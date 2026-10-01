// Shared check for Edge Functions that pg_cron calls. The scheduler sends the CRON_SECRET value in
// an x-cron-secret header (see private.invoke_edge_function in the cron jobs migration).

/** True when the request carries the configured CRON_SECRET. */
export function hasCronSecret(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Returns a 401 response unless the request comes from the scheduler, or null when it does.
 * Fails closed: if CRON_SECRET isn't configured, every request is refused.
 */
export function rejectUnlessCron(req: Request, corsHeaders: Record<string, string>): Response | null {
  if (hasCronSecret(req)) return null;
  if (!Deno.env.get("CRON_SECRET")) console.error("CRON_SECRET is not configured; refusing the request");
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
