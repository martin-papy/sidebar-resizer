# Sidebar and Windows Resizer — v13+ Module Design

**Date:** 2026-05-29
**Status:** Approved (design)
**Author:** Martin Papy

## Summary

A FoundryVTT v13+ module that lets each user resize the right-hand sidebar
horizontally, resize the chat input region vertically, and resize popped-out
sidebar directory windows (Combat Tracker, Playlists, etc.). It is a clean
re-implementation, for the v13 ApplicationV2 UI, of the abandoned v12-only
[`foundryvtt-sidebar-resizer`](https://github.com/saif-ellafi/foundryvtt-sidebar-resizer)
by JeansenVaars (originally VanceCole).

It deliberately follows the engineering patterns, scaffold, and structure of the
sibling [`markdown-paste`](https://github.com/martin-papy/markdown-paste) module:
many small, single-purpose files; pure logic separated from Foundry glue;
`node:test` unit tests; i18n via `lang/*.json`; and the same GitHub Actions
release pipeline.

## Scope

### In scope (v1)

1. **Sidebar horizontal resize** — drag the sidebar's inner edge to set its width.
2. **Chat input vertical resize** — drag to set the chat input region's height;
   the chat log scrollback above it grows/shrinks to share the column.
3. **Floating window resize** — popped-out sidebar directories become user-resizable.

### Out of scope (v1)

- **Rich chat editor** (the original's EXPERIMENTAL TinyMCE feature). TinyMCE was
  removed from Foundry in v13. A ProseMirror-based chat toolbar may be revisited
  as a future feature, but is explicitly not part of this module's first release.
- **Forced popout dimensions.** The v12 code forced popout height to
  `board height ÷ 2.5`. We drop this and let Foundry's natural position logic
  stand, only enabling user resizing.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chat editor feature | Dropped from v1 | TinyMCE gone in v13; out of scope, revisit later |
| Floating-window mechanism | Set `DEFAULT_OPTIONS.window.resizable` at init | v13-idiomatic; **no libWrapper dependency** |
| Size persistence | Client-scoped `game.settings` | Per-user preference, Foundry-native storage |
| Feature toggles | Client-scoped boolean settings | Each player enables/disables resizers they want |
| i18n | Full en + fr | Consistent with `markdown-paste` |
| Pointer handling | Pointer Events + `setPointerCapture` | More robust than v12's mouse events |

## Module Identity

```jsonc
{
  "id": "sidebar-resizer",
  "title": "Sidebar and Windows Resizer",
  "description": "Resize the sidebar, the chat input, and popped-out sidebar windows.",
  "version": "0.1.0",
  "compatibility": { "minimum": "13", "verified": "14" },
  "esmodules": ["scripts/main.js"],
  "styles": ["styles/sidebar-resizer.css"],
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" },
    { "lang": "fr", "name": "Français", "path": "lang/fr.json" }
  ]
}
```

- **No `relationships.requires`** — libWrapper is not needed.
- MIT license. README credits JeansenVaars and VanceCole as the original authors/inspiration.

## Architecture

Data flow: **`init` registers settings + enables window resize → `ready`/render
hooks attach drag handles and restore saved sizes → drag updates DOM live and
persists on release.**

```
scripts/main.js            init + ready hooks; wires features, each gated by its enable* setting
scripts/settings.js        MODULE_ID; registers client-scoped settings; getSetting/setSetting helpers
scripts/constants.js       MIN_SIDEBAR_WIDTH, MIN_CHAT_HEIGHT, MAX bounds, setting keys, DIRECTORY_CLASSES
scripts/resize-core.js     PURE: clampSize(value,min,max), parsePx(str). No Foundry import — unit-tested
scripts/sidebar-resize.js  Foundry: build horizontal handle on ui.sidebar.element, drag, persist+restore
scripts/chat-resize.js     Foundry: build vertical handle on chat input region, drag, persist+restore
scripts/window-resize.js   Foundry: set Class.DEFAULT_OPTIONS.window.resizable=true on directory classes
styles/sidebar-resizer.css handle cursors, hit areas, hover affordance
lang/en.json               setting names/hints (English)
lang/fr.json               setting names/hints (French)
tests/resize-core.test.js  node:test unit tests for clamp/parse
tests/setup.js             --import anchor for the node:test runner
```

Each Foundry-facing module is self-contained, depends only on `settings.js`,
`constants.js`, and the pure `resize-core.js`, and can be understood/changed in
isolation. The only unit-tested logic is the pure math in `resize-core.js`; the
DOM/Foundry glue is kept thin around it.

## Settings (client-scoped)

Registered in `settings.js` under `MODULE_ID = 'sidebar-resizer'`.

**Persisted sizes** (`config: false`, written by drag, not shown in the form):

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `sidebarWidth` | Number | `null` | Last sidebar width in px; `null` = Foundry default |
| `chatHeight` | Number | `null` | Last chat input region height in px; `null` = Foundry default |

**Feature toggles** (`config: true`, `scope: 'client'`, default `true`):

| Key | Meaning |
|-----|---------|
| `enableSidebarResize` | Show/enable the sidebar width handle |
| `enableChatResize` | Show/enable the chat input height handle |
| `enableWindowResize` | Make popped-out directory windows resizable |

`scope` for all of the above is `'client'` — each player controls their own.

## Feature Behavior

### Feature 1 — Sidebar horizontal resize (`sidebar-resize.js`)

- On `ready`, and re-asserted on `renderSidebar`, read `ui.sidebar.element`
  (an `HTMLElement` in v13). If `enableSidebarResize` is off, do nothing.
- Append a ~6px-wide, full-height, absolutely-positioned handle on the sidebar's
  inner (left) edge; `cursor: col-resize`. Attach is idempotent (skip if present).
- `pointerdown` → `setPointerCapture`, record start clientX and current width.
- `pointermove` → `newWidth = clampSize(startWidth + (startX - e.clientX),
  MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)`; apply via inline `element.style.width`.
- `pointerup` → persist `newWidth` to the `sidebarWidth` setting; release capture.
- **Guards:** ignore drags while the sidebar is collapsed. On `renderSidebar`
  and on expand, re-apply the saved `sidebarWidth` if set.

### Feature 2 — Chat input vertical resize (`chat-resize.js`)

- In v13 the chat input relocates between the expanded sidebar chat tab, the
  chat popout, and the notifications area (`ChatLog#_toggleNotifications`).
  Therefore the handle is (re-)attached on each relevant render hook
  (`renderChatLog` and the chat-input render path), idempotently.
- Locate the chat input container (the form/region holding the message
  `<textarea>`). Prepend a ~4px-high handle on its top edge; `cursor: row-resize`.
- Drag adjusts the container's height/flex-basis via
  `clampSize(startHeight + (startY - e.clientY), MIN_CHAT_HEIGHT, MAX_CHAT_HEIGHT)`.
  Because the input and the log scrollback share the column, the log above
  naturally grows/shrinks to fill the remaining space.
- `pointerup` → persist to `chatHeight`. On re-render, re-apply saved `chatHeight`.

### Feature 3 — Floating window resize (`window-resize.js`)

- At `init`, if `enableWindowResize` is on, iterate `DIRECTORY_CLASSES`:
  `foundry.applications.sidebar.tabs.{ChatLog, CombatTracker, SceneDirectory,
  ActorDirectory, ItemDirectory, RollTableDirectory, CardsDirectory,
  PlaylistDirectory, JournalDirectory}` plus
  `foundry.applications.sidebar.apps.CompendiumDirectory`.
- For each class that resolves, set `Class.DEFAULT_OPTIONS.window.resizable = true`.
  v13 ApplicationV2 reads this when constructing the popout via `renderPopout()`,
  making the popped-out window user-resizable.
- **Guard:** wrap each class lookup so a missing/renamed class in a future core
  version is skipped with a `console.warn`, never throwing.

## Cross-Cutting Concerns

- **Isolation & error handling:** each feature is wired in `main.js` inside its
  own try/catch and gated by its `enable*` setting. A failure in one resizer
  console-warns (prefixed with `MODULE_ID`) and never breaks the others or core UI.
- **Idempotent attach:** every handle-attach checks for an existing handle first,
  so repeated render hooks don't stack duplicate handles or listeners.
- **No mutation of shared user data:** size values are read/written through the
  settings helpers; DOM size is applied via inline styles only.

## Testing Strategy

- Runner: Node's built-in `node:test` via `tests/setup.js` `--import` anchor —
  identical to `markdown-paste`. No Jest/Vitest.
- `tests/resize-core.test.js` covers the pure logic:
  - `clampSize` returns the value within bounds, the min below range, the max above.
  - `parsePx('320px')` → `320`; malformed input → sensible fallback.
- DOM/Foundry glue (`sidebar-resize.js`, `chat-resize.js`, `window-resize.js`) is
  intentionally thin and verified manually in a running v13 world (resize, reload
  to confirm persistence, pop out a directory to confirm resizability). This
  mirrors `markdown-paste`'s split of pure-tested vs. Foundry-glue code.

## Build, Release & CI

Reuse the `markdown-paste` pipeline already partially scaffolded in the repo,
updated for this module's id:

- `package.json` — dev-only; `test` and `lint` scripts. No runtime npm
  dependencies (no vendored libraries needed — there is no `marked`/`dompurify`
  equivalent here), so **no `vendor/` step**.
- `.github/workflows/release.yml` — fix the placeholder `markdown-paste`
  references to `sidebar-resizer`; the zip bundles `module.json scripts/ styles/
  lang/` (no `templates/`, no `vendor/`).
- `.github/workflows/test.yml` — run `npm test` / `npm run lint` on PRs.
- `release.sh` — the same version-selection / tag / merge-back flow, retargeted.
- Development workflow: `develop` is the ongoing branch, `main` holds released
  code; feature/bugfix branches off `develop`; ship via feature → `develop` →
  `main`, then tag on `main` triggers the release workflow.

## Open Questions / Future Work

- ProseMirror-based rich chat toolbar (replacement for the dropped TinyMCE feature).
- Optional world-scoped GM defaults (e.g. a minimum sidebar width) if requested.
- Optional restoration of a sensible default popout size if users miss the v12 behavior.
