import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { parseGitStatus, parseTasks } from '../hooks/project'

const PANE = {
  plugin: 'agent-dashboard',
  component: 'Pane',
  requestId: 'agent-dashboard',
  props: {
    title: 'Dashboard',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const GIT = '## main...origin/main [ahead 2, behind 1]\n M src/app.ts\n?? notes.md\n'
const TASKS = '# Tasks\n- [ ] **Fix the login bug** - from Sam\n- [x] Ship v1\n* [ ] Write the README\n'

// Nothing sits beneath the mod: each hook here stands for the engine.
function engine(
  on: On,
  files: { git?: string; tasks?: string },
  opened: string[] = [],
  shown: { isPlaced: true } | { isPlaced: false; reason: string } = { isPlaced: true },
) {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: shown }
  })
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({
    value: [
      { id: 'a1', description: 'Reading the sources', type: 'Explore', status: 'running', name: 'Research' },
      { id: 'a2', description: 'Drafting the script', type: 'general-purpose', status: 'completed' },
    ],
  }))
  on('process.run', () =>
    files.git === undefined
      ? { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
      : { value: { exitCode: 0, stdout: files.git, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } },
  )
  on('fs.read', () => (files.tasks === undefined ? { deny: 'ENOENT: no such file' } : { value: files.tasks }))
}

function start($: Engine) {
  return $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

test('git status: branch, ahead and behind, changed files', () => {
  expect(parseGitStatus(GIT)).toEqual({
    branch: 'main',
    ahead: 2,
    behind: 1,
    changed: [
      { code: 'M', path: 'src/app.ts' },
      { code: '??', path: 'notes.md' },
    ],
  })
  expect(parseGitStatus('## feature-x\n').branch).toBe('feature-x')
  expect(parseGitStatus('## No commits yet on main\n').branch).toBe('main')
  expect(parseGitStatus('## HEAD (no branch)\n').branch).toBe('detached HEAD')
})

test('TASKS.md: open tasks without bold marks, done ones counted', () => {
  expect(parseTasks(TASKS)).toEqual({
    open: ['Fix the login bug - from Sam', 'Write the README'],
    done: 1,
  })
  expect(parseTasks('no checkboxes here')).toEqual({ open: [], done: 0 })
})

test('the panel shows agents, git and tasks on every surface', async ($, on) => {
  engine(on, { git: GIT, tasks: TASKS })
  await start($)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ key: 'agent-a1' }))?.text).toContain('● Research: Reading the sources')
    expect((await ui.find({ key: 'agent-a2' }))?.text).toContain('✓ general-purpose: Drafting the script')
    expect((await ui.find({ type: 'Text', text: /^Branch:/ }))?.text).toBe('Branch: main ↑2 ↓1')
    expect((await ui.find({ type: 'Text', text: /changed files/ }))?.text).toBe('2 changed files:')
    expect((await ui.find({ type: 'Text', text: /open ·/ }))?.text).toBe('2 open · 1 done')
    expect((await ui.find({ type: 'Text', text: /login/ }))?.text).toBe('• Fix the login bug - from Sam')
    await ui.unmount()
  }
})

test('outside a git repository and without TASKS.md it says so', async ($, on) => {
  engine(on, {})
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /git repository/ }))?.text).toBe('Not a git repository.')
  expect((await ui.find({ type: 'Text', text: /TASKS\.md/ }))?.text).toBe('No TASKS.md in this folder.')
  await ui.unmount()
})

test('/dash opens the panel', async ($, on) => {
  const opened: string[] = []
  engine(on, { git: GIT }, opened)
  await start($)
  opened.length = 0

  const ran = await $.command.run({
    command: 'dash',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

  expect(ran.text).toBe('Dashboard opened in the side panel.')
  expect(opened).toEqual(['agent-dashboard'])
})

test('/dash shows the dashboard as text where the app shows no side panel', async ($, on) => {
  engine(on, { git: GIT, tasks: TASKS }, [], { isPlaced: false, reason: 'the mobile app places no panes' })
  await start($)

  const ran = await $.command.run({
    command: 'dash',
    args: '',
    origin: { kind: 'bridge' },
    presentation: { isFullscreen: false, columns: 40 },
  })

  expect(ran.text).toBe(
    [
      'Agents',
      '  ● Research: Reading the sources (running)',
      '  ✓ general-purpose: Drafting the script (completed)',
      '',
      'Project',
      '  Branch: main ↑2 ↓1',
      '  2 changed files:',
      '    M  src/app.ts',
      '    ?? notes.md',
      '',
      'Tasks',
      '  2 open · 1 done',
      '  • Fix the login bug - from Sam',
      '  • Write the README',
      '',
      "(Shown here because this app didn't show the side panel: the mobile app places no panes)",
    ].join('\n'),
  )
})
