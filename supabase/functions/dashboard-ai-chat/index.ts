import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getGlooAccessToken } from "../_shared/gloo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://platform.ai.gloo.com/ai/v2/chat/completions";

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
  {
    type: "function" as const,
    function: {
      name: "find_contacts_by_criteria",
      description:
        "Build a smart list of contacts using ANY combination of filters: flow moments (e.g. baptized, salvation, joined the church), PCO membership status (e.g. Member, Regular Attender, Guest), group membership, serving history (e.g. served 3+ months), engagement markers, engagement level, or campus. Use this whenever the user wants a list of people who meet multiple criteria — e.g. 'people who were baptized, are members, and serve' or 'members who aren't in a group'. After calling, ALWAYS offer to add the results to a Flow.",
      parameters: {
        type: "object",
        properties: {
          flow_moment_names: {
            type: "array",
            items: { type: "string" },
            description: "Names of flow moments the person MUST have (matched case-insensitively against flow_moment_types.name). Examples: 'Baptism', 'Salvation Decision', 'Welcome Party Attended'.",
          },
          pc_membership: {
            type: "array",
            items: { type: "string" },
            description: "Allowed Planning Center membership values. Examples: ['Member'], ['Regular Attender','Member'], ['Guest'].",
          },
          in_any_group: {
            type: "boolean",
            description: "If true, only include people who are an active member of at least one group. If false, only people NOT in any active group.",
          },
          group_name: {
            type: "string",
            description: "Restrict to members of a specific group by (partial) name.",
          },
          serving_min_days: {
            type: "number",
            description: "Minimum number of days the person has been serving (based on earliest volunteer check-in or serving flow moment). Use 90 for '3 months', 180 for '6 months', 365 for '1 year'.",
          },
          marker_codes: {
            type: "array",
            items: { type: "string" },
            description: "Engagement marker codes (from marker_definitions) the contact must currently have.",
          },
          engagement_level: {
            type: "array",
            items: { type: "string", enum: ["new","highly_engaged","active","at_risk","inactive"] },
            description: "Filter by computed engagement level.",
          },
          campus_name: {
            type: "string",
            description: "Restrict to a specific campus by (partial) name.",
          },
          limit: {
            type: "number",
            description: "Max number of contacts to return (default 50, max 200).",
          },
        },
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

// Execute find_contacts_by_criteria tool
async function executeFindContactsByCriteria(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  args: any
): Promise<string> {
  const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200);

  // Start with org contacts
  let candidateIds: Set<string> | null = null;

  const intersect = (ids: string[]) => {
    const next = new Set(ids);
    if (candidateIds === null) {
      candidateIds = next;
    } else {
      candidateIds = new Set([...candidateIds].filter((id) => next.has(id)));
    }
  };

  // Flow moments filter
  if (Array.isArray(args?.flow_moment_names) && args.flow_moment_names.length > 0) {
    const names: string[] = args.flow_moment_names;
    const { data: types } = await adminClient
      .from("flow_moment_types")
      .select("id, name")
      .eq("organization_id", orgId);
    const matchedTypeIds = (types || [])
      .filter((t: any) => names.some((n) => String(t.name).toLowerCase().includes(String(n).toLowerCase()) || String(n).toLowerCase().includes(String(t.name).toLowerCase())))
      .map((t: any) => t.id);
    if (matchedTypeIds.length === 0) return `No flow moments matched: ${names.join(", ")}`;
    const { data: moments } = await adminClient
      .from("flow_moments")
      .select("contact_id")
      .in("flow_moment_type_id", matchedTypeIds);
    intersect((moments || []).map((m: any) => m.contact_id).filter(Boolean));
    if (!candidateIds || candidateIds.size === 0) return "No contacts found matching the flow-moment criteria.";
  }

  // PCO membership filter
  if (Array.isArray(args?.pc_membership) && args.pc_membership.length > 0) {
    const { data } = await adminClient
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .in("pc_membership", args.pc_membership);
    intersect((data || []).map((c: any) => c.id));
    if (!candidateIds || candidateIds.size === 0) return "No contacts found with that PCO membership status (it may not be synced yet).";
  }

  // Group membership
  if (args?.in_any_group === true || args?.in_any_group === false || args?.group_name) {
    let groupQuery = adminClient
      .from("groups")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active");
    if (args?.group_name) groupQuery = groupQuery.ilike("name", `%${args.group_name}%`);
    const { data: groups } = await groupQuery;
    const groupIds = (groups || []).map((g: any) => g.id);
    if (groupIds.length > 0) {
      const { data: members } = await adminClient
        .from("group_members")
        .select("contact_id")
        .in("group_id", groupIds)
        .eq("status", "active");
      const memberContactIds = new Set((members || []).map((m: any) => m.contact_id).filter(Boolean));
      if (args?.in_any_group === false) {
        // Need to exclude — fetch all org contact ids and filter
        const { data: allContacts } = await adminClient
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId);
        intersect((allContacts || []).map((c: any) => c.id).filter((id: string) => !memberContactIds.has(id)));
      } else {
        intersect([...memberContactIds] as string[]);
      }
    } else if (args?.in_any_group === true || args?.group_name) {
      return "No matching groups found.";
    }
    if (!candidateIds || candidateIds.size === 0) return "No contacts matched the group criteria.";
  }

  // Serving duration
  if (typeof args?.serving_min_days === "number" && args.serving_min_days > 0) {
    const cutoff = new Date(Date.now() - args.serving_min_days * 24 * 60 * 60 * 1000).toISOString();
    // Earliest volunteer checkin before cutoff
    const { data: checkins } = await adminClient
      .from("pco_checkins")
      .select("contact_id, checked_in_at")
      .eq("checkin_kind", "volunteer")
      .lte("checked_in_at", cutoff);
    const servedIds = new Set((checkins || []).map((c: any) => c.contact_id).filter(Boolean));
    // Also serving flow moments
    const { data: servingTypes } = await adminClient
      .from("flow_moment_types")
      .select("id")
      .eq("organization_id", orgId)
      .eq("category", "serving");
    if (servingTypes && servingTypes.length > 0) {
      const { data: servingMoments } = await adminClient
        .from("flow_moments")
        .select("contact_id, occurred_at")
        .in("flow_moment_type_id", servingTypes.map((t: any) => t.id))
        .lte("occurred_at", cutoff);
      (servingMoments || []).forEach((m: any) => m.contact_id && servedIds.add(m.contact_id));
    }
    intersect([...servedIds] as string[]);
    if (!candidateIds || candidateIds.size === 0) return `No contacts have been serving for ${args.serving_min_days}+ days.`;
  }

  // Markers
  if (Array.isArray(args?.marker_codes) && args.marker_codes.length > 0) {
    const { data: defs } = await adminClient
      .from("marker_definitions")
      .select("id, code")
      .in("code", args.marker_codes);
    const defIds = (defs || []).map((d: any) => d.id);
    if (defIds.length === 0) return `No markers found for codes: ${args.marker_codes.join(", ")}`;
    const { data: cm } = await adminClient
      .from("contact_markers")
      .select("contact_id")
      .in("marker_definition_id", defIds);
    intersect((cm || []).map((m: any) => m.contact_id).filter(Boolean));
    if (!candidateIds || candidateIds.size === 0) return "No contacts have those markers.";
  }

  // Engagement level
  if (Array.isArray(args?.engagement_level) && args.engagement_level.length > 0) {
    const { data } = await adminClient
      .from("contact_engagement_scores")
      .select("contact_id")
      .eq("organization_id", orgId)
      .in("engagement_level", args.engagement_level);
    intersect((data || []).map((c: any) => c.contact_id).filter(Boolean));
    if (!candidateIds || candidateIds.size === 0) return "No contacts at that engagement level.";
  }

  // Campus
  if (args?.campus_name) {
    const { data: campuses } = await adminClient
      .from("campuses")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", `%${args.campus_name}%`);
    const campusIds = (campuses || []).map((c: any) => c.id);
    if (campusIds.length === 0) return `No campus matching "${args.campus_name}".`;
    const { data } = await adminClient
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .in("campus_id", campusIds);
    intersect((data || []).map((c: any) => c.id));
    if (!candidateIds || candidateIds.size === 0) return "No contacts at that campus.";
  }

  // If no filters at all
  if (candidateIds === null) {
    return "No criteria were provided. Please specify at least one filter (flow moment, membership, group, serving, marker, engagement level, or campus).";
  }

  const finalIds = [...candidateIds].slice(0, limit);
  if (finalIds.length === 0) return "No contacts matched.";

  // Fetch names/emails for the matched ids (constrain to org)
  const { data: contacts } = await adminClient
    .from("contacts")
    .select("id, name, email, pc_membership")
    .eq("organization_id", orgId)
    .in("id", finalIds)
    .order("name");

  const totalMatched = candidateIds.size;
  const shown = (contacts || []).length;

  const lines: string[] = [];
  lines.push(`Found **${totalMatched}** contact${totalMatched === 1 ? "" : "s"} matching the criteria${totalMatched > shown ? ` (showing first ${shown})` : ""}:`);
  lines.push("");
  for (const c of contacts || []) {
    const membership = c.pc_membership ? ` _(${c.pc_membership})_` : "";
    lines.push(`- [${c.name}](/contacts/${c.id})${membership}`);
  }
  lines.push("");
  // Hidden marker for the UI to render an "Add to Flow" action button.
  lines.push(`<!--flowleed:contact_ids=${JSON.stringify(finalIds)}-->`);
  return lines.join("\n");
}


function getUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(atob(padded));

    return typeof claims?.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access through the user's RLS context instead of Auth session lookup.
    // Some valid app tokens can fail /auth/v1/user with "Session not found" after
    // session rotation, while PostgREST/RLS still validates the bearer JWT correctly.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const userId = getUserIdFromJwt(authHeader);
    if (!userId) {
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

    // Get user's org via RLS. If the bearer token is invalid or unauthorized,
    // this returns no accessible membership and the request is rejected.
    const { data: membership, error: membershipError } = await userClient
      .from("organization_members")
      .select("user_id, organization_id, role, organizations(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.user_id) {
      console.error("Auth/RLS membership check failed:", membershipError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: membership.user_id as string };

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

    // Compute time windows for new-contact counts
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Gather lightweight context data in parallel
    const [
      contactsResult,
      newLast7Result,
      newLast30Result,
      pipelinesResult,
      groupsResult,
      teamResult,
    ] = await Promise.all([
      adminClient
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      adminClient
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", sevenDaysAgo),
      adminClient
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo),
      adminClient
        .from("pipelines")
        .select(`id, name, icon, pipeline_stages(id, name, stage_order), pipeline_contacts(id, stage_id)`)
        .eq("organization_id", orgId)
        .order("flow_order", { ascending: true }),
      adminClient
        .from("groups")
        .select(`
          id, name, group_type, capacity, meeting_day, meeting_time, meeting_frequency,
          leader_user_id, co_leader_user_id,
          member_count:group_members(count)
        `)
        .eq("organization_id", orgId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("name"),
      adminClient
        .from("organization_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("organization_id", orgId),
    ]);

    const totalContacts = contactsResult.count || 0;
    const newLast7d = newLast7Result.count || 0;
    const newLast30d = newLast30Result.count || 0;

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

    // Helper: resolve user_id to full name via team roster
    const nameFor = (uid: string | null | undefined): string | null => {
      if (!uid) return null;
      const m = team.find((t: any) => t.user_id === uid);
      return m ? ((m.profiles as any)?.full_name || (m.profiles as any)?.email || null) : null;
    };

    let totalGroupMembers = 0;
    const groupLines = groups.map((g: any) => {
      const memberCount = Array.isArray(g.member_count) ? (g.member_count[0]?.count || 0) : 0;
      totalGroupMembers += memberCount;
      const capacity = g.capacity ? `${memberCount}/${g.capacity}` : `${memberCount}/∞`;
      const leader = nameFor(g.leader_user_id) || "Unassigned";
      const coLeader = nameFor(g.co_leader_user_id);
      const leaderStr = coLeader ? `led by ${leader} & ${coLeader}` : `led by ${leader}`;
      const cadenceParts: string[] = [];
      if (g.meeting_day) cadenceParts.push(g.meeting_day);
      if (g.meeting_time) cadenceParts.push(g.meeting_time);
      const cadence = cadenceParts.length ? cadenceParts.join(" ") : null;
      const freq = g.meeting_frequency ? `(${g.meeting_frequency})` : null;
      const cadenceStr = [cadence, freq].filter(Boolean).join(" ");
      const segments = [
        g.group_type,
        leaderStr,
        `${capacity} members`,
        cadenceStr || null,
      ].filter(Boolean);
      return `- [${g.name}](/groups/${g.id}) — ${segments.join(" · ")}`;
    }).join("\n");

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
- **find_contacts_by_criteria**: When the user wants a LIST of people meeting one or more conditions (e.g. "people who were baptized and are members", "members serving 3+ months who aren't in a group", "guests from last month"), call this tool. Flow moments are the church's canonical "next steps" language (Baptism, Salvation Decision, Welcome Party, etc.). "Member" maps to pc_membership=["Member"]. "Served at least N months" maps to serving_min_days = N*30. After returning results, ALWAYS finish with a short sentence like "Want to add these people to a Flow?" — the UI will render an action button automatically.

Do NOT guess or make up information about specific people. Always use the tools to look up real data.

## Navigation Links
When mentioning a Flow or a Person by name, ALWAYS use the markdown link format so users can click through.

**Flow Links:**
${flowLinks || "No flows yet."}

## Church Data Summary (overview)
**People:** ${totalContacts} total contacts | ${newLast7d} new in last 7 days | ${newLast30d} new in last 30 days

**Flows:**
${pipelineSummaries || "No flows set up yet."}

**Team Members (${team.length}):**
${teamSummary || "Just you for now."}

**Groups (${groups.length} active, ${totalGroupMembers} total members):**
${groupLines || "No groups yet."}

You can answer questions like "which groups have open spots?", "who leads X?", or "what groups meet on Tuesday?" directly from the Groups list above without calling any tool.

## Guidelines
- ALWAYS refer to pipelines as "Flows" — never say "pipeline" to the user.
- When mentioning a Flow name, ALWAYS wrap it in a markdown link using the lookup above, e.g. [New Family Follow-Up](/flows/abc-123).
- When mentioning a person's name, ALWAYS wrap it in a markdown link, e.g. [John Smith](/contacts/def-456).
- When listing people, format them clearly with relevant details.
- When suggesting actions, be specific and actionable.
- Use markdown formatting: use ## for section headers, **bold** for emphasis, and bullet lists for data.
- CRITICAL FORMATTING RULE: Always start with a short greeting paragraph, then leave a BLANK LINE before the first section header. Every section header must have a blank line ABOVE it.
- Use ## or ### for section titles. Every section must start with a header on its own line, preceded by a blank line.
- Write in clear, well-spaced paragraphs. Each paragraph must be separated by a blank line.
- NEVER put two bold-labeled items in the same paragraph. Each must be its own paragraph with a blank line before it.
- When describing multiple flows, moments, or categories, use this format EXACTLY:

  **Flow Name:** Description of the flow here.

  **Another Flow:** Description of another flow here.

  Notice the blank line between each item. ALWAYS follow this pattern.
- After any bold label followed by a colon (e.g. "**Team Care:** ..."), ALWAYS add a blank line before the next bold label.
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
    let collectedContactIds: string[] | null = null;

    while (toolRound < MAX_TOOL_ROUNDS) {
      // Make a non-streaming call to check for tool calls
      const toolCheckResponse = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getGlooAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gloo-google-gemini-3-flash",
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
          } else if (fnName === "find_contacts_by_criteria") {
            result = await executeFindContactsByCriteria(adminClient, orgId, args);
            // Extract contact ids from the marker so we can append it after the model's stream
            const m = result.match(/<!--flowleed:contact_ids=(\[[^\]]*\])-->/);
            if (m) {
              try {
                const ids = JSON.parse(m[1]);
                if (Array.isArray(ids) && ids.length > 0) collectedContactIds = ids;
              } catch { /* ignore */ }
            }
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
        Authorization: `Bearer ${await getGlooAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gloo-google-gemini-3-flash",
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

    // Wrap the upstream SSE stream so we can inject a hidden contact-ids marker
    // right before [DONE], guaranteeing the UI sees it even if the model paraphrases.
    const upstream = streamResponse.body!;
    const injected = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        let injectedMarker = false;

        const injectMarker = () => {
          if (injectedMarker || !collectedContactIds || collectedContactIds.length === 0) return;
          injectedMarker = true;
          const content = `\n\n<!--flowleed:contact_ids=${JSON.stringify(collectedContactIds)}-->`;
          const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Look for [DONE] marker; inject our marker just before it
            const doneIdx = buffer.indexOf("data: [DONE]");
            if (doneIdx !== -1) {
              const before = buffer.slice(0, doneIdx);
              const after = buffer.slice(doneIdx);
              if (before) controller.enqueue(encoder.encode(before));
              injectMarker();
              controller.enqueue(encoder.encode(after));
              buffer = "";
              // forward any remaining bytes as they arrive
              while (true) {
                const r = await reader.read();
                if (r.done) break;
                controller.enqueue(r.value);
              }
              break;
            }

            // Flush complete events while keeping a small tail in buffer
            const lastBreak = buffer.lastIndexOf("\n\n");
            if (lastBreak !== -1) {
              controller.enqueue(encoder.encode(buffer.slice(0, lastBreak + 2)));
              buffer = buffer.slice(lastBreak + 2);
            }
          }
          if (buffer) controller.enqueue(encoder.encode(buffer));
          // If stream ended without seeing [DONE], still inject
          injectMarker();
        } catch (e) {
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return new Response(injected, {
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
