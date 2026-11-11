import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, RenderInput } from 'claude-code'

import type { Draft, Style } from '../types'
import { banner, meter, meterAlt, meterText } from './art'
import type { BannerMode } from './art'
import { rewrite } from './rewrite'

const COMMAND = 'pm'
const MAX_DRAFTS = 20

// Bump the shape tag if Draft's fields change: it declines what an earlier
// version stored, which outlives a reload.
const drafts = atom({ plugin: 'prompt-master', key: 'drafts' } as const, [], {
  shape: 'drafts-2',
})
// Bumped to give the desktop box a fresh, empty field after each rewrite.
const bandRound = atom({ plugin: 'prompt-master', key: 'bandRound' } as const, 0)

const BAND_ART = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="26" viewBox="0 0 190 26">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset="0.55" stop-color="#DB2777"/><stop offset="1" stop-color="#F59E0B"/></linearGradient></defs>
  <rect width="190" height="26" rx="13" fill="url(#b)"/>
  <g transform="translate(16 13)"><path d="M0 -8 C1 -3 3 -1 8 0 C3 1 1 3 0 8 C-1 3 -3 1 -8 0 C-3 -1 -1 -3 0 -8Z" fill="#fff"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite"/></path></g>
  <text x="31" y="17.5" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11.5" font-weight="800" letter-spacing="1.8" fill="#fff">PROMPT MASTER</text>
</svg>`

type CardInput = RenderInput<'CommandOutput'> | RenderInput<'Placed'>

function rowText(n: number): string {
  return `Prompt Master draft #${n} (for the user to review; not sent)`
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

async function patch($: EngineInterface, id: string, change: Partial<Draft>): Promise<void> {
  await update($, drafts, list => list.map(one => (one.id === id ? { ...one, ...change } : one)))
}

async function work($: EngineInterface, id: string): Promise<void> {
  const draft = (await read($, drafts)).find(one => one.id === id)
  if (!draft || draft.status !== 'working') {
    return
  }
  try {
    const result = await rewrite($, draft.original, draft.style)
    if (!result.isDone) {
      await patch($, id, { status: 'failed', error: `Couldn't rewrite that: ${result.why}.` })
      return
    }
    await patch($, id, {
      status: 'ready',
      improved: result.improved,
      before: result.before,
      after: result.after,
      missing: result.missing,
      usedConversation: result.usedConversation,
    })
  } catch (error) {
    await patch($, id, { status: 'failed', error: `Something went wrong: ${String(error)}` })
  }
}

/** Starts a rewrite: a new draft, or the same one again in another style. */
async function start(
  $: EngineInterface,
  rough: string,
  style: Style,
  againId?: string,
): Promise<Draft> {
  let draft: Draft | undefined
  if (againId) {
    await patch($, againId, { status: 'working', style, error: '' })
    draft = (await read($, drafts)).find(one => one.id === againId)
  }
  if (!draft) {
    const list = await read($, drafts)
    const n = list.reduce((top, one) => Math.max(top, one.n), 0) + 1
    draft = {
      id: `pm-${n}`,
      n,
      original: rough,
      status: 'working',
      style,
      improved: '',
      before: [],
      after: [],
      missing: [],
      usedConversation: false,
      error: '',
    }
    const fresh = draft
    await update($, drafts, all => [...all, fresh].slice(-MAX_DRAFTS))
  }
  // The rewrite outlives this dispatch: the card shows "working" right away
  // and fills in when the model answers.
  const id = draft.id
  $.clock.after(1, () => void work($, id))

  return draft
}

async function send($: EngineInterface, id: string): Promise<void> {
  const draft = (await read($, drafts)).find(one => one.id === id)
  if (!draft || draft.status !== 'ready') {
    return
  }
  await patch($, id, { status: 'sent' })
  await $.prompt.submit({ text: draft.improved, asUser: true })
}

function subtitle(draft: Draft): string {
  switch (draft.status) {
    case 'working':
      return draft.style === 'shorter'
        ? 'Tightening it up…'
        : draft.style === 'detailed'
          ? 'Adding detail…'
          : 'Rewriting your prompt…'
    case 'ready':
      return `Draft #${draft.n} · ${draft.usedConversation ? 'used this conversation' : 'standalone'}`
    case 'sent':
      return `Sent · draft #${draft.n}`
    case 'failed':
      return 'That one didn’t work'
  }
}

