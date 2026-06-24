// Public endpoint that streams the organization logo by slug.
// Bypasses the private bucket restriction so logos can show on public pages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim();
    if (!slug) {
      return new Response("missing slug", { status: 400, headers: corsHeaders });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("logo_url")
      .eq("slug", slug)
      .maybeSingle();

    const path = (org as any)?.logo_url as string | null | undefined;
    if (!path) {
      return new Response("not found", { status: 404, headers: corsHeaders });
    }

    const { data: file, error } = await admin.storage.from("org-logos").download(path);
    if (error || !file) {
      return new Response("not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "svg" ? "image/svg+xml" :
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/png";

    return new Response(file, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[public-org-logo]", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
