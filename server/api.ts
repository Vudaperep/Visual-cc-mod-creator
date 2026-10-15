import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** A folder marketplace the builder owns: every panel it installs lives here and is read from here. */
const MARKET = join(homedir(), '.claude', 'visual-cc-mod-creator')
const MARKET_NAME = 'visual-cc-mods'
const PLUGINS = join(MARKET, 'plugins')
/** Claude Code's plugin API declarations, copied here by `npm run sync-types`. */
const VENDOR_TYPES = join(ROOT, 'vendor', 'types')
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
/** The editor's own source of a panel, kept beside it so it can be opened again. */
export const SOURCE_FILE = 'visual-cc-mod-creator.json'

type Run = { code: number; out: string }

function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<Run> {
  return new Promise(res => {
    const p = spawn(cmd, args, { cwd: opts.cwd ?? homedir(), env: process.env })
    let out = ''
    p.stdout.on('data', d => (out += d))
    p.stderr.on('data', d => (out += d))
    const t = setTimeout(() => p.kill('SIGTERM'), opts.timeoutMs ?? 60_000)
    p.on('error', err => {
      clearTimeout(t)
      res({ code: -1, out: String(err) })
    })
    p.on('close', code => {
      clearTimeout(t)
      res({ code: code ?? -1, out })
    })
    p.stdin.end()
  })
}

const isSlug = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,47}$/.test(s)

function within(base: string, p: string) {
  const r = resolve(p)
  return r === base || r.startsWith(base + sep)
}

async function writeFiles(dir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const p = resolve(dir, rel)
    if (!within(dir, p) || rel.includes('..')) throw new Error(`bad path ${rel}`)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, content)
  }
}

