import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to gather org data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's org
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = membership.organization_id;
    const orgName = (membership.organizations as any)?.name || "Your Church";
    const userRole = membership.role;

    // Get user profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const userName = profile?.full_name || "Pastor";

    // Gather context data in parallel
    const [
      contactsResult,
      pipelinesResult,
      recentInteractionsResult,
      prayerRequestsResult,
      pendingTasksResult,
      groupsResult,
      teamResult,
    ] = await Promise.all([
      // Total contacts + recent
      adminClient
        .from("contacts")
        .select("id, name, status, created_at, assigned_to_user_id, email, phone", { count: "exact" })
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),

      // Pipelines with stages and contact counts
      adminClient
        .from("pipelines")
        .select(`
          id, name, icon,
          pipeline_stages(id, name, stage_order),
          pipeline_contacts(id, contact_id, stage_id, assigned_to_user_id, created_at, updated_at)
        `)
        .eq("organization_id", orgId)
        .order("flow_order", { ascending: true }),

      // Recent interactions
      adminClient
        .from("contact_interactions")
        .select("id, contact_id, interaction_type, subject, details, created_at, scheduled_at, completed_at, assigned_to_user_id")
        .in("contact_id", (await adminClient.from("contacts").select("id").eq("organization_id", orgId).limit(500)).data?.map((c: any) => c.id) || [])
        .order("created_at", { ascending: false })
        .limit(100),

      // Active prayer requests
      adminClient
        .from("contact_prayer_requests")
        .select("id, title, description, status, created_at, contact_id")
        .in("contact_id", (await adminClient.from("contacts").select("id").eq("organization_id", orgId).limit(500)).data?.map((c: any) => c.id) || [])
        .in("status", ["active", "praying"])
        .order("created_at", { ascending: false })
        .limit(50),

      // Pending tasks (scheduled interactions not completed)
      adminClient
        .from("contact_interactions")
        .select("id, contact_id, subject, details, scheduled_at, assigned_to_user_id, interaction_type")
        .in("contact_id", (await adminClient.from("contacts").select("id").eq("organization_id", orgId).limit(500)).data?.map((c: any) => c.id) || [])
        .is("completed_at", null)
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true })
        .limit(50),

      // Groups
      adminClient
        .from("groups")
        .select("id, name, group_type, status, leader_user_id")
        .eq("organization_id", orgId)
        .eq("status", "active"),

      // Team members
      adminClient
        .from("organization_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("organization_id", orgId),
    ]);

    // Build contact name lookup
    const contacts = contactsResult.data || [];
    const contactMap: Record<string, string> = {};
    contacts.forEach((c: any) => { contactMap[c.id] = c.name; });

    // Build summary metrics
    const totalContacts = contactsResult.count || contacts.length;
    const newContactsThisWeek = contacts.filter((c: any) => {
      const d = new Date(c.created_at);
      const week = new Date();
      week.setDate(week.getDate() - 7);
      return d >= week;
    }).length;

    const pipelines = pipelinesResult.data || [];
    const pipelineSummaries = pipelines.map((p: any) => {
      const contactCount = p.pipeline_contacts?.length || 0;
      const stages = (p.pipeline_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);
      const stageBreakdown = stages.map((s: any) => {
        const count = (p.pipeline_contacts || []).filter((pc: any) => pc.stage_id === s.id).length;
        return `${s.name}: ${count}`;
      }).join(", ");
      return `- ${p.name} (${contactCount} people): ${stageBreakdown}`;
    }).join("\n");

    const activePrayers = prayerRequestsResult.data || [];
    const pendingTasks = pendingTasksResult.data || [];
    const overdueTasks = pendingTasks.filter((t: any) => new Date(t.scheduled_at) < new Date());
    const groups = groupsResult.data || [];
    const team = teamResult.data || [];

    const recentInteractions = recentInteractionsResult.data || [];
    const interactionsThisWeek = recentInteractions.filter((i: any) => {
      const d = new Date(i.created_at);
      const week = new Date();
      week.setDate(week.getDate() - 7);
      return d >= week;
    }).length;

    // Enrich prayer requests with contact names
    const prayerSummary = activePrayers.slice(0, 20).map((pr: any) => 
      `- "${pr.title}" for ${contactMap[pr.contact_id] || "Unknown"} (${pr.status})`
    ).join("\n");

    // Pending tasks enriched
    const tasksSummary = pendingTasks.slice(0, 20).map((t: any) => {
      const assignee = team.find((m: any) => m.user_id === t.assigned_to_user_id);
      const assigneeName = (assignee?.profiles as any)?.full_name || "Unassigned";
      const overdue = new Date(t.scheduled_at) < new Date() ? " ⚠️ OVERDUE" : "";
      return `- "${t.subject}" for ${contactMap[t.contact_id] || "Unknown"} (assigned: ${assigneeName}, due: ${t.scheduled_at})${overdue}`;
    }).join("\n");

    // Team summary
    const teamSummary = team.map((m: any) => {
      const name = (m.profiles as any)?.full_name || (m.profiles as any)?.email || "Unknown";
      return `- ${name} (${m.role})`;
    }).join("\n");

    // Recent contacts needing attention (no interaction in 14+ days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const contactsWithLastInteraction = contacts.map((c: any) => {
      const lastInteraction = recentInteractions
        .filter((i: any) => i.contact_id === c.id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return { ...c, lastInteraction };
    });
    const needingAttention = contactsWithLastInteraction
      .filter((c: any) => !c.lastInteraction || new Date(c.lastInteraction.created_at) < twoWeeksAgo)
      .slice(0, 15);

    const needingAttentionSummary = needingAttention.map((c: any) => {
      const lastDate = c.lastInteraction ? c.lastInteraction.created_at.split("T")[0] : "never";
      return `- ${c.name} (last contact: ${lastDate})`;
    }).join("\n");

    // Build link lookup tables for clickable navigation
    const flowLinks = pipelines.map((p: any) => `- "${p.name}" → [${p.name}](/flows/${p.id})`).join("\n");
    const contactLinks = contacts.slice(0, 50).map((c: any) => `- "${c.name}" → [${c.name}](/contacts/${c.id})`).join("\n");

    const systemPrompt = `You are FlowLeed AI, a smart pastoral assistant for "${orgName}". You're speaking with ${userName} (role: ${userRole}).

Your job is to help pastors and church staff make data-driven decisions about their ministry. Be warm, encouraging, and pastoral in tone while being precise with data.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

## Navigation Links — USE THESE for clickable references
When mentioning a Flow or a Person by name, ALWAYS use the markdown link format so users can click through.

**Flow Links:**
${flowLinks || "No flows yet."}

**People Links (sample):**
${contactLinks || "No contacts yet."}

## Church Data Summary

**People:** ${totalContacts} total contacts, ${newContactsThisWeek} new this week
**Flows:**
${pipelineSummaries || "No flows set up yet."}

**Active Prayer Requests (${activePrayers.length}):**
${prayerSummary || "None currently."}

**Pending Tasks (${pendingTasks.length}, ${overdueTasks.length} overdue):**
${tasksSummary || "No pending tasks."}

**People Needing Attention (no contact in 14+ days):**
${needingAttentionSummary || "Everyone is well-connected!"}

**Team Members (${team.length}):**
${teamSummary || "Just you for now."}

**Groups (${groups.length} active):**
${groups.map((g: any) => `- ${g.name} (${g.group_type})`).join("\n") || "No groups yet."}

**Recent Activity:** ${interactionsThisWeek} interactions this week

## Guidelines
- ALWAYS refer to pipelines as "Flows" — never say "pipeline" to the user.
- When mentioning a Flow name, ALWAYS wrap it in a markdown link using the lookup above, e.g. [New Family Follow-Up](/flows/abc-123).
- When mentioning a person's name, ALWAYS wrap it in a markdown link using the lookup above, e.g. [John Smith](/contacts/def-456).
- When listing people, format them clearly with relevant details.
- When suggesting actions, be specific and actionable.
- Use markdown formatting: use ## for section headers, **bold** for emphasis, and bullet lists for data.
- IMPORTANT: Add clear paragraph breaks between sections. Each section should be separated by a blank line. Use ## headers to introduce new topics.
- Write in clear, well-spaced paragraphs. Never output a wall of text — break content into digestible chunks with line breaks between them.
- If asked about something not in the data, say so honestly.
- Keep responses focused and concise — pastors are busy!
- When appropriate, suggest next steps or follow-up actions.
- Use emojis sparingly for warmth (🙏 ❤️ ✅).`;

    // Call Lovable AI Gateway with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("dashboard-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
