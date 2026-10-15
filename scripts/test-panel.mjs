// Generates a panel with every widget, then type-checks, validates and render-tests it against Claude Code.
// Runs anywhere Node and the claude CLI run: no sh, no Python.
//   node scripts/test-panel.mjs
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(tmpdir(), 'visual-cc-test-'))
const OUT = join(WORK, 'all-widgets')
const IS_WINDOWS = process.platform === 'win32'

function sh(cmd, args, label) {
  // on Windows `claude` may be an npm shim (claude.cmd), which only a shell finds
  const viaShell = IS_WINDOWS && cmd === 'claude'
  const quoted = viaShell ? args.map(a => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)) : args
  const r = spawnSync(cmd, quoted, { encoding: 'utf8', shell: viaShell })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0) {
    console.error(out || String(r.error))
    throw new Error(`${label} failed`)
  }
  return out
}

/** Sample data for every value the runtime keeps, so the render test draws every row of every widget. */
function seed(registerFile) {
  let src = readFileSync(registerFile, 'utf8')
  const panel = JSON.parse(src.slice(src.indexOf('const PANEL: Panel = ') + 'const PANEL: Panel = '.length, src.indexOf('\n\nconst PANE ')))
  const N = '1_800_000_000_000'
  const data = {
    agents: `[{ id: 'a1', description: 'refactor auth', type: 'general-purpose', status: 'running', firstSeenMs: ${N} - 60000, steps: 3, tools: 9, outTokens: 2000, ctxTokens: 38000, model: 'claude-sonnet-5-5', lastTool: 'Edit' }, { id: 'a2', description: 'done one', type: 'Explore', status: 'completed', firstSeenMs: ${N} - 900000, endedMs: ${N} - 10000, steps: 9, tools: 41, outTokens: 12000, ctxTokens: 101000, durationMs: 336000 }]`,
    tools: `[{ id: 't1', tool: 'Bash', detail: 'npm test', startedMs: ${N} - 3000, endedMs: ${N}, isError: true, denied: false }, { id: 't2', tool: 'Read', detail: 'x', startedMs: ${N}, agentId: 'a1' }]`,
    usage: `{ startedAt: ${N} - 3600000, tokens: 92000, window: 200000, percent: 46, usd: 3.41, limits: [{ kind: 'five_hour', percentUsed: 31, resetsAt: '23:00' }] }`,
    git: `{ branch: 'main', ahead: 2, behind: 1, files: [' M a.ts', '?? b/', ' D c.ts'], last: 'abc fix' }`,
    peers: `[{ pid: 1, sessionId: 's1', name: 'me', cwd: '/Users/x/p', status: 'busy', kind: 'interactive', updatedAt: ${N}, isSelf: true }, { pid: 2, sessionId: 's2', name: 'other', cwd: '/Users/x/q', status: 'idle', kind: 'interactive', updatedAt: ${N} - 5000, isSelf: false }]`,
    info: `{ model: 'claude-opus-5-5', turns: 4, cwd: '/Users/x/p', sessionId: 's1' }`,
    messages: `[{ role: 'user', text: 'hello there', tools: [] }, { role: 'assistant', text: 'hi', tools: ['Read', 'Bash'] }, { role: 'assistant', text: '', tools: ['Edit'] }]`,
    inventory: `{ tools: [{ name: 'Bash', mcp: false }, { name: 'mcp__x__y', mcp: true }], commands: [{ name: 'compact', description: 'Compact the conversation' }, { name: 'cost', description: 'Show cost' }] }`,
    turn: `{ id: 'turn1', startedMs: ${N} - 42000 }`,
    ctxHistory: `[10, 20, 35, 46, 60, 85]`,
  }
  const diff = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n-old\n+new\n ctx'
  const outputs = {}
  const expanded = {}
  const notes = {}
  for (const w of panel.widgets) {
    if (['ask', 'aiAction', 'selection'].includes(w.kind)) outputs[w.id] = '**answer** text'
    else if (w.kind === 'nextStep') outputs[w.id] = 'Run the tests'
    else if (w.kind === 'diff') outputs[w.id] = diff
    else if (['http', 'mcp', 'shell', 'file'].includes(w.kind)) outputs[w.id] = '200 · ok'
    if (w.kind === 'inventory') expanded[w.id] = true
    if (w.kind === 'notes') notes[w.id] = ['one', 'two']
  }
  Object.assign(data, { outputs: JSON.stringify(outputs), expanded: JSON.stringify(expanded), notes: JSON.stringify(notes) })
  for (const [key, value] of Object.entries(data)) {
    const re = new RegExp(`(const S_${key} = atom\\(\\{ plugin: '[\\w-]+', key: '${key}' \\} as const, )(.*?)\\)\\n`)
    if (!re.test(src)) throw new Error(`no atom ${key}`)
    src = src.replace(re, (_, head) => `${head}${value} as any)\n`)
  }
  writeFileSync(registerFile, src)
}

try {
  // 1. generate
  const smoke = join(WORK, 'smoke.mjs')
  await build({ entryPoints: [join(ROOT, 'scripts', 'panel-smoke.ts')], bundle: true, platform: 'node', format: 'esm', outfile: smoke, logLevel: 'warning' })
  process.argv[2] = OUT
  process.argv[3] = ROOT
  await import(pathToFileURL(smoke).href)
  console.log('generated a panel with every widget')

  // 2. type-check against Claude Code's declarations
  const types = join(ROOT, 'vendor', 'types')
  if (!existsSync(join(types, 'claude-code', 'index.d.ts'))) sh(process.execPath, [join(ROOT, 'scripts', 'sync-types.mjs')], 'sync-types')
  cpSync(types, join(OUT, '.claude-plugin', 'types'), { recursive: true })
  writeFileSync(join(OUT, 'tsconfig.json'), JSON.stringify({ extends: './.claude-plugin/types/tsconfig.json' }))
  sh(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', OUT], 'tsc')
  rmSync(join(OUT, '.claude-plugin', 'types'), { recursive: true, force: true })
  rmSync(join(OUT, 'tsconfig.json'))
  console.log('tsc ok')

  // 3. validate the way the engine reads it
  const validated = sh('claude', ['plugin', 'validate', OUT], 'claude plugin validate')
  console.log(validated.trim().split('\n').pop())

  // 4. render and behaviour tests with sample data
  seed(join(OUT, 'hooks', 'register.tsx'))
  mkdirSync(join(OUT, 'tests'), { recursive: true })
  cpSync(join(ROOT, 'scripts', 'panel.test.ts'), join(OUT, 'tests', 'render.test.ts'))
  console.log(sh('claude', ['plugin', 'test', OUT], 'claude plugin test').trim())
} finally {
  rmSync(WORK, { recursive: true, force: true })
}
