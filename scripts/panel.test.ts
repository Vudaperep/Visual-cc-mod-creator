import { expect, mock, test } from 'claude-code/testing'

test('every widget draws with data on every surface', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { HOME: '/Users/x' })
  on('session.cwd', () => ({ value: '/Users/x/p' }))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const pane = await $.ui.mount({ plugin: 'all-widgets', surface, component: 'Pane', requestId: 'all-widgets', props: { title: 'D', isFocused: true, bodyColumns: 100, placement: 'dock' } as any })
    for (const t of [/refactor auth/, /other/, /main/, /hello there/, /refreshes every/, /blocked/, /mcp__all-widgets__run_tests/])
      expect(await pane.find({ type: 'Text', text: t })).toBeDefined()
    await pane.unmount()
    const band = await $.ui.mount({ plugin: 'all-widgets', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: {} as any, view: {} as any } as any })
    expect(await band.find({ type: 'Text', text: /ctx 46%/ })).toBeDefined()
    await band.unmount()
  }
})

test('the guard denies a matching Bash call and lets others through', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  on('tool.call', () => ({ result: 'ran', text: 'ran' }) as any)
  const bad = await $.tool.call({ tool: 'Bash', command: 'rm -rf /', description: 'x' } as any)
  expect((bad as any).deny ?? (bad as any).text).toMatch(/rm -rf/)
  const ok = await $.tool.call({ tool: 'Bash', command: 'ls', description: 'x' } as any)
  expect((ok as any).deny).toBeUndefined()
})

const RAN = { exitCode: 0, stdout: 'ok', stderr: '', isStdoutTruncated: false }

test('on Windows a tool line runs in cmd.exe, carried in CC_LINE', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\x' })
  on('session.cwd', () => ({ value: 'C:\\code\\app' }))
  const runs: any[] = []
  on('process.run', ($, e: any) => {
    runs.push(e)
    return { value: RAN } as any
  })
  const r: any = await $.tool.call({ tool: 'mcp__all-widgets__run_tests', input: 'a b' } as any)
  const tool = runs.find(e => JSON.stringify(e).includes('CC_LINE'))
  expect(JSON.stringify(tool)).toContain('%CC_LINE%')
  expect(JSON.stringify(tool)).toContain('npm test -- \\"a b\\"')
  expect(r.text ?? JSON.stringify(r)).toContain('ok')
})

test('on Linux a tool line runs in sh with the argument single-quoted', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { HOME: '/home/x' })
  on('session.cwd', () => ({ value: '/home/x/app' }))
  const runs: any[] = []
  on('process.run', ($, e: any) => {
    runs.push(e)
    return { value: JSON.stringify(e).includes('uname') ? { ...RAN, stdout: 'Linux\n' } : RAN } as any
  })
  await $.tool.call({ tool: 'mcp__all-widgets__run_tests', input: "it's" } as any)
  const tool = runs.find(e => JSON.stringify(e).includes('npm test'))
  expect(JSON.stringify(tool)).toContain('"sh","-c"')
  expect(JSON.stringify(tool)).toContain(`npm test -- 'it'\\\\''s'`)
})
