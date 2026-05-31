# A/V Camera Dock Resizer — Design

- **Date:** 2026-05-31
- **Status:** Approved
- **Branch:** `feature-av-column-resizer`
- **Module:** `sidebar-resizer` (FoundryVTT v13+ / ApplicationV2)

## Summary

Add a fourth client-scoped resizer to the module: a drag handle on the
audio/video camera dock (`#camera-views`) so users running with A/V enabled can
adjust its size. Foundry lets the dock sit on the **left, right, top, or
bottom**. Left/right render as a vertical column sized by width; top/bottom
render as a horizontal bar sized by height. **All four positions are in scope.**

This is structurally a clone of the existing `sidebar-resize.js` feature,
generalized for two axes and four edge placements. It follows the module's
guiding pattern: many small single-purpose files, pure logic separated from
Foundry glue, each resizer isolated behind the `safely()` guard and gated by its
own `enable*` setting.

## Background — how Foundry sizes the A/V dock

Confirmed identical in the v13 and v14 sources
(`client/applications/apps/av/cameras.mjs`, `public/less2/applications/webrtc.less`):

- The dock is `CameraViews extends HandlebarsApplicationMixin(ApplicationV2)`,
  `id: "camera-views"`. The live instance is `ui.webrtc`; its root element is
  `ui.webrtc.element` (`#camera-views`).
- Size is driven by CSS custom properties on `#camera-views`:
  - `--av-width: 300px` (default) — vertical docks use `width: var(--av-width)`.
  - `--av-height: calc(var(--av-width) * 3 / 4)` — horizontal docks use
    `height: var(--av-height)` (default 225px).
- On render, `_onRender` toggles classes `.vertical`/`.horizontal` and adds the
  position class `.left` / `.right` / `.top` / `.bottom`, then re-inserts the
  element before/after `#interface` depending on position.
- Dock position: `game.webrtc.settings.client.dockPosition` (values from
  `AVSettings.DOCK_POSITIONS = { TOP, RIGHT, BOTTOM, LEFT }`). When A/V mode is
  `DISABLED`, `ui.webrtc.isVertical` / `isHorizontal` are both false and the
  element is hidden.
- ApplicationV2 fires the `renderCameraViews` hook on each render.

Because the dock re-renders and re-inserts itself, the handle must be a child of
`#camera-views` (so it travels with the element) and attachment must be
idempotent.

## Architecture

Data flow mirrors the other resizers:

> `init` registers settings (adds the A/V toggle) → `renderCameraViews` hook
> attaches the handle and restores saved sizes → drag updates the relevant CSS
> custom property live and persists on pointer release.

### 1. Pure logic — `scripts/resize-core.js`

Generalize `computeDragSize` with a grow-direction parameter so handles on
canvas-facing edges work. Today the handle always sits on the inner/top edge and
size grows as the pointer moves toward a *smaller* coordinate. The A/V dock needs
both directions:

- Left dock → handle on the **right** edge → grows toward larger X.
- Right dock → handle on the **left** edge → grows toward smaller X.
- Top dock → handle on the **bottom** edge → grows toward larger Y.
- Bottom dock → handle on the **top** edge → grows toward smaller Y.

