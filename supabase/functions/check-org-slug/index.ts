import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName } = await req.json();

    if (!organizationName || typeof organizationName !== "string") {
      return new Response(
        JSON.stringify({ error: "Organization name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const baseSlug = generateSlug(organizationName);

    if (!baseSlug) {
      return new Response(
        JSON.stringify({ error: "Invalid organization name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if exact slug exists
    const { data: exactMatch, error: exactError } = await supabase
      .from("organizations")
      .select("slug")
      .eq("slug", baseSlug)
      .maybeSingle();

    if (exactError) {
      console.error("Error checking exact slug:", exactError);
      throw exactError;
    }

    // If no exact match, the slug is available
    if (!exactMatch) {
      console.log(`Slug "${baseSlug}" is available`);
      return new Response(
        JSON.stringify({
          available: true,
          slug: baseSlug,
          suggestions: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Slug is taken - find existing numbered versions to generate suggestions
    const { data: existingSlugs, error: searchError } = await supabase
      .from("organizations")
      .select("slug")
      .like("slug", `${baseSlug}-%`);

    if (searchError) {
      console.error("Error searching for similar slugs:", searchError);
      throw searchError;
    }

    // Find the highest number used
    const existingNumbers = new Set<number>();
    existingNumbers.add(0); // Base slug is taken, so 0 is "used"

    if (existingSlugs) {
      for (const org of existingSlugs) {
        const match = org.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
        if (match) {
          existingNumbers.add(parseInt(match[1], 10));
        }
      }
    }

    // Generate 3 available suggestions
    const suggestions: string[] = [];
    let num = 1;
    while (suggestions.length < 3) {
      if (!existingNumbers.has(num)) {
        suggestions.push(`${baseSlug}-${num}`);
      }
      num++;
      // Safety limit
      if (num > 100) break;
    }

    console.log(`Slug "${baseSlug}" is taken. Suggestions: ${suggestions.join(", ")}`);

    return new Response(
      JSON.stringify({
        available: false,
        slug: baseSlug,
        suggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-org-slug:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
