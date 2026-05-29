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
  // The marker scopes the fill CSS to a region we've actively sized, so the
  // editor inside (textarea or the nested ProseMirror element) stretches to
  // fill the new height instead of leaving an empty void below it.
  el.classList.add('chat-resizer-host');
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

  function onEnd(e) {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
    if (e.type !== 'pointerup') return;
    setSetting(SETTINGS.CHAT_HEIGHT, input.offsetHeight)
      .catch((err) => console.warn(`${MODULE_ID} | failed to save chat height`, err));
  }

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startCoord = e.clientY;
    startSize = input.offsetHeight;
    handle.setPointerCapture?.(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });
}
