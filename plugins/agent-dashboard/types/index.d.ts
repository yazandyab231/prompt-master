/** One agent as the panel lists it. */
export type DashAgent = { id: string; name: string; task: string; status: string }

/** One uncommitted file: git's two-letter status code and its path. */
export type DashChange = { code: string; path: string }

/** The repository's state, from `git status`. */
export type DashGit = { branch: string; ahead: number; behind: number; changed: DashChange[] }

/** The checkbox tasks in TASKS.md: the open ones' text, and how many are done. */
export type DashTasks = { open: string[]; done: number }

/** What the Project section shows: null where there is no git repository or no TASKS.md. */
export type DashProject = { git: DashGit | null; tasks: DashTasks | null }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': { agents: Shaped<DashAgent[]>; project: Shaped<DashProject | null> }
  }
}
