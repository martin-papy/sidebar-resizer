// scripts/constants.js
// Single source of truth for numeric bounds, setting keys, and the directory
// class paths whose pop-out windows we make resizable. No imports — leaf module.

/** Minimum sidebar width in pixels. */
export const MIN_SIDEBAR_WIDTH = 200;
/** Maximum sidebar width in pixels (defensive upper bound). */
export const MAX_SIDEBAR_WIDTH = 1200;
/**
 * Foundry's default expanded sidebar content width (the `--sidebar-width` CSS
 * custom property). Used as the drag start basis when the live value can't be read.
 */
export const DEFAULT_SIDEBAR_WIDTH = 300;
/** The CSS custom property v13+ uses to size the sidebar content. */
export const SIDEBAR_WIDTH_VAR = '--sidebar-width';
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
  'tabs.CompendiumDirectory',
  'tabs.MacroDirectory',
];
