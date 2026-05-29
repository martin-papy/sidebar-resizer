# Sidebar and Windows Resizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FoundryVTT v13/v14 module that lets each user resize the sidebar width, the chat input height, and popped-out sidebar directory windows.

**Architecture:** Many small single-purpose ES modules. All resize math and class-marking logic lives in pure, Node-testable functions (`resize-core.js`, plus a pure helper in `window-resize.js`); the Foundry-coupled DOM glue is a thin layer around them, gated per-feature by client-scoped settings. No runtime dependencies, no libWrapper.

**Tech Stack:** Vanilla ES modules, FoundryVTT ApplicationV2 API (v13/v14), Pointer Events, `game.settings` (client scope), `node:test` for unit tests, ESLint, GitHub Actions release pipeline (mirrors `markdown-paste`).

**Reference spec:** `docs/superpowers/specs/2026-05-29-sidebar-resizer-module-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Dev-only: `test` + `lint` scripts, eslint devDeps. No runtime deps. |
| `eslint.config.js` | Flat ESLint config with Foundry globals. |
| `module.json` | Foundry manifest (id, compatibility, entry points, languages). |
| `scripts/constants.js` | Numeric bounds, setting keys, directory class paths. No imports. |
| `scripts/resize-core.js` | PURE: `clampSize`, `parsePx`, `computeDragSize`. Unit-tested. |
| `scripts/settings.js` | `MODULE_ID`; registers client-scoped settings; `getSetting`/`setSetting`. |
| `scripts/window-resize.js` | `markClassResizable` (pure) + `enableWindowResize` (Foundry glue). |
| `scripts/sidebar-resize.js` | Horizontal sidebar handle: attach, drag, persist, restore. |
| `scripts/chat-resize.js` | Vertical chat-input handle: attach, drag, persist, restore. |
| `scripts/main.js` | `init`/`ready`/render hooks; wires each feature behind its toggle. |
| `styles/sidebar-resizer.css` | Handle cursors, hit areas, hover affordance. |
| `lang/en.json`, `lang/fr.json` | Setting names/hints. |
| `tests/setup.js` | `--import` anchor for `node:test`. |
| `tests/resize-core.test.js` | Unit tests for the pure resize math. |
| `tests/window-resize.test.js` | Unit tests for `markClassResizable`. |

Files retargeted from the markdown-paste scaffold already present in the repo: `.github/workflows/release.yml`, `.github/workflows/test.yml`, `release.sh`, `README.md`.

---

## Task 1: Dev tooling scaffold (package.json, eslint, gitignore, test anchor)

**Files:**
- Create: `package.json`
- Create: `eslint.config.js`
- Create: `tests/setup.js`
- Verify: `.gitignore` (already present from scaffold)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sidebar-resizer-tests",
  "private": true,
  "version": "0.1.0",
  "description": "Dev-only — node test runner config for sidebar-resizer",
  "type": "module",
  "scripts": {
    "test": "node --test --import ./tests/setup.js 'tests/**/*.test.js'",
    "lint": "eslint scripts/ tests/"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create `eslint.config.js`**

```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Standard browser globals
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        PointerEvent: 'readonly',
        // FoundryVTT globals available at runtime
        game: 'readonly',
        Hooks: 'readonly',
        foundry: 'readonly',
        ui: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/'],
  },
];
```

- [ ] **Step 3: Create `tests/setup.js`**

```js
// tests/setup.js
// `--import` anchor for the node:test runner (see package.json "test" script).
// Pure tests need no global fixtures; add here if that ever changes.
```

- [ ] **Step 4: Install dev deps**

Run: `cd /Users/martin.papy/Development/sidebar-resizer && npm install`
Expected: `node_modules/` created, `eslint` available. (`package-lock.json` is gitignored.)

- [ ] **Step 5: Commit**

```bash
git add package.json eslint.config.js tests/setup.js
git commit -m "chore: add dev tooling scaffold (eslint + node:test)"
```

---

## Task 2: Constants module

**Files:**
- Create: `scripts/constants.js`

- [ ] **Step 1: Create `scripts/constants.js`**

```js
// scripts/constants.js
// Single source of truth for numeric bounds, setting keys, and the directory
// class paths whose pop-out windows we make resizable. No imports — leaf module.

/** Minimum sidebar width in pixels. */
export const MIN_SIDEBAR_WIDTH = 200;
/** Maximum sidebar width in pixels (defensive upper bound). */
export const MAX_SIDEBAR_WIDTH = 1200;
/** Minimum chat input region height in pixels. */
export const MIN_CHAT_HEIGHT = 60;
/** Maximum chat input region height in pixels (defensive upper bound). */
export const MAX_CHAT_HEIGHT = 1000;

/** Client-scoped setting keys. */
export const SETTINGS = {
  SIDEBAR_WIDTH: 'sidebarWidth',
  CHAT_HEIGHT: 'chatHeight',
  ENABLE_SIDEBAR: 'enableSidebarResize',
  ENABLE_CHAT: 'enableChatResize',
  ENABLE_WINDOW: 'enableWindowResize',
};

