import { useState, type ReactNode } from 'react'
import type { Panel, Widget } from '../../runtime/hooks/config'
import { WIDGET_BY_KIND } from './widgets'

/** Claude Code's dark theme, roughly: what each ThemeKey the runtime uses looks like. */
const C = {
  claude: '#d77757',
  suggestion: '#b1b9f9',
  warning: '#ffc107',
  remember: '#b1b9f9',
  permission: '#b1b9f9',
  merged: '#af87ff',
  success: '#4eba65',
  error: '#ff6b80',
  subtle: '#888',
  text: '#e6e6e6',
  bash: '#fd5db1',
  added: '#38a660',
  removed: '#b3596b',
}

const T = ({ c, b, dim, children }: { c?: string; b?: boolean; dim?: boolean; children: ReactNode }) => (
  <span style={{ color: dim ? C.subtle : c, fontWeight: b ? 700 : undefined }}>{children}</span>
)
const Btn = ({ children, primary, plain }: { children: ReactNode; primary?: boolean; plain?: boolean }) => (
  <span className="t-btn" style={{ color: primary ? C.claude : undefined }}>
    {plain ? children : <>[ {children} ]</>}
  </span>
)
const Line = ({ children }: { children?: ReactNode }) => <div className="t-line">{children ?? ' '}</div>
const Field = ({ label, placeholder }: { label: string; placeholder: string }) => (
  <Line>
    <T dim>{label}: </T>
    <span className="t-field">{placeholder}</span>
  </Line>
)
const bar = (pct: number, w = 16) => '█'.repeat(Math.round((pct / 100) * w)) + '░'.repeat(w - Math.round((pct / 100) * w))

