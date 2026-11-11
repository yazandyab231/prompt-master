// The card's vector art: a banner and the before/after prompt check. Drawn by
// the desktop, VS Code and the phone app (the terminal gets text instead).
// Every animation starts from the finished picture's values, so a surface that
// draws the SVG as a still image still shows the right thing.

import type { Check } from '../types'

const W = 360
const FONT = `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif"`
const MUTED = '#9CA3AF'

const LABELS: Record<Check, string> = {
  goal: 'Goal',
  context: 'Context',
  limits: 'Limits',
  format: 'Format',
  done: 'Done',
}

const GRADIENT = `<linearGradient id="pm-g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#7C3AED"/>
  <stop offset="0.55" stop-color="#DB2777"/>
  <stop offset="1" stop-color="#F59E0B"/>
</linearGradient>`

const SPARKLE = 'M0 -15 C2 -5 5 -2 15 0 C5 2 2 5 0 15 C-2 5 -5 2 -15 0 C-5 -2 -2 -5 0 -15Z'

export type BannerMode = 'working' | 'ready' | 'sent' | 'failed'

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Holds a value at `from` until `start` (0 to 1 of `dur`), then eases to `to`. */
function ease(attribute: string, from: string, to: string, start: number, dur: number): string {
  return `<animate attributeName="${attribute}" values="${from};${from};${to}" keyTimes="0;${start};1" dur="${dur}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.2 0.8 0.2 1"/>`
}

export function banner(mode: BannerMode, subtitle: string): string {
  const isWorking = mode === 'working'
  const fill = mode === 'failed' ? '#6B7280' : 'url(#pm-g)'
  const shimmer =
    mode === 'failed'
      ? ''
      : `<rect x="-160" y="-20" width="110" height="120" fill="url(#pm-shine)" transform="skewX(-20)">
      <animate attributeName="x" from="-160" to="${W + 160}" dur="${isWorking ? 1.6 : 1.3}s" ${isWorking ? 'repeatCount="indefinite"' : 'fill="freeze"'}/>
    </rect>`
  const spin = isWorking
    ? '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/>'
    : mode === 'ready'
      ? '<animateTransform attributeName="transform" type="scale" values="0.4;1.25;1" dur="0.7s" fill="freeze"/>'
      : ''
  const dots = isWorking
    ? [0, 1, 2]
        .map(
          i =>
            `<circle cx="${312 + i * 14}" cy="38" r="4" fill="#fff"><animate attributeName="cy" values="38;29;38" dur="0.9s" begin="${i * 0.15}s" repeatCount="indefinite"/></circle>`,
        )
        .join('')
    : ''
  const tick =
    mode === 'sent'
      ? `<circle cx="326" cy="38" r="15" fill="#fff" fill-opacity="0.22"/>
    <path d="M318 38 l6 6 l11 -12" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="0">${ease('stroke-dashoffset', '30', '0', 0.1, 0.6)}</path>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="76" viewBox="0 0 ${W} 76">
  <defs>
    ${GRADIENT}
    <linearGradient id="pm-shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="pm-clip"><rect width="${W}" height="76" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#pm-clip)">
    <rect width="${W}" height="76" fill="${fill}"/>
    <circle cx="300" cy="-10" r="70" fill="#fff" fill-opacity="0.08"/>
    <circle cx="350" cy="80" r="44" fill="#fff" fill-opacity="0.07"/>
    ${shimmer}
  </g>
  <g transform="translate(38 38)"><path d="${SPARKLE}" fill="#fff">${spin}</path></g>
  <text x="66" y="35" ${FONT} font-size="18" font-weight="800" letter-spacing="2.4" fill="#fff">PROMPT MASTER</text>
  <text x="66" y="56" ${FONT} font-size="12.5" fill="#fff" fill-opacity="0.88">${escape(subtitle)}</text>
  ${dots}${tick}
</svg>`
}

