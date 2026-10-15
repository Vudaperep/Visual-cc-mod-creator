// Copies Claude Code's own plugin API declarations into vendor/types, so the builder can type-check
// the mods it generates. They are written by Claude Code on this machine and are not part of this repo.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'vendor', 'types')

/** Folders a loaded mod's types are laid in: <mod>/.claude-plugin/types/claude-code/index.d.ts */
function modTypeDirs() {
  const found = []
  const bases = [join(homedir(), '.claude', 'dev-mods'), join(homedir(), '.claude', 'visual-cc-mod-creator', 'plugins'), join(homedir(), '.claude', 'plugins', 'cache')]
  const walk = (dir, depth) => {
    if (depth < 0 || !existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      const types = join(p, '.claude-plugin', 'types')
      if (existsSync(join(types, 'claude-code', 'index.d.ts'))) found.push({ dir: types, mtime: statSync(join(types, 'claude-code', 'index.d.ts')).mtimeMs })
      else walk(p, depth - 1)
    }
  }
  for (const b of bases) walk(b, 4)
  return found.sort((a, b) => b.mtime - a.mtime)
}

// The copy the plugin-authoring skill writes when it loads:
// <tmp>/claude-<uid>/bundled-skills/<ver>/<hash>/plugin-authoring/types/claude-code.d.ts
function skillTypeFiles() {
  const found = []
  for (const base of ['/private/tmp', '/tmp', tmpdir()]) {
    if (!existsSync(base)) continue
    for (const c of readdirSync(base).filter(n => n.startsWith('claude-'))) {
      const bs = join(base, c, 'bundled-skills')
      if (!existsSync(bs)) continue
      for (const ver of readdirSync(bs))
        for (const h of readdirSync(join(bs, ver))) {
          const f = join(bs, ver, h, 'plugin-authoring', 'types', 'claude-code.d.ts')
          if (existsSync(f)) found.push({ file: f, mtime: statSync(f).mtimeMs })
        }
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime)
}

const mods = modTypeDirs()
if (mods.length) {
  mkdirSync(OUT, { recursive: true })
  cpSync(mods[0].dir, OUT, { recursive: true })
  console.log(`Copied types from ${mods[0].dir}`)
} else {
  const skill = skillTypeFiles()
  if (!skill.length) {
    console.error('No Claude Code plugin types found. Install any panel once (the engine lays its types beside it), or load the plugin-authoring skill in a session, then run this again.')
    process.exit(1)
  }
  mkdirSync(join(OUT, 'claude-code'), { recursive: true })
  cpSync(skill[0].file, join(OUT, 'claude-code', 'index.d.ts'))
  for (const extra of ['claude-code-tools', 'claude-code-mcp']) {
    mkdirSync(join(OUT, extra), { recursive: true })
    writeFileSync(join(OUT, extra, 'index.d.ts'), 'export {}\n')
  }
  console.log(`Copied types from ${skill[0].file}`)
}
// a tsconfig the generated mod extends while it is type-checked
const tsconfig = {
  compilerOptions: {
    target: 'es2023', lib: ['es2023'], module: 'esnext', moduleResolution: 'bundler', strict: true, noUncheckedIndexedAccess: true,
    noEmit: true, skipLibCheck: true, jsx: 'react', jsxFactory: 'h', jsxFragmentFactory: 'Fragment', typeRoots: ['.'],
    types: ['claude-code', 'claude-code-tools', 'claude-code-mcp'],
  },
  include: ['../../hooks', '../../types', '../../tests'],
}
writeFileSync(join(OUT, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n')