New signature (default reproduces today's behavior exactly):

```js
/**
 * @param {number} grow  -1 (default): size grows as the pointer moves toward a
 *   smaller coordinate (inner/top edge). +1: grows toward a larger coordinate
 *   (outer/bottom edge).
 */
export function computeDragSize(startSize, startCoord, currentCoord, min, max, grow = -1) {
  const next = Math.round(startSize + grow * (currentCoord - startCoord));
  return clampSize(next, min, max);
}
```

`grow = -1` gives `startSize + (startCoord - currentCoord)` — byte-for-byte the
current formula — so the existing `sidebar-resize.js` and `chat-resize.js`
callers and their unit tests are unaffected.

### 2. Constants & settings — `scripts/constants.js`, `scripts/settings.js`

`constants.js` additions:

```js
export const MIN_AV_WIDTH = 200;
export const MAX_AV_WIDTH = 1200;
export const DEFAULT_AV_WIDTH = 300;   // matches Foundry's --av-width default
export const MIN_AV_HEIGHT = 100;
export const MAX_AV_HEIGHT = 800;
export const DEFAULT_AV_HEIGHT = 225;  // matches Foundry's --av-height default (300 * 3/4)
export const AV_WIDTH_VAR = '--av-width';
export const AV_HEIGHT_VAR = '--av-height';
```

Extend `SETTINGS`:

```js
ENABLE_AV: 'enableAVResize',
AV_WIDTH:  'avWidth',
AV_HEIGHT: 'avHeight',
```

`settings.js`:

- Add `SETTINGS.ENABLE_AV` to the `TOGGLES` array — registered exactly like the
  other three toggles: `scope: 'world'`, `config: true`, `type: Boolean`,
  `default: true`, `requiresReload: true`.
- Register `SETTINGS.AV_WIDTH` and `SETTINGS.AV_HEIGHT` as persisted sizes:
  `scope: 'client'`, `config: false`, `type: Number`, `default: null`.

### 3. New module — `scripts/av-resize.js`

Foundry glue mirroring `sidebar-resize.js`. Depends only on `settings.js`,
`constants.js`, and the pure `resize-core.js`.

- `getAVElement()` → `ui?.webrtc?.element ?? null`.
- `dockConfig()` reads `game.webrtc.settings.client.dockPosition` and returns the
  per-position drag descriptor, or `null` when A/V is disabled / position is
  unknown:

  | dockPosition | axis | grow | sizeVar        | min/max/default            | persisted setting |
  |--------------|------|------|----------------|----------------------------|-------------------|
  | `left`       | x    | +1   | `--av-width`   | width bounds, default 300  | `AV_WIDTH`        |
  | `right`      | x    | -1   | `--av-width`   | width bounds, default 300  | `AV_WIDTH`        |
  | `top`        | y    | +1   | `--av-height`  | height bounds, default 225 | `AV_HEIGHT`       |
  | `bottom`     | y    | -1   | `--av-height`  | height bounds, default 225 | `AV_HEIGHT`       |

- `attachAVResizer()`:
  - Bail if the element is absent, A/V disabled (`dockConfig()` is null), or the
    element is hidden (`ui.webrtc.hidden`).
  - Idempotent: bail if a `.av-resizer-handle` already exists.
  - If `#camera-views` computes to `position: static`, set it to `relative` so
    the absolutely-positioned handle anchors to the dock (same defensive move as
    `sidebar-resize.js`). The handle's edge placement is done in CSS via
    Foundry's `.left/.right/.top/.bottom` classes — no inline offset math.
  - Append the handle. Pointer drag: read `dockConfig()` at `pointerdown`, use
    `e.clientX` (x axis) or `e.clientY` (y axis), call
    `computeDragSize(startSize, startCoord, currentCoord, min, max, grow)`, apply
    inline `el.style.setProperty(sizeVar, `${size}px`)`. Use pointer capture and
    the same `pointermove`/`pointerup`/`pointercancel` lifecycle as the sidebar.
  - On `pointerup`, persist the size to the position's setting (`AV_WIDTH` or
    `AV_HEIGHT`); `.catch` logs a `MODULE_ID`-prefixed warning.
  - `startSize` is read from the live computed custom-property value, falling
    back to the saved setting and finally the position default.
- `restoreAVSizes()`: re-apply saved `--av-width` and `--av-height` (each clamped
  to its bounds) when stored. Both are applied regardless of current position so
  the dock is correct immediately after a position change + render.

### 4. CSS — `styles/sidebar-resizer.css`

Handle placement is driven entirely by Foundry's own dock classes; no inline
positioning beyond the parent's `position: relative`:

```css
#camera-views .av-resizer-handle {
  position: absolute;
  z-index: 30;
  background: transparent;
  transition: background-color 150ms ease-out;
  touch-action: none;
  pointer-events: auto;
}
#camera-views.left   .av-resizer-handle { top: 0; right: 0;  width: 6px;  height: 100%; cursor: col-resize; }
#camera-views.right  .av-resizer-handle { top: 0; left: 0;   width: 6px;  height: 100%; cursor: col-resize; }
#camera-views.top    .av-resizer-handle { left: 0; bottom: 0; height: 6px; width: 100%; cursor: row-resize; }
#camera-views.bottom .av-resizer-handle { left: 0; top: 0;    height: 6px; width: 100%; cursor: row-resize; }

#camera-views .av-resizer-handle:hover {
  background-color: var(--color-border-highlight, rgba(255, 255, 255, 0.25));
}

/* No drag affordance while the dock is minimized. */
#camera-views.minimized .av-resizer-handle { display: none; }
```

