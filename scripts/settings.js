// scripts/settings.js
import { SETTINGS } from './constants.js';

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
      // Each toggle wires its resizer at init/render time, so a change only
      // takes effect on reload. Flagging it makes Foundry's settings form offer
      // the standard "reload application?" prompt when the value actually changes.
      requiresReload: true,
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
