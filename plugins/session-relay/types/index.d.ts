/** The session /handoff sends work to, as ListAgents names it; null when none is picked. */
export type RelayPartner = string | null

declare module 'claude-code' {
  interface PluginState {
    'session-relay': { partner: RelayPartner; received: number }
  }
}
