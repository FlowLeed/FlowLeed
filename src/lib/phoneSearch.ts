/**
 * Helpers for searching phone numbers stored in inconsistent formats.
 *
 * Stored phone values vary widely (`+14084277192`, `4084277192`,
 * `(408) 427-7192`, `408-427-7192`, …). User input also varies and may
 * include a country code that the stored value lacks (or vice versa).
 *
 * Strategy: extract digits from the input, build a small set of candidate
 * digit strings (with and without the US +1 country code), and turn each
 * candidate into an ILIKE pattern that allows any non-digit characters
 * between the digits (e.g. `%4%0%8%4%2%7%7%1%9%2%`). Combine with
 * PostgREST's `or` filter so a row matches if ANY candidate matches.
 */

const PHONE_CHAR_RE = /^[\d\s+()\-.]+$/;

export const isPhoneLike = (input: string): boolean => {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 3 && PHONE_CHAR_RE.test(trimmed);
};

/**
 * Build the candidate digit strings to search for. Handles the common
 * mismatch where the user types `+1 (408) 427-7192` but the contact is
 * stored as `4084277192` (or the reverse).
 */
export const buildPhoneCandidates = (input: string): string[] => {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 3) return [];

  const candidates = new Set<string>();
  candidates.add(digits);

  // US: typed with country code, stored without
  if (digits.length === 11 && digits.startsWith('1')) {
    candidates.add(digits.slice(1));
  }
  // US: typed without country code, stored with +1
  if (digits.length === 10) {
    candidates.add('1' + digits);
  }

  return Array.from(candidates);
};

/** Build a single ILIKE pattern from a digit string. */
export const phoneIlikePattern = (digits: string): string =>
  `%${digits.split('').join('%')}%`;

/**
 * Build a PostgREST `.or()` filter fragment that matches the `phone`
 * column against any of the candidate digit patterns. Returns an empty
 * string when the input isn't phone-like.
 */
export const buildPhoneOrFilter = (
  input: string,
  column: string = 'phone'
): string => {
  if (!isPhoneLike(input)) return '';
  return buildPhoneCandidates(input)
    .map((d) => `${column}.ilike.${phoneIlikePattern(d)}`)
    .join(',');
};