function WidgetPreview({ w, panelName }: { w: Widget; panelName: string }) {
  switch (w.kind) {
    case 'note':
      return (
        <>
          {w.text.split('\n').map((l, i) => (
            <Line key={i}>{l.split(/(\*\*[^*]+\*\*)/).map((p, j) => (p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p))}</Line>
          ))}
        </>
      )
    case 'agents':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title} · 1 running
            </T>
          </Line>
          <Line>
            <T c={C.suggestion}>◐</T> refactor auth module <Btn plain>Open</Btn>
          </Line>
          <Line>
            <T dim>{'  '}general-purpose · claude-sonnet-5-5 · running · ⏱ 1m 12s · ctx 38k · out 2k · 9 tools · Edit</T>
          </Line>
          {w.showDone && (
            <>
              <Line>
                <T dim>✓</T> add token usage per run <Btn plain>Open</Btn>
              </Line>
              <Line>
                <T dim>{'  '}general-purpose · claude-opus-5-5 · completed · ⏱ 5m 36s · ctx 101k · out 12k · 41 tools</T>
              </Line>
            </>
          )}
          {w.allowMessage && (
            <>
              <Field label="To agent" placeholder="refactor auth module ▾" />
              <Field label="Message" placeholder="Enter to send to the agent" />
            </>
          )}
        </>
      )
    case 'spawn': {
      const types = w.types.split(',').map(s => s.trim()).filter(Boolean)
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          {w.presets.length > 0 && (
            <Line>
              {w.presets.map((p, i) => (
                <Btn key={i}>{p.label || '…'}</Btn>
              ))}
            </Line>
          )}
          {w.freeInput && types.length > 1 && <Field label="Type" placeholder={`${types[0]} ▾`} />}
          {w.freeInput && <Field label="Task" placeholder="What should the agent do? Enter to start" />}
        </>
      )
    }
    case 'sessions':
      return (
        <>
          <Line>
            <T c={C.remember} b>
              {w.title} · {w.hideSelf ? 2 : 3}
            </T>
          </Line>
          {!w.hideSelf && (
            <Line>
              <T c={C.warning}>◐</T> <b>web-app</b> <T dim>busy · ~/code/web-app · 2s ago · this one</T>
            </Line>
          )}
          <Line>
            <T c={C.success}>●</T> api-refactor <T dim>idle · ~/code/api · 4m 10s ago</T>
          </Line>
          <Line>
            <T c={C.success}>●</T> docs-site <T dim>idle · ~/code/docs · 12m 3s ago</T>
          </Line>
          {w.allowSend && (
            <>
              <Field label="To" placeholder="api-refactor ▾" />
              <Field label="Message" placeholder="Enter to send" />
            </>
          )}
        </>
      )
    case 'newSession':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title}
            </T>
          </Line>
          <Line>
            <Btn primary>{w.label || 'New session'}</Btn> <T dim>{w.app} · {w.cwd || 'this folder'}</T>
          </Line>
          <Field label="First prompt" placeholder={w.prompt || 'optional'} />
        </>
      )
    case 'usage':
      return (
        <>
          <Line>
            <T c={C.permission} b>
              {w.title}
            </T>
          </Line>
          <Line>
            <T c={C.success}>{bar(46)}</T> context 46% · 92k / 200k
          </Line>
          {w.showCost && <Line>cost $3.41</Line>}
          {w.showLimits && (
            <>
              <Line>
                <T dim>{bar(31)}</T> five_hour 31% · resets 23:00
              </Line>
              <Line>
                <T dim>{bar(12)}</T> seven_day 12%
              </Line>
            </>
          )}
        </>
      )
    case 'session':
      return (
        <>
          <Line>
            <T b>{w.title}</T>
          </Line>
          <Line>claude-opus-5-5 · 14 turns · 1h 3m · ~/code/web-app</Line>
        </>
      )
    case 'git': {
      const files = [' M src/App.tsx', ' M server/api.ts', '?? src/panel/', ' D old.ts', ' M README.md', 'A  runtime/x.ts', ' M package.json']
      return (
        <>
          <Line>
            <T c={C.merged} b>
              {w.title}
            </T>
          </Line>
          <Line>
            <b>main</b>
            <T c={C.success}> ↑2</T> · {files.length} changed
          </Line>
          {files.slice(0, w.maxFiles).map(f => (
            <Line key={f}>
              <T c={f.startsWith('??') ? C.subtle : f.includes('D') ? C.removed : C.added}>
                {'  '}
                {f}
              </T>
            </Line>
          ))}
          {files.length > w.maxFiles && (
            <Line>
              <T dim>{`  …${files.length - w.maxFiles} more`}</T>
            </Line>
          )}
          <Line>
            <T dim>a1b2c3d Add panel builder · 2 hours ago</T>
          </Line>
        </>
      )
    }
    case 'tools': {
      const rows = [
        ['✓', C.success, 'Read', 'src/App.tsx · 0s', false],
        ['✓', C.success, 'Bash', 'npm test · 14s', false],
        ['✗', C.error, 'Bash', 'git push · 2s', false],
        ['◐', C.suggestion, 'Grep', 'TODO · 1s · agent', true],
        ['✓', C.success, 'Edit', 'server/api.ts · 0s', false],
      ] as const
      return (
        <>
          <Line>
            <T c={C.bash} b>
              {w.title}
            </T>
          </Line>
          {rows
            .filter(r => !w.agentsOnly || r[4])
            .slice(0, w.count)
            .map((r, i) => (
              <Line key={i}>
                <T c={r[1]}>{r[0]}</T> <b>{r[2]}</b> <T dim>{r[3]}</T>
              </Line>
            ))}
        </>
      )
    }
    case 'prompts':
    case 'commands':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          <Line>
            {w.presets.map((p, i) => (
              <Btn key={i}>{p.label || ('command' in p ? `/${p.command}` : '…')}</Btn>
            ))}
          </Line>
          {w.kind === 'commands' && w.picker && (
            <Line>
              <T dim>Any command: </T>
              <span className="t-field">/compact ▾</span> <Btn>Run</Btn>
            </Line>
          )}
        </>
      )
    case 'shell':
      return (
        <>
          <Line>
            <T c={C.bash} b>
              {w.title}
            </T>{' '}
            <T dim>$ {w.command}</T> <Btn plain>↻</Btn> <Btn plain>−</Btn>
          </Line>
          {Array.from({ length: Math.min(w.lines, 4) }, (_, i) => (
            <Line key={i}>
              <T dim>…output line {i + 1}</T>
            </Line>
          ))}
        </>
      )
    case 'file':
      return (
        <>
          <Line>
            <T b>
              {w.title} · {w.path}
            </T>
          </Line>
          {['# TODO', '- [ ] agents panel', '- [x] install'].slice(0, w.lines).map(l => (
            <Line key={l}>{l}</Line>
          ))}
        </>
      )
    case 'agentTypes':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title} · {w.presets.length}
            </T>
          </Line>
          {w.presets.map((a, i) => (
            <Line key={i}>
              <Btn plain>▶ {a.name || '…'}</Btn> <T dim>{a.description}{a.model ? ` · ${a.model}` : ''}</T>
            </Line>
          ))}
          <Field label="Task for ▶" placeholder="optional" />
        </>
      )
    case 'control':
      return (
        <>
          <Line>
            <T c={C.warning} b>
              {w.title} · working 42s
            </T>
          </Line>
          <Line>
            {w.stop && <Btn primary>■ Stop</Btn>}
            {w.compact && <Btn>Compact</Btn>}
            {w.clear && <Btn>/clear</Btn>}
          </Line>
          {w.compact && <Field label="What to keep when compacting" placeholder="optional" />}
        </>
      )
    case 'messages': {
      const ms = [
        ['u', 'add a widget for every capability'],
        ['a', 'Adding 21 widgets: agents, AI, data, behaviour…'],
        ['u', 'check that everything renders'],
        ['a', 'Tests pass on 4 surfaces. · 6 tools'],
      ].slice(-w.count)
      return (
        <>
          <Line>
            <T b>{w.title}</T>
          </Line>
          {ms.map(([r, t], i) => (
            <Line key={i}>
              <T c={r === 'u' ? C.suggestion : C.claude}>{r === 'u' ? '›' : '◆'}</T> {t}
            </Line>
          ))}
        </>
      )
    }
    case 'contextChart':
      return (
        <>
          <Line>
            <T c={C.permission} b>
              {w.title} · 46%
            </T>
          </Line>
          <Line>
            <T c={C.success}>{'▁▁▂▂▂▃▃▄▂▂▃▃▄▄▅▄'.slice(0, Math.max(4, Math.min(16, w.points)))}</T>
          </Line>
        </>
      )
    case 'diff':
      return (
        <>
          <Line>
            <T c={C.merged} b>
              {w.title}
            </T>{' '}
            <Btn plain>↻</Btn>
          </Line>
          <Line>
            <T dim>@@ -12,7 +12,9 @@ export function App() {'{'}</T>
          </Line>
          <Line>
            <T c={C.removed}>- const [tab, setTab] = useState('code')</T>
          </Line>
          <Line>
            <T c={C.added}>+ const [tab, setTab] = useState('inspect')</T>
          </Line>
        </>
      )
    case 'inventory':
      return (
        <Line>
          <T b>{w.title}</T> <T dim>42 tools (27 MCP) · 58 commands</T> <Btn plain>list</Btn> <Btn plain>↻</Btn>
        </Line>
      )
    case 'ask':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title}
            </T>
          </Line>
          {w.presets.length > 0 && (
            <Line>
              {w.presets.map((p, i) => (
                <Btn key={i}>{p.label || '…'}</Btn>
              ))}
            </Line>
          )}
          {w.freeInput && <Field label="Question" placeholder="Ask about this session… Enter" />}
          <Line>We are building a panel builder and adding a widget for every API capability.</Line>
          <Line>
            <Btn plain>Copy</Btn> <Btn plain>To prompt</Btn> <Btn plain>×</Btn>
          </Line>
        </>
      )
    case 'aiAction':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title}
            </T>
          </Line>
          <Line>
            {w.presets.map((p, i) => (
              <Btn key={i}>{p.label || '…'}</Btn>
            ))}
          </Line>
          <Line>feat(panel): add 21 widgets to the panel builder</Line>
          <Line>
            <Btn plain>Copy</Btn> <Btn plain>To prompt</Btn> <Btn plain>×</Btn>
          </Line>
        </>
      )
    case 'nextStep':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title}
            </T>{' '}
            <Btn plain>● on</Btn> <Btn plain>↻</Btn>
          </Line>
          <Line>
            Run the tests and show what fails <Btn plain>Insert</Btn>
          </Line>
        </>
      )
    case 'selection':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          {w.quote && (
            <Line>
              <Btn>Quote the selection into the prompt</Btn>
            </Line>
          )}
          {w.ask && <Field label="Ask about the selection" placeholder="What does this do? Enter" />}
        </>
      )
    case 'choice':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          <Line>
            <Btn>{w.label || w.question}</Btn>
          </Line>
        </>
      )
    case 'snippets':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          <Line>
            {w.presets.map((p, i) => (
              <Btn key={i}>⧉ {p.label || '…'}</Btn>
            ))}
          </Line>
        </>
      )
    case 'image':
      return (
        <>
          <Line>
            <T b>{w.title}</T>
          </Line>
          <div className="t-image" style={{ width: `${Math.min(w.columns, 100)}ch`, height: `${w.rows * 1.45}em` }}>
            🖼 {w.path}
          </div>
        </>
      )
    case 'links':
      return (
        <>
          <Line>
            <T c={C.suggestion} b>
              {w.title}
            </T>
          </Line>
          {w.presets.map((l, i) => (
            <Line key={i}>
              <span className="t-link">{l.label || l.url}</span>
            </Line>
          ))}
        </>
      )
    case 'http':
      return (
        <>
          <Line>
            <T c={C.remember} b>
              {w.title}
            </T>{' '}
            <Btn plain>↻</Btn>
          </Line>
          <Line>200 · All Systems Operational</Line>
        </>
      )
    case 'mcp':
      return (
        <>
          <Line>
            <T c={C.remember} b>
              {w.title}
            </T>{' '}
            <T dim>
              {w.server || 'server'} · {w.tool || 'tool'}
            </T>{' '}
            <Btn plain>↻</Btn>
          </Line>
          <Line>
            <T dim>…the tool’s result</T>
          </Line>
        </>
      )
    case 'notes':
      return (
        <>
          <Line>
            <T c={C.warning} b>
              {w.title} · 2
            </T>
          </Line>
          <Line>
            • update the README <Btn plain>×</Btn>
          </Line>
          <Line>
            • ask about rate limits <Btn plain>×</Btn>
          </Line>
          <Field label="Note" placeholder="Kept across sessions. Enter" />
        </>
      )
    case 'voice':
      return (
        <>
          <Line>
            <T c={C.claude} b>
              {w.title}
            </T>{' '}
            <Btn plain>● on</Btn>
          </Line>
          <Line>
            <T dim>
              turns over {w.minSeconds}s →{w.speak ? ` say “${w.speak}”` : ''}
              {w.notify ? ' + notification' : ''}
            </T>
          </Line>
        </>
      )
    case 'guard':
      return (
        <>
          <Line>
            <T c={C.error} b>
              {w.title}
            </T>{' '}
            <Btn plain>● on</Btn> <T dim>blocked: 1</T>
          </Line>
          {w.rules.map((r, i) => (
            <Line key={i}>
              <T dim>
                {'  '}
                {r.tool || '*'} ~ /{r.pattern}/ → {r.reason}
              </T>
            </Line>
          ))}
        </>
      )
    case 'systemPrompt':
      return (
        <>
          <Line>
            <T c={C.permission} b>
              {w.title}
            </T>{' '}
            <Btn plain>● on</Btn>
          </Line>
          <Line>
            <T dim>{w.text}</T>
          </Line>
        </>
      )
    case 'modelTool':
      return (
        <>
          <Line>
            <T c={C.bash} b>
              {w.title}
            </T>{' '}
            <T dim>mcp__{panelName}__{w.name} · 3 calls</T>
          </Line>
          <Line>
            <T dim>$ {w.command}</T>
          </Line>
        </>
      )
  }
}

