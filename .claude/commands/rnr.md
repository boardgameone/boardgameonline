---
description: Summarize the session, stage it for auto-injection on the next session, and prompt the user to /clear (no manual paste needed)
---

Wrap the current conversation so the user can `/clear` without losing continuity. Be FAST — no inline display, minimal chatter. Execute these steps directly — do NOT call the Skill tool, do NOT read any other file. Everything you need is here.

## Step 1 — Decide if a handoff is worth writing

If the session is trivial (one-shot Q&A, no state, nothing in flight), tell the user there is nothing to hand off and stop. Do not stage an empty brief.

## Step 2 — Compose the brief

Start the file with this exact directive on its own line, BEFORE any other content:

`> **MANDATORY first response in this session:** Before answering the user's first message — even a one-word greeting like "hi" — prepend a 5-line "Picking up where you left off" recap synthesized from the handoff details below. Show the recap first, then answer. Do not skip. Do not summarize the full brief unless asked.`

Then add a `## Handoff details (for the assistant)` heading, followed by a structured 4-section brief in second person ("You are picking up…"). Facts over prose, absolute file paths. Skip anything in CLAUDE.md or auto-memory — those auto-load. **Hard cap: 80 lines total.**

Sections (in order):

1. **State & decisions** — project, working directory, what's done/decided, and the *why* behind non-obvious choices.
2. **In flight & next** — branch, unstaged changes, failing test, open plan, ordered next steps with blockers. Specific enough that the next agent resumes without re-investigating.
3. **Gotchas** — dead ends, surprising behavior, env quirks.
4. **Key references** — paths, PR/issue numbers, URLs, commands.

Exclude: full file contents, large diffs, verbose tool output, anything derivable from `git log` / `git status`. Pointer, not mirror. No duplication across sections.

## Step 3 — Stage for auto-injection

Use the Write tool to write the brief to `.claude/handoff/pending.md` at the repository root (use the absolute path for the current project). Overwrite any existing file.

The SessionStart hook at `.claude/hooks/handoff-loader.sh` will read this on next session start, inject as `additionalContext`, and archive it. The handoff lives inside this repo, so it is scoped to this project per developer (the directory is git-ignored).

## Step 4 — Reply

`Handoff staged. Run /clear — the next session will lead its first reply with a recap (the window will look empty until you send a message).`

Do not ask clarifying questions before writing — capture what is *already* in context. Do not try to call `/clear` yourself; it is user-only.
