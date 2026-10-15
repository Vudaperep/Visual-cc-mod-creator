import { useEffect, useState } from 'react'
import { api, type InstallResult, type ModEntry, type Step } from '../api'

function StepView({ step }: { step: Step }) {
  const ok = step.run.code === 0
  return (
    <details className={`run ${ok ? 'is-ok' : 'is-fail'}`} open={!ok}>
      <summary>
        <span className="run-dot" /> {step.title}: {ok ? 'ok' : `failed (exit ${step.run.code})`}
      </summary>
      <pre className="code small">{step.run.out.trim() || '(empty)'}</pre>
    </details>
  )
}

export const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

/** One button: check, write to the builder's marketplace, install for every session. */
export function InstallPanel({ name, command, files, source }: { name: string; command: string; files: Record<string, string>; source: unknown }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<InstallResult | null>(null)
  const [checked, setChecked] = useState<Step[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<ModEntry | null>(null)
  const [launched, setLaunched] = useState(false)

  useEffect(() => {
    void api.mods().then(r => setExisting(r.mods.find(m => m.name === name) ?? null))
  }, [name, result])

  const act = async (what: string, fn: () => Promise<void>) => {
    setBusy(what)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="build-panel">
      <section>
        <h3>Install</h3>
        <p className="muted">
          The panel is installed into Claude Code as a regular plugin (from a local marketplace in <code>~/.claude/visual-cc-mod-creator</code>) and works in{' '}
          <b>every</b> session.
        </p>
        <ul className="muted how">
          <li>New sessions: right away.</li>
          <li>
            Sessions already open: after <code>/reload-plugins</code>.
          </li>
          <li>Installing again updates it in place.</li>
        </ul>
        {existing?.installed && (
          <p className="status-line">
            <span className="run-dot" /> “{name}” is installed{existing.enabled ? '' : ' (disabled)'}; the button updates it.
          </p>
        )}
      </section>

      <div className="build-actions">
        <button
          className="primary big"
          disabled={!!busy}
          onClick={() =>
            act('install', async () => {
              setResult(await api.install({ name, files, source }))
              setChecked(null)
            })
          }
        >
          {busy === 'install' ? 'Installing…' : existing?.installed ? 'Update panel' : 'Install into Claude Code'}
        </button>
        <button disabled={!!busy} onClick={() => act('check', async () => setChecked((await api.check(files)).steps))}>
          {busy === 'check' ? 'Checking…' : 'Check only'}
        </button>
      </div>
      {error && <div className="warn-box">{error}</div>}

      {checked && (
        <section>
          <h3>Check</h3>
          {checked.map(s => (
            <StepView key={s.title} step={s} />
          ))}
        </section>
      )}

      {result && (
        <section>
          <h3>{result.installed ? (result.wasInstalled ? 'Updated' : 'Installed') : 'Not installed'}</h3>
          {result.steps.map(s => (
            <StepView key={s.title} step={s} />
          ))}
          {result.installed && (
            <div className="next-box">
              <b>Next:</b> in an open session run <code>/reload-plugins</code>, then <code>/{command}</code>. Or start a new session:
              <div className="build-actions">
                <button
                  disabled={!!busy}
                  onClick={() =>
                    act('launch', async () => {
                      await api.launch()
                      setLaunched(true)
                    })
                  }
                >
                  Open a new session in a terminal
                </button>
              </div>
              {launched && <span className="muted">Opened.</span>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export function OpenDialog({ onOpen, onClose }: { onOpen: (source: unknown) => void; onClose: () => void }) {
  const [mods, setMods] = useState<ModEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => api.mods().then(r => setMods(r.mods))
  useEffect(() => void load(), [])
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>My panels</h2>
        <p className="muted">Everything you installed from this builder.</p>
        {!mods && <p className="muted">Loading…</p>}
        {mods?.length === 0 && <p className="muted">Nothing installed yet.</p>}
        {error && <div className="warn-box">{error}</div>}
        <div className="open-list">
          {mods?.map(m => (
            <div key={m.name} className="open-item">
              <div>
                <b>{m.name}</b>{' '}
                <span className="muted">
                  {m.installed ? (m.enabled ? 'installed' : 'disabled') : 'not installed'} · {ago(m.mtimeMs)}
                </span>
              </div>
              <div className="open-actions">
                <button disabled={!m.hasSource} onClick={() => api.mod(m.name).then(onOpen, e => setError(String(e)))}>
                  Open
                </button>
                {m.installed && (
                  <button
                    className="danger"
                    onClick={async () => {
                      if (!confirm(`Uninstall “${m.name}” from Claude Code?`)) return
                      await api.uninstall(m.name, false)
                      void load()
                    }}
                  >
                    Uninstall
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