export function Preview({
  panel,
  selected,
  onSelect,
  onMove,
  onRemove,
  onRename,
}: {
  panel: Panel
  selected: string | null
  onSelect: (id: string | null) => void
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
  onRename: (title: string) => void
}) {
  const [cols, setCols] = useState(110)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  return (
    <div className="preview-wrap" onClick={() => onSelect(null)}>
      <div className="preview-toolbar" onClick={e => e.stopPropagation()}>
        <span className="muted">Pane width:</span>
        {[60, 80, 110].map(c => (
          <button key={c} className={cols === c ? 'is-active' : ''} onClick={() => setCols(c)}>
            {c} cols
          </button>
        ))}
        <span className="muted preview-hint">Click to set up, drag to reorder</span>
      </div>
      <div className="term" style={{ width: `calc(${cols}ch + 34px)` }} onClick={e => e.stopPropagation()}>
        <div className="term-title">
          <input
            className="term-title-input"
            value={panel.title}
            placeholder="Panel"
            onChange={e => onRename(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            title="Click to rename the panel"
            spellCheck={false}
          />
          <span className="term-x">✕</span>
        </div>
        <div className="term-body">
          {panel.widgets.length === 0 && (
            <div className="term-empty">Add widgets from the left: they show up here as they will look in Claude Code.</div>
          )}
          {panel.widgets.map((w, i) => (
            <div
              key={w.id}
              className={`t-section ${selected === w.id ? 'is-selected' : ''} ${over === i && drag !== null && drag !== i ? 'is-over' : ''}`}
              draggable
              onDragStart={e => {
                setDrag(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={e => {
                e.preventDefault()
                setOver(i)
              }}
              onDragEnd={() => {
                setDrag(null)
                setOver(null)
              }}
              onDrop={e => {
                e.preventDefault()
                if (drag !== null && drag !== i) onMove(drag, i)
                setDrag(null)
                setOver(null)
              }}
              onClick={() => onSelect(w.id)}
            >
              <div className="t-tag">
                {WIDGET_BY_KIND[w.kind].title}
                <button
                  className="t-tag-x"
                  title="Remove"
                  onClick={e => {
                    e.stopPropagation()
                    onRemove(w.id)
                  }}
                >
                  ×
                </button>
              </div>
              <WidgetPreview w={w} panelName={panel.name} />
            </div>
          ))}
          {panel.widgets.length > 0 && (
            <Line>
              <T dim>refreshes every {panel.refreshSec}s</T>
            </Line>
          )}
        </div>
      </div>

      {panel.band && (
        <div className="term term-prompt" style={{ width: `calc(${cols}ch + 34px)` }} onClick={e => e.stopPropagation()}>
          <Line>
            <T c={C.claude} b>
              {panel.title}
            </T>{' '}
            <T dim>◐ 1 agent · ctx 46% · main ±7</T> <Btn plain>Open</Btn>
          </Line>
          <div className="t-prompt">
            &gt; <T dim>/{panel.command || panel.name}</T>
          </div>
        </div>
      )}
    </div>
  )
}
