// Takes the README's screenshots of a running builder (npm run dev) with headless Chrome.
//   node scripts/screenshots.mjs [url] [chrome path]
// Talks to Chrome over the DevTools protocol with Node's own WebSocket, so it needs nothing installed.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_ = process.argv[2] ?? 'http://127.0.0.1:5177/'
const CHROME = process.argv[3] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const STORAGE = 'visual-cc-mod-creator:panel'

const panel = (name, title, command, description, widgets) => ({
  name,
  description,
  title,
  command,
  openOnStart: false,
  refreshSec: 5,
  band: true,
  widgets: widgets.map((kind, i) => ({ id: `w${i}`, kind })),
})

const DASHBOARD = panel('my-dashboard', 'Dashboard', 'dash', 'Agents, sessions and usage in one pane', ['agents', 'spawn', 'sessions', 'usage', 'git'])
const AI = panel('copilot', 'Copilot', 'copilot', 'Turn control, AI helpers and guards', ['control', 'ask', 'aiAction', 'nextStep', 'contextChart', 'guard', 'notes'])

const sleep = ms => new Promise(r => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'visual-cc-shots-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })

let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  target = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_)}`, { method: 'PUT' })
    .then(r => r.json())
    .catch(() => undefined)
}
if (!target) throw new Error('Chrome did not start')

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', m => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, msg => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
const js = expression => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then(r => r.result.value)

async function size(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false })
}

async function load(p) {
  await js(`localStorage.setItem(${JSON.stringify(STORAGE)}, ${JSON.stringify(JSON.stringify(p))}); location.reload(); true`)
  await sleep(1500)
}

async function click(selector, index = 0) {
  const ok = await js(`(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`no element ${selector}[${index}]`)
  await sleep(400)
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(ROOT, 'docs', `${name}.png`), Buffer.from(data, 'base64'))
  console.log(`docs/${name}.png`)
}

try {
  await send('Page.enable')
  await size(1440, 900)
  await load(DASHBOARD)
  await shot('screenshot')

  await click('.tabs button', 1)
  await shot('code')

  await size(1440, 1100)
  await load(AI)
  await shot('ai-and-behaviour')
} finally {
  ws.close()
  chrome.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true })
}
