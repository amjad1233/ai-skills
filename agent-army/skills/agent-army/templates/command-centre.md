# {{OPERATION}} — Command Centre

**You are the MASTER / COORDINATOR agent.** This file is the single source of truth. Any fresh session reads it top-to-bottom and takes command — you do **not** need the originating chat. Keep *Last master action* current and claim `master.lock`.

## Mission
{{ONE_PARAGRAPH_MISSION}}

## Integration branch
`{{INTEGRATION_BRANCH}}` (forked from `{{INTEGRATION_BASE}}`). **Every agent PR targets `{{INTEGRATION_BRANCH}}`, NOT the project's main branch.** When all agents land + CI green + reviewed, master opens one PR `{{INTEGRATION_BRANCH}}` → `{{BASE_BRANCH}}`.

## Roster
| Agent | Branch | Worktree | Model | Scope |
|-------|--------|----------|-------|-------|
| {{AGENT}} | {{BRANCH}} | {{WORKTREE}} | {{MODEL}} | {{SCOPE}} |

Each agent's durable brief: `briefs/<agent>.md`. Self-report: `agents/<agent>.status.md`. Runtime handle (window/pane/pid): `agents/<agent>.runtime.json`.

## Checking the fleet
```bash
SK={{SKILL_SCRIPTS_PATH}}        # …/skills/agent-army/scripts
"$SK/fleet-status.sh" {{OPERATION}}   # objective board (process + commits + transcript + self-report)
"$SK/where.sh" {{OPERATION}}          # where each agent's WINDOW is + how to inspect/close it
cat "$CC"/agents/*.status.md          # raw self-reports
```
The objective board is authoritative for liveness; self-reports are authoritative for *intent*. Liveness is hardened (recorded PID **or** brief-path **or** worktree cwd) so a live agent can't go invisible. `STALLED` = alive but no progress past `stallSeconds` (usually a usage-limit freeze). `IDLE-BURN`/`ORPHAN!` = the agent is DONE but its session is still alive **burning money** → stop it (below).

## Relaunch — pick the mode by why it stopped
```bash
"$SK/launch-agent.sh" {{OPERATION}} <agent> --resume   # STALLED (usage-limit; context healthy) → same conversation
"$SK/launch-agent.sh" {{OPERATION}} <agent>            # DYING/DEAD (context exhausted) → FRESH; successor reads continuations/<agent>.md
```
The script verifies a live process within ~15s and records the window handle. Never trust the launch exit code. Default substrate is the stock terminal; add `--tmux` for SSH/headless.

## Stopping an agent (kill idle-burn)
A DONE/PR-OPEN agent left running is paying a meter for nothing. Close it cleanly:
```bash
"$SK/stop-agent.sh" {{OPERATION}} <agent>            # graceful /exit then close the window, verified
"$SK/stop-agent.sh" {{OPERATION}} <agent> --force    # if it won't exit
```

## Reviewing a PR before merge (in-session, two-stage — from subagent-driven-development)
Do NOT merge on the agent's self-report alone. For each agent's PR, dispatch reviewer **subagents in YOUR session** (the Agent tool — no new windows, cheap) and loop until clean:
1. **Spec-compliance reviewer** — "does the diff implement {{SPEC_POINTER}} exactly: nothing missing, nothing extra?" If ❌, send findings back to the agent (re-launch with `--resume`, or note in its brief) and re-review.
2. **Code-quality reviewer** — only after spec is ✅. Correctness, security, project conventions, do-not-touch zones. If ❌, fix loop.
3. Read any `concerns:` (DONE_WITH_CONCERNS) before merging — never merge silently over a flagged doubt.
Merge into `{{INTEGRATION_BRANCH}}` only when both reviewers are ✅. This is the master's quality gate; the agents build, your session reviews.

## Needs a human (this operation is semi-autonomous)
Agents set themselves **BLOCKED** when only a human can decide. Surface those for the human's next check-in, then nudge the agent:
```bash
grep -l '^status: BLOCKED' "$CC"/agents/*.status.md | while read f; do echo "== $f =="; grep '^blockers:' "$f"; done
```

## Changing the master
`master.lock` records who holds command. To take over: read this file, run the fleet check + `where.sh`, reconcile, then overwrite `master.lock` with your identity + `date` timestamp.

## Teardown (when all PRs merged into the integration branch)
1. Capture each agent's continuations/learnings into the archive (they live in the worktree's `.claude/`).
2. `stop-agent.sh` any still-alive agents.
3. `git worktree remove --force <worktree>` per agent; delete the merged local branches.
4. Open the final PR `{{INTEGRATION_BRANCH}}` → `{{BASE_BRANCH}}` (or hand to the release owner).
5. Move the command centre to `~/.claude/agent-army/archive/{{OPERATION}}/` with an `ARCHIVED.md` stamp.

## Known hazards
- Agents freeze silently at account usage limits (process alive, no progress). Wait for the limit window, relaunch with `--resume`.
- One live `claude` per worktree + its launcher shell — don't kill "the dupe".
- Do-not-touch zones (other devs' active streams): {{DO_NOT_TOUCH}}.
- Shared test DB contention across N agents — use the project's parallel-test routing; transient "missing relation" = collision, re-run, never reset the shared DB.

## Operation log
Append notable events to `log.md` (launches, stalls, relaunches, merges, stops).

**Last master action:** {{TIMESTAMP}} — {{WHAT}}
