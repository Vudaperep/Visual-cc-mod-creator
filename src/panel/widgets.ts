import type { Panel, Widget, WidgetKind } from '../../runtime/hooks/config'

export type FieldSpec = {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'bool' | 'select' | 'list'
  options?: readonly string[]
  /** For `list`: the columns of each row. */
  columns?: { key: string; label: string; kind: 'text' | 'select'; options?: readonly string[]; wide?: boolean }[]
  hint?: string
}

export const GROUPS = ['Agents & sessions', 'AI', 'Status', 'Actions', 'Data', 'Behaviour'] as const

export type WidgetSpec = {
  kind: WidgetKind
  title: string
  description: string
  group: (typeof GROUPS)[number]
  make: () => Omit<Widget, 'id'>
  fields: FieldSpec[]
}

let seq = 0
export const widgetId = () => `w${Date.now().toString(36)}${(seq++).toString(36)}`

const MODELS = ['', 'haiku', 'sonnet', 'opus'] as const

export const WIDGETS: WidgetSpec[] = [
  // ── Agents & sessions ──
  {
    kind: 'agents',
    title: 'Session agents',
    description: 'Subagents and teammates: type, model, status, time, context, tokens. A button opens the transcript.',
    group: 'Agents & sessions',
    make: () => ({ kind: 'agents', title: 'This session · agents', keepMinutes: 15, showDone: true, allowMessage: true }),
    fields: [
      { key: 'showDone', label: 'Show finished agents', kind: 'bool' },
      { key: 'allowMessage', label: 'Message an agent', kind: 'bool' },
      { key: 'keepMinutes', label: 'Keep finished agents, minutes', kind: 'number' },
    ],
  },
  {
    kind: 'spawn',
    title: 'Start a subagent',
    description: 'Buttons with ready tasks plus a “your task” field. Agents run in the background.',
    group: 'Agents & sessions',
    make: () => ({
      kind: 'spawn',
      title: 'Start an agent',
      freeInput: true,
      types: 'general-purpose, Explore, Plan',
      presets: [
        { label: 'Review the diff', type: 'general-purpose', prompt: 'Review the current git diff: bugs, risks, what can be simpler. Be brief.', model: '' },
        { label: 'Find TODOs', type: 'Explore', prompt: 'Find every TODO/FIXME in the repository and group them by importance.', model: 'haiku' },
      ],
    }),
    fields: [
      { key: 'freeInput', label: '“Your task” field', kind: 'bool' },
      { key: 'types', label: 'Agent types to pick from (comma separated)', kind: 'text' },
      {
        key: 'presets',
        label: 'Buttons',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'type', label: 'Type', kind: 'text' },
          { key: 'model', label: 'Model', kind: 'select', options: MODELS },
          { key: 'prompt', label: 'Task', kind: 'text', wide: true },
        ],
      },
    ],
  },
  {
    kind: 'agentTypes',
    title: 'Custom agent types',
    description: 'Registers your own subagents (prompt, model, tools): Claude can call them, and you can start them with a button.',
    group: 'Agents & sessions',
    make: () => ({
      kind: 'agentTypes',
      title: 'My agents',
      presets: [
        { name: 'reviewer', description: 'A strict reviewer of changes', prompt: 'You are a strict reviewer. Read the git diff, look for bugs and risks, answer as a list.', model: 'sonnet', tools: 'Bash, Read, Grep' },
        { name: 'test-writer', description: 'Writes the missing tests', prompt: 'You write tests for changed code. Find what is not covered and add tests.', model: '', tools: '' },
      ],
    }),
    fields: [
      {
        key: 'presets',
        label: 'Agents',
        kind: 'list',
        columns: [
          { key: 'name', label: 'Name (latin)', kind: 'text' },
          { key: 'model', label: 'Model', kind: 'select', options: MODELS },
          { key: 'tools', label: 'Tools (comma separated, empty = all)', kind: 'text' },
          { key: 'description', label: 'When to use it (description)', kind: 'text', wide: true },
          { key: 'prompt', label: 'The agent’s system prompt', kind: 'text', wide: true },
        ],
        hint: 'The agent type is <panel-name>:<name>',
      },
    ],
  },
  {
    kind: 'sessions',
    title: 'Sessions on this machine',
    description: 'Every running Claude Code session: name, status, folder. You can send a message to another one.',
    group: 'Agents & sessions',
    make: () => ({ kind: 'sessions', title: 'Sessions', allowSend: true, hideSelf: false }),
    fields: [
      { key: 'allowSend', label: 'Send messages', kind: 'bool' },
      { key: 'hideSelf', label: 'Hide this session', kind: 'bool' },
    ],
  },
  {
    kind: 'newSession',
    title: 'New session',
    description: 'A button that opens a new terminal window with claude, optionally with a first prompt (macOS).',
    group: 'Agents & sessions',
    make: () => ({ kind: 'newSession', title: 'New session', app: 'Terminal', cwd: '', prompt: '', label: 'Open a new session' }),
    fields: [
      { key: 'label', label: 'Button text', kind: 'text' },
      { key: 'app', label: 'Terminal', kind: 'select', options: ['Terminal', 'iTerm'] },
      { key: 'cwd', label: 'Folder (empty = current)', kind: 'text', hint: 'Absolute, ~/…, or relative to the current folder' },
      { key: 'prompt', label: 'Default first prompt', kind: 'text' },
    ],
  },
  {
    kind: 'control',
    title: 'Turn control',
    description: 'Stop the current turn, compact with instructions on what to keep, /clear.',
    group: 'Agents & sessions',
    make: () => ({ kind: 'control', title: 'Claude', stop: true, compact: true, clear: false }),
    fields: [
      { key: 'stop', label: '“Stop” button while a turn runs', kind: 'bool' },
      { key: 'compact', label: 'Compact with instructions', kind: 'bool' },
      { key: 'clear', label: '/clear button', kind: 'bool' },
    ],
  },
  {
    kind: 'messages',
    title: 'Conversation feed',
    description: 'The latest messages, yours and Claude’s, with how many tools each used.',
    group: 'Agents & sessions',
    make: () => ({ kind: 'messages', title: 'Conversation', count: 6 }),
    fields: [{ key: 'count', label: 'How many messages', kind: 'number' }],
  },

  // ── AI ──
  {
    kind: 'ask',
    title: 'Ask about the session',
    description: 'A question to the model over the current conversation (fork): “where are we?”, “what is left?”. Copy or insert the answer.',
    group: 'AI',
    make: () => ({
      kind: 'ask',
      title: 'Ask',
      freeInput: true,
      presets: [
        { label: 'Where are we?', question: 'In one paragraph: what are we working on right now and at what stage?' },
        { label: 'What is left?', question: 'As a list: what is left to do on the current task?' },
      ],
    }),
    fields: [
      { key: 'freeInput', label: 'Field for your own question', kind: 'bool' },
      {
        key: 'presets',
        label: 'Question buttons',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'question', label: 'Question', kind: 'text', wide: true },
        ],
      },
    ],
  },
  {
    kind: 'aiAction',
    title: 'AI buttons',
    description: 'A button calls the model with your prompt and a command’s output as context, or classifies into labels.',
    group: 'AI',
    make: () => ({
      kind: 'aiAction',
      title: 'AI',
      presets: [
        { label: 'Commit message', prompt: 'Write a short commit message (conventional commits) for this diff. The message only.', context: 'git diff --staged || git diff', model: 'haiku', labels: '' },
        { label: 'Diff risk', prompt: 'Rate the risk of these changes.', context: 'git diff', model: 'haiku', labels: 'low, medium, high' },
      ],
    }),
    fields: [
      {
        key: 'presets',
        label: 'Buttons',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'model', label: 'Model', kind: 'select', options: ['haiku', 'sonnet', 'opus'] },
          { key: 'labels', label: 'Labels (to classify)', kind: 'text' },
          { key: 'prompt', label: 'Prompt', kind: 'text', wide: true },
          { key: 'context', label: 'Context command (its output is added to the prompt)', kind: 'text', wide: true },
        ],
        hint: 'With labels, the model picks one of them',
      },
    ],
  },
  {
    kind: 'nextStep',
    title: 'Next step',
    description: 'After each answer Claude suggests your next message, as a hint in the prompt and in the panel.',
    group: 'AI',
    make: () => ({ kind: 'nextStep', title: 'Next', instruction: 'Suggest one short next message from the user to keep the work going. The message text only.' }),
    fields: [{ key: 'instruction', label: 'Instruction to the model', kind: 'textarea' }],
  },
  {
    kind: 'selection',
    title: 'Selected text',
    description: 'Quote what you selected with the mouse into the prompt, or ask Claude about it.',
    group: 'AI',
    make: () => ({ kind: 'selection', title: 'Selection', quote: true, ask: true }),
    fields: [
      { key: 'quote', label: '“Quote” button', kind: 'bool' },
      { key: 'ask', label: 'Ask about the selection', kind: 'bool' },
    ],
  },

  // ── Status ──
  {
    kind: 'usage',
    title: 'Context & limits',
    description: 'How full the context is, the session’s cost, subscription limits.',
    group: 'Status',
    make: () => ({ kind: 'usage', title: 'Usage', showLimits: true, showCost: true }),
    fields: [
      { key: 'showCost', label: 'Cost', kind: 'bool' },
      { key: 'showLimits', label: 'Limits', kind: 'bool' },
    ],
  },
  {
    kind: 'contextChart',
    title: 'Context chart',
    description: 'How the context filled up, turn by turn (sparkline).',
    group: 'Status',
    make: () => ({ kind: 'contextChart', title: 'Context', points: 40 }),
    fields: [{ key: 'points', label: 'Points', kind: 'number' }],
  },
  {
    kind: 'session',
    title: 'This session',
    description: 'Model, number of turns, duration, folder.',
    group: 'Status',
    make: () => ({ kind: 'session', title: 'Session' }),
    fields: [],
  },
  {
    kind: 'git',
    title: 'Git',
    description: 'Branch, ahead/behind, changed files, last commit.',
    group: 'Status',
    make: () => ({ kind: 'git', title: 'Git', maxFiles: 6 }),
    fields: [{ key: 'maxFiles', label: 'Files to show', kind: 'number' }],
  },
  {
    kind: 'diff',
    title: 'Git diff',
    description: 'The current changes, highlighted as a diff.',
    group: 'Status',
    make: () => ({ kind: 'diff', title: 'Diff', maxLines: 80 }),
    fields: [{ key: 'maxLines', label: 'Max lines', kind: 'number' }],
  },
  {
    kind: 'tools',
    title: 'Tool calls',
    description: 'The latest tool calls: tool, argument, status, time.',
    group: 'Status',
    make: () => ({ kind: 'tools', title: 'Tool calls', count: 8, agentsOnly: false }),
    fields: [
      { key: 'count', label: 'How many to show', kind: 'number' },
      { key: 'agentsOnly', label: 'Subagents only', kind: 'bool' },
    ],
  },
  {
    kind: 'inventory',
    title: 'Tools & commands',
    description: 'How many and which tools (MCP included) and slash commands the session has.',
    group: 'Status',
    make: () => ({ kind: 'inventory', title: 'Available' }),
    fields: [],
  },

  // ── Actions ──
  {
    kind: 'prompts',
    title: 'Quick prompts',
    description: 'Buttons that insert a ready prompt or send it right away.',
    group: 'Actions',
    make: () => ({
      kind: 'prompts',
      title: 'Prompts',
      presets: [
        { label: 'Run the tests', text: 'Run the tests and fix what fails', mode: 'submit' },
        { label: 'Commit', text: 'Commit with a clear message', mode: 'fill' },
      ],
    }),
    fields: [
      {
        key: 'presets',
        label: 'Buttons',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'mode', label: 'Mode', kind: 'select', options: ['fill', 'submit'] },
          { key: 'text', label: 'Prompt', kind: 'text', wide: true },
        ],
        hint: 'fill puts it in the prompt box, submit sends it',
      },
    ],
  },
  {
    kind: 'commands',
    title: 'Command buttons',
    description: 'Slash-command buttons plus a dropdown of every command in the session (yours, plugins, skills).',
    group: 'Actions',
    make: () => ({
      kind: 'commands',
      title: 'Commands',
      presets: [
        { label: '/compact', command: 'compact', args: '' },
        { label: '/cost', command: 'cost', args: '' },
      ],
      picker: true,
    }),
    fields: [
      { key: 'picker', label: 'Dropdown of every command', kind: 'bool' },
      {
        key: 'presets',
        label: 'Buttons',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'command', label: 'Command (no slash)', kind: 'text' },
          { key: 'args', label: 'Arguments', kind: 'text', wide: true },
        ],
      },
    ],
  },
  {
    kind: 'choice',
    title: 'Pick an option',
    description: 'A button asks a question with options; the answer goes into a prompt template.',
    group: 'Actions',
    make: () => ({
      kind: 'choice',
      title: 'Mode',
      label: 'Pick an answer style',
      question: 'How should Claude answer?',
      options: 'briefly, in detail, with code examples',
      template: 'From now on answer {{choice}}.',
      mode: 'submit',
    }),
    fields: [
      { key: 'label', label: 'Button text', kind: 'text' },
      { key: 'question', label: 'Question', kind: 'text' },
      { key: 'options', label: 'Options (comma separated)', kind: 'text' },
      { key: 'template', label: 'Prompt template ({{choice}} is the pick)', kind: 'text' },
      { key: 'mode', label: 'Mode', kind: 'select', options: ['fill', 'submit'] },
    ],
  },
  {
    kind: 'snippets',
    title: 'Clipboard snippets',
    description: 'Buttons that copy ready text to the clipboard.',
    group: 'Actions',
    make: () => ({ kind: 'snippets', title: 'Snippets', presets: [{ label: 'PR template', text: '## What\n\n## Why\n\n## How to test\n' }] }),
    fields: [
      {
        key: 'presets',
        label: 'Snippets',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Button', kind: 'text' },
          { key: 'text', label: 'Text', kind: 'text', wide: true },
        ],
      },
    ],
  },

  // ── Data ──
  {
    kind: 'shell',
    title: 'Command output',
    description: 'A shell command on a timer; shows the last lines of its output.',
    group: 'Data',
    make: () => ({ kind: 'shell', title: 'Shell', command: 'git log --oneline -5', everySec: 30, lines: 6 }),
    fields: [
      { key: 'command', label: 'Command', kind: 'text' },
      { key: 'everySec', label: 'Every, seconds', kind: 'number' },
      { key: 'lines', label: 'Lines', kind: 'number' },
    ],
  },
  {
    kind: 'file',
    title: 'File',
    description: 'The first lines of a file: TODO.md, a plan, notes.',
    group: 'Data',
    make: () => ({ kind: 'file', title: 'TODO', path: 'TODO.md', lines: 10 }),
    fields: [
      { key: 'path', label: 'Path', kind: 'text', hint: 'Relative to the session’s folder, ~/…, or absolute' },
      { key: 'lines', label: 'Lines', kind: 'number' },
    ],
  },
  {
    kind: 'note',
    title: 'Note',
    description: 'Any Markdown: a heading, hints, links.',
    group: 'Data',
    make: () => ({ kind: 'note', title: '', text: '**Tip:** run /compact when the context is over 70%' }),
    fields: [{ key: 'text', label: 'Markdown', kind: 'textarea' }],
  },
  {
    kind: 'links',
    title: 'Links',
    description: 'Clickable links: the task board, CI, docs.',
    group: 'Data',
    make: () => ({ kind: 'links', title: 'Links', presets: [{ label: 'Claude Code docs', url: 'https://docs.claude.com/en/docs/claude-code' }] }),
    fields: [
      {
        key: 'presets',
        label: 'Links',
        kind: 'list',
        columns: [
          { key: 'label', label: 'Text', kind: 'text' },
          { key: 'url', label: 'URL', kind: 'text', wide: true },
        ],
      },
    ],
  },
  {
    kind: 'http',
    title: 'HTTP / API',
    description: 'Fetches a URL on a timer (CI status, tasks, anything) and shows a value from the JSON.',
    group: 'Data',
    make: () => ({ kind: 'http', title: 'GitHub status', url: 'https://www.githubstatus.com/api/v2/status.json', everySec: 120, jsonPath: 'status.description', auth: '' }),
    fields: [
      { key: 'url', label: 'URL', kind: 'text' },
      { key: 'jsonPath', label: 'JSON path (a.b[0].c, empty = all)', kind: 'text' },
      { key: 'everySec', label: 'Every, seconds (0 = on the button)', kind: 'number' },
      { key: 'auth', label: 'Authorization (optional)', kind: 'text', hint: 'For example Bearer <token>. It is stored in the panel’s code.' },
    ],
  },
  {
    kind: 'mcp',
    title: 'MCP tool',
    description: 'Calls a tool of a connected MCP server and shows the result.',
    group: 'Data',
    make: () => ({ kind: 'mcp', title: 'MCP', server: '', tool: '', args: '{}', everySec: 0 }),
    fields: [
      { key: 'server', label: 'Server', kind: 'text' },
      { key: 'tool', label: 'Tool', kind: 'text' },
      { key: 'args', label: 'Arguments (JSON)', kind: 'textarea' },
      { key: 'everySec', label: 'Every, seconds (0 = on the button)', kind: 'number' },
    ],
  },
  {
    kind: 'image',
    title: 'Image',
    description: 'A PNG right in the terminal (kitty, Ghostty; a caption elsewhere).',
    group: 'Data',
    make: () => ({ kind: 'image', title: 'Image', path: 'docs/diagram.png', columns: 60, rows: 16 }),
    fields: [
      { key: 'path', label: 'PNG path', kind: 'text' },
      { key: 'columns', label: 'Width, columns', kind: 'number' },
      { key: 'rows', label: 'Height, rows', kind: 'number' },
    ],
  },
  {
    kind: 'notes',
    title: 'Notes',
    description: 'Your own notes in the panel, kept across sessions.',
    group: 'Data',
    make: () => ({ kind: 'notes', title: 'Notes' }),
    fields: [],
  },

  // ── Behaviour ──
  {
    kind: 'voice',
    title: 'Sound & notifications',
    description: 'When a long turn ends: say something out loud and/or show a system notification.',
    group: 'Behaviour',
    make: () => ({ kind: 'voice', title: 'Alerts', speak: 'Done', notify: true, minSeconds: 30 }),
    fields: [
      { key: 'speak', label: 'Say out loud (empty = silent)', kind: 'text' },
      { key: 'notify', label: 'System notification', kind: 'bool' },
      { key: 'minSeconds', label: 'Only for turns longer than, seconds', kind: 'number' },
    ],
  },
  {
    kind: 'guard',
    title: 'Guards',
    description: 'Rules that block tool calls (rm -rf, git push --force…). Switch them on and off from the panel.',
    group: 'Behaviour',
    make: () => ({
      kind: 'guard',
      title: 'Guard',
      rules: [
        { tool: 'Bash', pattern: 'rm\\s+-rf\\s+/', reason: 'rm -rf from the root is not allowed' },
        { tool: 'Bash', pattern: 'git\\s+push.*--force', reason: 'force push is not allowed' },
      ],
    }),
    fields: [
      {
        key: 'rules',
        label: 'Rules',
        kind: 'list',
        columns: [
          { key: 'tool', label: 'Tool (* = any)', kind: 'text' },
          { key: 'pattern', label: 'Regex on the argument', kind: 'text' },
          { key: 'reason', label: 'Reason (Claude sees it)', kind: 'text', wide: true },
        ],
        hint: 'The argument is command for Bash, file_path for Edit/Write, pattern for Grep…',
      },
    ],
  },
  {
    kind: 'systemPrompt',
    title: 'System prompt addition',
    description: 'Your own text in the system prompt of every request. Switch it on and off from the panel.',
    group: 'Behaviour',
    make: () => ({ kind: 'systemPrompt', title: 'Rules', text: 'Before large changes, describe the plan in a few lines.' }),
    fields: [{ key: 'text', label: 'Text', kind: 'textarea' }],
  },
  {
    kind: 'modelTool',
    title: 'Tool for Claude',
    description: 'Your own tool that Claude calls itself: a shell command with an {{input}} argument.',
    group: 'Behaviour',
    make: () => ({
      kind: 'modelTool',
      title: 'Tool',
      name: 'run_tests',
      description: 'Run the project test suite, optionally filtered by a pattern passed as input.',
      command: 'npm test -- {{input}}',
    }),
    fields: [
      { key: 'name', label: 'Name (snake_case)', kind: 'text' },
      { key: 'description', label: 'Description for Claude (when to call it)', kind: 'textarea' },
      { key: 'command', label: 'Command ({{input}} is Claude’s argument)', kind: 'text' },
    ],
  },
]

export const WIDGET_BY_KIND = Object.fromEntries(WIDGETS.map(w => [w.kind, w])) as Record<WidgetKind, WidgetSpec>

export function makeWidget(kind: WidgetKind): Widget {
  return { ...WIDGET_BY_KIND[kind].make(), id: widgetId() } as Widget
}

export function samplePanel(): Panel {
  return {
    name: 'my-dashboard',
    description: 'Agents, sessions and usage in one pane',
    title: 'Dashboard',
    command: 'dash',
    openOnStart: false,
    refreshSec: 5,
    band: true,
    widgets: [makeWidget('agents'), makeWidget('spawn'), makeWidget('sessions'), makeWidget('newSession'), makeWidget('usage'), makeWidget('git')],
  }
}
