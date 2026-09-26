/**
 * One-time move of browser-saved data from the old project name ("weaveone_*") to "sckt_*".
 * Runs before any store reads localStorage, so existing drafts and cached data are kept.
 */
const LEGACY_PREFIX = "weaveone_";
const PREFIX = "sckt_";

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      const newKey = PREFIX + key.slice(LEGACY_PREFIX.length);
      if (value !== null && localStorage.getItem(newKey) === null) {
        // WhatsApp users were saved with a "weaveone_user_id" field, now "sckt_user_id".
        localStorage.setItem(newKey, value.replaceAll('"weaveone_user_id"', '"sckt_user_id"'));
      }
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Legacy storage migration failed:", error);
  }
}
