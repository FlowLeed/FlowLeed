import { createClient } from "@supabase/supabase-js";
import { type GlooChatCompletion, glooChat, glooErrorStatus } from "../_shared/gloo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await adminClient.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) {
      console.error("Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, messages } = await req.json();
    if (!conversation_id || !messages || messages.length < 2) {
      return new Response(JSON.stringify({ error: "conversation_id and at least 2 messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Take only first user + assistant exchange for titling
    const firstExchange = messages.slice(0, 4);

    let result: GlooChatCompletion;
    try {
      result = await glooChat({
        messages: [
          {
            role: "system",
            content: "Generate a very short title (3-5 words max) that summarizes this conversation. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.",
          },
          {
            role: "user",
            content: firstExchange.map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`).join("\n"),
          },
        ],
      });
    } catch (error) {
      const status = glooErrorStatus(error);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, error);
      return new Response(JSON.stringify({ error: "Failed to generate title" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = result.choices[0]?.message?.content?.trim() || "Untitled Chat";

    // Update the conversation title in DB
    await adminClient
      .from("chat_conversations")
      .update({ title })
      .eq("id", conversation_id)
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-chat-title error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
