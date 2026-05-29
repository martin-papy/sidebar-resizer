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
 * than at the sidebar's outer edge. The rail (`#sidebar-tabs`) is the first
 * child; its width is the content's left offset.
 * @param {HTMLElement} el      The sidebar element.
 * @param {HTMLElement} handle  The resize handle.
 */
function positionHandle(el, handle) {
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
 * Re-apply the saved sidebar width, if one is stored and the sidebar is open.
 */
export function restoreSidebarWidth() {
  const el = getSidebarElement();
  if (!el || isCollapsed()) return;
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
