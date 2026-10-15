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
