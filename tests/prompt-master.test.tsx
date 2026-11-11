import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { parse } from '../hooks/rewrite'

type On = Parameters<TestBody>[1]

const ROUGH = 'make my login page not suck, its slow and ugly'
const IMPROVED =
  'Improve the login page: it loads slowly and looks dated.\n\nAsk me which framework it uses before changing code.'
const REPLY = `<prompt>${IMPROVED}</prompt>
<before>goal</before>
<after>goal, format, done</after>
<missing>
- Which framework is the page built with?
- What counts as fast enough?
</missing>`
const USAGE = {
  input_tokens: 10,
  output_tokens: 10,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

/** What the engine itself would answer beneath the plugin. */
function engine(on: On, reply = REPLY) {
  const calls = { complete: [] as string[], submitted: [] as { text: string; asUser?: true }[], placed: [] as string[] }
  on('command.register', () => ({ value: { command: 'pm' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork' } }))
  on('model.complete', (_, e) => {
    calls.complete.push(e.system ?? '')

    return { value: { isAnswered: true, text: reply, usage: USAGE } }
  })
  on('prompt.submit', (_, e) => {
    calls.submitted.push({ text: e.text, asUser: (e.origin as { asUser?: true }).asUser })

    return { text: e.text }
  })
  on('ui.place', (_, e) => {
    calls.placed.push(e.id)

    return { value: { isPlaced: true, requestId: e.id } }
  })

  return calls
}

function pm(args: string) {
  return {
    command: 'pm',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  } as const
}

function row(text: string) {
  return {
    plugin: 'prompt-master',
    component: 'CommandOutput',
    requestId: 'row-1',
    props: { command: 'pm', args: ROUGH, text, isErrored: false },
  } as const
}

const BAND = {
  plugin: 'prompt-master',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

test('the parser reads the tags, keeps only known checks, and tidies the questions', () => {
  const read = parse(`Sure, here it is!\n${REPLY.replace('goal, format, done', 'Goal, format, DONE, vibes')}`)

  expect(read?.improved).toBe(IMPROVED)
  expect(read?.before).toEqual(['goal'])
  expect(read?.after).toEqual(['goal', 'format', 'done'])
  expect(read?.missing).toEqual(['Which framework is the page built with?', 'What counts as fast enough?'])
  expect(parse('<prompt></prompt>')).toBeUndefined()
})

test('/pm shows a working card at once, fills it in, and Send submits it as the user', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const calls = engine(on)
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })

  const out = await $.command.run(pm(ROUGH))
  expect(out.text).toBe('Prompt Master draft #1 (for the user to review; not sent)')

  const ui = await $.ui.mount({ ...row(out.text ?? ''), surface: 'mobile' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Rewriting your prompt/)
  expect(await ui.find({ type: 'Text', text: /make my login page/ })).toBeDefined()

  await clock.advance(5)

  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.map(svg => svg.props.alt)).toEqual([
    'Prompt Master: Draft #1 · standalone',
    'Prompt check: 2 of 10 before, 6 of 10 after. Still open: Context, Limits.',
  ])
  expect((await ui.find({ type: 'Markdown' }))?.props.text).toBe(IMPROVED)
  expect(await ui.find({ type: 'Text', text: /Worth adding/ })).toBeDefined()

  await ui.press({ key: 'pm-1:send' })
  expect(calls.submitted).toEqual([{ text: IMPROVED, asUser: true }])
  expect(await ui.find({ key: 'pm-1:send' })).toBeUndefined()
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Sent/)
  await ui.unmount()
})

test('Shorter rewrites the same draft again, in place, in that style', async ($, on) => {
  const clock = mock.clock(on)
  const calls = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run(pm(ROUGH))
  await clock.advance(5)

  const ui = await $.ui.mount({ ...row(out.text ?? ''), surface: 'desktop' })
  await ui.press({ key: 'pm-1:shorter' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toMatch(/Tightening/)

  await clock.advance(5)
  expect(calls.complete).toHaveLength(2)
  expect(calls.complete[1]).toMatch(/as short as possible/)
  expect(await ui.find({ key: 'pm-1:send' })).toBeDefined()
  await ui.unmount()
})

test('the card draws on every surface, with text in place of art on the terminal', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run(pm(ROUGH))
  await clock.advance(5)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...row(out.text ?? ''), surface })
    expect(await ui.find({ key: 'pm-1:send' })).toBeDefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Prompt check 2\/10 → 6\/10/ })).toBeDefined()
    } else {
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    }
    await ui.unmount()
  }
})

test('a rewrite that fails says why and offers Try again', async ($, on) => {
  const clock = mock.clock(on)
  const calls = engine(on, '<prompt></prompt>')
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
  const out = await $.command.run(pm(ROUGH))
  await clock.advance(5)

  const ui = await $.ui.mount({ ...row(out.text ?? ''), surface: 'mobile' })
  expect(await ui.find({ type: 'Text', text: /empty rewrite/ })).toBeDefined()
  await ui.press({ key: 'pm-1:retry' })
  await clock.advance(5)
  expect(calls.complete).toHaveLength(2)
  expect(calls.submitted).toEqual([])
  await ui.unmount()
})

test('the desktop box rewrites what was typed into a card placed in the chat; phones get no box', async ($, on) => {
  const clock = mock.clock(on)
  const calls = engine(on)
  // Stands for the engine's own band beneath the plugin.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine band</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const field = await band.find({ type: 'Input' })
  expect(field).toBeDefined()
  await band.input({ key: field!.key!, text: ROUGH, kind: 'change' })
  await band.press({ key: 'rewrite' })
  expect(calls.placed).toEqual(['pm-1'])
  await band.unmount()

  await clock.advance(5)
  const placed = await $.ui.mount({
    plugin: 'prompt-master',
    component: 'Placed',
    requestId: 'pm-1',
    props: { id: 'pm-1', plugin: 'prompt-master' },
    surface: 'desktop',
  })
  expect((await placed.find({ type: 'Markdown' }))?.props.text).toBe(IMPROVED)
  await placed.unmount()

  const phone = await $.ui.mount({ ...BAND, surface: 'mobile' })
  expect(await phone.find({ type: 'Text', text: /engine band/ })).toBeDefined()
  await phone.unmount()
})

test('an empty /pm shows how to use it', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run(pm('  '))

  expect(out.text).toMatch(/^Usage/)
})
