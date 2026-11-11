# Prompt Master

A Claude Code mod that turns a rough prompt into a clear one before Claude acts on it.

Start a message with `pm:` and Claude replies with a Prompt Master card instead of doing the task:

- the prompt rewritten, keeping your intent and not inventing requirements you didn't state
- a **before → after** score against five checks: **Goal, Context, Limits, Format, Done**
- the questions only you can answer ("Worth adding")

Reply **go** to run the rewritten prompt, **shorter** or **more detail** to redo it, or answer the questions to fold them in. This works in every app, phones included, because the card is Claude's own reply.

Where the app draws mod UI (for example the terminal), there's also `/pm <rough prompt>`, which shows an animated card with **Send ✦**, **Shorter** and **More detail** buttons, plus a Prompt Master box above the text box in the desktop app.

When the conversation already has messages, the rewrite uses them, so "fix that bug" becomes the actual bug.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-master --marketplace yazandyab231/prompt-master
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; press Enter).

From a shell:

```bash
claude plugin install prompt-master --marketplace yazandyab231/prompt-master
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `yazandyab231/prompt-master`, then **Add plugin**.

## Use

```
pm: make my login page faster
```

## Good to know

- The score is Claude grading its own rewrite against a strict checklist. Read it as "what the prompt now says", not as proof the prompt is good. The **before** ring is the honest signal: it shows what your rough prompt left out.
- The rewrite can't know what you didn't tell it. Answer the "Worth adding" questions; that's where most of the improvement comes from.
- With a conversation to read, the rewrite runs on the session's own model. In a new chat it uses Sonnet. You can change the model at the top of `hooks/rewrite.ts`.

## Develop

```bash
claude plugin validate .
```

```bash
claude plugin test .
```
