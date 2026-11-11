import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DashAgent, DashProject } from '../types'
import { parseGitStatus, parseTasks } from './project'

const PANE = 'agent-dashboard'
const TITLE = 'Dashboard'
const AGENT_POLL_MS = 3000
const MAX_FILES = 8
const MAX_TASKS = 6

// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const agents = atom({ plugin: 'agent-dashboard', key: 'agents' } as const, [] as DashAgent[], {
  shape: 'agents-1',
})
const project = atom(
  { plugin: 'agent-dashboard', key: 'project' } as const,
  null as DashProject | null,
  { shape: 'project-1' },
)

const ACTIVE = new Set(['pending', 'running', 'waiting'])
const MARK: Record<string, string> = {
  pending: '○',
  running: '●',
  waiting: '◐',
  idle: '◌',
  completed: '✓',
  failed: '✗',
  killed: '✗',
}

async function refreshAgents($: EngineInterface): Promise<void> {
  const rows: DashAgent[] = (await $.agent.list()).map(agent => ({
    id: agent.id,
    name: agent.name ?? agent.type,
    task: agent.description,
    status: agent.status,
  }))

  // Skip the write when nothing changed, so the panel isn't redrawn every poll.
  if (JSON.stringify(await read($, agents)) !== JSON.stringify(rows)) {
    await update($, agents, () => rows)
  }
}

async function refreshProject($: EngineInterface): Promise<void> {
  let git: DashProject['git'] = null
  let tasks: DashProject['tasks'] = null

  try {
    const ran = await $.process.run(['git', 'status', '--porcelain=v1', '--branch'], {
      timeoutMs: 10_000,
    })
    git = ran.exitCode === 0 ? parseGitStatus(ran.stdout) : null
  } catch {
    git = null
  }

  try {
    tasks = parseTasks(await $.fs.read('TASKS.md'))
  } catch {
    tasks = null
  }

  await update($, project, () => ({ git, tasks }))
}

async function refreshAll($: EngineInterface): Promise<void> {
  await Promise.all([refreshAgents($), refreshProject($)])
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dash',
      description: 'Open the Dashboard panel: running agents, git status and TASKS.md',
    })
    await refreshAll($).catch(() => undefined)
    $.clock.every(AGENT_POLL_MS, () => {
      refreshAgents($).catch(() => undefined)
    })
    $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'dash' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await refreshAll($).catch(() => undefined)

    return { text: 'Dashboard opened.' }
  })

  // A turn can change files, finish an agent or tick off a task.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    await (e.agentId === undefined ? refreshAll($) : refreshAgents($)).catch(() => undefined)

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const width = Math.max(24, e.props.bodyColumns)
    const fit = (text: string) => (text.length > width ? `${text.slice(0, width - 1)}…` : text)

    const list = await read($, agents)
    const proj = await read($, project)
    const ordered = [
      ...list.filter(agent => ACTIVE.has(agent.status)),
      ...list.filter(agent => !ACTIVE.has(agent.status)),
    ]
    const git = proj?.git ?? null
    const tasks = proj?.tasks ?? null

    return (
      <Box flexDirection="column">
        <Text bold>Agents</Text>
        {ordered.length === 0 && <Text dimColor>No agents running.</Text>}
        {ordered.map(agent => (
          <Button
            key={`agent-${agent.id}`}
            plain
            onPress={() => $.ui.view({ agentId: agent.id }).then(() => undefined)}
          >
            {fit(`${MARK[agent.status] ?? '·'} ${agent.name}: ${agent.task}`)}{' '}
            <Text dimColor>{agent.status}</Text>
          </Button>
        ))}

        <Box marginTop={1} flexDirection="column">
          <Text bold>Project</Text>
          {proj === null && <Text dimColor>Loading…</Text>}
          {proj !== null && git === null && <Text dimColor>Not a git repository.</Text>}
          {git !== null && (
            <Text>
              {fit(
                `Branch: ${git.branch}${git.ahead > 0 ? ` ↑${git.ahead}` : ''}${
                  git.behind > 0 ? ` ↓${git.behind}` : ''
                }`,
              )}
            </Text>
          )}
          {git !== null && (
            <Text dimColor={git.changed.length === 0}>
              {git.changed.length === 0
                ? 'No uncommitted changes.'
                : `${plural(git.changed.length, 'changed file', 'changed files')}:`}
            </Text>
          )}
          {git?.changed.slice(0, MAX_FILES).map(file => (
            <Text dimColor>{fit(`  ${file.code.padEnd(2)} ${file.path}`)}</Text>
          ))}
          {git !== null && git.changed.length > MAX_FILES && (
            <Text dimColor>{`  … and ${git.changed.length - MAX_FILES} more`}</Text>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Tasks</Text>
          {proj !== null && tasks === null && <Text dimColor>No TASKS.md in this folder.</Text>}
          {tasks !== null && (
            <Text>{`${tasks.open.length} open · ${tasks.done} done`}</Text>
          )}
          {tasks?.open.slice(0, MAX_TASKS).map(task => <Text>{fit(`• ${task}`)}</Text>)}
          {tasks !== null && tasks.open.length > MAX_TASKS && (
            <Text dimColor>{`… and ${tasks.open.length - MAX_TASKS} more`}</Text>
          )}
        </Box>

        <Box marginTop={1}>
          <Button key="refresh" label="Refresh" onPress={() => refreshAll($)} />
        </Box>
      </Box>
    )
  })
}
