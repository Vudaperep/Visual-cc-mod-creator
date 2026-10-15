import { useEffect, useMemo, useState } from 'react'
import registerSrc from '../../runtime/hooks/register.tsx?raw'
import configSrc from '../../runtime/hooks/config.ts?raw'
import typesSrc from '../../runtime/types/index.d.ts?raw'
import type { Panel, Widget, WidgetKind } from '../../runtime/hooks/config'
import { CodePanel } from '../components/CodePanel'
import { InstallPanel, OpenDialog } from '../components/Install'
import { generatePanel, slug } from './generate'
import { Preview } from './Preview'
import { GROUPS, makeWidget, samplePanel, WIDGET_BY_KIND, WIDGETS, type FieldSpec } from './widgets'

export const PANEL_STORAGE = 'visual-cc-mod-creator:panel'

function loadSaved(): Panel {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE)
    if (raw) return normalizePanel(JSON.parse(raw))
  } catch {
    /* fall through */
  }
  return samplePanel()
}

export function normalizePanel(raw: any): Panel {
  const base = samplePanel()
  const widgets: Widget[] = Array.isArray(raw?.widgets)
    ? raw.widgets.filter((w: any) => w && WIDGET_BY_KIND[w.kind as WidgetKind]).map((w: any) => ({ ...makeWidget(w.kind), ...w }))
    : base.widgets
  return { ...base, ...raw, widgets }
}

