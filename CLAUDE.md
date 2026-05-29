# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo State (read first)

The module is **implemented**. The original design and build plan remain in
`docs/superpowers/specs/2026-05-29-sidebar-resizer-module-design.md` and
`docs/superpowers/plans/2026-05-29-sidebar-resizer-implementation.md` as historical reference.

## Commands

```bash
npm install                           # dev deps only (eslint); NO runtime deps
npm test                              # run all tests via Node's built-in node:test runner (tests/**/*.test.js)
npm run lint                          # eslint scripts/ tests/
node --test --import ./tests/setup.js tests/resize-core.test.js   # run a single test file
```

## What This Is

A FoundryVTT **v13+** module (ApplicationV2 UI) giving each user three client-scoped resizers:

1. **Sidebar horizontal resize** — drag the sidebar's inner edge to set its width.
2. **Chat input vertical resize** — drag the chat input region's top edge; the log scrollback shares the column.
3. **Floating window resize** — popped-out sidebar directories (Combat Tracker, Playlists, etc.) become resizable.

It is a clean v13 re-implementation of the abandoned v12-only `foundryvtt-sidebar-resizer`. The dropped
v12 features (TinyMCE rich chat editor, forced popout dimensions) are explicitly out of scope for v1.

`module.json` declares the entry point and compatibility (`minimum: 13`, `verified: 14`);
`scripts/main.js` is the sole ESModule Foundry loads at runtime.

## Architecture

Data flow: **`init` registers settings + enables window resize → `ready`/render hooks attach drag
handles and restore saved sizes → drag updates the DOM live and persists on pointer release.**

```
scripts/main.js              init + ready/render hooks; wires each feature via the safely() guard, gated by its enable* setting
scripts/settings.js          MODULE_ID = 'sidebar-resizer'; client-scoped settings; getSetting/setSetting helpers
scripts/constants.js         MIN/MAX bounds, setting keys (SETTINGS), DIRECTORY_CLASS_PATHS list
scripts/resize-core.js       PURE: clampSize(value,min,max), parsePx(str). No Foundry import
scripts/sidebar-resize.js    Foundry glue: horizontal handle on ui.sidebar.element, drag, persist+restore
scripts/chat-resize.js       Foundry glue: vertical handle on the chat input region, drag, persist+restore
scripts/window-resize.js     Foundry glue: markClassResizable() (pure, tested) + enableWindowResize() over DIRECTORY_CLASS_PATHS
styles/sidebar-resizer.css   handle cursors, hit areas, hover affordance
lang/{en,fr}.json            setting names/hints (English + French)
tests/resize-core.test.js    node:test unit tests for clampSize/parsePx
tests/window-resize.test.js  node:test unit tests for markClassResizable
tests/setup.js               --import anchor for the node:test runner
eslint.config.js             flat ESLint config for scripts/ and tests/
```

The guiding pattern: **many small single-purpose files; pure logic separated from Foundry glue.**
Each Foundry-facing module depends only on `settings.js`, `constants.js`, and the pure `resize-core.js`,
and is understandable in isolation.

### Cross-cutting invariants

- **Isolation:** each resizer is wired in `main.js` through the `safely(label, fn)` guard and gated by its
  `enable*` setting. One failing resizer console-warns (prefixed with `MODULE_ID`) and never breaks the others or core UI.
- **Idempotent attach:** render hooks fire repeatedly, so every handle-attach checks for an existing handle
  first — never stack duplicate handles or listeners.
- **No mutation of shared data:** sizes are read/written via the settings helpers; DOM size via inline styles only.
- **Window resize is v13-idiomatic and needs no libWrapper** — it sets `DEFAULT_OPTIONS.window.resizable`
  at `init`. Wrap each directory-class lookup so a renamed/missing class in a future core version is skipped
  with a `console.warn`, never thrown.

## Settings (all `scope: 'client'`)

Persisted sizes (`config: false`, written by drag): `sidebarWidth`, `chatHeight` — `Number`, default `null`
(`null` = Foundry default). Feature toggles (`config: true`, default `true`): `enableSidebarResize`,
`enableChatResize`, `enableWindowResize`.

## i18n

All UI strings are keys like `sidebar-resizer.settings.<key>.name`. English in `lang/en.json`, French in
`lang/fr.json`. Keep pure modules free of `game.i18n`; inject localized labels from the Foundry-glue layer.

## Testing Strategy

Tests run under Node's built-in `node:test` runner via the `tests/setup.js` `--import` anchor — **no
Jest/Vitest**. Unit tests cover the pure logic only: `resize-core.js` (`clampSize` bounds, `parsePx`
parsing + fallback) and `window-resize.js`'s pure `markClassResizable` (sets `resizable` on a class's
`DEFAULT_OPTIONS.window`, creating intermediate objects, returning `false` for a missing class). The
remaining DOM/Foundry glue is kept thin and verified manually in a running v13 world: resize, reload to
confirm persistence, pop out a directory to confirm resizability.

## Development Workflow

- `develop` is the ongoing branch; `main` only receives released code.
- Every feature/fix gets its own branch off `develop`, named `feature-xxx` or `bugfix-yyy`. Use branches, **not** worktrees.
- A change ships in two PRs: feature/bugfix → `develop`, then `develop` → `main`. The release workflow runs from the tag pushed on `main`.

## Releasing

Releases are automated by `.github/workflows/release.yml`, triggered by any `v*` tag. From `main`, run
`./release.sh` — it handles version selection, `module.json` edits, the release commit, tag, push, and
merge-back to `develop`. Stable tags (`vX.Y.Z`) publish to FoundryVTT; pre-release tags
(`vX.Y.Z-beta.N`, `-rc.N`) create a GitHub pre-release and skip the Foundry publish.

The release zip bundles only the runtime files: `module.json scripts/ styles/ lang/`. `docs/`, `README.md`,
`CHANGELOG.md`, and `.github/` are repo-only.

## Code Exploration

If `codebase-memory-mcp` is available, use it **first** for structural exploration: `search_graph` (find
symbols), `trace_path` (call chains), `get_code_snippet` (read a symbol), `get_architecture`, `search_code`.
Run `index_repository` first if unindexed. Fall back to `Grep`/`Glob`/`Read` for config, non-code, and plain text.

## External Documentation

If the **Context7 MCP server** is available, fetch up-to-date FoundryVTT docs rather than relying on
training data — especially for ApplicationV2, `DEFAULT_OPTIONS`, the Hooks API, `ui.sidebar`/`ChatLog`,
and the sidebar directory classes under `foundry.applications.sidebar.*`:

```
mcp__plugin_context7_context7__resolve-library-id({ libraryName: "foundryvtt" })
mcp__plugin_context7_context7__query-docs({ context7CompatibleLibraryID: "...", query: "..." })
```

## Reference

- FoundryVTT API docs: https://foundryvtt.com/api/
- Original (v12, abandoned) inspiration: https://github.com/saif-ellafi/foundryvtt-sidebar-resizer
- Design specs: `docs/superpowers/specs/` · Implementation plans: `docs/superpowers/plans/`
```