/** Type-checks the mod in a scratch copy with the engine's declarations laid beside it. */
async function typecheck(files: Record<string, string>): Promise<Run> {
  if (!existsSync(join(VENDOR_TYPES, 'claude-code', 'index.d.ts')))
    return { code: 0, out: 'Skipped: no Claude Code types in vendor/types. Run `npm run sync-types` to enable this check.' }
  const tmp = await mkdtemp(join(tmpdir(), 'visual-cc-tsc-'))
  try {
    await writeFiles(tmp, files)
    await cp(VENDOR_TYPES, join(tmp, '.claude-plugin', 'types'), { recursive: true })
    await writeFile(join(tmp, 'tsconfig.json'), JSON.stringify({ extends: './.claude-plugin/types/tsconfig.json' }))
    const r = await run(process.execPath, [TSC, '-p', tmp], { timeoutMs: 120_000 })
    return { code: r.code, out: r.out.split(tmp + '/').join('') }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

function validate(dir: string): Promise<Run> {
  return run('claude', ['plugin', 'validate', dir], { timeoutMs: 60_000 })
}

// ── the marketplace ───────────────────────────────────────

type Installed = { id: string; enabled: boolean; scope: string }

async function installedMods(): Promise<Map<string, Installed>> {
  const r = await run('claude', ['plugin', 'list', '--json'])
  const map = new Map<string, Installed>()
  try {
    for (const p of JSON.parse(r.out) as Installed[]) {
      const [name, market] = p.id.split('@')
      if (market === MARKET_NAME && name) map.set(name, p)
    }
  } catch {
    /* no plugins */
  }
  return map
}

async function modDirs(): Promise<string[]> {
  return (await readdir(PLUGINS).catch(() => [] as string[])).filter(isSlug)
}

async function writeMarketplace() {
  const plugins = []
  for (const name of await modDirs()) {
    const manifest = JSON.parse(await readFile(join(PLUGINS, name, '.claude-plugin', 'plugin.json'), 'utf8').catch(() => '{}'))
    plugins.push({ name, source: `./plugins/${name}`, description: manifest.description ?? '', version: manifest.version ?? '0.1.0' })
  }
  await writeFiles(MARKET, {
    '.claude-plugin/marketplace.json':
      JSON.stringify(
        { name: MARKET_NAME, owner: { name: 'Visual CC Mod Creator' }, metadata: { description: 'Panels made with Visual CC Mod Creator' }, plugins },
        null,
        2,
      ) + '\n',
  })
}

async function ensureMarketplace(): Promise<Run | null> {
  const list = await run('claude', ['plugin', 'marketplace', 'list'])
  if (list.out.includes(MARKET)) return null
  return run('claude', ['plugin', 'marketplace', 'add', MARKET])
}

async function mods() {
  const installed = await installedMods()
  const out = []
  for (const name of await modDirs()) {
    const st = await stat(join(PLUGINS, name, SOURCE_FILE)).catch(() => null)
    out.push({
      name,
      mtimeMs: st?.mtimeMs ?? 0,
      installed: installed.has(name),
      enabled: installed.get(name)?.enabled ?? false,
      hasSource: !!st,
    })
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

async function install(body: { name?: string; files?: Record<string, string>; source?: unknown }) {
  const { name, files, source } = body
  if (!isSlug(name)) throw new Error('Mod name: lowercase latin letters, digits and dashes')
  if (!files || typeof files !== 'object') throw new Error('no files')
  const dir = join(PLUGINS, name)
  const tsc = await typecheck(files)
  // replace the generated files; anything the engine laid beside them stays
  await mkdir(dir, { recursive: true })
  for (const sub of ['hooks', 'types']) await rm(join(dir, sub), { recursive: true, force: true })
  await writeFiles(dir, { ...files, [SOURCE_FILE]: JSON.stringify(source, null, 2) + '\n' })
  const val = await validate(dir)
  const steps: { title: string; run: Run }[] = [
    { title: 'TypeScript', run: tsc },
    { title: 'claude plugin validate', run: val },
  ]
  if (val.code !== 0) return { dir, steps, installed: false, wasInstalled: false }

  await writeMarketplace()
  const added = await ensureMarketplace()
  if (added) steps.push({ title: `Marketplace ${MARKET_NAME} added`, run: added })
  else steps.push({ title: 'Marketplace updated', run: await run('claude', ['plugin', 'marketplace', 'update', MARKET_NAME]) })

  const before = await installedMods()
  const wasInstalled = before.has(name)
  if (!wasInstalled) {
    steps.push({ title: 'claude plugin install', run: await run('claude', ['plugin', 'install', `${name}@${MARKET_NAME}`, '--scope', 'user'], { timeoutMs: 120_000 }) })
  } else if (!before.get(name)!.enabled) {
    steps.push({ title: 'claude plugin enable', run: await run('claude', ['plugin', 'enable', `${name}@${MARKET_NAME}`]) })
  }
  const installed = (await installedMods()).has(name)
  return { dir, steps, installed, wasInstalled }
}

async function uninstall(body: { name?: string; deleteFiles?: boolean }) {
  if (!isSlug(body.name)) throw new Error('bad name')
  const r = await run('claude', ['plugin', 'uninstall', `${body.name}@${MARKET_NAME}`])
  if (body.deleteFiles) {
    await rm(join(PLUGINS, body.name), { recursive: true, force: true })
    await writeMarketplace()
  }
  return { run: r }
}

async function check(body: { files?: Record<string, string> }) {
  if (!body.files) throw new Error('no files')
  const tmp = await mkdtemp(join(tmpdir(), 'visual-cc-check-'))
  try {
    await writeFiles(tmp, body.files)
    const [tsc, val] = await Promise.all([typecheck(body.files), validate(tmp)])
    return {
      steps: [
        { title: 'TypeScript', run: tsc },
        { title: 'claude plugin validate', run: { ...val, out: val.out.split(tmp).join('<mod>') } },
      ],
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

/** Opens a new Terminal window with a fresh claude session (installed panels load in it). macOS only. */
async function launch(body: { cwd?: string }) {
  if (process.platform !== 'darwin') throw new Error('Opening a terminal window is supported on macOS only. Run `claude` yourself.')
  const cwd = body.cwd ? resolve(String(body.cwd).replace(/^~(?=$|\/)/, homedir())) : homedir()
  const sh = `cd ${JSON.stringify(cwd)} && claude`
  const script = `tell application "Terminal" to do script ${JSON.stringify(sh)}\ntell application "Terminal" to activate`
  const r = await run('osascript', ['-e', script])
  if (r.code !== 0) throw new Error(r.out)
  return { command: sh }
}

async function readJson(req: IncomingMessage): Promise<any> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/** The builder's local API, served by the Vite dev server on 127.0.0.1 only. */
export function modCreatorApi(): Plugin {
  return {
    name: 'visual-cc-mod-creator-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, nextMw) => {
        if (!req.url?.startsWith('/api/')) return nextMw()
        const url = new URL(req.url, 'http://x')
        try {
          switch (`${req.method} ${url.pathname}`) {
            case 'GET /api/mods':
              return send(res, 200, { mods: await mods(), dir: PLUGINS })
            case 'GET /api/mod': {
              const name = url.searchParams.get('name')
              if (!isSlug(name)) throw new Error('bad name')
              return send(res, 200, { source: JSON.parse(await readFile(join(PLUGINS, name, SOURCE_FILE), 'utf8')) })
            }
            case 'POST /api/install':
              return send(res, 200, await install(await readJson(req)))
            case 'POST /api/uninstall':
              return send(res, 200, await uninstall(await readJson(req)))
            case 'POST /api/check':
              return send(res, 200, await check(await readJson(req)))
            case 'POST /api/launch':
              return send(res, 200, await launch(await readJson(req)))
            default:
              return send(res, 404, { error: 'not found' })
          }
        } catch (err) {
          return send(res, 400, { error: err instanceof Error ? err.message : String(err) })
        }
      })
    },
  }
}