function ListField({ spec, rows, onChange }: { spec: FieldSpec; rows: Record<string, string>[]; onChange: (rows: Record<string, string>[]) => void }) {
  const cols = spec.columns!
  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (i === j ? { ...r, [k]: v } : r)))
  return (
    <div className="list-field">
      {rows.map((r, i) => (
        <div key={i} className="list-row">
          {cols.map(c =>
            c.kind === 'select' ? (
              <select key={c.key} className="field-input" value={r[c.key] ?? ''} onChange={e => set(i, c.key, e.target.value)} title={c.label}>
                {c.options!.map(o => (
                  <option key={o} value={o}>
                    {o || `${c.label}: default`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={c.key}
                className={`field-input ${c.wide ? 'is-wide' : ''}`}
                placeholder={c.label}
                value={r[c.key] ?? ''}
                onChange={e => set(i, c.key, e.target.value)}
                title={c.label}
              />
            ),
          )}
          <button className="icon" title="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, Object.fromEntries(cols.map(c => [c.key, c.options?.[0] ?? '']))])}>+ Row</button>
    </div>
  )
}

function Fields({ fields, value, onChange }: { fields: FieldSpec[]; value: Record<string, any>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      {fields.map(f => (
        <div key={f.key} className="field">
          {f.kind === 'bool' ? (
            <label className="check">
              <input type="checkbox" checked={!!value[f.key]} onChange={e => onChange({ [f.key]: e.target.checked })} /> {f.label}
            </label>
          ) : (
            <>
              <span className="field-label">{f.label}</span>
              {f.kind === 'text' && <input className="field-input" value={value[f.key] ?? ''} onChange={e => onChange({ [f.key]: e.target.value })} />}
              {f.kind === 'number' && (
                <input className="field-input" type="number" value={value[f.key] ?? 0} onChange={e => onChange({ [f.key]: Number(e.target.value) })} />
              )}
              {f.kind === 'textarea' && (
                <textarea className="field-input" rows={5} value={value[f.key] ?? ''} onChange={e => onChange({ [f.key]: e.target.value })} />
              )}
              {f.kind === 'select' && (
                <select className="field-input" value={value[f.key]} onChange={e => onChange({ [f.key]: e.target.value })}>
                  {f.options!.map(o => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}
              {f.kind === 'list' && <ListField spec={f} rows={value[f.key] ?? []} onChange={rows => onChange({ [f.key]: rows })} />}
            </>
          )}
          {f.hint && <span className="field-hint">{f.hint}</span>}
        </div>
      ))}
    </>
  )
}

const PANEL_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Panel title', kind: 'text' },
  { key: 'command', label: 'Command that opens it (no slash)', kind: 'text' },
  { key: 'description', label: 'Description', kind: 'text' },
  { key: 'refreshSec', label: 'Refresh every, seconds', kind: 'number' },
  { key: 'openOnStart', label: 'Open when a session starts', kind: 'bool' },
  { key: 'band', label: 'Summary line above the prompt', kind: 'bool' },
]

type Tab = 'inspect' | 'code' | 'install'

export function PanelEditor() {
  const [panel, setPanel] = useState<Panel>(loadSaved)
  const [isOpenShown, setOpenShown] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('inspect')

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_STORAGE, JSON.stringify(panel))
    } catch {
      /* ignore */
    }
  }, [panel])

  const files = useMemo(() => generatePanel(panel, { register: registerSrc, config: configSrc, types: typesSrc }), [panel])
  const widget = panel.widgets.find(w => w.id === selected) ?? null
  const name = slug(panel.name)

  const add = (kind: WidgetKind) => {
    const w = makeWidget(kind)
    setPanel(p => ({ ...p, widgets: [...p.widgets, w] }))
    setSelected(w.id)
    setTab('inspect')
  }
  const patchWidget = (id: string, patch: Record<string, unknown>) =>
    setPanel(p => ({ ...p, widgets: p.widgets.map(w => (w.id === id ? ({ ...w, ...patch } as Widget) : w)) }))
  const move = (from: number, to: number) =>
    setPanel(p => {
      const ws = [...p.widgets]
      const [w] = ws.splice(from, 1)
      ws.splice(to, 0, w!)
      return { ...p, widgets: ws }
    })
  const remove = (id: string) => {
    setPanel(p => ({ ...p, widgets: p.widgets.filter(w => w.id !== id) }))
    if (selected === id) setSelected(null)
  }

  const groups = GROUPS
  const idx = widget ? panel.widgets.indexOf(widget) : -1

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◆</span> Visual CC Mod Creator
        </div>
        <input className="mod-name" value={panel.name} onChange={e => setPanel({ ...panel, name: e.target.value })} title="Plugin name" />
        {name !== panel.name && <span className="muted small">→ {name}</span>}
        <div className="topbar-actions">
          <button
            onClick={() => {
              if (confirm('Start an empty panel?')) {
                setPanel({ ...samplePanel(), name: 'my-panel', title: 'My panel', command: 'my-panel', widgets: [] })
                setSelected(null)
              }
            }}
          >
            New
          </button>
          <button onClick={() => (setPanel(samplePanel()), setSelected(null))}>Example</button>
          <button onClick={() => setOpenShown(true)}>My panels</button>
          <button className="primary" onClick={() => setTab('install')}>
            Install ▸
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="palette">
          <div className="palette-list">
            {groups.map(g => (
              <section key={g} className="palette-group">
                <h3 style={{ color: '#d97757' }}>{g}</h3>
                {WIDGETS.filter(w => w.group === g).map(w => (
                  <button key={w.kind} className="palette-item" style={{ ['--c' as string]: '#d97757' }} onClick={() => add(w.kind)} title={w.description}>
                    <span className="palette-item-title">+ {w.title}</span>
                    <span className="palette-item-desc">{w.description}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
          <p className="palette-hint">Click a widget to add it to the panel</p>
        </aside>

        <div className="canvas">
          <Preview
            panel={panel}
            selected={selected}
            onSelect={id => {
              setSelected(id)
              if (id) setTab('inspect')
            }}
            onMove={move}
            onRemove={remove}
            onRename={title => setPanel(p => ({ ...p, title }))}
          />
        </div>

        <aside className="side">
          <nav className="tabs">
            <button className={tab === 'inspect' ? 'is-active' : ''} onClick={() => setTab('inspect')}>
              {widget ? 'Widget' : 'Panel'}
            </button>
            <button className={tab === 'code' ? 'is-active' : ''} onClick={() => setTab('code')}>
              Code
            </button>
            <button className={tab === 'install' ? 'is-active' : ''} onClick={() => setTab('install')}>
              Install
            </button>
          </nav>
          <div className="side-body">
            {tab === 'inspect' &&
              (widget ? (
                <div className="inspector">
                  <div className="inspector-head">
                    <h2>{WIDGET_BY_KIND[widget.kind].title}</h2>
                    <p>{WIDGET_BY_KIND[widget.kind].description}</p>
                  </div>
                  <Fields
                    fields={[{ key: 'title', label: 'Section title', kind: 'text' }, ...WIDGET_BY_KIND[widget.kind].fields]}
                    value={widget}
                    onChange={p => patchWidget(widget.id, p)}
                  />
                  <div className="inspector-actions">
                    <button disabled={idx <= 0} onClick={() => move(idx, idx - 1)}>
                      ↑ Up
                    </button>
                    <button disabled={idx >= panel.widgets.length - 1} onClick={() => move(idx, idx + 1)}>
                      ↓ Down
                    </button>
                    <button className="danger" onClick={() => remove(widget.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inspector">
                  <div className="inspector-head">
                    <h2>Panel</h2>
                    <p>
                      Opens with <code>/{slug(panel.command || name)}</code>. Click a section in the preview to set up its widget.
                    </p>
                  </div>
                  <Fields fields={PANEL_FIELDS} value={panel} onChange={p => setPanel(prev => ({ ...prev, ...p }))} />
                </div>
              ))}
            {tab === 'code' && <CodePanel files={files} />}
            {tab === 'install' && <InstallPanel name={name} command={slug(panel.command || name)} files={files} source={panel} />}
          </div>
        </aside>
      </div>

      {isOpenShown && (
        <OpenDialog
          onClose={() => setOpenShown(false)}
          onOpen={source => {
            setPanel(normalizePanel(source))
            setSelected(null)
            setOpenShown(false)
          }}
        />
      )}
    </div>
  )
}
