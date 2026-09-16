# YouTube launch: ai-skills

Format: approximately 5 minutes, screen recording with voiceover. Allow 15 minutes
to rehearse and 20 minutes to record. This is a script and shot list, not a rendered video.

## Packaging

**Title:** I Built Open-Source Skills to Give My AI Coding Agent Project Memory

**Thumbnail text:** STOP RE-EXPLAINING YOUR PROJECT

**Thumbnail direction:** Your face beside a terminal showing `/continue`, with a
small `ai-skills` label. Keep the text readable at phone size.

## Before recording

1. Confirm https://ai-skills.amjad1233.com opens publicly with the updated pages.
2. Open a disposable demo repository with no client code or private data.
3. Install Continuation using the commands below; initialise it before the demo.
4. Rehearse saving a convention, ending the session, and resuming in a fresh session.
5. Set your recorder to 1920×1080, enlarge the terminal font, and record a 10-second audio check.

## Script and screen recording

### 0:00–0:35 — Show the result first

**Screen:** A fresh Claude Code session in the demo repo. Run `/continue` and show
the actual project orientation. Avoid showing a staged success message.

**Say:**

“Every time I start a fresh coding-agent session, I have to explain the project
again. What we decided, what failed, and what we were doing next.

I built a skill called Continuation to keep that information in the repository.
Here’s a fresh session reading it back. The useful part is that I can open those
files myself and see exactly what the agent is using.”

### 0:35–1:20 — Introduce the collection

**Screen:** Open the homepage, then the two skill cards. Briefly show the GitHub repo.

**Say:**

“This is ai-skills, my open-source collection at ai-skills dot amjad1233 dot com.
There are two skills here today.

Continuation stores project decisions, learnings, conventions, and session
handoffs. It’s designed for coding agents that can read skills, including Codex,
Cursor, opencode, and Claude Code.

Agent Army coordinates multiple Claude Code sessions working on independent
pieces of a larger job. I’ll show where that fits after the memory demo.

The source is available on GitHub under the MIT licence.”

### 1:20–2:10 — Install one skill

**Screen:** Show this path in Claude Code. If already installed, explain that and
use your recorded installation footage rather than pretending to install again.

```text
/plugin marketplace add amjad1233/ai-skills
/plugin install continuation@amjad1233
```

**Say:**

“In Claude Code, add the marketplace, then install Continuation. In a project
without memory yet, ask the agent to initialise it. The `/continue` command offers
that setup when the memory folder doesn’t exist.

If you use another supported agent, there’s an editable-skills installation path
through skills.sh. Choose one installation method so you don’t get duplicate skills.”

**Screen overlay — alternative, don’t execute in the same setup:**

```sh
npx skills add amjad1233/ai-skills --skill continuation
```

“The portable skill covers the memory workflow. The slash commands I’m showing
come with the Claude Code plugin.”

### 2:10–3:40 — Prove the memory loop

**Screen:** In the prepared demo repo, run:

```text
/remember Convention: use npm for package commands in this demo repository.
```

Open the resulting file under `.continuation/conventions/`. Show its actual content.
Ask the agent to note a next task: add a greeting to the demo README. Run `/end`.
Open a fresh session in that same repo and branch, then run `/continue`.

**Say:**

“Let’s save a small convention: this demo uses npm. The skill writes a record
inside `.continuation`. This is an ordinary Markdown file, so I can review it
and commit it with the project.

Now I’ll leave a next task and end the session. The handoff captures where we got
to and what remains. In the new session, `/continue` reads the project memory and
checks the current git state.

Notice what actually comes back here: [point to the real output]. I still review
it. This gives the agent written context to work from; it doesn’t guarantee that
every decision it makes will be correct.

There’s also a short generated HOT.md file, so the agent can start with a compact
view and read the detailed records when needed.”

**Recording note:** Leave 20–30 seconds for the real file inspection and resume
output. If the demo fails, fix the setup and record it again. Label sped-up waits.

### 3:40–4:30 — Explain Agent Army’s scope

**Screen:** Open the Agent Army page and the README’s “Is this the right tool?” table.
This is an overview, not a live fleet demonstration.

**Say:**

“The second skill is Agent Army. It’s for a larger body of work that already
splits into independent pieces. Each worker gets its own Claude Code session,
git worktree, and branch. A command centre on disk holds the briefs and status
so another session can take over coordination.

This uses multiple full sessions, so cost grows with the fleet. For a few small
tasks, ordinary subagents are often enough. For tightly connected changes,
sequential work is a better fit.

I’d start with Continuation, then consider Agent Army when the work and deadline
justify running several sessions.”

### 4:30–5:00 — Give one next action

**Screen:** Return to the installation section. Finish on the domain and repository.

**Say:**

“You can find both skills, the install commands, and the source at
ai-skills dot amjad1233 dot com. The links are in the description.

Try Continuation in one small project. Save a convention, end the session, and
see what a fresh session can recover. That’s the quickest way to decide whether
it helps your workflow.”

## YouTube description

I built ai-skills: open-source skills for project memory and parallel coding work.
This walkthrough demonstrates Continuation in Claude Code and introduces Agent Army.

Website: https://ai-skills.amjad1233.com
Source: https://github.com/amjad1233/ai-skills
Continuation: https://ai-skills.amjad1233.com/continuation/
Agent Army: https://ai-skills.amjad1233.com/agent-army/

Claude Code installation:

```text
/plugin marketplace add amjad1233/ai-skills
/plugin install continuation@amjad1233
```

Editable skill installation for other supported agents:

```sh
npx skills add amjad1233/ai-skills --skill continuation
```

Choose one installation method. Agent Army currently targets Claude Code.

Chapters — adjust these timestamps to the final edit before uploading:

```text
0:00 A fresh session with project memory
0:35 What is ai-skills?
1:20 Install Continuation
2:10 Save, end, and resume
3:40 Where Agent Army fits
4:30 Try it in one project
```

## Pinned comment draft

Start here: https://ai-skills.amjad1233.com

Try the save → end → resume loop with Continuation in a small project.
Which coding agent are you using it with?
