/**
 * Base URL for links that must open outside the Lovable editor preview.
 * The `id-preview--*.lovable.app` host requires a Lovable login, so links
 * opened in a new tab from the preview (e.g. public form links) hit a login
 * wall. Point those at the production site instead.
 */
const PRODUCTION_BASE = "https://app.flowleed.com";

export function publicBaseUrl(): string {
  const host = window.location.hostname;
  if (host === "localhost" || host.startsWith("id-preview--")) {
    return PRODUCTION_BASE;
  }
  return window.location.origin;
}

export function publicUrl(path: string): string {
  return `${publicBaseUrl()}${path}`;
}
