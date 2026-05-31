// scripts/sidebar-resize.js
// Horizontal resize handle on the sidebar's inner edge. Persists width to a
// client setting and restores it on render/expand.
//
// v13+ sizes the sidebar through the `--sidebar-width` CSS custom property
// (consumed by #sidebar-content and the tabs), NOT the #sidebar element's own
// width. #sidebar is also position:static and inherits pointer-events:none from
// #ui-right, so the handle needs an explicit positioning context and
// pointer-events (see styles/sidebar-resizer.css).
import { MODULE_ID, getSetting, setSetting } from './settings.js';
import { computeDragSize, parsePx } from './resize-core.js';
import {
  SETTINGS,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_VAR,
} from './constants.js';

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

/** Apply a width (px) to the sidebar via the `--sidebar-width` custom property. */
function applyWidth(el, width) {
  el.style.setProperty(SIDEBAR_WIDTH_VAR, `${width}px`);
}

/**
 * Position the handle at the seam between the icon rail and the content, rather
 * than at the sidebar's outer edge.
 *
 * Anchors to `#sidebar-content`'s left edge — the true seam — instead of the
 * rail's `offsetWidth`. `offsetWidth` includes any trailing padding the icon
 * rail picks up (e.g. monks-little-details adds 16px), which would drift the
 * handle right of the seam. We use the content's `offsetLeft` (relative to its
 * positioned ancestor, `#sidebar`) rather than a viewport-based bounding rect:
 * `offsetLeft` reflects only the internal rail width, so it stays correct even
 * when this runs mid-render while the sidebar's absolute position is still
 * settling. Falls back to the rail's width if the content element is absent.
 * @param {HTMLElement} el      The sidebar element.
 * @param {HTMLElement} handle  The resize handle.
 */
function positionHandle(el, handle) {
  const content = el.querySelector(':scope > #sidebar-content');
  if (content) {
    handle.style.left = `${content.offsetLeft}px`;
    return;
  }
  const tabs = el.querySelector(':scope > #sidebar-tabs');
  handle.style.left = `${tabs ? tabs.offsetWidth : 0}px`;
}

/**
 * Read the sidebar's current content width from the live `--sidebar-width`
 * value, falling back to any saved setting and finally Foundry's default.
 * @param {HTMLElement} el
 * @returns {number}
 */
function readCurrentWidth(el) {
  const live = parsePx(window.getComputedStyle(el).getPropertyValue(SIDEBAR_WIDTH_VAR));
  if (live != null) return live;
  const saved = parsePx(getSetting(SETTINGS.SIDEBAR_WIDTH));
  return saved ?? DEFAULT_SIDEBAR_WIDTH;
}

/**
 * Re-apply the saved sidebar width, if one is stored.
 *
 * The width is applied even while the sidebar is collapsed. v13 sizes the
 * collapsed rail through its own width, so `--sidebar-width` is dormant while
 * collapsed but is set on the persistent `#sidebar` element — already correct
 * the moment the user expands. This matters because expanding fires only the
 * `collapseSidebar` hook (never `renderSidebar`) and does not re-render, so
 * gating restore on the expanded state would leave the saved width unapplied
 * after a reload and across collapse/expand cycles.
 */
export function restoreSidebarWidth() {
  const el = getSidebarElement();
  if (!el) return;
  const handle = el.querySelector(`:scope > .${HANDLE_CLASS}`);
  if (handle) positionHandle(el, handle);
  const saved = parsePx(getSetting(SETTINGS.SIDEBAR_WIDTH));
  if (saved == null) return;
  applyWidth(el, computeDragSize(saved, 0, 0, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH));
}

/**
 * Attach the resize handle to the sidebar. Idempotent: a second call is a no-op
 * if the handle already exists.
 */
export function attachSidebarResizer() {
  const el = getSidebarElement();
  if (!el) return;
  if (el.querySelector(`:scope > .${HANDLE_CLASS}`)) return;

  // #sidebar is position:static, so an absolutely-positioned handle would anchor
  // to #ui-right and land off the sidebar. Establish a containing block so the
  // handle's left:0 maps to the sidebar's own inner edge.
  if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';

  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  el.appendChild(handle);
  positionHandle(el, handle);

  // The rail↔content seam animates: `#sidebar-content` slides on a transitioned
  // negative `margin-left` during expand/collapse, so the value read at render
  // time is mid-flight. Re-assert once that transition settles. The listener
  // lives on the persistent `#sidebar` (transitionend bubbles), so it survives
  // inner re-renders that replace `#sidebar-content`, and runs only once.
  el.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'margin-left' && e.target?.id === 'sidebar-content') {
      positionHandle(el, handle);
    }
  });

  let startCoord = 0;
  let startSize = 0;
  let currentSize = 0;

  function onMove(e) {
    currentSize = computeDragSize(startSize, startCoord, e.clientX, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
    applyWidth(el, currentSize);
  }

  function onEnd(e) {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
    if (e.type !== 'pointerup') return;
    setSetting(SETTINGS.SIDEBAR_WIDTH, currentSize)
      .catch((err) => console.warn(`${MODULE_ID} | failed to save sidebar width`, err));
  }

  handle.addEventListener('pointerdown', (e) => {
    if (isCollapsed()) return;
    e.preventDefault();
    startCoord = e.clientX;
    startSize = readCurrentWidth(el);
    currentSize = startSize;
    handle.setPointerCapture?.(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });

  // Apply any saved width as soon as the handle is in place.
  restoreSidebarWidth();
}
