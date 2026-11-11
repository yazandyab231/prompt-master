import type { DashAgent, DashProject } from '../types'

const MARK: Record<string, string> = {
  pending: '○',
  running: '●',
  waiting: '◐',
  idle: '◌',
  completed: '✓',
  failed: '✗',
  killed: '✗',
}

const ACTIVE = new Set(['pending', 'running', 'waiting'])

/** The status mark drawn before an agent's name. */
export function agentMark(status: string): string {
  return MARK[status] ?? '·'
}

/** Running agents first, then the rest, each group in the engine's order. */
export function ordered(list: readonly DashAgent[]): DashAgent[] {
  return [
    ...list.filter(agent => ACTIVE.has(agent.status)),
    ...list.filter(agent => !ACTIVE.has(agent.status)),
  ]
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The dashboard as plain text, for apps that show no side panel: the same
 * three sections the panel draws, every agent, file and task listed.
 */
export function dashboardText(list: readonly DashAgent[], project: DashProject | null): string {
  const lines: string[] = ['Agents']

  if (list.length === 0) {
    lines.push('  No agents running.')
  }

  for (const agent of ordered(list)) {
    lines.push(`  ${agentMark(agent.status)} ${agent.name}: ${agent.task} (${agent.status})`)
  }

  lines.push('', 'Project')
  const git = project?.git ?? null

  if (project === null) {
    lines.push('  Not loaded yet.')
  } else if (git === null) {
    lines.push('  Not a git repository.')
  } else {
    const ahead = git.ahead > 0 ? ` ↑${git.ahead}` : ''
    const behind = git.behind > 0 ? ` ↓${git.behind}` : ''
    lines.push(`  Branch: ${git.branch}${ahead}${behind}`)
    lines.push(
      git.changed.length === 0
        ? '  No uncommitted changes.'
        : `  ${plural(git.changed.length, 'changed file', 'changed files')}:`,
    )

    for (const file of git.changed) {
      lines.push(`    ${file.code.padEnd(2)} ${file.path}`)
    }
  }

  lines.push('', 'Tasks')
  const tasks = project?.tasks ?? null

  if (tasks === null) {
    lines.push(project === null ? '  Not loaded yet.' : '  No TASKS.md in this folder.')
  } else {
    lines.push(`  ${tasks.open.length} open · ${tasks.done} done`)

    for (const task of tasks.open) {
      lines.push(`  • ${task}`)
    }
  }

  return lines.join('\n')
}
