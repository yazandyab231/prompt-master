import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptSubmitInput, Register } from 'claude-code'

import type { RouterRoute, RouterStats } from '../types'
import {
  MAX_CONTEXT_TOKENS,
  RATER_SYSTEM,
  freeFilter,
  haikuNotice,
  isRatedEasy,
  modelName,
  previewOf,
  ratingPrompt,
} from './rules'

const CHEAP_MODEL = 'haiku'
const RATER_MODEL = 'opus'
/** A judged prompt applies to the turn that starts within this long. */
const PENDING_MS = 15_000
/** How many decisions /router lists. */
const RECENT = 8

const isOn = atom({ plugin: 'model-router', key: 'isOn' } as const, true)
const pending = atom({ plugin: 'model-router', key: 'pending' } as const, null as RouterRoute | null, {
  shape: 'route-1',
})
const current = atom({ plugin: 'model-router', key: 'current' } as const, null as RouterRoute | null, {
  shape: 'route-1',
})
const stats = atom(
  { plugin: 'model-router', key: 'stats' } as const,
  { total: 0, rated: 0, routed: 0 } as RouterStats,
  { shape: 'stats-1' },
)
const recent = atom({ plugin: 'model-router', key: 'recent' } as const, [] as RouterRoute[], {
  shape: 'recent-1',
})

/** Only what the person typed, on the computer or from the phone, is routed. */
function isPersonsPrompt(e: PromptSubmitInput): boolean {
  if (e.command !== undefined || e.isMeta === true || e.turnId !== undefined) {
    return false
  }

  return e.origin.kind === 'composer' || e.origin.kind === 'bridge'
}

async function judge($: EngineInterface, e: PromptSubmitInput): Promise<RouterRoute> {
  const at = await $.clock.now()
  const main = (why: string): RouterRoute => ({ model: 'main', why, at })

  if ((e.attachments?.length ?? 0) > 0) {
    return main('has attachments')
  }

  const filtered = freeFilter(e.text)

  if (filtered !== null) {
    return main(filtered)
  }

  try {
    const { context } = await $.session.usage()

    if ((context.tokens ?? 0) > MAX_CONTEXT_TOKENS) {
      return main('long conversation')
    }
  } catch {
    return main("couldn't read the conversation size")
  }

  await update($, stats, s => ({ ...s, rated: s.rated + 1 }))

  const rating = await $.model.complete({
    model: RATER_MODEL,
    system: RATER_SYSTEM,
    prompt: ratingPrompt(e.text),
    maxTokens: 16,
    effort: 'low',
    timeoutMs: 15_000,
  })

  if (!rating.isAnswered) {
    return main(`rating failed (${rating.reason})`)
  }

  return isRatedEasy(rating.text)
    ? { model: 'cheap', why: 'Opus rated it easy', at }
    : main('Opus rated it hard')
}

async function report($: EngineInterface): Promise<string> {
  const s = await read($, stats)
  const on = await read($, isOn)
  const last = await read($, recent)

  return [
    `Model router is ${on ? 'on' : 'off'}.`,
    `This session: ${s.total} prompts judged, ${s.rated} rated by Opus, ${s.routed} sent to Haiku.`,
    ...(last.length === 0
      ? []
      : [
          '',
          'Last replies, newest first:',
          ...last.map(
            route =>
              `  ${modelName(route.answeredBy ?? '?')} · ${route.why}${route.preview ? ` · "${route.preview}"` : ''}`,
          ),
        ]),
    '',
    on ? 'Turn it off with /router off.' : 'Turn it on with /router on.',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Model router: show what it did, or turn it on or off',
      argumentHint: '[on | off]',
    })

    return next(e)
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'on' || arg === 'off') {
      await update($, isOn, () => arg === 'on')
      $.ui.status(arg === 'on' ? 'router: on' : undefined)
    }

    return { text: await report($) }
  })

  // Judge the prompt before it enters, so its turn knows where to run.
  on('prompt.submit', async ($, e, next) => {
    if (!(await read($, isOn)) || !isPersonsPrompt(e)) {
      return next(e)
    }

    const route = { ...(await judge($, e)), preview: previewOf(e.text) }
    await update($, pending, () => route)
    await update($, stats, s => ({
      ...s,
      total: s.total + 1,
      routed: s.routed + (route.model === 'cheap' ? 1 : 0),
    }))

    return next(e)
  }).catch(($, e, next) => next(e)) // a router failure never holds a prompt back

  // Tie the judgement to the main loop's next turn; anything older is dropped.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const judged = await read($, pending)
      const isFresh = judged !== null && (await $.clock.now()) - judged.at < PENDING_MS

      await update($, current, () => (isFresh ? { ...judged, turnId: e.turnId } : null))
      await update($, pending, () => null)
    }

    return next(e)
  })

  // Every request of an easy turn names Haiku; subagents keep their own models.
  on('turn.step', async function* ($, e, next) {
    const route = e.agentId === undefined ? await read($, current) : null

    if (route === null || route.turnId !== e.turnId) {
      return yield* next(e)
    }

    const model = route.model === 'cheap' ? CHEAP_MODEL : e.model

    if (e.index === 0) {
      await update($, current, r => (r === null ? r : { ...r, answeredBy: model }))
    }

    return yield* next(model === e.model ? e : { ...e, model })
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      const route = await read($, current)

      if (route !== null && route.turnId === e.turnId && route.answeredBy !== undefined) {
        await update($, recent, list => [route, ...list].slice(0, RECENT))
        $.ui.status(`router: ${modelName(route.answeredBy)} answered · ${route.why}`)

        // The status line isn't drawn in every app; a notice in the chat is.
        if (route.model === 'cheap') {
          await $.session
            .append({ message: { type: 'system', content: [{ type: 'text', text: haikuNotice(route.why) }] } })
            .catch(() => undefined)
        }
      }
    }

    return result
  })
}