/**
 * Dotted paths under `foundry.applications.sidebar` for the directory classes
 * whose pop-out windows should be resizable. Resolved defensively at runtime;
 * a missing path is skipped, never thrown.
 */
export const DIRECTORY_CLASS_PATHS = [
  'tabs.ChatLog',
  'tabs.CombatTracker',
  'tabs.SceneDirectory',
  'tabs.ActorDirectory',
  'tabs.ItemDirectory',
  'tabs.RollTableDirectory',
  'tabs.CardsDirectory',
  'tabs.PlaylistDirectory',
  'tabs.JournalDirectory',
  'apps.CompendiumDirectory',
];
```

- [ ] **Step 2: Lint the file**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add scripts/constants.js
git commit -m "feat: add constants module (bounds, setting keys, directory paths)"
```

---

## Task 3: Pure resize math (`resize-core.js`) — TDD

**Files:**
- Create: `tests/resize-core.test.js`
- Create: `scripts/resize-core.js`

- [ ] **Step 1: Write the failing test**

Create `tests/resize-core.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSize, parsePx, computeDragSize } from '../scripts/resize-core.js';

test('clampSize returns the value when within bounds', () => {
  assert.equal(clampSize(300, 200, 1200), 300);
});

test('clampSize floors to min when below range', () => {
  assert.equal(clampSize(150, 200, 1200), 200);
});

test('clampSize caps to max when above range', () => {
  assert.equal(clampSize(5000, 200, 1200), 1200);
});

test('clampSize returns min for non-finite input', () => {
  assert.equal(clampSize(NaN, 200, 1200), 200);
  assert.equal(clampSize(Infinity, 200, 1200), 1200);
});

test('clampSize ignores max when max is null', () => {
  assert.equal(clampSize(5000, 200, null), 5000);
});

test('parsePx parses a px string to a number', () => {
  assert.equal(parsePx('320px'), 320);
});

test('parsePx parses a bare numeric string', () => {
  assert.equal(parsePx('320'), 320);
});

test('parsePx passes through a finite number', () => {
  assert.equal(parsePx(440), 440);
});

test('parsePx returns null for non-numeric input', () => {
  assert.equal(parsePx('auto'), null);
  assert.equal(parsePx(''), null);
  assert.equal(parsePx(null), null);
  assert.equal(parsePx(undefined), null);
});

test('computeDragSize grows size as the pointer moves toward a smaller coord', () => {
  // start 300px wide, pointer moved left from x=900 to x=820 → +80
  assert.equal(computeDragSize(300, 900, 820, 200, 1200), 380);
});

test('computeDragSize shrinks size as the pointer moves toward a larger coord', () => {
  // start 300px wide, pointer moved right from x=900 to x=960 → -60
  assert.equal(computeDragSize(300, 900, 960, 200, 1200), 240);
});

test('computeDragSize clamps the result to the given bounds', () => {
  assert.equal(computeDragSize(300, 900, 2000, 200, 1200), 200); // floored
  assert.equal(computeDragSize(300, 900, 200, 200, 1200), 1200); // capped
});

test('computeDragSize rounds to whole pixels', () => {
  assert.equal(computeDragSize(300.4, 900.6, 820.1, 200, 1200), 381);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/resize-core.js'` (or named-export errors).

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/resize-core.js`:

```js
// scripts/resize-core.js
// Pure resize math. No Foundry, DOM, or browser globals — unit-tested under node:test.

/**
 * Clamp a numeric size to [min, max].
 * @param {number} value  Candidate size.
 * @param {number} min    Lower bound (also the fallback for non-finite input).
 * @param {number|null} max  Upper bound, or null/undefined for no upper bound.
 * @returns {number}
 */
