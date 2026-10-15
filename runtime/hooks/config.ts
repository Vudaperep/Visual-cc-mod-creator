// The shape of a panel the Visual CC Mod Creator builds. Shared by the editor and the mod's runtime.

export type SpawnPreset = { label: string; type: string; prompt: string; model: string }
export type PromptPreset = { label: string; text: string; mode: 'fill' | 'submit' }
export type CommandPreset = { label: string; command: string; args: string }
export type AgentTypePreset = { name: string; description: string; prompt: string; model: string; tools: string }
export type AskPreset = { label: string; question: string }
export type AiPreset = { label: string; prompt: string; context: string; model: string; labels: string }
export type SnippetPreset = { label: string; text: string }
export type LinkPreset = { label: string; url: string }
export type GuardRule = { tool: string; pattern: string; reason: string }

type Base = { id: string; title: string }

export type Widget = Base &
  (
    | { kind: 'note'; text: string }
    | { kind: 'agents'; keepMinutes: number; showDone: boolean; allowMessage: boolean }
    | { kind: 'spawn'; presets: SpawnPreset[]; freeInput: boolean; types: string }
    | { kind: 'agentTypes'; presets: AgentTypePreset[] }
    | { kind: 'sessions'; allowSend: boolean; hideSelf: boolean }
    | { kind: 'newSession'; app: 'Terminal' | 'iTerm'; cwd: string; prompt: string; label: string }
    | { kind: 'control'; stop: boolean; compact: boolean; clear: boolean }
    | { kind: 'messages'; count: number }
    | { kind: 'usage'; showLimits: boolean; showCost: boolean }
    | { kind: 'contextChart'; points: number }
    | { kind: 'session' }
    | { kind: 'git'; maxFiles: number }
    | { kind: 'diff'; maxLines: number }
    | { kind: 'tools'; count: number; agentsOnly: boolean }
    | { kind: 'inventory' }
    | { kind: 'ask'; presets: AskPreset[]; freeInput: boolean }
    | { kind: 'aiAction'; presets: AiPreset[] }
    | { kind: 'nextStep'; instruction: string }
    | { kind: 'selection'; quote: boolean; ask: boolean }
    | { kind: 'prompts'; presets: PromptPreset[] }
    | { kind: 'commands'; presets: CommandPreset[]; picker: boolean }
    | { kind: 'choice'; question: string; options: string; template: string; mode: 'fill' | 'submit'; label: string }
    | { kind: 'snippets'; presets: SnippetPreset[] }
    | { kind: 'shell'; command: string; everySec: number; lines: number }
    | { kind: 'file'; path: string; lines: number }
    | { kind: 'image'; path: string; columns: number; rows: number }
    | { kind: 'links'; presets: LinkPreset[] }
    | { kind: 'http'; url: string; everySec: number; jsonPath: string; auth: string }
    | { kind: 'mcp'; server: string; tool: string; args: string; everySec: number }
    | { kind: 'notes' }
    | { kind: 'voice'; speak: string; notify: boolean; minSeconds: number }
    | { kind: 'guard'; rules: GuardRule[] }
    | { kind: 'systemPrompt'; text: string }
    | { kind: 'modelTool'; name: string; description: string; command: string }
  )

export type WidgetKind = Widget['kind']

export type Panel = {
  /** Plugin name, kebab-case. */
  name: string
  description: string
  title: string
  /** Slash command that opens the pane, without the slash. */
  command: string
  openOnStart: boolean
  refreshSec: number
  /** A one-line summary above the prompt. */
  band: boolean
  widgets: Widget[]
}
