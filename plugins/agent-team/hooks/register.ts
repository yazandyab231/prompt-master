import type { Register } from 'claude-code'

export const MAX_FIX_ROUNDS = 2

/** The three roles. The planner and tester cannot edit files, so only the builder changes code. */
export const ROLES = [
  {
    name: 'planner',
    description: 'Reads the code and writes a short numbered plan with acceptance checks. Never edits files.',
    prompt:
      'You are the PLANNER. Read the relevant code, then reply with: (1) a numbered plan of at most 8 small steps, (2) the files each step touches, (3) acceptance checks the tester can run (exact commands where possible). Do not edit files. If the task is ambiguous, say what you assumed.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    disallowedTools: ['Edit', 'Write', 'NotebookEdit'],
    model: 'inherit',
  },
  {
    name: 'builder',
    description: 'Implements a plan by editing files. Reports what changed.',
    prompt:
      'You are the BUILDER. Implement exactly the plan you are given, nothing extra. Keep changes small. When done, reply with the files changed and anything you could not finish. If given tester failures, fix only those.',
    model: 'sonnet',
  },
  {
    name: 'tester',
    description: 'Runs the acceptance checks and the project tests. Never edits files. Reports PASS or FAIL with evidence.',
    prompt:
      'You are the TESTER. Run the acceptance checks from the plan and the project\'s existing tests/linters. Do not edit files. Reply with a first line of exactly PASS or FAIL, then the commands you ran and their real output (trimmed). Never claim PASS without running something.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    disallowedTools: ['Edit', 'Write', 'NotebookEdit'],
    model: 'sonnet',
  },
] as const

/** The hidden instruction the main model follows when the person runs /team. */
export function teamBrief(task: string): string {
  return [
    `The person ran /team for this task: ${task}`,
    'Run it as a team using the Agent tool, in order, passing each agent the full context it needs (it sees nothing else):',
    '1. Agent type "agent-team:planner" with the task.',
    '2. Agent type "agent-team:builder" with the task and the planner\'s full plan.',
    '3. Agent type "agent-team:tester" with the plan\'s acceptance checks and the builder\'s report.',
    `4. If the tester's first line is FAIL, send the failures to the builder, then the tester again. At most ${MAX_FIX_ROUNDS} fix rounds.`,
    'Finish with a short status for the person: what was built, the tester\'s last verdict with its evidence, and anything still failing. If still FAIL after the last round, say so plainly; do not claim success.',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const role of ROLES) {
      await $.agent.register({ ...role, tools: role.tools ? [...role.tools] : undefined, disallowedTools: 'disallowedTools' in role ? [...role.disallowedTools] : undefined })
    }

    await $.command.register({
      name: 'team',
      description: 'Run a task with a planner, a builder and a tester agent',
      argumentHint: '<task>',
    })

    return next(e)
  })

  on('command.run', { command: 'team' }, async (_$, e) => {
    const task = e.args.trim()

    if (task === '') {
      return { text: 'Say what the team should do: /team <task>' }
    }

    return {
      text: `Team started: planner → builder → tester (up to ${MAX_FIX_ROUNDS} fix rounds).`,
      context: [teamBrief(task)],
    }
  })
}