export function clampSize(value, min, max) {
  if (!Number.isFinite(value)) {
    return value === Infinity && max != null ? max : min;
  }
  if (value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

/**
 * Parse a CSS pixel value or bare number into a finite number.
 * @param {string|number|null|undefined} value
 * @returns {number|null}  The number, or null if it cannot be parsed.
 */
export function parsePx(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute a new size during a drag. Size grows as the pointer moves toward a
 * smaller coordinate (left for width, up for height): the resize handle sits on
 * the inner/top edge, matching the original module's behaviour.
 * @param {number} startSize     Size (px) when the drag began.
 * @param {number} startCoord    Pointer coordinate (px) when the drag began.
 * @param {number} currentCoord  Current pointer coordinate (px).
 * @param {number} min           Lower bound.
 * @param {number|null} max      Upper bound, or null for none.
 * @returns {number}  Clamped, whole-pixel size.
 */
export function computeDragSize(startSize, startCoord, currentCoord, min, max) {
  const next = Math.round(startSize + (startCoord - currentCoord));
  return clampSize(next, min, max);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `resize-core` tests green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/resize-core.js tests/resize-core.test.js
git commit -m "feat: add pure resize math (clampSize, parsePx, computeDragSize)"
```

---

## Task 4: Window-resize pure helper (`markClassResizable`) — TDD

**Files:**
- Create: `tests/window-resize.test.js`
- Create: `scripts/window-resize.js` (pure helper first; Foundry glue added in Task 5 step)

> Note: `window-resize.js` must reference the `foundry` global only *inside*
> functions, never at module top level, so importing it in Node is side-effect-free.

- [ ] **Step 1: Write the failing test**

Create `tests/window-resize.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markClassResizable } from '../scripts/window-resize.js';

test('markClassResizable sets resizable on a class with full options', () => {
  const cls = { DEFAULT_OPTIONS: { window: { title: 'X', resizable: false } } };
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
  assert.equal(cls.DEFAULT_OPTIONS.window.title, 'X'); // other keys preserved
});

test('markClassResizable creates window when DEFAULT_OPTIONS lacks it', () => {
  const cls = { DEFAULT_OPTIONS: {} };
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
});

test('markClassResizable creates DEFAULT_OPTIONS when missing', () => {
  const cls = {};
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
});

test('markClassResizable returns false for a missing class', () => {
  assert.equal(markClassResizable(null), false);
  assert.equal(markClassResizable(undefined), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/window-resize.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/window-resize.js`:

```js
// scripts/window-resize.js
// Makes popped-out sidebar directory windows user-resizable on v13/v14.
// `markClassResizable` is pure (operates on a plain class-like object) and
// unit-tested; `enableWindowResize` is the Foundry glue and is verified manually.
import { MODULE_ID } from './settings.js';
import { DIRECTORY_CLASS_PATHS } from './constants.js';

/**
 * Ensure a directory class's ApplicationV2 DEFAULT_OPTIONS marks its window as
 * resizable. Mutating the static options object is the intended v13 mechanism:
 * ApplicationV2 reads `window.resizable` when constructing the pop-out.
 * @param {object|null|undefined} cls  A class (or class-like object) with a
 *   static `DEFAULT_OPTIONS`. Missing pieces are created.
 * @returns {boolean}  true if applied, false if `cls` is absent.
 */
export function markClassResizable(cls) {
  if (!cls) return false;
  if (!cls.DEFAULT_OPTIONS) cls.DEFAULT_OPTIONS = {};
  if (!cls.DEFAULT_OPTIONS.window) cls.DEFAULT_OPTIONS.window = {};
  cls.DEFAULT_OPTIONS.window.resizable = true;
  return true;
}

/**
 * Resolve a dotted path under `foundry.applications.sidebar` to a class.
 * @param {string} path  e.g. 'tabs.ChatLog' or 'apps.CompendiumDirectory'.
 * @returns {object|null}
 */
function resolveDirectoryClass(path) {
  const root = foundry?.applications?.sidebar;
  if (!root) return null;
  return path.split('.').reduce((node, key) => (node ? node[key] : null), root) ?? null;
}

/**
 * Mark every known directory pop-out window as resizable. Each lookup is guarded
 * so a renamed/removed core class in a future version is skipped with a warning,
 * never throwing.
 * @returns {number}  Count of classes successfully marked.
 */
export function enableWindowResize() {
  let count = 0;
  for (const path of DIRECTORY_CLASS_PATHS) {
    try {
      const cls = resolveDirectoryClass(path);
      if (markClassResizable(cls)) count += 1;
      else console.warn(`${MODULE_ID} | directory class not found: ${path}`);
    } catch (err) {
      console.warn(`${MODULE_ID} | failed to mark ${path} resizable`, err);
    }
  }
  return count;
}
```

> This task creates `settings.js` as a dependency in the next task. Until Task 5
> lands, the `import ... from './settings.js'` line will make the Node test fail
> on module resolution. To keep this task self-contained and its test green now,
> temporarily inline the constant: replace the two import lines with
> `const MODULE_ID = 'sidebar-resizer';` and
> `import { DIRECTORY_CLASS_PATHS } from './constants.js';`. Task 5 step 4 restores
> the `MODULE_ID` import from `settings.js`.

- [ ] **Step 4: Apply the self-contained shim for this task**

Replace the top imports in `scripts/window-resize.js` with:

```js
import { DIRECTORY_CLASS_PATHS } from './constants.js';

// Temporary until settings.js exists (Task 5 restores the import).
const MODULE_ID = 'sidebar-resizer';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `window-resize` and `resize-core` suites green.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add scripts/window-resize.js tests/window-resize.test.js
git commit -m "feat: add window-resize helper (markClassResizable + enableWindowResize)"
```

---

## Task 5: Settings module

**Files:**
- Create: `scripts/settings.js`
- Modify: `scripts/window-resize.js` (restore `MODULE_ID` import)

- [ ] **Step 1: Create `scripts/settings.js`**

```js
// scripts/settings.js
import { SETTINGS, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from './constants.js';

export const MODULE_ID = 'sidebar-resizer';

// Feature toggles: client-scoped so each user controls their own UI. Shown in
// the module's settings panel.
const TOGGLES = [
  SETTINGS.ENABLE_SIDEBAR,
  SETTINGS.ENABLE_CHAT,
  SETTINGS.ENABLE_WINDOW,
];

/**
 * Register all module settings. Called once from the `init` hook.
 */
export function registerSettings() {
  for (const key of TOGGLES) {
    game.settings.register(MODULE_ID, key, {
      name: `${MODULE_ID}.settings.${key}.name`,
      hint: `${MODULE_ID}.settings.${key}.hint`,
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
    });
  }

  // Persisted sizes: client-scoped, written by drag (config:false so they are
  // not shown in the settings form). null means "use Foundry's default".
  game.settings.register(MODULE_ID, SETTINGS.SIDEBAR_WIDTH, {
    scope: 'client',
    config: false,
    type: Number,
    default: null,
  });
  game.settings.register(MODULE_ID, SETTINGS.CHAT_HEIGHT, {
    scope: 'client',
    config: false,
    type: Number,
    default: null,
  });

  // Touch a bound so the import is used even if tree-shaken aggressively; also
  // documents the intended sidebar range next to registration.
  void MIN_SIDEBAR_WIDTH;
  void MAX_SIDEBAR_WIDTH;
}

/**
 * Read a module setting.
 * @param {string} key
 * @returns {*}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Write a module setting.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<*>}
 */
export function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}
```

> If the two `void` lines feel unnecessary, drop them and remove
> `MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH` from the import — they are only there to
> avoid an unused-import lint error if you keep them. The drag modules import the
> bounds directly, so settings.js does not actually need them. **Preferred:**
> import only `{ SETTINGS }` and delete the `void` lines.

- [ ] **Step 2: Apply the preferred import in `scripts/settings.js`**

Change the first import line to:

```js
import { SETTINGS } from './constants.js';
```

and delete the two `void MIN_SIDEBAR_WIDTH; void MAX_SIDEBAR_WIDTH;` lines.

- [ ] **Step 3: Restore the real `MODULE_ID` import in `scripts/window-resize.js`**

Replace the shim block at the top of `scripts/window-resize.js`:

```js
import { DIRECTORY_CLASS_PATHS } from './constants.js';

// Temporary until settings.js exists (Task 5 restores the import).
const MODULE_ID = 'sidebar-resizer';
```

with:

```js
import { MODULE_ID } from './settings.js';
import { DIRECTORY_CLASS_PATHS } from './constants.js';
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test && npm run lint`
Expected: PASS. (`settings.js` references `game.*` only inside functions, so importing `window-resize.js` — which imports `settings.js` — stays side-effect-free in Node.)

- [ ] **Step 5: Commit**

```bash
git add scripts/settings.js scripts/window-resize.js
git commit -m "feat: add client-scoped settings module"
```

---

## Task 6: Sidebar horizontal resize (Foundry glue)

**Files:**
- Create: `scripts/sidebar-resize.js`

> Manually verified in a running world (no Node test — DOM/Foundry-coupled).

- [ ] **Step 1: Create `scripts/sidebar-resize.js`**

```js
// scripts/sidebar-resize.js
// Horizontal resize handle on the sidebar's inner edge. Persists width to a
// client setting and restores it on render/expand.
import { MODULE_ID, getSetting, setSetting } from './settings.js';
import { computeDragSize, parsePx } from './resize-core.js';
import { SETTINGS, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from './constants.js';

const HANDLE_CLASS = 'sidebar-resizer-handle';

/** @returns {HTMLElement|null} The sidebar root element, or null if unavailable. */
function getSidebarElement() {
  return ui?.sidebar?.element ?? null;
}

/** @returns {boolean} true if the sidebar is currently collapsed. */
function isCollapsed() {
  // v13 Sidebar exposes `expanded`; fall back to the CSS class if absent.
  if (typeof ui?.sidebar?.expanded === 'boolean') return !ui.sidebar.expanded;
  return getSidebarElement()?.classList.contains('collapsed') ?? false;
}

/** Apply a width (px) to the sidebar element via inline style. */
function applyWidth(el, width) {
  el.style.width = `${width}px`;
}

/**
 * Re-apply the saved sidebar width, if one is stored and the sidebar is open.
 */
export function restoreSidebarWidth() {
  const el = getSidebarElement();
  if (!el || isCollapsed()) return;
  const saved = parsePx(getSetting(SETTINGS.SIDEBAR_WIDTH));
  if (saved != null) applyWidth(el, saved);
}

/**
 * Attach the resize handle to the sidebar. Idempotent: a second call is a no-op
 * if the handle already exists.
 */
export function attachSidebarResizer() {
  const el = getSidebarElement();
  if (!el) return;
  if (el.querySelector(`:scope > .${HANDLE_CLASS}`)) return;

  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  el.appendChild(handle);

  let startCoord = 0;
  let startSize = 0;

  function onMove(e) {
    const width = computeDragSize(startSize, startCoord, e.clientX, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
    applyWidth(el, width);
  }

  function onUp(e) {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    setSetting(SETTINGS.SIDEBAR_WIDTH, el.offsetWidth)
      .catch((err) => console.warn(`${MODULE_ID} | failed to save sidebar width`, err));
  }

  handle.addEventListener('pointerdown', (e) => {
    if (isCollapsed()) return;
    e.preventDefault();
    startCoord = e.clientX;
    startSize = el.offsetWidth;
    handle.setPointerCapture?.(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  // Apply any saved width as soon as the handle is in place.
  restoreSidebarWidth();
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/sidebar-resize.js
git commit -m "feat: add horizontal sidebar resize handle"
```

---

## Task 7: Chat input vertical resize (Foundry glue)

**Files:**
- Create: `scripts/chat-resize.js`

> Manually verified in a running world. The chat-input selector chain is
> best-effort for v13/v14 markup; Task 10's manual-verification step confirms it.

- [ ] **Step 1: Create `scripts/chat-resize.js`**

```js
// scripts/chat-resize.js
// Vertical resize handle on the chat input region. The input relocates between
// the expanded sidebar, the chat pop-out, and the notifications area, so the
// handle is (re-)attached idempotently on each relevant render.
import { MODULE_ID, getSetting, setSetting } from './settings.js';
import { computeDragSize, parsePx } from './resize-core.js';
import { SETTINGS, MIN_CHAT_HEIGHT, MAX_CHAT_HEIGHT } from './constants.js';

const HANDLE_CLASS = 'chat-resizer-handle';

/**
 * Find the chat input region inside a rendered chat element.
 * @param {HTMLElement} root  The chat log element (from the render hook).
 * @returns {HTMLElement|null}
 */
function findChatInput(root) {
  if (!root) return null;
  // v13/v14: the message box lives in a chat input form/region. Try the most
  // specific selectors first, then fall back to the textarea's container.
  return (
    root.querySelector('.chat-form')
    ?? root.querySelector('#chat-form')
    ?? root.querySelector('textarea')?.closest('form, .chat-form, div')
    ?? null
  );
}

/** Apply a height (px) to the input region via inline flex-basis. */
function applyHeight(el, height) {
  el.style.flex = `0 0 ${height}px`;
}

/**
 * Attach the resize handle to a chat element's input region. Idempotent.
 * @param {HTMLElement} root  The chat log element from the render hook.
 */
export function attachChatResizer(root) {
  const input = findChatInput(root);
  if (!input) return;
  if (input.querySelector(`:scope > .${HANDLE_CLASS}`)) return;

  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  input.prepend(handle);

  // Restore a saved height immediately.
  const saved = parsePx(getSetting(SETTINGS.CHAT_HEIGHT));
  if (saved != null) applyHeight(input, saved);

  let startCoord = 0;
  let startSize = 0;

  function onMove(e) {
    const height = computeDragSize(startSize, startCoord, e.clientY, MIN_CHAT_HEIGHT, MAX_CHAT_HEIGHT);
    applyHeight(input, height);
  }

  function onUp(e) {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    setSetting(SETTINGS.CHAT_HEIGHT, input.offsetHeight)
      .catch((err) => console.warn(`${MODULE_ID} | failed to save chat height`, err));
  }

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startCoord = e.clientY;
    startSize = input.offsetHeight;
    handle.setPointerCapture?.(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/chat-resize.js
git commit -m "feat: add vertical chat input resize handle"
```

---

## Task 8: Main entry — hook wiring

**Files:**
- Create: `scripts/main.js`

- [ ] **Step 1: Create `scripts/main.js`**

```js
// scripts/main.js
import { MODULE_ID, registerSettings, getSetting } from './settings.js';
import { SETTINGS } from './constants.js';
import { enableWindowResize } from './window-resize.js';
import { attachSidebarResizer, restoreSidebarWidth } from './sidebar-resize.js';
import { attachChatResizer } from './chat-resize.js';

/** Run a feature wire-up guarded so one failure never breaks the others. */
function safely(label, fn) {
  try {
    fn();
  } catch (err) {
    console.warn(`${MODULE_ID} | ${label} failed`, err);
  }
}

Hooks.once('init', () => {
  console.info(
    `${MODULE_ID} | Initializing on Foundry release `
    + `${game.release?.generation}.${game.release?.build}`
  );
  registerSettings();

  // Window resize is set up at init so DEFAULT_OPTIONS are marked before any
  // pop-out is constructed.
  if (getSetting(SETTINGS.ENABLE_WINDOW)) {
    safely('window resize', () => enableWindowResize());
  }
});

Hooks.once('ready', () => {
  if (getSetting(SETTINGS.ENABLE_SIDEBAR)) {
    safely('sidebar resize', () => attachSidebarResizer());
  }
});

// The sidebar re-renders on tab changes and collapse/expand; re-assert the
// handle and the saved width each time.
Hooks.on('renderSidebar', () => {
  if (!getSetting(SETTINGS.ENABLE_SIDEBAR)) return;
  safely('sidebar resize (render)', () => {
    attachSidebarResizer();
    restoreSidebarWidth();
  });
});

// The chat input relocates between surfaces; re-attach on each chat render.
Hooks.on('renderChatLog', (_app, element) => {
  if (!getSetting(SETTINGS.ENABLE_CHAT)) return;
  // element may be an HTMLElement (ApplicationV2) or a jQuery-wrapped node.
  const root = element instanceof window.HTMLElement ? element : element?.[0];
  safely('chat resize', () => attachChatResizer(root));
});
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/main.js
git commit -m "feat: wire features in main entry (init/ready/render hooks)"
```

---

## Task 9: Manifest, styles, and i18n

**Files:**
- Create: `module.json`
- Create: `styles/sidebar-resizer.css`
- Create: `lang/en.json`
- Create: `lang/fr.json`

- [ ] **Step 1: Create `module.json`**

```json
{
  "id": "sidebar-resizer",
  "title": "Sidebar and Windows Resizer",
  "description": "Resize the sidebar, the chat input, and popped-out sidebar windows.",
  "version": "0.1.0",
  "authors": [
    {
      "name": "Martin Papy",
      "email": "martin.papy@gmail.com"
    }
  ],
  "compatibility": {
    "minimum": "13",
    "verified": "14"
  },
  "esmodules": [
    "scripts/main.js"
  ],
  "styles": [
    "styles/sidebar-resizer.css"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    },
    {
      "lang": "fr",
      "name": "Français",
      "path": "lang/fr.json"
    }
  ],
  "url": "https://github.com/martin-papy/sidebar-resizer",
  "manifest": "https://github.com/martin-papy/sidebar-resizer/releases/latest/download/module.json",
  "download": "https://github.com/martin-papy/sidebar-resizer/releases/download/v0.1.0/sidebar-resizer.zip"
}
```

- [ ] **Step 2: Create `styles/sidebar-resizer.css`**

```css
/* styles/sidebar-resizer.css */
/* Drag handles for the sidebar (horizontal) and chat input (vertical).
   Compositor-friendly: only background/opacity transition on hover. */

.sidebar-resizer-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 30;
  background: transparent;
  transition: background-color 150ms ease-out;
  touch-action: none;
}

.sidebar-resizer-handle:hover {
  background-color: var(--color-border-highlight, rgba(255, 255, 255, 0.25));
}

.chat-resizer-handle {
  position: relative;
  width: 100%;
  height: 4px;
  cursor: row-resize;
  z-index: 30;
  background: transparent;
  transition: background-color 150ms ease-out;
  touch-action: none;
}

.chat-resizer-handle:hover {
  background-color: var(--color-border-highlight, rgba(255, 255, 255, 0.25));
}
```

- [ ] **Step 3: Create `lang/en.json`**

```json
{
  "sidebar-resizer.settings.enableSidebarResize.name": "Enable sidebar resize",
  "sidebar-resizer.settings.enableSidebarResize.hint": "Show a drag handle on the inner edge of the sidebar to set its width. Your width is remembered on this device.",
  "sidebar-resizer.settings.enableChatResize.name": "Enable chat input resize",
  "sidebar-resizer.settings.enableChatResize.hint": "Show a drag handle on the top edge of the chat input to set its height. Your height is remembered on this device.",
  "sidebar-resizer.settings.enableWindowResize.name": "Enable pop-out window resize",
  "sidebar-resizer.settings.enableWindowResize.hint": "Make popped-out sidebar windows (Combat Tracker, Playlists, directories, etc.) resizable. Takes effect after a reload."
}
```

- [ ] **Step 4: Create `lang/fr.json`**

```json
{
  "sidebar-resizer.settings.enableSidebarResize.name": "Activer le redimensionnement de la barre latérale",
  "sidebar-resizer.settings.enableSidebarResize.hint": "Affiche une poignée sur le bord intérieur de la barre latérale pour régler sa largeur. Votre largeur est mémorisée sur cet appareil.",
  "sidebar-resizer.settings.enableChatResize.name": "Activer le redimensionnement de la zone de saisie du chat",
  "sidebar-resizer.settings.enableChatResize.hint": "Affiche une poignée sur le bord supérieur de la zone de saisie du chat pour régler sa hauteur. Votre hauteur est mémorisée sur cet appareil.",
  "sidebar-resizer.settings.enableWindowResize.name": "Activer le redimensionnement des fenêtres détachées",
  "sidebar-resizer.settings.enableWindowResize.hint": "Rend redimensionnables les fenêtres détachées de la barre latérale (suivi de combat, listes de lecture, répertoires, etc.). Prend effet après un rechargement."
}
```

- [ ] **Step 5: Validate JSON**

Run: `jq empty module.json lang/en.json lang/fr.json`
Expected: no output (all valid JSON).

- [ ] **Step 6: Commit**

```bash
git add module.json styles/sidebar-resizer.css lang/en.json lang/fr.json
git commit -m "feat: add manifest, handle styles, and en/fr i18n"
```

---

## Task 10: Retarget CI pipeline, release script, and README

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/test.yml`
- Modify: `release.sh`
- Modify: `README.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`
- Create: `CLAUDE.md`

- [ ] **Step 1: Fix `release.yml` — zip name and contents**

In `.github/workflows/release.yml`, change the expected download filename and the
zip build to this module's id and file set (no `templates/`, no `vendor/`).

Replace the line in the "Preflight assertions" step:

```bash
          EXPECTED_DOWNLOAD="https://github.com/${GITHUB_REPOSITORY}/releases/download/${TAG}/markdown-paste.zip"
```

with:

```bash
          EXPECTED_DOWNLOAD="https://github.com/${GITHUB_REPOSITORY}/releases/download/${TAG}/sidebar-resizer.zip"
```

Replace the "Build release zip" step body:

```bash
          set -euo pipefail
          zip -r markdown-paste.zip module.json scripts/ styles/ lang/ templates/ vendor/
          echo "Zip contents:"
          unzip -l markdown-paste.zip
```

with:

```bash
          set -euo pipefail
          zip -r sidebar-resizer.zip module.json scripts/ styles/ lang/
          echo "Zip contents:"
          unzip -l sidebar-resizer.zip
```

Replace the "Create GitHub release" upload line:

```bash
            markdown-paste.zip module.json \
```

with:

```bash
            sidebar-resizer.zip module.json \
```

- [ ] **Step 2: Fix `test.yml` — drop the vendor step**

Replace the entire `.github/workflows/test.yml` with:

```yaml
name: tests

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
      - run: npm ci || npm install
      - run: npm run lint
      - run: npm test
```

- [ ] **Step 3: Retarget `release.sh`**

Apply these four replacements in `release.sh`:

1. Line 2 comment:
   - from: `# release.sh — interactive release driver for markdown-paste.`
   - to:   `# release.sh — interactive release driver for sidebar-resizer.`
2. `DOWNLOAD_URL_BASE`:
   - from: `DOWNLOAD_URL_BASE="https://github.com/martin-papy/markdown-paste/releases/download"`
   - to:   `DOWNLOAD_URL_BASE="https://github.com/martin-papy/sidebar-resizer/releases/download"`
3. Both occurrences of the zip filename in `plan_summary` and `execute_release`:
   - from: `local download_url="${DOWNLOAD_URL_BASE}/v${TARGET}/markdown-paste.zip"`
   - to:   `local download_url="${DOWNLOAD_URL_BASE}/v${TARGET}/sidebar-resizer.zip"`
   (use `replace_all` — the line is identical in both functions)
4. The two final URLs in `main`:
   - from: `Actions: https://github.com/martin-papy/markdown-paste/actions`
   - to:   `Actions: https://github.com/martin-papy/sidebar-resizer/actions`
   - from: `Release (when workflow finishes): https://github.com/martin-papy/markdown-paste/releases/tag/v${TARGET}`
   - to:   `Release (when workflow finishes): https://github.com/martin-papy/sidebar-resizer/releases/tag/v${TARGET}`

- [ ] **Step 4: Verify no stray `markdown-paste` references remain in retargeted files**

Run: `grep -rn "markdown-paste" .github/ release.sh`
Expected: no output.

- [ ] **Step 5: Create `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-29

### Added
- Horizontal sidebar resize via a drag handle on the sidebar's inner edge; width persisted per device.
- Vertical chat input resize via a drag handle on the input's top edge; height persisted per device.
- Resizable popped-out sidebar windows (Combat Tracker, Playlists, directories, Compendium).
- Client-scoped settings to enable/disable each resizer independently.
- English and French localization.
```

- [ ] **Step 6: Create `LICENSE` (MIT)**

```text
MIT License

Copyright (c) 2026 Martin Papy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Replace `README.md`**

```markdown
# Sidebar and Windows Resizer

A FoundryVTT v13/v14 module that lets each user resize parts of the interface:

- **Sidebar width** — drag the inner edge of the right-hand sidebar.
- **Chat input height** — drag the top edge of the chat input; the log above shares the space.
- **Pop-out windows** — popped-out sidebar windows (Combat Tracker, Playlists, directories, Compendium) become resizable.

Sizes are remembered per device. Each resizer can be toggled independently in the module settings.

## Compatibility

- Minimum: FoundryVTT v13
- Verified: FoundryVTT v14
- No dependencies.

## Credits

A v13+ re-implementation inspired by the v12-only
[foundryvtt-sidebar-resizer](https://github.com/saif-ellafi/foundryvtt-sidebar-resizer)
by JeansenVaars, originally created by VanceCole.

## License

[MIT](./LICENSE)
```

- [ ] **Step 8: Create `CLAUDE.md`**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dev deps (eslint)
npm test             # run all unit tests via Node's built-in test runner
npm run lint         # lint scripts/ and tests/
```

Run a single test file:
```bash
node --test --import ./tests/setup.js tests/resize-core.test.js
```

## What This Is

A FoundryVTT module (v13/v14) that adds drag-resize to the sidebar, the chat
input, and popped-out sidebar windows. `module.json` declares the entry point
and compatibility; `scripts/main.js` is the sole ESModule Foundry loads.

## Architecture

```
scripts/main.js          init/ready/render hooks; wires each feature behind its toggle
scripts/settings.js      MODULE_ID + client-scoped settings (3 toggles, 2 persisted sizes)
scripts/constants.js     numeric bounds, setting keys, directory class paths
scripts/resize-core.js   PURE: clampSize, parsePx, computeDragSize — no Foundry, unit-tested
scripts/window-resize.js markClassResizable (pure, tested) + enableWindowResize (Foundry glue)
scripts/sidebar-resize.js horizontal handle on ui.sidebar.element: drag, persist, restore
scripts/chat-resize.js   vertical handle on the chat input region: drag, persist, restore
```

## Testing Strategy

Tests live in `tests/` and run under Node's built-in `node:test` runner — no
Jest/Vitest, no jsdom. Only the pure logic (`resize-core.js`, `markClassResizable`)
is unit-tested; the DOM/Foundry glue is verified manually in a running world.

## Development workflow

- Ongoing branch is `develop`; `main` holds released code.
- Feature/bugfix branches off `develop` (`feature-xxx` / `bugfix-yyy`); ship via
  branch → `develop`, then `develop` → `main`. Tagging on `main` triggers release.

## Releasing

`./release.sh` from `main` handles version bump, `module.json`/`package.json`
edits, tag, push, and merge-back to `develop`. The release workflow
(`.github/workflows/release.yml`) fires on the `v*` tag, zips
`module.json scripts/ styles/ lang/` into `sidebar-resizer.zip`, and submits
stable releases to FoundryVTT.

## External Documentation

Use the Context7 MCP server for up-to-date FoundryVTT API docs (ApplicationV2,
Sidebar, Hooks): resolve `foundryvtt`, then query the v13/v14 docs.
```

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/release.yml .github/workflows/test.yml release.sh README.md CHANGELOG.md LICENSE CLAUDE.md
git commit -m "chore: retarget CI/release pipeline and docs to sidebar-resizer"
```

---

## Task 11: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all `resize-core` and `window-resize` tests green.

- [ ] **Step 2: Run the linter across all scripts and tests**

Run: `npm run lint`
Expected: PASS — no errors.

- [ ] **Step 3: Validate every JSON file**

Run: `jq empty module.json lang/en.json lang/fr.json`
Expected: no output.

- [ ] **Step 4: Confirm the release zip file set resolves**

Run: `ls module.json scripts/ styles/ lang/`
Expected: all present; `scripts/` contains main, settings, constants, resize-core, window-resize, sidebar-resize, chat-resize.

- [ ] **Step 5: Manual verification in a running Foundry v13 (and v14) world**

Symlink or copy the module into a Foundry `Data/modules/` directory, enable it,
and confirm:
1. A `col-resize` handle appears on the sidebar's inner edge; dragging changes
   width; the width survives a page reload (F5).
2. A `row-resize` handle appears on the top edge of the chat input; dragging
   changes its height and the chat log above adjusts; the height survives a reload.
3. Popping out a directory (e.g. Combat Tracker → pop-out) yields a window with a
   draggable resize corner.
4. Toggling each setting off (then reload) removes/disables the corresponding
   resizer.
5. **If the chat handle does not appear**, inspect the chat input markup and
   adjust the selector chain in `chat-resize.js#findChatInput` to match the
   actual v13/v14 element, then re-verify and amend the commit.

- [ ] **Step 6: Final no-op commit check**

Run: `git status`
Expected: clean working tree (all work committed).

---

## Notes for the implementer

- **Immutability exception:** `markClassResizable` deliberately mutates a core
  class's static `DEFAULT_OPTIONS` — that is the intended v13 mechanism for
  enabling pop-out resizing, not a style violation.
- **No runtime dependencies:** unlike `markdown-paste`, there is no `vendor/`
  step. Do not add `marked`/`dompurify` or a `vendor` script.
- **Selector uncertainty:** the only genuinely uncertain part is the chat input
  selector (Task 7 / verification Step 5). Everything else uses documented v13
  APIs (`ui.sidebar.element`, `foundry.applications.sidebar.*`,
  `DEFAULT_OPTIONS.window.resizable`, the `renderSidebar`/`renderChatLog` hooks).
