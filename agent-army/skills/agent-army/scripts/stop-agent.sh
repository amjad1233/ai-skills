#!/usr/bin/env bash
# stop-agent.sh <operation> <agent> [--force] — gracefully stop one agent and CLOSE its
# window/pane, using the runtime handle recorded by launch-agent.sh. Kills the idle-burn
# that happens when a DONE agent keeps a session (and its meter) alive.
#
# Graceful path: ask the REPL to exit (send /exit), give it a moment, then close the
# substrate. --force skips the grace and closes/kills immediately.
# VERIFIES the process is gone before reporting success.
# Requires: jq. Reads ~/.claude/agent-army/<operation>/agents/<agent>.runtime.json
set -uo pipefail

OP="${1:?usage: stop-agent.sh <operation> <agent> [--force]}"
AGENT="${2:?usage: stop-agent.sh <operation> <agent> [--force]}"
FORCE=""; [ "${3:-}" = "--force" ] && FORCE=1
CC="$HOME/.claude/agent-army/$OP"
MAN="$CC/manifest.json"; rt="$CC/agents/$AGENT.runtime.json"
[ -f "$rt" ] || { echo "no runtime handle at $rt — close the window manually."; exit 1; }

wt=$(jq -r --arg n "$AGENT" '.agents[]|select(.name==$n).worktree // ""' "$MAN" 2>/dev/null)
sub=$(jq -r '.substrate // "?"' "$rt"); tgt=$(jq -r '.target // ""' "$rt")
wid=$(jq -r '.windowId // ""' "$rt"); rpid=$(jq -r '.pid // empty' "$rt")

resolve_pid() {
  if [ -n "$rpid" ] && [ "$rpid" != "null" ] && kill -0 "$rpid" 2>/dev/null; then echo "$rpid"; return; fi
  pgrep -f "briefs/$AGENT.md" 2>/dev/null | head -1
}

echo "stopping $AGENT  [$sub]  target=$tgt"

case "$sub" in
  tmux)
    if [ -z "$FORCE" ]; then tmux send-keys -t "$tgt" "/exit" Enter 2>/dev/null; sleep 2; fi
    tmux kill-pane -t "$tgt" 2>/dev/null || tmux kill-window -t "$tgt" 2>/dev/null ;;
  terminal-app)
    pid=$(resolve_pid)
    if [ -z "$FORCE" ] && [ -n "$pid" ]; then kill -INT "$pid" 2>/dev/null; sleep 2; fi
    # close the exact Terminal window we recorded the id for
    osascript >/dev/null 2>&1 <<OSA
tell application "Terminal"
	try
		close (every window whose id is ${wid:-0})
	end try
end tell
OSA
    pid=$(resolve_pid); [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null ;;
  nohup)
    pid=$(resolve_pid); [ -n "$pid" ] && { [ -z "$FORCE" ] && kill -INT "$pid" 2>/dev/null && sleep 2; kill -TERM "$pid" 2>/dev/null; } ;;
  *)
    pid=$(resolve_pid); [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null
    echo "  (substrate '$sub' has no window-close hook; killed process if found)" ;;
esac

# verify gone
sleep 1
left=$(resolve_pid)
if [ -z "$left" ]; then
  echo "STOPPED: $AGENT process gone; window closed."
  # mark the handle stopped so the board stops counting it
  jq '.pid=null | .stoppedAt=(now|floor)' "$rt" > "$rt.t" 2>/dev/null && mv "$rt.t" "$rt"
  exit 0
fi
echo "WARN: $AGENT still alive (pid $left). Re-run with --force, or close the window by hand."; exit 3
