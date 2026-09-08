## ADDED Requirements

### Requirement: init scaffolds and wires tools

The CLI SHALL provide `continuation init` that scaffolds the `continuation/` directory (copying `AGENTS.md` and templates, creating `continuation.config.json`), patches each selected tool's config with thin trigger stubs that delegate to the spec, and adds a gitignore rule for `continuation/agent-army/`. `init` MUST be idempotent.

#### Scenario: Fresh init

- **WHEN** `continuation init --tools=claude` runs in a repo with no `continuation/` directory
- **THEN** `continuation/` is scaffolded, `CLAUDE.md` gains a `@continuation/AGENTS.md` import and trigger stubs, and `continuation/agent-army/` is gitignored

#### Scenario: Idempotent re-run

- **WHEN** `init` runs a second time in the same repo
- **THEN** no duplicate imports or stubs are added and the existing scaffold is left intact

### Requirement: validate lints a continuation directory

The CLI SHALL provide `continuation validate` that lints a `continuation/` directory for the filename convention, required artifact sections, broken references, and overwrite collisions, reporting any violation.

#### Scenario: Malformed artifact is caught

- **WHEN** `validate` runs against a `continuation/` directory containing a session file that violates the filename convention or is missing a required section
- **THEN** it reports the violation and exits non-zero

### Requirement: list and archive manage artifacts

The CLI SHALL provide `continuation list` that lists sessions and learnings newest-first, and `continuation archive <file>` that moves a named session or learning into `continuation/archive/`.

#### Scenario: List newest first

- **WHEN** `list` runs with sessions `2026-06-20-a.md` and `2026-06-21-b.md`
- **THEN** it prints `2026-06-21-b.md` before `2026-06-20-a.md`

#### Scenario: Archive a session

- **WHEN** `archive 2026-06-20-a.md` runs and that file exists under `sessions/`
- **THEN** the file is moved into `continuation/archive/` and removed from `sessions/`

### Requirement: update re-syncs spec and stubs

The CLI SHALL provide `continuation update` that refreshes the copied `continuation/AGENTS.md` from the package's canonical spec and re-applies the trigger stubs for the tools recorded in `continuation.config.json`.

#### Scenario: Refresh after a schema bump

- **WHEN** the copied `continuation/AGENTS.md` has drifted and `update` runs in an initialised repo
- **THEN** `AGENTS.md` is rewritten from the shipped spec and each wired tool's config is re-applied

#### Scenario: Update requires initialisation

- **WHEN** `update` runs in a repo with no `continuation.config.json`
- **THEN** it reports that `continuation/` is not initialised and exits non-zero

### Requirement: migrate copies legacy artifacts non-destructively

The CLI SHALL provide `continuation migrate` that copies legacy `.claude/continuations/*.md` into `continuation/sessions/`, `.claude/learnings/*.md` into `continuation/learnings/`, and each `<op>` under the agent-army source into `continuation/agent-army/<op>/`. It MUST copy only — never delete a source. It MUST be idempotent (skip byte-identical destinations) and MUST apply the never-overwrite collision rule on differing content. It MUST require `continuation/` to already exist and MUST skip any absent source directory. The agent-army source SHALL default to `$HOME/.claude/agent-army` and accept a `--agent-army-src` override. `migrate` SHALL apply immediately and accept a `--dry-run` flag that previews without writing.

#### Scenario: Copy sessions, learnings, and agent-army

- **WHEN** `migrate` runs in an initialised repo with legacy `.claude/continuations`, `.claude/learnings`, and an agent-army op present
- **THEN** the corresponding files are copied into `continuation/sessions/`, `continuation/learnings/`, and `continuation/agent-army/<op>/`, and the legacy sources are left in place

#### Scenario: Idempotent re-run

- **WHEN** `migrate` runs a second time with no source changes
- **THEN** it copies nothing and reports the already-present files as skipped

#### Scenario: Name clash with differing content

- **WHEN** a destination filename already exists with different content
- **THEN** the migrated file is written with a `-2` suffix and the existing file is left unchanged

#### Scenario: Not initialised

- **WHEN** `migrate` runs in a repo with no `continuation/` directory
- **THEN** it reports that `continuation/` is not initialised and exits non-zero

### Requirement: Per-tool adapter stubs delegate to the spec

The CLI SHALL generate, per supported tool (Claude Code, OpenCode, Antigravity), only thin native trigger stubs whose body delegates to `continuation/AGENTS.md`. The canonical workflow prose MUST NOT be duplicated into each tool's config.

#### Scenario: Claude adapter delegates

- **WHEN** `init --tools=claude` runs
- **THEN** `CLAUDE.md` imports `@continuation/AGENTS.md` and the generated slash-command stubs reference the workflow defined in `continuation/AGENTS.md` rather than restating it
