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
