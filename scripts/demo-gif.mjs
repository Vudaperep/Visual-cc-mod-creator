// Records docs/demo.gif from a running builder (npm run dev): headless Chrome plays a short scenario
// with a visible cursor, frames are captured over the DevTools protocol, and ffmpeg makes the GIF.
//   node scripts/demo-gif.mjs [url] [chrome path]
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_ = process.argv[2] ?? 'http://127.0.0.1:5177/'
const CHROME =
  process.argv[3] ??
  process.env.CHROME ??
  {
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  }[process.platform] ??
  'google-chrome'
const PORT = 9334
const W = 1280
const H = 760
const STORAGE = 'visual-cc-mod-creator:panel'

const START = {
  name: 'my-copilot',
  description: 'Agents, sessions and usage in one pane',
  title: 'Dashboard',
  command: 'dash',
  openOnStart: false,
  refreshSec: 5,
  band: true,
  widgets: [{ id: 'w0', kind: 'agents' }],
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const work = mkdtempSync(join(tmpdir(), 'visual-cc-gif-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], {
  stdio: 'ignore',
})

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

// ── frames ──
const frames = []
async function frame(ms) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = join(work, `f${String(frames.length).padStart(4, '0')}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  frames.push({ file, ms })
}
const hold = ms => frame(ms)

// ── a fake cursor, since a headless screenshot has none ──
const CURSOR = `(() => {
  if (document.getElementById('demo-cursor')) return
  const c = document.createElement('div')
  c.id = 'demo-cursor'
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  Object.assign(c.style, { position: 'fixed', left: '640px', top: '420px', zIndex: 99999, pointerEvents: 'none', transition: 'transform .12s' })
  document.body.appendChild(c)
})()`
let cursor = { x: 640, y: 420 }

async function center(selector, index = 0) {
  const r = await js(`(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const b = el.getBoundingClientRect(); return { x: b.left + Math.min(b.width / 2, 90), y: b.top + b.height / 2 } })()`)
  if (!r) throw new Error(`no element ${selector}[${index}]`)
  return r
}

async function moveTo(selector, index = 0) {
  const to = await center(selector, index)
  const steps = 7
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const x = cursor.x + (to.x - cursor.x) * e
    const y = cursor.y + (to.y - cursor.y) * e
    await js(`(() => { const c = document.getElementById('demo-cursor'); c.style.left = '${x}px'; c.style.top = '${y}px' })()`)
    await frame(45)
  }
  cursor = to
}

async function click(selector, index = 0) {
  await moveTo(selector, index)
  await js(`document.getElementById('demo-cursor').style.transform = 'scale(.8)'`)
  await frame(90)
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: cursor.x, y: cursor.y, button: 'left', clickCount: 1 })
  await js(`document.getElementById('demo-cursor').style.transform = ''`)
  await sleep(120)
  await frame(160)
}

async function type(text, selectAll = true) {
  if (selectAll) await js(`document.activeElement && document.activeElement.select && document.activeElement.select()`)
  await frame(120)
  for (const ch of text) {
    await send('Input.insertText', { text: ch })
    await frame(55)
  }
}

try {
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false })
  await js(`localStorage.setItem(${JSON.stringify(STORAGE)}, ${JSON.stringify(JSON.stringify(START))}); location.reload(); true`)
  await sleep(1500)
  await js(CURSOR)
  await hold(900)

  // add two widgets from the palette
  await click('.palette-item', 1) // Start a subagent
  await hold(700)
  await click('.palette-item', 3) // Sessions on this machine
  await hold(800)

  // rename the pane
  await click('.term-title-input')
  await type('My copilot')
  await hold(600)

  // edit a button of the subagent widget
  await click('.t-section', 1)
  await hold(400)
  await click('.list-row .field-input', 0)
  await type('Review my diff')
  await hold(900)

  // the generated code, then install
  await click('.tabs button', 1)
  await hold(1600)
  await click('.tabs button', 2)
  await hold(1400)
  await moveTo('.build-actions .primary')
  await hold(1800)
} finally {
  ws.close()
  chrome.kill()
}

// ── GIF ──
const list = frames.map(f => `file '${f.file}'\nduration ${(f.ms / 1000).toFixed(3)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`
writeFileSync(join(work, 'list.txt'), list)
const out = join(ROOT, 'docs', 'demo.gif')
const scale = `fps=15,scale=${W}:-1:flags=lanczos`
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-vf', `${scale},palettegen=max_colors=128:stats_mode=diff`, join(work, 'palette.png')])
execFileSync('ffmpeg', [
  '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-i', join(work, 'palette.png'),
  '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', out,
])
rmSync(work, { recursive: true, force: true })
console.log(`${out} · ${frames.length} frames`)
