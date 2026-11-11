# Prompt Master

A Claude Code mod that turns a rough prompt into a clear one before Claude acts on it.

Start a message with `pm:` (or `/pm` where the app sends it) and your rough prompt. Nothing else triggers it, so every other message gets a normal, quick reply.

1. If something important is missing, Claude asks 1 to 4 quick **multiple-choice** questions (clickable where the app supports it, otherwise reply like `1a 2b`). Clear prompts skip this.
2. Claude shows the draft prompt with a **before → after** score against five checks: **Goal, Context, Limits, Format, Done**, and asks **Yes / No** with a box to type fixes (clickable where the app supports it, otherwise reply `yes`, `no` or your fixes).
3. On **Yes**, Claude starts the task immediately. Anything hard to undo (sending, publishing, deleting, paying) gets one more Yes / No on the full draft of exactly what will happen.

Say "redo", "shorter" or "more detail" to rebuild the draft prompt. This works in every app, phones included, because the card is Claude's own reply.

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
- With a conversation to read, the rewrite runs on the session's own model. In a new chat it uses Sonnet. You can change the model at the top of `plugins/prompt-master/hooks/rewrite.ts`.

## More mods in this repo

Each mod installs on its own, the same way as Prompt Master.

### Session relay

Pass work between two Claude Code sessions on the same computer: one plans, the other builds, and it reports back.

```
/plugin install session-relay --marketplace yazandyab231/prompt-master
```

- `/relay` lists the sessions you can reach and shows this session's name.
- `/relay <name>` picks the session to send work to. `/relay off` stops it.
- `/handoff [note]` sends Claude's last reply, plus your note, to that session to carry out. It replies here with a summary when done.
- The status line shows where `/handoff` goes and how many messages came back.

The other session treats the handoff as a message from another session, so it may ask you before it starts.

### Agent dashboard

A **Dashboard** panel beside the chat: the agents running right now and what each is doing, plus this project's git branch, uncommitted files and the open tasks in `TASKS.md`.

```
/plugin install agent-dashboard --marketplace yazandyab231/prompt-master
```

- The panel opens by itself where there's room for it beside the chat. `/dash` opens it anywhere.
- Click an agent to open its conversation.
- It refreshes after every turn, checks agents every few seconds, and has a **Refresh** button.
- Tasks are Markdown checkboxes in `TASKS.md` in the project folder: `- [ ] open`, `- [x] done`.

### Model router

Sends easy prompts to Haiku so your more expensive model's limits last longer.

```
/plugin install model-router --marketplace yazandyab231/prompt-master
```

How it decides, for each prompt you type:

1. **Free filter, no model call:** prompts over 300 characters, prompts that mention code, files, paths or errors, prompts with attachments, and conversations that have grown by more than about 40,000 tokens stay on your model. Claude's own built-in instructions, which every request carries, don't count toward that.
2. **Opus rates the rest:** one short Opus call reads only your prompt and answers EASY or HARD. When unsure, it says HARD.
3. **EASY runs on Haiku.** Everything else stays on your model. Subagents always keep their own model.

Any reply Haiku wrote ends with a short italic line saying so, like *↳ Haiku answered this (Opus rated it easy)*. It is part of the reply, the one thing every app shows, so Claude reads it later too. Replies from your own model are untouched. Where the app draws a status line, it also shows who answered each reply. `/router` lists the last replies and who wrote each, plus this session's counts, and `/router off` / `/router on` switch it.

Good to know: the rating is an extra Opus call and adds a moment before the reply. Haiku is weaker on anything that turns out harder than it looked. If a Haiku answer is off, ask again with more detail or switch the router off.

## Develop

Each plugin lives in its own folder under `plugins/`. Check and test one at a time:

```bash
claude plugin validate plugins/prompt-master
claude plugin test plugins/prompt-master
```

```bash
claude plugin validate plugins/session-relay
claude plugin test plugins/session-relay
```

```bash
claude plugin validate plugins/agent-dashboard
claude plugin test plugins/agent-dashboard
```

```bash
claude plugin validate plugins/model-router
claude plugin test plugins/model-router
```

`claude plugin validate .` checks the marketplace file.
