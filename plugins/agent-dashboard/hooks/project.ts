import type { DashGit, DashTasks } from '../types'

const MAX_OPEN_TASKS = 50

/** Reads `git status --porcelain=v1 --branch`: the branch line, then one line per changed file. */
export function parseGitStatus(stdout: string): DashGit {
  const lines = stdout.split('\n').filter(line => line !== '')
  const first = lines[0] ?? ''
  const head = first.startsWith('## ') ? first.slice(3) : ''
  const files = first.startsWith('## ') ? lines.slice(1) : lines

  let rest = head
  let ahead = 0
  let behind = 0
  const bracket = / \[([^\]]*)\]$/.exec(rest)

  if (bracket !== null) {
    rest = rest.slice(0, bracket.index)
    ahead = Number(/ahead (\d+)/.exec(bracket[1] ?? '')?.[1] ?? 0)
    behind = Number(/behind (\d+)/.exec(bracket[1] ?? '')?.[1] ?? 0)
  }

  const dots = rest.indexOf('...')
  let branch = dots >= 0 ? rest.slice(0, dots) : rest

  if (branch.startsWith('No commits yet on ')) {
    branch = branch.slice('No commits yet on '.length)
  } else if (branch === 'HEAD (no branch)') {
    branch = 'detached HEAD'
  }

  return {
    branch: branch === '' ? 'unknown' : branch,
    ahead,
    behind,
    changed: files.map(line => ({ code: line.slice(0, 2).trim() || '?', path: line.slice(3) })),
  }
}

/** Reads Markdown checkboxes: `- [ ] open` and `- [x] done`. */
export function parseTasks(text: string): DashTasks {
  const open: string[] = []
  let done = 0

  for (const line of text.split('\n')) {
    const box = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)

    if (box === null) {
      continue
    }

    if (box[1] === ' ') {
      const task = (box[2] ?? '').replace(/\*\*|__|~~/g, '').trim()

      if (task !== '' && open.length < MAX_OPEN_TASKS) {
        open.push(task)
      }
    } else {
      done += 1
    }
  }

  return { open, done }
}
