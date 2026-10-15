import { useState } from 'react'

export function CodePanel({ files }: { files: Record<string, string> }) {
  const names = Object.keys(files)
  const [active, setActive] = useState('hooks/register.tsx')
  const current = files[active] !== undefined ? active : names[0]!
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-panel">
      <div className="code-tabs">
        {names.map(n => (
          <button key={n} className={n === current ? 'is-active' : ''} onClick={() => setActive(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="code-wrap">
        <button
          className="code-copy"
          onClick={() => {
            void navigator.clipboard.writeText(files[current] ?? '')
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre className="code">{files[current]}</pre>
      </div>
    </div>
  )
}