function ring(cx: number, score: number, stroke: string, ink: string, label: string, delay: number): string {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = (c * (1 - score / 10)).toFixed(1)

  return `<circle cx="${cx}" cy="56" r="${r}" fill="none" stroke="${MUTED}" stroke-opacity="0.22" stroke-width="9"/>
  <circle cx="${cx}" cy="56" r="${r}" fill="none" stroke="${stroke}" stroke-width="9" stroke-linecap="round"
    stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} 56)">${ease('stroke-dashoffset', c.toFixed(1), offset, delay, 1.5)}</circle>
  <text x="${cx}" y="63" text-anchor="middle" ${FONT} font-size="24" font-weight="800" fill="${ink}">${score}<tspan font-size="12" font-weight="600" fill="${MUTED}">/10</tspan></text>
  <text x="${cx}" y="110" text-anchor="middle" ${FONT} font-size="10" font-weight="700" letter-spacing="1.6" fill="${MUTED}">${label}</text>`
}

/** The before/after prompt check: two score rings and the five checks. */
export function meter(before: readonly Check[], after: readonly Check[]): string {
  const was = before.length * 2
  const now = after.length * 2
  const gain = now - was
  const headline = gain > 0 ? `+${gain}` : gain === 0 ? '±0' : String(gain)
  const caption = gain > 0 ? 'clearer' : now === 10 ? 'already solid' : 'needs your input'

  const pills = (Object.keys(LABELS) as Check[])
    .map((check, i) => {
      const x = 6 + i * 70
      const has = after.includes(check)
      const isNew = has && !before.includes(check)
      const text = `${isNew ? '+ ' : has ? '✓ ' : ''}${LABELS[check]}`
      const shape = has
        ? `<rect x="${x}" y="126" width="64" height="26" rx="13" fill="url(#pm-g)"/>`
        : `<rect x="${x + 0.75}" y="126.75" width="62.5" height="24.5" rx="12.25" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 3"/>`

      return `<g opacity="1">${ease('opacity', '0', '1', Math.min(0.9, 0.45 + i * 0.09), 1.9)}${shape}
    <text x="${x + 32}" y="143.5" text-anchor="middle" ${FONT} font-size="11.5" font-weight="700" fill="${has ? '#fff' : MUTED}">${text}</text></g>`
    })
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="160" viewBox="0 0 ${W} 160">
  <defs>${GRADIENT}</defs>
  ${ring(52, was, MUTED, MUTED, 'BEFORE', 0)}
  <path d="M100 56 h26 m-7 -7 l7 7 l-7 7" fill="none" stroke="${MUTED}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  ${ring(174, now, 'url(#pm-g)', '#A855F7', 'AFTER', 0.2)}
  <g opacity="1">${ease('opacity', '0', '1', 0.65, 1.6)}
    <text x="290" y="64" text-anchor="middle" ${FONT} font-size="34" font-weight="900" fill="url(#pm-g)">${headline}</text>
    <text x="290" y="86" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="${MUTED}">${caption}</text>
  </g>
  ${pills}
</svg>`
}

export function meterAlt(before: readonly Check[], after: readonly Check[]): string {
  const open = (Object.keys(LABELS) as Check[]).filter(check => !after.includes(check))

  return `Prompt check: ${before.length * 2} of 10 before, ${after.length * 2} of 10 after.${
    open.length ? ` Still open: ${open.map(check => LABELS[check]).join(', ')}.` : ''
  }`
}

/** The terminal's line for the same check. */
export function meterText(before: readonly Check[], after: readonly Check[]): string {
  const marks = (Object.keys(LABELS) as Check[])
    .map(check =>
      after.includes(check)
        ? `${before.includes(check) ? '✓' : '+'}${LABELS[check]}`
        : `·${LABELS[check]}`,
    )
    .join('  ')

  return `Prompt check ${before.length * 2}/10 → ${after.length * 2}/10   ${marks}`
}
