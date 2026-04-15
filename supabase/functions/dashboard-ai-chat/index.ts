import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Tool definitions for on-demand person lookup
const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_person",
      description:
        "Search for a specific person/contact by name and return detailed info including demographics, family/household, tags, engagement scores, addresses, notes, flow moments, and flow memberships. Use this whenever the user asks about a specific person.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The person's name or partial name to search for",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_people_in_flow",
      description:
        "List people in a specific flow/pipeline by flow name. Returns contacts with their stage, assignee, and when they entered.",
      parameters: {
        type: "object",
        properties: {
          flow_name: {
            type: "string",
            description: "The flow/pipeline name to search in",
          },
        },
        required: ["flow_name"],
      },
    },
  },
];

// Execute search_person tool
async function executeSearchPerson(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  query: string,
  teamMembers: any[]
): Promise<string> {
  // Search contacts by name (case-insensitive)
  const { data: contacts } = await adminClient
    .from("contacts")
    .select("id, name, email, phone, status, created_at, assigned_to_user_id, avatar, campus_id, pc_household_id")
    .eq("organization_id", orgId)
    .ilike("name", `%${query}%`)
    .limit(5);

  if (!contacts || contacts.length === 0) {
    return `No contacts found matching "${query}".`;
  }

  const results: string[] = [];

  for (const contact of contacts) {
    const contactId = contact.id;
    const lines: string[] = [`## ${contact.name}`];
    lines.push(`- **Email:** ${contact.email || "N/A"}`);
    lines.push(`- **Phone:** ${contact.phone || "N/A"}`);
    lines.push(`- **Status:** ${contact.status}`);
    lines.push(`- **Added:** ${contact.created_at?.split("T")[0]}`);
    lines.push(`- **Profile link:** [${contact.name}](/contacts/${contactId})`);

    const assignee = teamMembers.find((m: any) => m.user_id === contact.assigned_to_user_id);
    if (assignee) {
      lines.push(`- **Assigned to:** ${(assignee.profiles as any)?.full_name || "Unknown"}`);
    }

    // Fetch all detail data in parallel
    const [
      demographicsResult,
      familyResult,
      tagsResult,
      engagementResult,
      addressResult,
      notesResult,
      momentsResult,
      flowsResult,
      prayerResult,
      interactionsResult,
    ] = await Promise.all([
      adminClient
        .from("contact_demographics")
        .select("birthday, gender, marital_status, occupation")
        .eq("contact_id", contactId)
        .maybeSingle(),
      adminClient
        .from("contact_family_members")
        .select("name, relationship, birthday, is_child")
        .eq("contact_id", contactId),
      adminClient
        .from("contact_tags")
        .select("tag")
        .eq("contact_id", contactId),
      adminClient
        .from("contact_engagement_scores")
        .select("score, engagement_level, streak_weeks, weeks_attended_last_12, total_checkins_90d, last_checkin_at, volunteer_checkins_90d")
        .eq("contact_id", contactId)
        .maybeSingle(),
      adminClient
        .from("contact_addresses")
        .select("address_type, street_address, city, state, zip_code, is_primary")
        .eq("contact_id", contactId),
      adminClient
        .from("contact_notes")
        .select("content, note_type, created_at, is_private")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(10),
      adminClient
        .from("flow_moments")
        .select("occurred_at, source_system, flow_moment_type_id, flow_moment_types(name, category)")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(20),
      adminClient
        .from("pipeline_contacts")
        .select("stage_id, assigned_to_user_id, created_at, updated_at, pipeline_id, pipelines(name), pipeline_stages(name)")
        .eq("contact_id", contactId),
      adminClient
        .from("contact_prayer_requests")
        .select("title, description, status, created_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(5),
      adminClient
        .from("contact_interactions")
        .select("interaction_type, subject, details, created_at, completed_at, scheduled_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    // Demographics
    const demo = demographicsResult.data;
    if (demo) {
      const parts: string[] = [];
      if (demo.gender) parts.push(`Gender: ${demo.gender}`);
      if (demo.birthday) parts.push(`Birthday: ${demo.birthday}`);
      if (demo.marital_status) parts.push(`Marital: ${demo.marital_status}`);
      if (demo.occupation) parts.push(`Occupation: ${demo.occupation}`);
      if (parts.length) lines.push(`\n**Demographics:** ${parts.join(" | ")}`);
    }

    // Family / Household
    const family = familyResult.data || [];
    if (family.length > 0) {
      lines.push(`\n**Family/Household (${family.length} members):**`);
      for (const f of family) {
        const age = f.birthday ? ` (born ${f.birthday})` : "";
        const child = f.is_child ? " [child]" : "";
        lines.push(`- ${f.name} — ${f.relationship}${age}${child}`);
      }
    }

    // Household peers (same pc_household_id)
    if (contact.pc_household_id) {
      const { data: householdPeers } = await adminClient
        .from("contacts")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("pc_household_id", contact.pc_household_id)
        .neq("id", contactId)
        .limit(10);
      if (householdPeers && householdPeers.length > 0) {
        lines.push(`\n**Household peers:** ${householdPeers.map(p => `[${p.name}](/contacts/${p.id})`).join(", ")}`);
      }
    }

    // Tags
    const tags = tagsResult.data || [];
    if (tags.length > 0) {
      lines.push(`\n**Tags:** ${tags.map(t => t.tag).join(", ")}`);
    }

    // Engagement
    const eng = engagementResult.data;
    if (eng) {
      lines.push(`\n**Engagement:** Score ${eng.score}/100 (${eng.engagement_level})`);
      lines.push(`- Streak: ${eng.streak_weeks} weeks | 12-week attendance: ${eng.weeks_attended_last_12} weeks`);
      lines.push(`- Check-ins (90d): ${eng.total_checkins_90d} | Volunteer (90d): ${eng.volunteer_checkins_90d}`);
      if (eng.last_checkin_at) lines.push(`- Last check-in: ${eng.last_checkin_at.split("T")[0]}`);
    }

    // Addresses
    const addresses = addressResult.data || [];
    if (addresses.length > 0) {
      lines.push(`\n**Addresses:**`);
      for (const a of addresses) {
        const parts = [a.street_address, a.city, a.state, a.zip_code].filter(Boolean).join(", ");
        const primary = a.is_primary ? " (primary)" : "";
        lines.push(`- ${a.address_type}: ${parts}${primary}`);
      }
    }

    // Flow memberships
    const flows = flowsResult.data || [];
    if (flows.length > 0) {
      lines.push(`\n**Current Flows:**`);
      for (const f of flows) {
        const flowName = (f.pipelines as any)?.name || "Unknown";
        const stageName = (f.pipeline_stages as any)?.name || "Unknown";
        const assigneeName = teamMembers.find((m: any) => m.user_id === f.assigned_to_user_id);
        const aName = assigneeName ? (assigneeName.profiles as any)?.full_name : "Unassigned";
        lines.push(`- [${flowName}](/flows/${f.pipeline_id}) → Stage: ${stageName} (assigned: ${aName})`);
      }
    }

    // Flow moments
    const moments = momentsResult.data || [];
    if (moments.length > 0) {
      lines.push(`\n**Recent Flow Moments (${moments.length}):**`);
      for (const m of moments.slice(0, 10)) {
        const typeName = (m.flow_moment_types as any)?.name || "Unknown";
        const cat = (m.flow_moment_types as any)?.category || "";
        lines.push(`- ${m.occurred_at.split("T")[0]}: ${typeName} (${cat}) [${m.source_system}]`);
      }
    }

    // Prayer requests
    const prayers = prayerResult.data || [];
    if (prayers.length > 0) {
      lines.push(`\n**Prayer Requests (${prayers.length}):**`);
      for (const pr of prayers) {
        lines.push(`- "${pr.title}" (${pr.status}) — ${pr.created_at.split("T")[0]}`);
      }
    }

    // Notes (non-private)
    const notes = (notesResult.data || []).filter((n: any) => !n.is_private);
    if (notes.length > 0) {
      lines.push(`\n**Recent Notes (${notes.length}):**`);
      for (const n of notes.slice(0, 5)) {
        const preview = n.content.length > 120 ? n.content.slice(0, 120) + "…" : n.content;
        lines.push(`- [${n.created_at.split("T")[0]}] (${n.note_type}): ${preview}`);
      }
    }

    // Recent interactions
    const interactions = interactionsResult.data || [];
    if (interactions.length > 0) {
      lines.push(`\n**Recent Interactions (${interactions.length}):**`);
      for (const i of interactions.slice(0, 8)) {
        const completed = i.completed_at ? " ✅" : i.scheduled_at ? ` (scheduled: ${i.scheduled_at.split("T")[0]})` : "";
        lines.push(`- ${i.created_at.split("T")[0]} — ${i.interaction_type}: ${i.subject || "No subject"}${completed}`);
      }
    }

    results.push(lines.join("\n"));
  }

  return results.join("\n\n---\n\n");
}

// Execute search_people_in_flow tool
async function executeSearchPeopleInFlow(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  flowName: string,
  teamMembers: any[]
): Promise<string> {
  const { data: pipelines } = await adminClient
    .from("pipelines")
    .select("id, name, pipeline_stages(id, name, stage_order), pipeline_contacts(contact_id, stage_id, assigned_to_user_id, created_at)")
    .eq("organization_id", orgId)
    .ilike("name", `%${flowName}%`)
    .limit(3);

  if (!pipelines || pipelines.length === 0) {
    return `No flow found matching "${flowName}".`;
  }

  const results: string[] = [];
  for (const pipeline of pipelines) {
    const pContacts = pipeline.pipeline_contacts || [];
    const contactIds = pContacts.map((pc: any) => pc.contact_id);
    
    if (contactIds.length === 0) {
      results.push(`**${pipeline.name}** — 0 people`);
      continue;
    }

    const { data: contacts } = await adminClient
      .from("contacts")
      .select("id, name, email, phone")
      .in("id", contactIds.slice(0, 100));

    const contactMap = new Map((contacts || []).map(c => [c.id, c]));
    const stages = (pipeline.pipeline_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);
    const stageMap = new Map(stages.map((s: any) => [s.id, s.name]));

    const lines: string[] = [`**${pipeline.name}** — ${pContacts.length} people\n`];
    
    // Group by stage
    for (const stage of stages) {
      const stageContacts = pContacts.filter((pc: any) => pc.stage_id === stage.id);
      if (stageContacts.length === 0) continue;
      lines.push(`### ${stage.name} (${stageContacts.length})`);
      for (const pc of stageContacts.slice(0, 20)) {
        const c = contactMap.get(pc.contact_id);
        if (!c) continue;
        const assignee = teamMembers.find((m: any) => m.user_id === pc.assigned_to_user_id);
        const aName = assignee ? (assignee.profiles as any)?.full_name : "Unassigned";
        lines.push(`- [${c.name}](/contacts/${c.id}) — assigned: ${aName}, added: ${pc.created_at?.split("T")[0]}`);
      }
      if (stageContacts.length > 20) lines.push(`  _...and ${stageContacts.length - 20} more_`);
    }
    results.push(lines.join("\n"));
  }
  return results.join("\n\n");
}

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

    // Gather lightweight context data in parallel
    const [
      contactsResult,
      pipelinesResult,
      groupsResult,
      teamResult,
    ] = await Promise.all([
      adminClient
        .from("contacts")
        .select("id, name, status, created_at", { count: "exact" })
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
      adminClient
        .from("pipelines")
        .select(`id, name, icon, pipeline_stages(id, name, stage_order), pipeline_contacts(id, stage_id)`)
        .eq("organization_id", orgId)
        .order("flow_order", { ascending: true }),
      adminClient
        .from("groups")
        .select("id, name, group_type, status")
        .eq("organization_id", orgId)
        .eq("status", "active"),
      adminClient
        .from("organization_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("organization_id", orgId),
    ]);

    const contacts = contactsResult.data || [];
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

    const groups = groupsResult.data || [];
    const team = teamResult.data || [];

    const flowLinks = pipelines.map((p: any) => `- "${p.name}" → [${p.name}](/flows/${p.id})`).join("\n");

    const teamSummary = team.map((m: any) => {
      const name = (m.profiles as any)?.full_name || (m.profiles as any)?.email || "Unknown";
      return `- ${name} (${m.role})`;
    }).join("\n");

    const systemPrompt = `You are FlowLeed AI, a smart pastoral assistant for "${orgName}". You're speaking with ${userName} (role: ${userRole}).

Your job is to help pastors and church staff make data-driven decisions about their ministry. Be warm, encouraging, and pastoral in tone while being precise with data.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

## Tools Available
You have access to tools to look up detailed information about specific people and flows. USE THEM PROACTIVELY:
- **search_person**: When the user mentions a person by name, or asks about someone specific, ALWAYS call this tool to get their full profile (demographics, family, tags, engagement, notes, flow moments, etc.)
- **search_people_in_flow**: When the user asks who is in a specific flow or wants details about a flow's people, call this tool.

Do NOT guess or make up information about specific people. Always use the tools to look up real data.

## Navigation Links
When mentioning a Flow or a Person by name, ALWAYS use the markdown link format so users can click through.

**Flow Links:**
${flowLinks || "No flows yet."}

## Church Data Summary (overview)
**People:** ${totalContacts} total contacts, ${newContactsThisWeek} new this week

**Flows:**
${pipelineSummaries || "No flows set up yet."}

**Team Members (${team.length}):**
${teamSummary || "Just you for now."}

**Groups (${groups.length} active):**
${groups.map((g: any) => `- ${g.name} (${g.group_type})`).join("\n") || "No groups yet."}

## Guidelines
- ALWAYS refer to pipelines as "Flows" — never say "pipeline" to the user.
- When mentioning a Flow name, ALWAYS wrap it in a markdown link using the lookup above, e.g. [New Family Follow-Up](/flows/abc-123).
- When mentioning a person's name, ALWAYS wrap it in a markdown link, e.g. [John Smith](/contacts/def-456).
- When listing people, format them clearly with relevant details.
- When suggesting actions, be specific and actionable.
- Use markdown formatting: use ## for section headers, **bold** for emphasis, and bullet lists for data.
- CRITICAL FORMATTING RULE: Always start with a short greeting paragraph, then leave a BLANK LINE before the first section header. Every section header must have a blank line ABOVE it. Never run a header directly after a paragraph without a blank line separating them.
- Use ## or ### for section titles (e.g. "## Growth and Engagement"). Every section must start with a header on its own line, preceded by a blank line.
- Write in clear, well-spaced paragraphs. Each paragraph should be separated by a blank line. Never output a wall of text — break content into digestible chunks.
- When listing flows or categories with descriptions, put each on its own paragraph with a blank line above it. Never stack multiple items in a single paragraph.
- After any colon-separated item (e.g. "Team Care: 5 people in 3 stages"), always add a blank line before the next item.
- If asked about something not in the data, say so honestly.
- Keep responses focused and concise — pastors are busy!
- When appropriate, suggest next steps or follow-up actions.
- Use emojis sparingly for warmth (🙏 ❤️ ✅).`;

    // Build the message list for the AI
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tool call loop: make non-streaming calls until we get a final response, then stream it
    const MAX_TOOL_ROUNDS = 5;
    let toolRound = 0;

    while (toolRound < MAX_TOOL_ROUNDS) {
      // Make a non-streaming call to check for tool calls
      const toolCheckResponse = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!toolCheckResponse.ok) {
        const status = toolCheckResponse.status;
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
        const errorText = await toolCheckResponse.text();
        console.error("AI Gateway error:", status, errorText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCheckData = await toolCheckResponse.json();
      const choice = toolCheckData.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "No AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = choice.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls — model wants to respond directly.
        // If we already have tool results, stream the final response.
        // If this is the first round with no tool calls, also stream.
        break;
      }

      // Execute tool calls
      aiMessages.push(choice.message);

      for (const tc of toolCalls) {
        const fnName = tc.function.name;
        let args: any;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        let result = "";
        try {
          if (fnName === "search_person") {
            result = await executeSearchPerson(adminClient, orgId, args.query || "", team);
          } else if (fnName === "search_people_in_flow") {
            result = await executeSearchPeopleInFlow(adminClient, orgId, args.flow_name || "", team);
          } else {
            result = `Unknown tool: ${fnName}`;
          }
        } catch (e) {
          console.error(`Tool ${fnName} error:`, e);
          result = `Error executing ${fnName}: ${e instanceof Error ? e.message : "Unknown error"}`;
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      toolRound++;
    }

    // Final streaming response (with tool results in context but no tools offered)
    const streamResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const status = streamResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await streamResponse.text();
      console.error("AI Gateway stream error:", status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
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
