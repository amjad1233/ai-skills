#!/usr/bin/env bash
# launch-agent.sh <operation> <agent> [--resume] [--terminal <name>] [--tmux] — start one
# worker in a VISIBLE terminal window, VERIFY it, and RECORD a runtime handle so the master
# can later locate / inspect / close its window.
#
# Substrate selection (visible-by-default — you should SEE your agents, not hunt for them):
#   --terminal <name>   force a substrate. One of:
#                         macOS  : terminal-app | iterm | warp
#                         Linux  : gnome-terminal | konsole | xterm
#                         Windows: windows-terminal | powershell
#                         any    : tmux | nohup
#   --tmux              alias for --terminal tmux (panes survive SSH disconnect, but HIDDEN).
#   (neither)           auto-detect, preferring a VISIBLE window for the current OS; tmux is
#                       chosen ONLY on headless/SSH where there is no desktop to draw on.
#
# NEVER trusts the launch exit code — confirms a live claude process (matched by the agent's
# unique brief path). Writes agents/<agent>.runtime.json — {substrate, target, pid, tty,
# windowId, launchedAt} — which where.sh and stop-agent.sh read to find and close the window.
#
# Relaunch modes:
#   (default / fresh)  new session; reads the brief AND any predecessor continuation → CLEAN
#                      context. Use for first start and for DYING (context-exhausted) handoff.
#   --resume           `claude -c` reattaches the SAME conversation (same context). Use only
#                      for a usage-limit STALL where the context is still healthy.
# Requires: jq.  Reads ~/.claude/agent-army/<operation>/manifest.json
set -uo pipefail

OP=""; AGENT=""; RESUME=""; SUBSTRATE=""
while [ $# -gt 0 ]; do case "$1" in
  --resume)       RESUME="-c";;
  --tmux)         SUBSTRATE="tmux";;
  --terminal)     shift; SUBSTRATE="${1:-}";;
  --terminal=*)   SUBSTRATE="${1#*=}";;
  *) if [ -z "$OP" ]; then OP="$1"; elif [ -z "$AGENT" ]; then AGENT="$1"; fi;;
esac; shift; done
[ -n "$OP" ] && [ -n "$AGENT" ] || { echo "usage: launch-agent.sh <operation> <agent> [--resume] [--terminal <name>] [--tmux]"; exit 1; }

CC="$HOME/.claude/agent-army/$OP"
MAN="$CC/manifest.json"
[ -f "$MAN" ] || { echo "no manifest at $MAN"; exit 1; }
a=$(jq -c --arg n "$AGENT" '.agents[] | select(.name==$n)' "$MAN")
[ -n "$a" ] || { echo "agent '$AGENT' not in manifest"; exit 1; }

MODEL=$(echo "$a"   | jq -r '.model // "sonnet"')
LABEL=$(echo "$a"   | jq -r '.label // .name')
STARTDIR=$(echo "$a"| jq -r --arg p "$(jq -r .projectRoot "$MAN")" '.startDir // $p')
INTBRANCH=$(jq -r '.integrationBranch' "$MAN")
mkdir -p "$CC/continuations" "$CC/agents"
RUNTIME="$CC/agents/$AGENT.runtime.json"

# Durable initial prompt → file (dodges shell-quoting in every terminal). Contains the
# unique brief path, which we also use to verify the right process started.
PROMPT_FILE="$CC/.prompt-$AGENT"
cat > "$PROMPT_FILE" <<EOF
You are agent '$AGENT' (label: $LABEL) in Agent Army operation '$OP'. Work to completion but you are SEMI-autonomous — when only a human can decide, set status BLOCKED with a one-line question rather than guessing.
Durable brief: $CC/briefs/$AGENT.md — read it fully and execute it.
SUCCESSOR CHECK: if $CC/continuations/$AGENT.md exists, a predecessor handed off — read it FIRST and resume from its next step (your worktree already exists; just cd in).
Report status to $CC/agents/$AGENT.status.md on every milestone (commit before you stop).
Integration branch for your PR: $INTBRANCH (never target the main branch, never merge, never move tickets).
Work subagent-driven to keep your context lean; run the context/DYING protocol in your brief when your window nears ~80% full.
EOF
CMD="claude --dangerously-skip-permissions --model $MODEL $RESUME \"\$(cat '$PROMPT_FILE')\""

