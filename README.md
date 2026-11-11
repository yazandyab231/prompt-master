# Prompt Master

A Claude Code mod that turns a rough prompt into a clear one before Claude acts on it.

Start a message with `pm:` (or `/pm` where the app sends it) and your rough prompt. Nothing else triggers it, so every other message gets a normal, quick reply.

1. If something important is missing, Claude asks 1 to 4 quick **multiple-choice** questions (clickable where the app supports it, otherwise reply like `1a 2b`). Clear prompts skip this.
2. Claude shows the final prompt with a **before → after** score against five checks: **Goal, Context, Limits, Format, Done**.
3. Claude does the task right away in the same reply. No "go" needed, except for anything hard to undo (sending, publishing, deleting, paying): there it shows the full draft and asks **Yes / No**, with a box to type fixes, and only acts on a yes.

Say "redo", "shorter" or "more detail" to rebuild and rerun it. This works in every app, phones included, because the card is Claude's own reply.

### For normal Claude chats

`chat-skill/prompt-master/` holds the same behaviour as a claude.ai skill. Zip that folder and upload it in Settings → Capabilities → Skills. Once added to your account it works in normal chats and Claude Code alike, so you don't need the mod as well.

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
