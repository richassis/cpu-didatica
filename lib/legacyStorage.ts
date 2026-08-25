/**
 * legacyStorage.ts
 *
 * Keys the app used to write and no longer does.
 *
 * The datapath is now read from `public/default-project.cpud` on every load,
 * so a student who visited an older build is carrying a cached layout that
 * nothing reads any more. Left in place it is just dead weight that makes
 * "clear your site data" a plausible-sounding fix for problems it cannot cause.
 */
const LEGACY_KEYS = [
  // The layout mirror, now derived from the active project on every load.
  "simulator-layout",
  // Wire routing, folded into the project file long ago.
  "enhanced-wire-storage",
];

/** Drop every key the app no longer reads. Safe to call more than once. */
export function purgeLegacyStorage(): void {
  try {
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private mode, or storage disabled entirely. Nothing to clean up.
  }
}
