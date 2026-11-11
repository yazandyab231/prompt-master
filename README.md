# Prompt Master

A Claude Code mod that turns a rough prompt into a clear one before you send it.

Type `/pm` followed by your rough prompt. A card appears in the chat that:

- rewrites the prompt while keeping your intent, without inventing requirements you didn't state
- scores it **before → after** against five checks: **Goal, Context, Limits, Format, Done**
- lists the questions only you can answer ("Worth adding before you send")
- gives you **Send ✦**, **Shorter** and **More detail** buttons

In the desktop app there's also a Prompt Master box above the text box, with its own field and a **✦ Rewrite** button.

When the conversation already has messages, the rewrite reads them, so "fix that bug" becomes the actual bug. In a new chat it rewrites the prompt on its own.

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
/pm make my login page not suck, its slow and ugly
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
