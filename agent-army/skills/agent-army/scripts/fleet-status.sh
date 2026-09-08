#!/usr/bin/env bash
# fleet-status.sh <operation> — objective health board for an Agent Army operation.
# Combines self-reported status with master-observed signals (process alive,
# last commit age, transcript activity) so silent stalls and report-lag can't hide.
#
# HARDENED liveness: an agent is "alive" if ANY of three signals fire —
#   (1) recorded runtime PID still running     (cwd-independent; survives worktree removal)
#   (2) a claude process args match briefs/<agent>.md  (durable, unique per agent)
#   (3) a claude process cwd is under the worktree     (original signal)
# This fixes the bug where a live agent went invisible to a cwd-only probe.
#
# IDLE-BURN flag: an agent that reports DONE/PR-OPEN but is STILL a live process is
# burning a session doing nothing → flagged so the master can stop-agent it.
# Requires: jq. Reads ~/.claude/agent-army/<operation>/manifest.json
set -uo pipefail

OP="${1:?usage: fleet-status.sh <operation>}"
CC="$HOME/.claude/agent-army/$OP"
MAN="$CC/manifest.json"
[ -f "$MAN" ] || { echo "no manifest at $MAN"; exit 1; }

NOW=$(date +%s)
STALL=$(jq -r '.stallSeconds // 900' "$MAN")
INTBASE=$(jq -r '.integrationBase // .integrationBranch' "$MAN")

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
ago()   { local s=$(( NOW - ${1:-0} )); [ "$1" -eq 0 ] 2>/dev/null && { echo "-"; return; }
          if   [ $s -lt 90 ]; then echo "${s}s";
          elif [ $s -lt 5400 ]; then echo "$((s/60))m";
          else echo "$((s/3600))h"; fi; }

transcript_mtime() {
  local wt="$1"; local munged="-${wt#/}"; munged="${munged//\//-}"
  local dir="$HOME/.claude/projects/$munged"
  [ -d "$dir" ] || { echo 0; return; }
  local f; f=$(ls -t "$dir"/*.jsonl 2>/dev/null | head -1)
  [ -n "$f" ] && mtime "$f" || echo 0
}

# hardened: returns a PID if the agent is live by ANY of the three signals
agent_pid() {
  local name="$1" wt="$2" rpid="$3"
  # (1) recorded runtime PID
  if [ -n "$rpid" ] && [ "$rpid" != "null" ] && kill -0 "$rpid" 2>/dev/null; then echo "$rpid"; return; fi
  # (2) brief-path match (unique per agent, cwd-independent)
  local bp; bp=$(pgrep -f "briefs/$name.md" 2>/dev/null | head -1)
  if [ -n "$bp" ]; then echo "$bp"; return; fi
  # (3) cwd under worktree
  [ -d "$wt" ] || return
  for pid in $(pgrep -f "claude" 2>/dev/null); do
    local cwd; cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    case "$cwd" in "$wt"|"$wt"/*) echo "$pid"; return;; esac
  done
}

printf "\n  OPERATION: %s   (stall threshold %ss)\n" "$OP" "$STALL"
printf "  %-18s %-10s %-8s %-7s %-9s %-9s %s\n" AGENT HEALTH REPORTED COMMITS LASTCMT ACTIVITY PR
printf "  %s\n" "----------------------------------------------------------------------------------------"

jq -c '.agents[]' "$MAN" | while read -r a; do
  name=$(echo "$a" | jq -r .name)
  wt=$(echo "$a" | jq -r .worktree)
  sf="$CC/agents/$name.status.md"
  rt="$CC/agents/$name.runtime.json"
  rpid=$(jq -r '.pid // empty' "$rt" 2>/dev/null)
  reported=$(grep -m1 '^status:' "$sf" 2>/dev/null | awk '{print $2}'); reported="${reported:-?}"
  pr=$(grep -m1 '^pr:' "$sf" 2>/dev/null | sed 's/^pr:[[:space:]]*//'); pr="${pr:--}"

  pid=$(agent_pid "$name" "$wt" "$rpid")

  if [ ! -d "$wt" ]; then
    # worktree gone — but a live process means an orphaned (idle-burning) session
    h="NOSTART"; [ -n "$pid" ] && h="ORPHAN!"
    printf "  %-18s %-10s %-8s %-7s %-9s %-9s %s\n" "$name" "$h" "$reported" "-" "-" "-" "$pr"
    continue
  fi

  commits=$(git -C "$wt" rev-list --count "$INTBASE"..HEAD 2>/dev/null || echo "?")
  lastcmt=$(git -C "$wt" log -1 --format=%ct 2>/dev/null || echo 0)
  tmt=$(transcript_mtime "$wt")
  activity=$(( lastcmt > tmt ? lastcmt : tmt ))

  if   [ "$reported" = "DONE" ] || [ "$reported" = "PR-OPEN" ]; then
        # done but still a live process = paying a meter for nothing
        if [ -n "$pid" ]; then health="IDLE-BURN"; else health="$reported"; fi
  elif [ "$reported" = "DYING" ]; then health="DYING"
  elif [ "$reported" = "BLOCKED" ]; then health="BLOCKED"
  elif [ "$reported" = "DONE_WITH_CONCERNS" ]; then health="CONCERNS"
  elif [ -z "$pid" ]; then health="DEAD"
  elif [ $(( NOW - activity )) -gt "$STALL" ]; then health="STALLED"
  else health="ALIVE"; fi

  printf "  %-18s %-10s %-8s %-7s %-9s %-9s %s\n" \
    "$name" "$health" "$reported" "$commits" "$(ago "$lastcmt")" "$(ago "$activity")" "$pr"
done
printf "\n  HEALTH: ALIVE=working  BLOCKED=needs human  CONCERNS=done, read doubts  DYING=ctx full, relaunch FRESH\n"
printf "          STALLED=relaunch --resume  DEAD=no process  IDLE-BURN/ORPHAN=done but alive → stop-agent.sh\n\n"
