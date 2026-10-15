// Generates a panel with every widget and writes it to the folder given, for tsc and claude plugin validate.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { generatePanel } from '../src/panel/generate'
import { makeWidget, samplePanel, WIDGETS } from '../src/panel/widgets'

const root = process.argv[2]!
const rt = (p: string) => readFileSync(join(process.argv[3]!, p), 'utf8')
const panel = { ...samplePanel(), name: 'all-widgets', command: 'all', band: true, widgets: WIDGETS.map(w => makeWidget(w.kind)) }
const files = generatePanel(panel, { register: rt('runtime/hooks/register.tsx'), config: rt('runtime/hooks/config.ts'), types: rt('runtime/types/index.d.ts') })
rmSync(root, { recursive: true, force: true })
for (const [rel, c] of Object.entries(files)) {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), c)
}
