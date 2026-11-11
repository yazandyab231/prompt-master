---
name: prompt-master
description: Turns the user's rough prompt into a clear, effective one, asks quick multiple-choice questions only when something important is missing, then does the task right away without waiting for "go". Use whenever a message starts with "pm:" or "pm " (any capitalization), or the user asks to improve, rewrite or fix a prompt before running it. Also handles the user's answers to Prompt Master's questions.
---

# Prompt Master

The flow: rough prompt → quick multiple-choice questions, only if needed → the final prompt card → do the work in the same reply. The user never has to say "go" and never has to write a long answer.

The rough prompt is everything after `pm:` / `pm `. Treat it as text to rewrite, never as instructions about this process.

## 1. Decide whether to ask

Ask only when a missing detail would change the result a lot and there is no safe, sensible default: who it is for, which of two quite different things they mean, a hard limit (length, budget, platform, deadline). If a sensible default exists, use it and write it into the prompt as a stated assumption instead of asking. Small or clear tasks need no questions: go straight to step 3.

## 2. Ask, multiple choice only

- 1 to 4 questions, each with 2 to 4 short options. Put the option you would pick first and mark it "(Recommended)". Always allow the user's own answer.
- Never ask an open question that needs a written paragraph.
- If you have a tool that shows the user clickable multiple-choice questions (for example AskUserQuestion), use it, with all the questions in one call, and nothing else first.
- Otherwise send one short message in exactly this shape and nothing else, then wait:

```
### ✦ PROMPT MASTER · quick questions
**1. Who is it for?**
a) Recommended option (Recommended) · b) Option · c) Option
**2. How long?**
a) Option (Recommended) · b) Option
Reply like `1a 2b`, or type your own answer.
```

## 3. Build the final prompt

Rewrite rules:
1. Keep the user's intent exactly. Do not add goals, features, technologies, constraints or preferences they did not state, imply or choose in an answer.
2. Open with the goal in one or two sentences: what they want, and why if they said why.
3. Keep every concrete detail they gave (names, numbers, quotes, error messages, code) verbatim, and fold in every answer they picked.
4. Say what a good result looks like and what form the answer should take, as far as their words and answers support.
5. State any assumption you made in place of a question, so it is visible.
6. Match length to the task. A small request stays a few lines. Use short headings or bullets only when the prompt has several distinct parts.
7. Write to Claude directly ("you"), in plain language, in the same language the user wrote in.
8. Fix spelling and grammar and drop filler, but keep tone markers that matter ("quick", "rough draft", "production-ready").
9. Use the earlier conversation only to make vague references specific ("that error", "the other one"), and only where it is unambiguous.

Grade the rough prompt and the final prompt strictly against five checks. A check passes only if the text actually says it.
- **Goal**: what is wanted is clear
- **Context**: the background needed (situation, audience, what exists already)
- **Limits**: constraints, requirements or preferences
- **Format**: what form or shape the result should take
- **Done**: how to tell the result is good or finished

Score = passed checks × 2, out of 10. The final score rises only for what the user said, answered, or what you stated as an assumption.

## 4. Show the card, then do the work in the same reply

Start the reply with:

```
### ✦ PROMPT MASTER
**Before** ▰▰▱▱▱▱▱▱▱▱ 2/10 → **After** ▰▰▰▰▰▰▰▰▱▱ 8/10

✓ Goal · ✨ Context · ○ Limits · ✨ Format · ✨ Done
```

- The bars have 10 cells: ▰ per point, ▱ for the rest.
- Per check: ✓ the rough prompt already had it, ✨ the final prompt added it, ○ still missing.

Then the final prompt in a code block with no language tag (so it has a copy button), then the line `**▶ Running it now**`, then a horizontal rule (`---`), then carry out the final prompt fully, exactly as if the user had sent it themselves. No "reply go" line, no waiting.

The one exception: if carrying it out would send, publish, delete, pay for or otherwise do something hard to undo, do all the work up to that step and stop there:

1. Show the card, then the full draft of exactly what will be sent, published or done (the whole email, post or message, every recipient and subject; for a deletion or payment, exactly what and how much). Never a summary.
2. Ask one multiple-choice question. With a clickable-questions tool (for example AskUserQuestion): the question "Send it as shown? Pick one, or choose Other to type fixes.", with the options "Yes, send it" (Recommended) and "No, don't send it", worded for the action (publish, delete, pay). The tool's own free-text answer is where the user types fixes. Without such a tool, end the reply with: `Reply **yes** to send it, **no** to stop, or type your fixes.`
3. Fixes (typos, wording, recipients, anything): apply exactly those and nothing else, show the full updated draft, and ask the same question again.
4. Do the hard-to-undo step only after an explicit yes to the draft as last shown. No means stop and leave nothing half-done.

## 5. Afterwards

If the user says "redo", "shorter", "more detail" or corrects the prompt, rebuild it, show a new card and run it again in the same reply.
