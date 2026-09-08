## 1. Package skeleton

- [ ] 1.1 Create `continuation/package.json` (name `@amjad1233/continuation`, bin `continuation`, type module, Node ≥18, zero deps, test script `node --test`)
- [ ] 1.2 Create `continuation/.gitignore` (`node_modules/`, `*.tgz`)
- [ ] 1.3 Create `continuation/bin/continuation.js` shebang entry importing `src/cli.js`
- [ ] 1.4 Create minimal `continuation/src/cli.js` dispatch stub with `--help`
- [ ] 1.5 Make the bin executable and smoke-test it

## 2. Core helpers (TDD)

- [ ] 2.1 Write failing `test/slug.test.js` for `fileSlug` and `nextFreeName`
- [ ] 2.2 Implement `src/lib/slug.js` (slugify + `-2`/`-3` collision suffix) to pass
- [ ] 2.3 Implement `src/lib/fsx.js` (`ensureDir`, `writeIfAbsent`, `appendBlockOnce`)
- [ ] 2.4 Implement `src/paths.js` (`repoRoot`, `continuationDir`, `templateDir`, `specPath`)
- [ ] 2.5 Create `test/helpers.js` with `makeTempRepo()`

## 3. Canonical spec and templates

- [ ] 3.1 Write `spec/AGENTS.md` (directory contract, filenames, collision rule, section schema for end/continue, reserved agent-army note)
- [ ] 3.2 Write `templates/session.md`, `templates/learnings.md`, `templates/continuation.config.json`

## 4. init command (TDD)

- [ ] 4.1 Write failing `test/init.test.js` (scaffold tree, config, gitignore, idempotency)
- [ ] 4.2 Implement `src/commands/init.js` to scaffold `continuation/`, copy spec + templates, write config, add gitignore rule (no tool patching yet)
- [ ] 4.3 Wire `init` into `src/cli.js`; verify tests pass

## 5. Adapters (TDD)

- [ ] 5.1 Write adapter trigger-stub templates under `templates/adapters/{claude,opencode,antigravity}/`
- [ ] 5.2 Write failing `test/adapters.test.js` (Claude import + stubs; OpenCode root AGENTS.md reference; Antigravity config entry; idempotent)
- [ ] 5.3 Implement `src/adapters/{index,claude,opencode,antigravity}.js` and call them from `init`; verify tests pass

## 6. validate command (TDD)

- [ ] 6.1 Write failing `test/validate.test.js` (filename convention, required sections, collisions)
- [ ] 6.2 Implement `src/commands/validate.js`; wire into `cli.js`; verify tests pass

## 7. list and archive commands (TDD)

- [ ] 7.1 Write failing `test/list-archive.test.js` (newest-first list; archive moves into `archive/`)
- [ ] 7.2 Implement `src/commands/list.js` and `src/commands/archive.js`; wire into `cli.js`; verify tests pass

## 8. update command (TDD)

- [ ] 8.1 Write failing `test/update.test.js` (refresh AGENTS.md from shipped spec; re-apply wired tools; not-initialised guard)
- [ ] 8.2 Implement `src/commands/update.js`; wire into `cli.js`; verify tests pass

## 9. migrate command (TDD)

- [ ] 9.1 Write failing `test/migrate.test.js` (copy sessions/learnings/agent-army + leave sources; idempotent re-run; collision suffix; not-initialised guard)
- [ ] 9.2 Implement `src/commands/migrate.js` (copy-only, idempotent, `--dry-run`, `--agent-army-src`)
- [ ] 9.3 Wire `migrate` into `cli.js` with summary + "safe to delete" reminder; run full suite

## 10. Packaging and docs

- [ ] 10.1 Create `continuation/README.md` (usage incl. `migrate`, develop instructions)
- [ ] 10.2 Add a "Standards" section/row to the root `README.md`
- [ ] 10.3 Verify `npm pack --dry-run` lists `bin/`, `src/`, `spec/`, `templates/`, `README.md`

## 11. Acceptance

- [ ] 11.1 Manual cross-tool round-trip: `init` a throwaway repo, write a session with Claude `/end`, resume from it in OpenCode then Antigravity — a handoff written by one tool and resumed by another passes