# write_runtime <substrate> <target> <tty> <windowId>
write_runtime() {
  local now; now=$(date +%s)
  jq -n --arg s "$1" --arg t "$2" --arg tty "$3" --arg w "$4" --arg label "$LABEL" \
        --argjson at "$now" \
    '{substrate:$s, target:$t, tty:$tty, windowId:$w, label:$label, pid:null, launchedAt:$at}' \
    > "$RUNTIME"
}

# Auto-detect a substrate, preferring a VISIBLE window. tmux only when there's no desktop.
detect_substrate() {
  if [ -n "${SSH_TTY:-}" ] && command -v tmux >/dev/null 2>&1; then echo tmux; return; fi
  case "$(uname)" in
    Darwin)
      case "${TERM_PROGRAM:-}" in
        iTerm.app)     echo iterm; return;;
        WarpTerminal)  echo warp;  return;;
      esac
      echo terminal-app ;;
    Linux)
      if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
        command -v tmux >/dev/null 2>&1 && { echo tmux; return; }; echo nohup; return
      fi
      command -v gnome-terminal >/dev/null 2>&1 && { echo gnome-terminal; return; }
      command -v konsole        >/dev/null 2>&1 && { echo konsole;        return; }
      command -v xterm          >/dev/null 2>&1 && { echo xterm;          return; }
      command -v tmux           >/dev/null 2>&1 && { echo tmux;           return; }
      echo nohup ;;
    *) # Windows (Git Bash / MSYS / Cygwin) or unknown
      command -v wt.exe         >/dev/null 2>&1 && { echo windows-terminal; return; }
      command -v powershell.exe >/dev/null 2>&1 && { echo powershell;       return; }
      command -v tmux           >/dev/null 2>&1 && { echo tmux;             return; }
      echo nohup ;;
  esac
}

# A reusable launch script that cd's and runs claude, then keeps the shell open.
write_run_script() {
  local shebang="$1"
  RUN="$CC/.run-$AGENT.sh"
  printf '%s\ncd %q || exit 1\n%s\nexec %s\n' "$shebang" "$STARTDIR" "$CMD" "${2:-bash}" > "$RUN"
  chmod +x "$RUN"
}

[ -n "$SUBSTRATE" ] || SUBSTRATE="$(detect_substrate)"
launched=""

