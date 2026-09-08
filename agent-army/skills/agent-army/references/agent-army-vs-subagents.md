# Agent Army vs Subagents vs Workflow — when to use which

Three ways to do "parallel work" in Claude Code. They are not rivals; they sit at different
points on a cost/scale curve, and they **nest** (a fleet agent runs subagents internally).

## The three mechanisms

| | In-session subagents | Workflow tool | Agent Army (this skill) |
|---|---|---|---|
| **What it is** | The `Agent`/`Task` tool — a built-in Claude Code feature | The `Workflow` tool — a scripted, deterministic fan-out of subagents | Separate `claude` OS processes in their own windows |
| **Where they run** | Inside your one session, headless | Inside your one session, headless, script-driven | Own process + terminal window/tmux pane |
| **Context window** | Each subagent has its own; only its *summary* returns to you | Same; controller accrues summaries | Each agent gets a full independent window |
| **Isolation** | Shared filesystem (sequential writes) | **Per-item git worktree** (`isolation: 'worktree'`) | **Per-agent git worktree** |
| **Parallelism** | Batchable; controller blocks | ~10 concurrent, queued to a cap | True concurrency, hours/days |
| **Survival** | Dies with your chat | Dies with your chat (resumable by runId) | **Survives** — command centre on disk; any session takes command |
| **Human inspection** | None mid-flight (but newer Claude Code shows subagent activity in the UI) | Progress UI (`/workflows`) | Real windows you can watch / attach / answer BLOCKED in |
| **Orchestration cost** | ~zero | low (write a script) | heavy (windows, status files, health board) |
| **Money** | N cheap tool calls | N cheap tool calls | **N full sessions** |

## The mental model

```
  IN-SESSION SUBAGENT                         AGENT-ARMY AGENT (one window)
  your session ── Agent("do X") ──▶           ┌─ window: g2 (full claude session) ─┐
     own context window, headless             │  coordinator                       │
     does its work, returns ONE summary       │   ├─ subagent: implement           │
     then vanishes (no window)                │   ├─ subagent: test                │
  only the summary lands in your context      │   └─ subagent: review              │
                                              └────────────────────────────────────┘
  Workflow = the same subagents, but a        Agent-army = N of those windows, each
  script drives the fan-out + worktrees        running subagents internally. Nesting:
  deterministically (loops, pipelines).        outer = parallelism + survival,
                                               inner = lean context per agent.
```

## Newer Claude Code shows subagent activity

Recent Claude Code surfaces what in-session subagents are doing (live activity in the UI).
That narrows the old "you can't see inside a subagent" gap — but it does **not** replace
agent-army's distinct value, which was never *only* visibility:

- **Independent full context windows that survive your session.** Subagent activity in the
  UI still lives and dies with your one chat; a fleet's command centre is on disk, so the
  operation outlives any master and any context limit.
- **Hours-to-days of true parallel building**, not a fan-out the controller blocks on.
- **A window per stream you can attach to and steer**, answer a BLOCKED question in, or hand
  to a teammate.

So: use the subagent UI for *visibility into a sweep you're driving now*; use agent-army when
the work must **outlast the session** and run as **independent long-lived streams**.

## Decision rule

```
  Fits one context + you'll finish it now ............ in-session subagents
  Many small isolated tasks (sweep/migration) ........ Workflow tool (worktree-isolated)
  4–9 big independent seams, deadline, babysat ....... AGENT-ARMY
  Tightly coupled / ordered .......................... sequential
```

## Worked example — "50 tickets in 4–5 groups" (a grouped epic)

You do **not** make 50 agents or 50 subagents. You make **one agent per independent seam**
(4–9), and each agent chews through its tickets internally with subagents.

- 50 tickets → 5 independent seams, each substantial, judgement + review, multi-day, babysat
  → **agent-army**, 5 agents. (e.g. 9 OpenSpec changes → 9 agents.)
- 50 tickets that are small, mechanical, isolated (rename, dep bump) → **Workflow sweep**,
  worktree-isolated, ~10 at a time, no windows, far cheaper.
- 50 tickets that all touch the same module / depend on order → **sequential**; parallel
  would be merge hell.

The differentiator is **seam size + need for babysitting + survival**, not ticket count.
