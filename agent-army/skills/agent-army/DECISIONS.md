# Agent Army — design decisions

Why this skill is shaped the way it is. Each decision is a lesson, usually paid for in lost
time or wasted spend during real multi-stream operations.

## D1 — Separate OS sessions, not in-session subagents
**Decision:** each agent is a full `claude` process in its own window/pane, not an `Agent`-tool
subagent. **Why:** the only things a fleet uniquely buys are (a) N *independent full context
windows*, (b) *survival beyond one chat*, and (c) *human-inspectable long-lived streams*.
In-session subagents share the parent's lifecycle and the controller accrues their summaries,
so they can't run for hours as independent streams. **Cost:** heavy orchestration (windows,
PIDs, worktrees, status files) — which the rest of these decisions exist to tame.

## D2 — Front Door in front (added after a cost scare; reshaped in 0.2.0)
**Decision:** the skill *starts* with a fit-check + cost-preview + routing gate; you only
proceed if the work is genuinely 4–9 big independent seams with a deadline and a babysitter.
**Why:** a fleet costs ~N full sessions. Most "parallel work" is better served by the
**Workflow tool** (worktree-isolated in-session sweep) or a few subagents. The default of
reaching for a fleet is the most expensive mistake in this whole system. The gate makes the
cheap path the default and the fleet an opt-in. The cost preview distinguishes **subscription
(quota+time)** from **API (real $)** because the right calculus differs.

**0.2.0 reshape (Front Door):** the gate now runs as a **one-question-at-a-time interview**
(brainstorming-faithful) rather than a form, the fit check collapsed 6 questions → 3, and the
routing is **advisory** (state the recommendation, user can override) rather than a hard stop.
It also interviews for operation prefs — terminal (auto-detected), models, permissions, babysit
cadence — **asked fresh each operation** (no persisted config). The interview script lives in
`references/front-door.md` to keep SKILL.md scannable. **No hook / plugin conversion** — the
skill auto-triggers on its description, so an always-on SessionStart injection isn't needed.

## D3 — Command centre lives OUTSIDE the repo
**Decision:** `~/.claude/agent-army/<operation>/`, referenced by absolute path. **Why:** if it
lived in the repo it would be caught in branch switches, worktree cleanups, and `.gitignore`
churn. Out-of-repo means agents in *any* worktree reach the same source of truth, and it
survives teardown of every worktree.

## D4 — One status file per agent, agent-owned
**Decision:** `agents/<name>.status.md`, overwritten (not appended) by the agent. **Why:** a
single shared status file corrupts under concurrent writes from N agents. Per-agent files are
race-free; the *directory* is the one logical source of truth.

## D5 — Two-signal truth (never trust self-report alone)
**Decision:** health = self-reported status **and** objective probe (process alive + last
commit age + transcript mtime). **Why:** agents stall silently at usage limits (process alive,
zero progress), commits lag reports, and launches lie about success. Either signal alone
deceives; together they don't.

## D6 — Hardened liveness probe (bug fix)
**Decision:** an agent is "alive" if ANY of three fire — recorded runtime PID runs, OR a
process matches `briefs/<agent>.md`, OR a process cwd is under the worktree. **Why:** the
original probe matched on cwd only, so a live agent went *invisible* once its worktree was
removed or its cwd differed — a master asked "where are the agents?" and got "none" while four
were alive at their prompts. The brief-path signal is unique per agent and cwd-independent; the
recorded PID is the fastest check and survives worktree removal.

## D7 — Record a window handle at launch (`runtime.json`)
**Decision:** `launch-agent.sh` writes `{substrate, target, pid, tty, windowId, launchedAt}`.
**Why:** the launcher *knew* the window (tmux pane, Terminal.app window id + tty) and threw it
away, so the master could never say "g2 is *that* window" or close it — leaving orphaned REPLs
to close by hand. Recording the handle is what makes `where.sh` and `stop-agent.sh` possible.

## D8 — `where.sh` and `stop-agent.sh`
**Decision:** ship a "where is each window / how do I inspect it" tool and a verified
"close this window" tool. **Why:** locating and *stopping* agents was a manual, error-prone
chore. `stop-agent.sh` specifically kills **idle-burn** — a DONE agent that keeps its session
(and meter) alive — which the board now flags as `IDLE-BURN`/`ORPHAN`.

## D9 — Relaunch mode depends on *why* it stopped
**Decision:** `--resume` (same conversation) only for a usage-limit **STALL** (context healthy);
**fresh** relaunch for **DYING/DEAD** (context exhausted), where the agent already wrote a
continuation. **Why:** resuming a context-exhausted agent just re-fills it; a fresh successor
reading the continuation starts clean. Resuming a healthy-but-frozen agent preserves its work.

## D10 — DYING protocol + subagent-driven work = context survival
**Decision:** agents work subagent-driven (thin coordinator, heavy work in disposable
subagents) and, at ~80% context, commit + write a continuation + mark DYING + `/end`. **Why:**
the fix for a tight context window is *architecture, not a bigger model*. Subagent-driven keeps
the main thread small; the DYING protocol resets cleanly with zero lost work when it does fill.

## D11 — Master reviews two-stage, in-session (from subagent-driven-development)
**Decision:** the master merges only after dispatching spec-compliance then code-quality
reviewer **subagents in its own session**, looping until both pass, and reading any
`DONE_WITH_CONCERNS` notes. **Why:** merging on an agent's self-report ships unreviewed code.
The review is cheap in-session (no new windows) and mirrors the discipline the agents already
use internally — the clean hybrid: *separate sessions build, in-session subagents review*.

## D12 — Richer status vocabulary
**Decision:** add `DONE_WITH_CONCERNS` and (in the agent's internal loop) `NEEDS_CONTEXT` to
the BLOCKED-only gate. **Why:** "done but I have doubts" is different from "done" and from
"blocked on a human." Without it, a master silently merges over a real concern.

## D13 — Agents self-create their worktrees
**Decision:** the master does not pre-create worktrees; each agent's brief step 1 creates its
own. **Why:** pre-creating couples bootstrap to the master and complicates teardown.
Self-creation keeps isolation clean and symmetrical with `git worktree remove` at teardown.

## D14 — Seam count, not ticket count, sets the agent number
**Decision:** N agents = N genuinely-independent seams (target 4–9), regardless of how many
tickets each seam holds. **Why:** spawning more agents than the work has independent seams
causes cross-talk and merge pain. 50 tickets in 5 groups = 5 agents, each sweeping its tickets
with subagents — not 50 agents.

## D15 — Default substrate is the stock terminal; `--tmux` opt-in
**Decision:** macOS Terminal.app / Linux gnome-terminal etc. by default; tmux behind a flag.
**Why:** the stock terminal "just works" for a human watching locally. tmux is better for
SSH/headless (panes survive disconnect, inspectable via `capture-pane`) but adds a dependency,
so it's opt-in. Ghostty's `open -na … -e` silently orphans on macOS — avoid it; that's why
verification never trusts the launch exit code.
