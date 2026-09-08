## ADDED Requirements

### Requirement: Tool-neutral directory contract

The standard SHALL define a `continuation/` directory at the repo root with a fixed layout that any AI tool can read and write. The directory MUST contain a canonical spec file `AGENTS.md`, a `continuation.config.json`, and the subdirectories `sessions/`, `learnings/`, and `archive/`. It MUST reserve a `agent-army/` subdirectory for live fleet state.

#### Scenario: Layout is scaffolded

- **WHEN** a tool or the CLI initialises the standard in a repo
- **THEN** `continuation/` contains `AGENTS.md`, `continuation.config.json`, `sessions/`, `learnings/`, and `archive/`, and reserves `agent-army/`

#### Scenario: Sessions replaces the legacy subdir name

- **WHEN** the layout is created
- **THEN** session handoffs live under `continuation/sessions/` (the renamed legacy `continuations/` subdir) and not under a name that stutters against the parent directory

### Requirement: Commit and gitignore boundaries

The standard SHALL commit the durable, shareable record and gitignore live fleet state. `AGENTS.md`, `continuation.config.json`, `sessions/`, `learnings/`, and `archive/` MUST be committed. `continuation/agent-army/` MUST be gitignored and exist only in the main checkout.

#### Scenario: agent-army is gitignored

- **WHEN** the standard is initialised
- **THEN** a gitignore rule excludes `continuation/agent-army/` while the committed directories remain tracked

#### Scenario: Worktree agents share one command centre

- **WHEN** a worktree agent needs the agent-army command centre
- **THEN** it references the main checkout's `continuation/agent-army/` by absolute path rather than receiving its own copy

### Requirement: Filename convention

Artifact filenames in `sessions/` and `learnings/` SHALL follow `YYYY-MM-DDTHHMMSS-slug.md`, where the prefix is a local-time, 24-hour, zero-padded, colon-free timestamp. The timestamp prefix MUST make each artifact uniquely identifiable and lexically sortable into chronological order, so the most recent artifact is unambiguous even within a single day. The slug MUST be lowercase, hyphen-separated, and begin with a letter.

#### Scenario: Valid filename

- **WHEN** a session handoff is written for topic "Stripe Webhook Handler" at 14:30:52 local on 2026-06-21
- **THEN** the file is named `2026-06-21T143052-stripe-webhook-handler.md`

#### Scenario: Same-day sessions order by time

- **WHEN** two sessions are written on the same day at 09:15:00 and 14:30:52
- **THEN** sorting the filenames descending places `2026-06-21T143052-…` before `2026-06-21T091500-…`, identifying the later session as most recent

#### Scenario: Slug starting with a digit is prefixed

- **WHEN** a slug would otherwise begin with a digit
- **THEN** it is prefixed so it begins with a letter (e.g. `123-numbers` becomes `n-123-numbers`)

### Requirement: Never-overwrite collision rule

When writing an artifact whose target filename already exists with differing content, the standard SHALL never overwrite. It MUST append an incrementing `-2`, `-3`, … suffix until a free name is found. A target that already holds byte-identical content MUST be treated as already-written.

#### Scenario: Name clash with different content

- **WHEN** `2026-06-21T143052-topic.md` already exists with different content and a new artifact targets that name (a same-second write)
- **THEN** the new artifact is written as `2026-06-21T143052-topic-2.md` and the original is left unchanged

#### Scenario: Identical content is not duplicated

- **WHEN** the target filename already holds byte-identical content
- **THEN** no new file is written

### Requirement: Self-describing workflow spec

`continuation/AGENTS.md` SHALL be the single canonical source of the workflow: it MUST specify where artifacts live, the filename convention, the collision rule, and the section schema for each artifact type. Every supported tool MUST read this file rather than embedding its own copy of the workflow.

#### Scenario: A tool resumes from the spec

- **WHEN** an AI tool opens a repo containing `continuation/`
- **THEN** it reads `continuation/AGENTS.md` to learn the paths, filename convention, collision rule, and artifact section schema, and can resume from a session another tool wrote