function card($: EngineInterface, e: CardInput, draft: Draft): RenderElement {
  const { Box, Text, Button, Markdown } = $.ui.resolve(e)
  const mode: BannerMode = draft.status

  const art = (source: string, alt: string, fallback: RenderElement): RenderElement => {
    if (e.surface === 'terminal') {
      return fallback
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={source} alt={alt} isInteractive />
  }

  const head = art(
    banner(mode, subtitle(draft)),
    `Prompt Master: ${subtitle(draft)}`,
    <Text bold color="magenta">
      ✦ PROMPT MASTER <Text dimColor>{subtitle(draft)}</Text>
    </Text>,
  )

  const again = (style: Style) => () => void start($, draft.original, style, draft.id)

  let body: RenderElement
  if (draft.status === 'working') {
    body = (
      <Box flexDirection="column">
        <Text dimColor>Your rough prompt:</Text>
        <Text dimColor italic>
          {clip(draft.original, 400)}
        </Text>
      </Box>
    )
  } else if (draft.status === 'failed') {
    body = (
      <Box flexDirection="column" gap={1}>
        <Text color="red">{draft.error}</Text>
        <Box flexDirection="row" gap={2}>
          <Button key={`${draft.id}:retry`} label="Try again" variant="primary" onPress={again(draft.style)} />
        </Box>
      </Box>
    )
  } else if (draft.status === 'sent') {
    body = <Markdown text={draft.improved} dimColor />
  } else {
    body = (
      <Box flexDirection="column" gap={1}>
        {art(
          meter(draft.before, draft.after),
          meterAlt(draft.before, draft.after),
          <Text dimColor>{meterText(draft.before, draft.after)}</Text>,
        )}
        <Markdown text={draft.improved} />
        {draft.missing.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Worth adding before you send</Text>
            <Markdown text={draft.missing.map(line => `- ${line}`).join('\n')} dimColor />
          </Box>
        )}
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          <Button
            key={`${draft.id}:send`}
            label="Send ✦"
            variant="primary"
            onPress={() => void send($, draft.id)}
          />
          <Button key={`${draft.id}:shorter`} label="Shorter" onPress={again('shorter')} />
          <Button key={`${draft.id}:detailed`} label="More detail" onPress={again('detailed')} />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" borderColor="magenta" paddingX={1} paddingY={1}>
      {head}
      {body}
    </Box>
  )
}

export const register: Register = on => {
  let bandText = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pm',
      description: 'Prompt Master: rewrite a rough prompt, check it, send it in one tap',
      argumentHint: '<rough prompt>',
    })
    // A reload stops rewrites in flight; their cards offer Try again.
    await update($, drafts, list =>
      list.map(one =>
        one.status === 'working'
          ? { ...one, status: 'failed', error: 'Interrupted before it finished.' }
          : one,
      ),
    )

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const rough = e.args.trim()
    if (!rough) {
      return {
        text: 'Usage: `/pm <your rough prompt>`. Prompt Master rewrites it, scores it before and after, and gives you a Send button.',
      }
    }
    const draft = await start($, rough, 'balanced')

    return { text: rowText(draft.n) }
  }).catch(() => ({
    text: "Prompt Master hit an error and couldn't start. Nothing was sent.",
  }))

  on('ui.render', { component: 'CommandOutput', props: { command: COMMAND } }, async ($, e, next) => {
    const n = Number(/draft #(\d+)/.exec(e.props.text)?.[1])
    const draft = (await read($, drafts)).find(one => one.n === n)

    return draft && !e.props.isErrored ? card($, e, draft) : next(e)
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== 'prompt-master') {
      return next(e)
    }
    const draft = (await read($, drafts)).find(one => one.id === e.props.id)

    return draft ? card($, e, draft) : next(e)
  })

  // The desktop app's band above the prompt: a box of its own with a button.
  // Phones don't draw this band; there, /pm is the way in.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }
    const { Box, Button, Input, Svg } = $.ui.resolve(e)
    const round = await read($, bandRound)

    const go = async (value: string): Promise<void> => {
      const rough = value.trim()
      if (!rough) {
        $.ui.toast('Type a rough prompt first.')
        return
      }
      bandText = ''
      const draft = await start($, rough, 'balanced')
      await update($, bandRound, r => r + 1)
      await $.ui.place({ id: draft.id })
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={BAND_ART} alt="Prompt Master" isInteractive />
        <Box flexDirection="row" gap={1} alignItems="flex-end">
          <Box flexGrow={1}>
            <Input
              key={`rough-${round}`}
              placeholder="Rough prompt here; Enter or ✦ Rewrite turns it into a great one"
              submitLabel="rewrite"
              rows={2}
              onInput={value => {
                bandText = value
              }}
              onSubmit={value => void go(value)}
            />
          </Box>
          <Button key="rewrite" label="✦ Rewrite" variant="primary" onPress={() => void go(bandText)} />
        </Box>
      </Box>
    )
  })
}
