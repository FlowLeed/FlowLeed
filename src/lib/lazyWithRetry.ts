import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy so that when a dynamic import fails (typically because
 * the deployed chunk hash changed and the old index.html is still loaded),
 * we force a one-time hard reload to fetch the new asset manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const key = "lovable:chunk-reload";
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg);

      if (isChunkError && typeof window !== "undefined") {
        const alreadyReloaded = sessionStorage.getItem(key);
        if (!alreadyReloaded) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          // Return a never-resolving promise while the reload happens
          return new Promise(() => {}) as Promise<{ default: T }>;
        }
      }
      throw err;
    }
  });
}
