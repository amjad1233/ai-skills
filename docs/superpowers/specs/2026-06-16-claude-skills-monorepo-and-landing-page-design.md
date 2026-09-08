# claude-skills — Monorepo Marketplace + 3D Landing Page

**Date:** 2026-06-16
**Status:** Approved (design), pending spec review
**Author:** Amjad Pathan

## Goal
Combine the open-source Claude Code skills (`agent-army`, `claude-continuation`) into a single
public plugin-marketplace monorepo, and ship a loud, 3D, Gen-Z one-pager explaining them at
`claude-skills.amjad1233.com`, hosted on DigitalOcean App Platform. Presentable tomorrow.

## Non-goals
- Migrating private skills.
- Deep research essay. Light research only (confirm current `/plugin` syntax + framing).
- A full multi-page site. One page.

## Decisions (settled)
- **Repo:** new public repo `amjad1233/claude-skills` (repurpose the existing empty private repo
  → make public).
- **Marketplace id:** `amjad1233` → installs read `/plugin install agent-army@amjad1233`.
- **Hosting:** DigitalOcean App Platform, static site, serves `docs/`. Auto-redeploys on push.
- **DNS:** Cloudflare holds `CNAME claude-skills → <app>.ondigitalocean.app` (DNS-only / grey
  cloud, so DO provisions the TLS cert).
- **Visual direction:** B — "Glassy 3D depth". Dark, glassmorphism cards, gradient-mesh blobs,
  real WebGL 3D hero (three.js via CDN), parallax/scroll motion.

## Architecture

### Repo layout — "separate binaries in one repo"
```
claude-skills/
├── .claude-plugin/marketplace.json     # name: "amjad1233"; plugins[] lists each skill by ./subdir
├── agent-army/                         # complete, standalone plugin
│   ├── .claude-plugin/plugin.json
│   ├── skills/agent-army/…             # SKILL.md, scripts, templates, references (moved verbatim)
│   ├── README.md
│   ├── CHANGELOG.md
│   └── LICENSE
├── claude-continuation/                # complete, standalone plugin (moved verbatim from its repo)
│   ├── .claude-plugin/plugin.json
│   ├── skills/…
│   └── …
├── docs/                               # the one-pager (DO serves this folder)
│   ├── index.html
│   ├── assets/  (three.js loaded via CDN; local css/js/img if needed)
│   └── superpowers/specs/  (this doc)
├── README.md                           # marketplace overview + per-skill install
└── LICENSE (MIT)
```
Each subdir is independently installable. Adding skill #3 later = new subdir + one entry in
`marketplace.json`. No cross-skill coupling.

### marketplace.json (multi-plugin)
Root `name: "amjad1233"`, `plugins: [{name, source: "./agent-army", …}, {name, source:
"./claude-continuation", …}]`. Each plugin's own `plugin.json` carries its version/homepage/
keywords. (Exact schema confirmed against current Claude Code docs during implementation.)

### Source repo handling
`agent-army-skill` and `claude-continuation` repos stay live but get a README banner: "Moved to
amjad1233/claude-skills — install via `/plugin marketplace add amjad1233/claude-skills`." No
deletions (avoids breaking anything mid-presentation).

## The landing page (docs/index.html)

Single self-contained HTML file + CDN three.js. No build step (static host friendly).

**Sections, top to bottom:**
1. **Hero** — WebGL 3D scene (floating glassy objects / gradient mesh, slow drift, mouse
   parallax). Big tagline, one-line `/plugin marketplace add amjad1233/claude-skills` with
   copy-to-clipboard.
2. **"What even is a Claude skill?"** — dummy-friendly explainer, 2–3 sentences + a tiny diagram.
3. **Skill cards (×2)** — glassmorphism card each: name, one-liner, what it does, why you'd want
   it, copy-paste install command, links (repo + live docs/explainer). agent-army card links to
   its existing rich explainer.
4. **"Get started in 30 seconds"** — numbered for-dummies guide: install Claude Code → add
   marketplace → install a skill → use it. Real copy-paste snippets.
5. **"More skills coming"** — teaser that the marketplace grows.
6. **Footer** — GitHub, MIT, built-with note.

**Tech:**
- three.js r160+ via CDN (`<script type="importmap">` + ES module), one `<canvas>` hero scene.
- Glassmorphism via CSS `backdrop-filter`, gradient-mesh background, `prefers-reduced-motion`
  fallback that disables the WebGL drift.
- Copy buttons: tiny vanilla JS.
- Performance budget: hero scene must not jank on a laptop; cap DPR, pause raf when tab hidden.
- Accessibility: semantic headings, alt text, keyboard-focusable copy buttons, reduced-motion.

## Data flow / deploy
1. Build repo locally → push to `amjad1233/claude-skills` (public).
2. Create DO App Platform **static site** app from the repo, source dir `docs/`, output `docs/`.
3. Add custom domain `claude-skills.amjad1233.com` in the DO app.
4. Add the `CNAME` in Cloudflare (DNS-only) → wait for DO cert.
5. Verify HTTPS 200 + the install commands actually resolve the marketplace.

## Error handling / risk
- **WebGL unsupported / reduced-motion** → static gradient hero fallback, page fully usable.
- **DO cert delay** → present from `<app>.ondigitalocean.app` URL as backup; subdomain can finish
  provisioning after.
- **Marketplace install fails** → verify `/plugin marketplace add` + `/plugin install …@amjad1233`
  end-to-end before relying on it on a slide.
- **Existing private `claude-skills` repo not actually empty** → check before repurposing; if it
  has content, create `claude-skills` fresh under a confirmed-safe path.

## Testing / verification
- `marketplace.json` + each `plugin.json` parse as valid JSON; schema matches current docs.
- Skill scripts remain executable after the move (perms preserved).
- Page renders: hero animates, copy buttons work, links resolve, reduced-motion path works.
- Live URL returns HTTP 200 over HTTPS; install commands work in a real Claude Code session.

## Open items to confirm during implementation
- Exact current `marketplace.json` multi-plugin schema + `/plugin` command syntax (light research).
- Whether the existing private `claude-skills` repo is safe to repurpose.
