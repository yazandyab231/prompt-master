/** Where one prompt's turn runs: on Haiku (`cheap`) or on the session's own model (`main`), and why. */
export type RouterRoute = {
  model: 'cheap' | 'main'
  why: string
  /** When the prompt was judged, in `$.clock.now()` time. */
  at: number
  /** The turn it applies to, once that turn has started. */
  turnId?: string
  /** The model the turn's first request named. */
  answeredBy?: string
}

/** This session's counts: prompts judged, prompts Opus rated, prompts sent to Haiku. */
export type RouterStats = { total: number; rated: number; routed: number }

declare module 'claude-code' {
  interface PluginState {
    'model-router': {
      isOn: boolean
      pending: Shaped<RouterRoute | null>
      current: Shaped<RouterRoute | null>
      stats: Shaped<RouterStats>
    }
  }
}
