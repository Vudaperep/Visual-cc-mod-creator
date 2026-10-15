export type Run = { code: number; out: string }
export type Step = { title: string; run: Run }
export type InstallResult = { dir: string; steps: Step[]; installed: boolean; wasInstalled: boolean }
export type ModEntry = { name: string; mtimeMs: number; installed: boolean; enabled: boolean; hasSource: boolean }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  return json as T
}

export const api = {
  mods: () => call<{ mods: ModEntry[]; dir: string }>('/api/mods'),
  /** The panel a mod was built from. */
  mod: (name: string) => call<{ source: unknown }>(`/api/mod?name=${encodeURIComponent(name)}`).then(r => r.source),
  install: (body: { name: string; files: Record<string, string>; source: unknown }) => call<InstallResult>('/api/install', body),
  uninstall: (name: string, deleteFiles: boolean) => call<{ run: Run }>('/api/uninstall', { name, deleteFiles }),
  check: (files: Record<string, string>) => call<{ steps: Step[] }>('/api/check', { files }),
  launch: (cwd?: string) => call<{ command: string }>('/api/launch', { cwd }),
}
