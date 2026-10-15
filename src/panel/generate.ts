import type { Panel } from '../../runtime/hooks/config'

export type RuntimeSources = { register: string; config: string; types: string }

/** A plugin or command name: lowercase latin, digits and dashes. */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'my-panel'

/** The panel's files: the widget runtime with this panel's config and names written in. */
export function generatePanel(p: Panel, rt: RuntimeSources): Record<string, string> {
  const name = slug(p.name)
  const command = slug(p.command || name)
  const config: Panel = { ...p, name, command }
  const sub = (s: string) => s.split('__MOD__').join(name).split('__CMD__').join(command)
  const register = sub(rt.register).replace(/\/\*PANEL\*\/[\s\S]*?\/\*END\*\//, JSON.stringify(config, null, 2))
  return {
    '.claude-plugin/plugin.json':
      JSON.stringify({ name, version: '0.1.0', description: p.description || `${p.title}: a pane made with Visual CC Mod Creator`, types: './types/index.d.ts' }, null, 2) + '\n',
    'hooks/hooks.json': JSON.stringify({ modules: ['./register.tsx'] }) + '\n',
    'hooks/register.tsx': register,
    'hooks/config.ts': rt.config,
    'types/index.d.ts': sub(rt.types),
  }
}
