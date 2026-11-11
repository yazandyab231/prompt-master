import type { On, PromptSubmitArgs } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { freeFilter, isRatedEasy, modelName, previewOf } from '../hooks/rules'

const MAIN = 'claude-opus-5-5'

type World = {
  rater?: string | null // the rater's reply; null: the call fails
  contextTokens?: number
  ratings: string[] // the prompts the rater was asked about
  models: string[] // the model each main-loop request named
  agentModels: string[] // the model each subagent request named
  status: (string | undefined)[]
}

// Nothing sits beneath the mod: each hook here stands for the engine.
function engine(on: On, world: World) {
  let now = 1_000

  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: (now += 10) }))
  on('ui.status', (_, e) => {
    world.status.push(e.text)

    return { value: undefined }
  })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: world.contextTokens ?? 2_000, window: 200_000 }, rateLimits: [] },
  }))
  on('model.complete', (_, e) => {
    world.ratings.push(e.prompt)

    return {
      value:
        world.rater === null
          ? ({ isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: ZERO } as const)
          : ({ isAnswered: true, text: world.rater ?? 'HARD', usage: ZERO } as const),
    }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    ;(e.agentId === undefined ? world.models : world.agentModels).push(e.model)

    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

const ZERO = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

/** The person types `text`; its turn runs one request, then ends. */
async function ask($: Engine, text: string, prompt: Partial<PromptSubmitArgs> = {}) {
  await $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false, ...prompt } as never)
  await $.turn.start({ text, turnId: 't1' })

  const stream = $.turn.step({ turnId: 't1', index: 0, model: MAIN, messageCount: 1 })

  for await (const _ of stream) {
    // the chunks don't matter here
  }

  await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 5, isAborted: false, reason: 'end_turn' } as never)
}

/** The notices the router added to the chat. */
function notices(session: ReturnType<typeof mock.session>): string[] {
  return session
    .appended()
    .filter(row => row.message.type === 'system')
    .flatMap(row => row.message.content.map(block => ('text' in block ? String(block.text) : '')))
}

function world(over: Partial<World> = {}): World {
  return { ratings: [], models: [], agentModels: [], status: [], ...over }
}

async function start($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

test('the free filter keeps code, files, errors and long prompts on the main model', () => {
  expect(freeFilter('Why does my build fail?')).toBe('mentions code, files or errors')
  expect(freeFilter('look at src/app.ts')).toBe('mentions code, files or errors')
  expect(freeFilter('what does `git rebase` do')).toBe('mentions code, files or errors')
  expect(freeFilter('x'.repeat(301))).toBe('long prompt')
  expect(freeFilter('What is the capital of Japan?')).toBeNull()
  expect(freeFilter('thanks!')).toBeNull()
})

test('only a clear EASY counts as easy', () => {
  expect(isRatedEasy('EASY')).toBe(true)
  expect(isRatedEasy('easy.')).toBe(true)
  expect(isRatedEasy('HARD')).toBe(false)
  expect(isRatedEasy('EASY or HARD')).toBe(false)
  expect(isRatedEasy('')).toBe(false)
  expect(modelName('claude-haiku-5-5')).toBe('Haiku')
})

test('an easy question goes to Haiku, and the chat and status line say so', async ($, on) => {
  const w = world({ rater: 'EASY' })
  engine(on, w)
  const session = mock.session(on)
  await start($)

  await ask($, 'What is the capital of Japan?')

  expect(w.ratings.length).toBe(1)
  expect(w.ratings[0]).toContain('<request>\nWhat is the capital of Japan?\n</request>')
  expect(w.models).toEqual(['haiku'])
  expect(w.status.at(-1)).toBe('router: Haiku answered · Opus rated it easy')
  expect(notices(session)).toEqual([
    '↳ Haiku answered this (Opus rated it easy). /router for details or to turn it off.',
  ])
})

test('a question Opus rates hard stays on the main model, with no notice', async ($, on) => {
  const w = world({ rater: 'HARD' })
  engine(on, w)
  const session = mock.session(on)
  await start($)

  await ask($, 'Should I take the job offer or stay where I am?')

  expect(w.models).toEqual([MAIN])
  expect(w.status.at(-1)).toBe('router: Opus answered · Opus rated it hard')
  expect(notices(session)).toEqual([])
})

test('code talk skips the rating entirely', async ($, on) => {
  const w = world({ rater: 'EASY' })
  engine(on, w)
  await start($)

  await ask($, 'fix the bug in login.ts')

  expect(w.ratings.length).toBe(0)
  expect(w.models).toEqual([MAIN])
  expect(w.status.at(-1)).toBe('router: Opus answered · mentions code, files or errors')
})

test('a long conversation stays on the main model without a rating', async ($, on) => {
  const w = world({ rater: 'EASY', contextTokens: 90_000 })
  engine(on, w)
  await start($)

  await ask($, 'What is the capital of Japan?')

  expect(w.ratings.length).toBe(0)
  expect(w.models).toEqual([MAIN])
})

test('a failed rating keeps the main model', async ($, on) => {
  const w = world({ rater: null })
  engine(on, w)
  await start($)

  await ask($, 'What is the capital of Japan?')

  expect(w.models).toEqual([MAIN])
  expect(w.status.at(-1)).toBe('router: Opus answered · rating failed (api-error)')
})

test('/router off stops routing and rating', async ($, on) => {
  const w = world({ rater: 'EASY' })
  engine(on, w)
  await start($)

  const off = await $.command.run({
    command: 'router',
    args: 'off',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  await ask($, 'What is the capital of Japan?')

  expect(off.text).toContain('Model router is off.')
  expect(w.ratings.length).toBe(0)
  expect(w.models).toEqual([MAIN])
})

test("a subagent's requests keep their own model", async ($, on) => {
  const w = world({ rater: 'EASY' })
  engine(on, w)
  await start($)

  await ask($, 'What is the capital of Japan?')

  // The same turn's id, but from a subagent's loop: never rerouted.
  const stream = $.turn.step({ turnId: 't1', index: 1, model: MAIN, messageCount: 3, agentId: 'a1' })
  for await (const _ of stream) {
    // nothing to read
  }

  expect(w.models).toEqual(['haiku'])
  expect(w.agentModels).toEqual([MAIN])
})

test('/router lists the last replies, newest first', async ($, on) => {
  const w = world({ rater: 'EASY' })
  engine(on, w)
  await start($)

  await ask($, 'fix the bug in login.ts')
  await ask($, 'What is the capital of Japan?')

  const ran = await $.command.run({
    command: 'router',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

  expect(ran.text).toBe(
    [
      'Model router is on.',
      'This session: 2 prompts judged, 1 rated by Opus, 1 sent to Haiku.',
      '',
      'Last replies, newest first:',
      '  Haiku · Opus rated it easy · "What is the capital of Japan?"',
      '  Opus · mentions code, files or errors · "fix the bug in login.ts"',
      '',
      'Turn it off with /router off.',
    ].join('\n'),
  )
  expect(previewOf('  a   b\n c ')).toBe('a b c')
  expect(previewOf('x'.repeat(60)).length).toBe(50)
})
