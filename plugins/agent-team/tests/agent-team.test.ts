import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

function engine(on: On, types: string[], seen: { text: string; context: readonly string[] }[] = []) {
  on('prompt.submit', (_, e) => {
    seen.push({ text: e.text, context: e.context ?? [] })

    return { text: e.text }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('agent.register', (_, e) => {
    types.push(e.name)

    return { value: { agent: `agent-team:${e.name}` } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

function team($: Engine, args: string) {
  return $.command.run({ command: 'team', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
}

test('registers planner, builder and tester at session start', async ($, on) => {
  const types: string[] = []
  engine(on, types)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(types).toEqual(['planner', 'builder', 'tester'])
})

test('/team without a task asks for one', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await team($, '  ')).text).toContain('Say what the team should do')
})

test('/team does not fail loudly or hang (the submit is deferred to a timer)', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await team($, 'add a login form')).text).not.toContain("couldn't")
})

test('"team: <task>" gets the planner/builder/tester brief as context, text untouched', async ($, on) => {
  const seen: { text: string; context: readonly string[] }[] = []
  engine(on, [], seen)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.prompt.submit({ text: 'team: add a login form', origin: { kind: 'composer' }, wait: false })
  await $.prompt.submit({ text: 'what is a team?', origin: { kind: 'composer' }, wait: false })

  const brief = (seen[0]?.context ?? []).join('\n')

  expect(seen[0]?.text).toBe('team: add a login form')
  expect(brief).toContain('add a login form')
  expect(brief).toContain('agent-team:planner')
  expect(brief).toContain('agent-team:builder')
  expect(brief).toContain('agent-team:tester')
  expect(brief).toContain('At most 2 fix rounds')
  expect(seen[1]?.context).toEqual([])
})
