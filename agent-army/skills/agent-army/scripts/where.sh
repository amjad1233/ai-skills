#!/usr/bin/env bash
# where.sh <operation> [agent] — locate each agent's window/pane and tell you how to
# inspect and close it. Reads the runtime handle recorded by launch-agent.sh, then
# verifies the process is actually still alive (three signals, same as fleet-status).
#
# This is the "master knows where each window is / Claude can query it" tool. Run it
# to get, per agent: substrate, live PID, how to peek in, how to close.
# Requires: jq. Reads ~/.claude/agent-army/<operation>/manifest.json + agents/*.runtime.json
set -uo pipefail

OP="${1:?usage: where.sh <operation> [agent]}"; ONE="${2:-}"
CC="$HOME/.claude/agent-army/$OP"
MAN="$CC/manifest.json"
[ -f "$MAN" ] || { echo "no manifest at $MAN"; exit 1; }

alive_pid() { # name worktree recorded_pid → echoes a live pid or nothing
  local name="$1" wt="$2" rpid="$3"
  if [ -n "$rpid" ] && [ "$rpid" != "null" ] && kill -0 "$rpid" 2>/dev/null; then echo "$rpid"; return; fi
  local bp; bp=$(pgrep -f "briefs/$name.md" 2>/dev/null | head -1)
  if [ -n "$bp" ]; then echo "$bp"; return; fi
  [ -d "$wt" ] || return
  for pid in $(pgrep -f "claude" 2>/dev/null); do
    local cwd; cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    case "$cwd" in "$wt"|"$wt"/*) echo "$pid"; return;; esac
  done
}

printf "\n  WHERE — operation %s\n\n" "$OP"
jq -c '.agents[]' "$MAN" | while read -r a; do
  name=$(echo "$a" | jq -r .name)
  [ -n "$ONE" ] && [ "$name" != "$ONE" ] && continue
  wt=$(echo "$a" | jq -r .worktree)
  rt="$CC/agents/$name.runtime.json"
  if [ ! -f "$rt" ]; then printf "  %-16s no runtime handle (launched by an old script, or never started)\n" "$name"; continue; fi
  sub=$(jq -r '.substrate // "?"' "$rt"); tgt=$(jq -r '.target // ""' "$rt")
  tty=$(jq -r '.tty // ""' "$rt"); wid=$(jq -r '.windowId // ""' "$rt"); rpid=$(jq -r '.pid // empty' "$rt")
  pid=$(alive_pid "$name" "$wt" "$rpid")
  state="DEAD (window may be an idle shell)"; [ -n "$pid" ] && state="ALIVE pid=$pid"

  printf "  %-16s [%s]  %s\n" "$name" "$sub" "$state"
  case "$sub" in
    tmux)
      printf "      inspect: tmux capture-pane -t '%s' -p | tail -40\n" "$tgt"
      printf "      attach : tmux attach -t '%s'\n" "${tgt%%:*}"
      printf "      close  : stop-agent.sh %s %s\n" "$OP" "$name" ;;
    terminal-app)
      printf "      window : Terminal.app id=%s  tty=%s\n" "$wid" "$tty"
      printf "      inspect: bring window %s to front (osascript) or watch tty %s\n" "$wid" "$tty"
      printf "      close  : stop-agent.sh %s %s\n" "$OP" "$name" ;;
    nohup)
      printf "      log    : %s   (tail -f to watch)\n" "$tgt"
      printf "      close  : stop-agent.sh %s %s\n" "$OP" "$name" ;;
    *)
      printf "      target : %s\n" "$tgt"
      printf "      close  : stop-agent.sh %s %s\n" "$OP" "$name" ;;
  esac
  echo
done
