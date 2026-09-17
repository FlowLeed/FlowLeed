import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy so that when a dynamic import fails (typically because
 * the deployed chunk hash changed and the old index.html is still loaded),
 * we retry once with a cache-busting query, then force a hard reload to
 * fetch the new asset manifest.
 */
const RELOAD_KEY = "lovable:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 20_000;

function isChunkError(err: unknown) {
  const msg = String((err as any)?.message || err);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkError(err) || typeof window === "undefined") throw err;

      // Second chance: the network may have hiccupped.
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await factory();
      } catch {
        // ignore, fall through to reload
      }

      // Reload once per cooldown window to pick up the new asset manifest,
      // avoiding an infinite reload loop.
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      } catch {
        /* storage may be unavailable */
      }

      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        window.location.reload();
        return new Promise(() => {}) as Promise<{ default: T }>;
      }

      throw err;
    }
  });
}