### 5. Wiring — `scripts/main.js`

```js
import { attachAVResizer, restoreAVSizes } from './av-resize.js';

// The A/V dock re-renders and re-inserts itself relative to #interface; re-assert
// the handle and saved sizes on each render. Idempotent attach prevents dupes.
Hooks.on('renderCameraViews', () => {
  if (!getSetting(SETTINGS.ENABLE_AV)) return;
  safely('a/v resize', () => {
    attachAVResizer();
    restoreAVSizes();
  });
});
```

No `init`-time work is needed (unlike window-resize): the handle is attached on
render, like the sidebar and chat resizers.

### 6. i18n — `lang/en.json`, `lang/fr.json`

Add the toggle's name/hint in both languages, matching the existing style:

- `sidebar-resizer.settings.enableAVResize.name`
  - en: `"Enable A/V dock resize"`
  - fr: `"Activer le redimensionnement du panneau A/V"`
- `sidebar-resizer.settings.enableAVResize.hint`
  - en: `"Show a drag handle on the inner edge of the audio/video camera dock to set its size (width or height depending on where it is docked). Your size is remembered on this device."`
  - fr: `"Affiche une poignée sur le bord intérieur du panneau audio/vidéo pour régler sa taille (largeur ou hauteur selon sa position d'ancrage). Votre taille est mémorisée sur cet appareil."`

Pure modules stay free of `game.i18n`; localized labels are injected only via the
settings registration (the Foundry-glue layer), as today.

## Cross-cutting invariants (preserved)

- **Isolation:** wired through `safely('a/v resize', …)` and gated by
  `ENABLE_AV`. A failure console-warns (`MODULE_ID` prefix) and never breaks the
  other resizers or core UI.
- **Idempotent attach:** `renderCameraViews` fires repeatedly; attach checks for
  an existing handle first.
- **No mutation of shared data:** sizes read/written via the settings helpers;
  DOM size via inline custom properties only.
- **Defensive against core changes:** a missing `ui.webrtc`, missing element, or
  unrecognized `dockPosition` results in a no-op, never a throw.

## Testing strategy

Consistent with the module's existing approach (Node's built-in `node:test`,
pure logic only; DOM/Foundry glue verified manually in a running world).

- **Unit (`tests/resize-core.test.js`):** add cases for `computeDragSize` with
  `grow = +1` — grows as the current coordinate increases, clamps to min and max,
  rounds to whole pixels. Confirm the default-arg path still matches existing
  expectations (no regression for sidebar/chat callers).
- **Manual (running v13/v14 world with A/V enabled):**
  - Dock left and right → drag the inner edge → width changes; reload → width
    persists.
  - Dock top and bottom → drag the inner edge → height changes; reload → height
    persists.
  - Change dock position after sizing → saved size re-applies correctly.
  - Minimize the dock → handle hidden.
  - Toggle `Enable A/V dock resize` off → no handle; other resizers unaffected.
  - A/V disabled entirely → no handle, no console errors.

## Out of scope (YAGNI)

- Independent control of the camera tile size (`--av-width`'s secondary effect on
  avatar sizing in horizontal mode); only the dock's main extent is resized.
- Per-dock-position distinct sizes beyond the natural width/height split (one
  saved width shared by left+right, one saved height shared by top+bottom).
- Any change to the existing three resizers beyond the additive, backward-
  compatible `computeDragSize` parameter.

## Files touched

| File | Change |
|------|--------|
| `scripts/resize-core.js`   | Add `grow` parameter to `computeDragSize` (default preserves behavior) |
| `scripts/constants.js`     | A/V bounds, var names, `SETTINGS` keys |
| `scripts/settings.js`      | Register A/V toggle + two persisted sizes |
| `scripts/av-resize.js`     | **New** — handle attach, drag, persist, restore |
| `scripts/main.js`          | `renderCameraViews` hook wiring |
| `styles/sidebar-resizer.css` | A/V handle styles (four edge placements) |
| `lang/en.json`, `lang/fr.json` | A/V toggle name/hint |
| `tests/resize-core.test.js` | `grow = +1` cases |

## Documentation note

`CLAUDE.md` states "Settings (all `scope: 'client'`)", but the code registers the
three `enable*` toggles as `scope: 'world'`. This design follows the code (new
toggle = `world`) for consistency with the existing toggles. The doc should be
reconciled with the code separately; it does not affect this feature.
