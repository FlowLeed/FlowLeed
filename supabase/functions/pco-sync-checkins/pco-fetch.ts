// Shared Planning Center fetch helper with rate-limit (429) and 5xx retry handling.
// PCO enforces a per-app rate limit; without backoff, large syncs abort mid-run.

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Small pause between paginated PCO requests to stay under the rate limit. */
export const PCO_PAGE_DELAY = 350;

export class PcoRateLimitError extends Error {
  constructor(message = 'Planning Center rate limit exceeded') {
    super(message);
    this.name = 'PcoRateLimitError';
  }
}

interface PcoFetchOptions {
  maxRetries?: number;
  label?: string;
}

/**
 * fetch() wrapper that retries on 429 (honouring Retry-After) and 5xx / network errors
 * with exponential backoff. Returns the Response for any other status (including 401/404)
 * so callers keep their existing handling.
 */
export async function pcoFetch(
  url: string,
  options: RequestInit = {},
  { maxRetries = 4, label = 'PCO' }: PcoFetchOptions = {},
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
        const backoff = Math.max(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0,
          1000 * Math.pow(2, attempt),
        );
        if (attempt < maxRetries) {
          console.log(`[${label}] Rate limited (429). Waiting ${backoff}ms before retry ${attempt + 1}/${maxRetries}`);
          await sleep(backoff);
          continue;
        }
        throw new PcoRateLimitError(`[${label}] Rate limited after ${maxRetries} retries`);
      }

      if (response.status >= 500 && attempt < maxRetries) {
        const backoff = 1000 * Math.pow(2, attempt);
        console.log(`[${label}] Server error ${response.status}. Waiting ${backoff}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(backoff);
        continue;
      }

      return response;
    } catch (error) {
      if (error instanceof PcoRateLimitError) throw error;
      lastError = error as Error;
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error(`[${label}] Fetch failed after retries`);
}
