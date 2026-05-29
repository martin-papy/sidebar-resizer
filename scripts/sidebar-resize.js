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

  function onEnd(e) {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
    if (e.type !== 'pointerup') return;
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
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });

  // Apply any saved width as soon as the handle is in place.
  restoreSidebarWidth();
}
