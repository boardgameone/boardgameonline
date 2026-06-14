#!/bin/bash
# UserPromptSubmit hook: nudge the user to run /rnr once context usage
# crosses the threshold. Fires at most once per session (sentinel file).

THRESHOLD_PCT=65
CONTEXT_WINDOW=1000000

INPUT=$(cat)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

SENTINEL="${TMPDIR:-/tmp}/claude-rnr-nudge-${SESSION_ID}"
[ -f "$SENTINEL" ] && exit 0

CHARS=$(wc -c < "$TRANSCRIPT" | tr -d ' ')
TOKENS=$((CHARS / 4))
THRESHOLD=$((CONTEXT_WINDOW * THRESHOLD_PCT / 100))

if [ "$TOKENS" -ge "$THRESHOLD" ]; then
  PCT=$((TOKENS * 100 / CONTEXT_WINDOW))
  touch "$SENTINEL"
  printf '{"systemMessage": "Context at ~%d%% of %dk window. Run /rnr to stage a handoff before /clear."}\n' "$PCT" $((CONTEXT_WINDOW / 1000))
fi

exit 0
