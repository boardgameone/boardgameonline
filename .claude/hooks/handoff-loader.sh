#!/bin/bash
# SessionStart hook: if a pending handoff brief exists, inject it as additionalContext
# and archive it so it's only consumed once. Project-scoped: state lives under the
# repo's .claude/handoff/ so each developer gets their own per-project handoff.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
PENDING="$PROJECT_DIR/.claude/handoff/pending.md"
ARCHIVE_DIR="$PROJECT_DIR/.claude/handoff/archive"

if [ ! -f "$PENDING" ]; then
  exit 0
fi

BRIEF=$(cat "$PENDING")

if [ -z "$BRIEF" ]; then
  exit 0
fi

TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$ARCHIVE_DIR"
mv "$PENDING" "$ARCHIVE_DIR/handoff-$TS.md"

FRAMED="<session-handoff>
The user ran /clear. Before responding to their FIRST message in this session — even if it is a one-word greeting like \"hi\" — you MUST lead your reply with a 5-line \"Picking up where you left off\" recap synthesized from the brief below, then answer their message. This overrides the default greeting reflex. Do not skip.

$BRIEF
</session-handoff>"

ESCAPED=$(printf '%s' "$FRAMED" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ESCAPED
  }
}
EOF