case "$SUBSTRATE" in
  tmux)
    command -v tmux >/dev/null 2>&1 || { echo "tmux not found"; exit 1; }
    tmux new-session -d -s "$OP" -n "$LABEL" -c "$STARTDIR" 2>/dev/null \
      || tmux new-window -t "$OP" -n "$LABEL" -c "$STARTDIR"
    tmux send-keys -t "$OP:$LABEL" "$CMD" Enter
    launched="tmux ($OP:$LABEL)"
    write_runtime "tmux" "$OP:$LABEL" "" "" ;;

  terminal-app)
    write_run_script '#!/bin/zsh -i' 'zsh'
    # capture the Terminal window id + tty so we can target/close this exact window later
    WININFO=$(osascript <<OSA 2>/dev/null
tell application "Terminal"
	activate
	set t to do script "$RUN"
	delay 0.3
	set custom title of t to "$LABEL"
	set wid to id of (window 1 whose tabs contains t)
	return (wid as text) & "|" & (tty of t)
end tell
OSA
)
    WID="${WININFO%%|*}"; TTY="${WININFO##*|}"
    launched="Terminal.app [$LABEL] win=$WID tty=$TTY"
    write_runtime "terminal-app" "$LABEL" "$TTY" "$WID" ;;

  iterm)
    write_run_script '#!/bin/zsh -i' 'zsh'
    TTY=$(osascript <<OSA 2>/dev/null
tell application "iTerm"
	activate
	set w to (create window with default profile)
	tell current session of w
		set name to "$LABEL"
		write text "$RUN"
		return tty
	end tell
end tell
OSA
)
    launched="iTerm [$LABEL] tty=$TTY"
    write_runtime "iterm" "$LABEL" "$TTY" "" ;;

  warp)
    # Warp has no AppleScript do-script; drive it via a Launch Configuration + warp:// URI.
    write_run_script '#!/bin/zsh -i' 'zsh'
    CONF="$CC/.warp-$AGENT.yaml"
    printf -- '---\nname: %s\nwindows:\n  - tabs:\n      - title: %s\n        layout:\n          cwd: %s\n          commands:\n            - exec: %s\n' \
      "$LABEL" "$LABEL" "$STARTDIR" "$RUN" > "$CONF"
    enc=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$CONF" 2>/dev/null || printf '%s' "$CONF")
    open "warp://launch/$enc" 2>/dev/null
    launched="Warp [$LABEL] (launch config: $CONF)"
    write_runtime "warp" "$LABEL" "" "" ;;

  gnome-terminal)
    gnome-terminal --title="$LABEL" -- bash -ic "cd '$STARTDIR' && $CMD; exec bash" >/dev/null 2>&1
    launched="gnome-terminal [$LABEL]"
    write_runtime "gnome-terminal" "$LABEL" "" "" ;;

  konsole)
    konsole -p tabtitle="$LABEL" -e bash -ic "cd '$STARTDIR' && $CMD; exec bash" >/dev/null 2>&1 &
    launched="konsole [$LABEL]"
    write_runtime "konsole" "$LABEL" "" "" ;;

  xterm)
    xterm -T "$LABEL" -e bash -ic "cd '$STARTDIR' && $CMD; exec bash" >/dev/null 2>&1 &
    launched="xterm [$LABEL]"
    write_runtime "xterm" "$LABEL" "" "" ;;

  windows-terminal)
    wt.exe -w 0 new-tab --title "$LABEL" bash -lic "cd '$STARTDIR' && $CMD; exec bash" >/dev/null 2>&1 &
    launched="Windows Terminal [$LABEL]"
    write_runtime "windows-terminal" "$LABEL" "" "" ;;

  powershell)
    powershell.exe -NoExit -Command "Start-Process bash -ArgumentList '-lic','cd \"$STARTDIR\" && $CMD; exec bash'" >/dev/null 2>&1 &
    launched="PowerShell [$LABEL]"
    write_runtime "powershell" "$LABEL" "" "" ;;

  nohup)
    write_run_script '#!/usr/bin/env bash' 'true'
    LOG="$CC/$AGENT.out"
    nohup "$RUN" >"$LOG" 2>&1 & NPID=$!
    launched="nohup background (log: $LOG, pid: $NPID)"
    write_runtime "nohup" "$LOG" "" ""
    jq --argjson p "$NPID" '.pid=$p' "$RUNTIME" > "$RUNTIME.t" && mv "$RUNTIME.t" "$RUNTIME" ;;

  *)
    echo "unknown --terminal '$SUBSTRATE' (try: terminal-app|iterm|warp|gnome-terminal|konsole|xterm|windows-terminal|powershell|tmux|nohup)"; exit 1 ;;
esac

# VERIFY — match the claude process by this agent's unique brief path (cwd is shared at startup).
echo "launched via $launched; verifying…"
for i in $(seq 1 15); do
  pid=$(pgrep -f "briefs/$AGENT.md" 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    # record the resolved PID for fast, cwd-independent liveness checks later
    jq --argjson p "$pid" '.pid=$p' "$RUNTIME" > "$RUNTIME.t" 2>/dev/null && mv "$RUNTIME.t" "$RUNTIME"
    echo "VERIFIED: $LABEL live (pid $pid). runtime → $RUNTIME"
    [ "$SUBSTRATE" = "tmux" ] && echo "  inspect: tmux capture-pane -t '$OP:$LABEL' -p | tail"
    exit 0
  fi
  sleep 1
done
echo "WARN: could not verify $LABEL within 15s — check the window/pane manually."; exit 3
