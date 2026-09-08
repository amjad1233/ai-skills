---
agent: {{AGENT}}
status: SPAWNING
updated: {{TIMESTAMP}}
current_task: not yet started
commits: 0
blockers: none
concerns: none
pr: -
notes: created by master at operation init; awaiting agent first report
---

<!--
status vocabulary (richer than BLOCKED-only, borrowed from subagent-driven-development):
  SPAWNING            launched, not yet bootstrapped
  BOOTSTRAPPING       creating worktree / reading brief
  WORKING             implementing
  BLOCKED             needs a HUMAN decision — put the one-line question in `blockers:`
  DONE_WITH_CONCERNS  work complete but the agent has doubts — put them in `concerns:`;
                      the master READS these before merging (don't silently merge over them)
  TESTING             running the suite
  PR-OPEN             PR raised against the integration branch
  DYING               context ~80% full — committed + wrote a continuation; relaunch FRESH
  DONE                fully complete; PR open; nothing left → master may stop-agent it
  FAILED              could not complete; `notes:` says why
-->
