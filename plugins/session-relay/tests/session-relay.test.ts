import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// A slash command as the person types it at the prompt.
function run($: Engine, command: string, args = '') {
  return $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
}

const PLAN = 'Plan: 1. add a login form 2. wire it to /api/login 3. write a test'

// Nothing sits beneath the mod: each hook here stands for the engine.
function engine(on: On, sent: { to: string; text: string }[]) {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Plan a login page', toolUses: [] },
      { role: 'assistant', text: PLAN, toolUses: [] },
      { role: 'assistant', text: '', toolUses: [] },
    ],
  }))
  on('session.send', (_, e) => {
    sent.push({ to: e.to, text: e.text })

    return e.to === 'gone-session'
      ? { isDelivered: false, reason: 'nobody by that name' }
      : { isDelivered: true }
  })
}

test('handoff asks for a session before one is picked', async ($, on) => {
  const sent: { to: string; text: string }[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await run($, 'handoff')

  expect(ran.text).toContain('Pick a session first')
  expect(sent.length).toBe(0)
})

test("handoff sends Claude's last reply and the note to the picked session", async ($, on) => {
  const sent: { to: string; text: string }[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const set = await run($, 'relay', 'builder-2')
  expect(set.text).toContain('builder-2')

  const ran = await run($, 'handoff', 'build steps 1 and 2 only')

  expect(ran.text).toBe("Sent Claude's last reply and your note to builder-2. It will report back here when it's done.")
  expect(sent.length).toBe(1)
  expect(sent[0]?.to).toBe('builder-2')
  expect(sent[0]?.text).toContain(PLAN)
  expect(sent[0]?.text).toContain('Their note: build steps 1 and 2 only')
  expect(sent[0]?.text.split('\n')[0]).toContain('Handoff from another Claude Code session')
})

test('a failed send says why', async ($, on) => {
  const sent: { to: string; text: string }[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await run($, 'relay', 'gone-session')
  const ran = await run($, 'handoff')

  expect(ran.text).toBe('Not sent to gone-session: nobody by that name')
})

test('relay off clears the session', async ($, on) => {
  const sent: { to: string; text: string }[] = []
  engine(on, sent)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await run($, 'relay', 'builder-2')
  await run($, 'relay', 'off')
  const ran = await run($, 'handoff')

  expect(ran.text).toContain('Pick a session first')
})

test('a message from another session counts in the status line', async ($, on) => {
  const sent: { to: string; text: string }[] = []
  const lines: (string | undefined)[] = []
  engine(on, sent)
  on('ui.status', (_, e) => {
    lines.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.receive', (_, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await run($, 'relay', 'planner-1')

  const got = await $.session.receive({
    origin: { kind: 'peer', plugin: 'session-relay' },
    text: 'Done: steps 1 and 2 built, tests pass.',
  })

  expect(got.text).toBe('Done: steps 1 and 2 built, tests pass.')
  expect(lines.at(-1)).toBe('relay → planner-1 · 1 message in')
})

test('relay lists the reachable sessions', async ($, on) => {
  const sent: { to: string; text: string }[] = []
  engine(on, sent)
  on('tool.call', { tool: 'ListAgents' }, () => ({
    result: { listing: 'This session is planner-1.\nbuilder-2 (idle)' },
    text: 'This session is planner-1.\nbuilder-2 (idle)',
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await run($, 'relay')

  expect(ran.text).toContain('No relay session picked yet.')
  expect(ran.text).toContain('builder-2 (idle)')
})
