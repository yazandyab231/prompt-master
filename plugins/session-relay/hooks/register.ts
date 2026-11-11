import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionReceiveInput } from 'claude-code'

import type { RelayPartner } from '../types'

const PLUGIN = 'session-relay'
const MAX_CHARS = 20_000

const partner = atom({ plugin: 'session-relay', key: 'partner' } as const, null as RelayPartner)
const received = atom({ plugin: 'session-relay', key: 'received' } as const, 0)

/** The line under the prompt: who /handoff goes to, and how much came back. */
function statusLine(name: RelayPartner, got: number): string | undefined {
  const arrived = got === 1 ? '1 message in' : `${got} messages in`

  if (name === null) {
    return got > 0 ? `relay: ${arrived}` : undefined
  }

  return got > 0 ? `relay → ${name} · ${arrived}` : `relay → ${name}`
}

async function showStatus($: EngineInterface): Promise<void> {
  $.ui.status(statusLine(await read($, partner), await read($, received)))
}

/** The sessions this one can reach, as the ListAgents tool words them. */
async function listSessions($: EngineInterface): Promise<string> {
  try {
    const ran = await $.tool.call({ tool: 'ListAgents' })

    if (ran.deny !== undefined) {
      return `Couldn't list sessions: ${ran.deny}`
    }

    const listing = ran.text ?? (ran.result as { listing?: string } | undefined)?.listing

    return listing?.trim() || 'No list came back.'
  } catch (err) {
    return `Couldn't list sessions here (${String(err)}). Peer messaging may be off in this Claude Code.`
  }
}

/** The message the other session reads. Its first line is the preview it shows. */
export function composeHandoff(work: string, note: string): string {
  const body =
    work.length > MAX_CHARS
      ? `${work.slice(0, MAX_CHARS)}\n[cut: the rest was longer than ${MAX_CHARS.toLocaleString('en-US')} characters]`
      : work

  return [
    'Handoff from another Claude Code session, sent by the person with /handoff (session-relay mod).',
    note === '' ? '' : `Their note: ${note}`,
    body === '' ? '' : `--- work passed on ---\n${body}\n--- end ---`,
    'Carry this out here. When you finish, reply to the sender with SendMessage: a short summary of what you did and anything left open.',
  ]
    .filter(part => part !== '')
    .join('\n\n')
}

/** A message another session's model or plugin sent to this conversation. */
function isFromPeerSession(e: SessionReceiveInput): boolean {
  if (e.agentId !== undefined) {
    return false
  }

  if (e.origin.kind === 'peer-send-message') {
    return true
  }

  return e.origin.kind === 'peer' && !('teammate' in e.origin)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'relay',
      description: 'Pick the session /handoff sends work to, or list the sessions you can reach',
      argumentHint: '[session name | off]',
    })
    await $.command.register({
      name: 'handoff',
      description: "Send Claude's last reply to your relay session to carry out",
      argumentHint: '[note]',
    })
    await showStatus($)

    return next(e)
  })

  on('command.run', { command: 'relay' }, async ($, e) => {
    const arg = e.args.trim()

    if (arg === 'off') {
      await update($, partner, () => null)
      await showStatus($)

      return { text: 'Relay off. Pick a session again with /relay <name>.' }
    }

    if (arg !== '') {
      await update($, partner, () => arg)
      await showStatus($)

      return { text: `Relay set: /handoff now sends work to ${arg}.` }
    }

    const current = await read($, partner)
    const listing = await listSessions($)

    return {
      text: [
        current === null ? 'No relay session picked yet.' : `Relay session: ${current}`,
        listing,
        'Pick one with /relay <name>, then use /handoff [note] to send it work. /relay off stops it.',
      ].join('\n\n'),
    }
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const to = await read($, partner)

    if (to === null) {
      return {
        text: 'Pick a session first: /relay lists the ones you can reach, then /relay <name>.',
      }
    }

    const note = e.args.trim()
    const messages = await $.session.messages()
    const last = [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && m.text.trim() !== '')
    const work = last?.text.trim() ?? ''

    if (work === '' && note === '') {
      return {
        text: "Nothing to hand off yet: Claude hasn't replied here. Say what to do: /handoff <note>.",
      }
    }

    try {
      const sent = await $.session.send({ to, text: composeHandoff(work, note) })

      if (!sent.isDelivered) {
        return { text: `Not sent to ${to}: ${sent.reason}` }
      }
    } catch (err) {
      return { text: `Not sent to ${to}: ${String(err)}` }
    }

    $.ui.toast(`Handed off to ${to}`)

    const what = [work === '' ? '' : "Claude's last reply", note === '' ? '' : 'your note']
      .filter(part => part !== '')
      .join(' and ')

    return { text: `Sent ${what} to ${to}. It will report back here when it's done.` }
  })

  on('session.receive', async ($, e, next) => {
    if (isFromPeerSession(e)) {
      await update($, received, n => n + 1)
      await showStatus($)

      const fromRelay = 'plugin' in e.origin && e.origin.plugin === PLUGIN
      $.ui.toast(fromRelay ? 'Work handed off from another session' : 'Another session sent a message')
    }

    return next(e)
  })
}
