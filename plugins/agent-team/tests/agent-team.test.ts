import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

function run($: Engine, args: string) {
  return $.command.run({
    command: 'team',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
}

function engine(on: On, types: string[]) {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('agent.register', (_, e) => {
    types.push(e.name)

    return { value: { type: `agent-team:${e.name}` } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
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

  const ran = await run($, '  ')

  expect(ran.text).toContain('Say what the team should do')
})

test('/team hands the model the three-step brief with a fix-round cap', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await run($, 'add a login form')
  const brief = (ran.context ?? []).join('\n')

  expect(brief).toContain('add a login form')
  expect(brief).toContain('agent-team:planner')
  expect(brief).toContain('agent-team:builder')
  expect(brief).toContain('agent-team:tester')
  expect(brief).toContain('At most 2 fix rounds')
})
