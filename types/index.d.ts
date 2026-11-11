/** The five things a strong prompt usually says. */
export type Check = 'goal' | 'context' | 'limits' | 'format' | 'done'

export type Style = 'balanced' | 'shorter' | 'detailed'

export type Draft = {
  /** Also the id of its Placed row, when it has one: `pm-<n>`. */
  id: string
  n: number
  original: string
  status: 'working' | 'ready' | 'sent' | 'failed'
  style: Style
  improved: string
  /** What the rough prompt already covered, by the rewriter's read. */
  before: Check[]
  /** What the rewrite covers. */
  after: Check[]
  /** Questions only the person can answer, which the rewrite left open. */
  missing: string[]
  usedConversation: boolean
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'prompt-master': { drafts: Shaped<Draft[]>; bandRound: number }
  }
}
