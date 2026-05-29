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
