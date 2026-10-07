import { createClient } from "@supabase/supabase-js";
import { type GlooChatCompletion, glooChat, glooChatStream, glooErrorStatus, glooToolCalls } from "../_shared/gloo.ts";
import { designForm, validateBlueprint } from "../_shared/formAgent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tool definitions for on-demand person lookup
const TOOL_REGISTRY = [
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
        "Build a smart list of contacts using ANY combination of filters: flow moments, PCO membership status, current group membership, past group participation in a date window (in_group_between), not currently in an active group, gender, serving history, signals, engagement level, or campus. Use this whenever the user wants a list of people who meet multiple criteria — e.g. 'Fairfield women who were in a group earlier this year but are not in a group now'. Pass EVERY criterion the user named; never silently drop one. The result states which criteria were applied — repeat that to the user, list the names, and only then offer to add them to a Flow.",
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
            description: "Restrict to members of a church GROUP by its title (e.g. 'Youth', 'Choir', 'Women's Bible Study'). NEVER put a person's name here — use search_person for people.",
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
            description: "Restrict to a specific campus by (partial) name, e.g. 'Fairfield'.",
          },
          gender: {
            type: "string",
            enum: ["male", "female"],
            description: "Restrict by gender (from Planning Center demographics). Use for 'women'/'men' questions.",
          },
          in_group_between: {
            type: "object",
            description: "Group participation HISTORY window: people who were an active group member or attended a group meeting between these dates. Use for 'were in a small group earlier this year' (from = Jan 1 of this year, to = today).",
            properties: {
              from: { type: "string", description: "Start date, YYYY-MM-DD." },
              to: { type: "string", description: "End date, YYYY-MM-DD. Defaults to today." },
            },
          },
          not_in_active_group: {
            type: "boolean",
            description: "If true, exclude anyone who is currently an active member of any active group. Combine with in_group_between for 'used to be in a group but isn't now'.",
          },
          exclude_group_names: {
            type: "array",
            items: { type: "string" },
            description: "Group names (partial match) that must NOT count as 'an active group' — e.g. ['PC Youth | Middle and High School Students'] when the user says 'don't count the youth group as an active group'. Applies to not_in_active_group.",
          },

          limit: {
            type: "number",
            description: "Max number of contacts to return (default 50, max 200).",
          },

        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_people_to_flow",
      description: "Prepare an action to add one verified person to a Flow and step. This never changes records immediately; it creates a confirmation for the user.",
      parameters: {
        type: "object",
        properties: {
          person_name: { type: "string", description: "Exact person name." },
          flow_name: { type: "string", description: "Exact Flow name." },
          step_name: { type: "string", description: "Exact Flow step name." },
        },
        required: ["person_name", "flow_name", "step_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_contact_note",
      description: "Prepare a note to add to one verified person's profile. This never saves immediately; it creates a confirmation for the user.",
      parameters: {
        type: "object",
        properties: {
          person_name: { type: "string", description: "Exact person name." },
          content: { type: "string", description: "The exact note text to save." },
          note_type: { type: "string", enum: ["general", "prayer", "pastoral", "follow-up"], description: "Note category. Defaults to general." },
          is_private: { type: "boolean", description: "Whether the note should be private. Defaults to false." },
        },
        required: ["person_name", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_prayer_request",
      description: "Prepare a prayer request for one verified person's profile. This never saves immediately; it creates a confirmation for the user.",
      parameters: {
        type: "object",
        properties: {
          person_name: { type: "string", description: "Exact person name." },
          title: { type: "string", description: "A concise title for the prayer request." },
          description: { type: "string", description: "The exact prayer request details to save." },
        },
        required: ["person_name", "title", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Prepare a task for the current user. Optionally linked to one person. This never saves immediately; it creates a confirmation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title." },
          description: { type: "string", description: "Optional details." },
          person_name: { type: "string", description: "Optional exact name of a person the task is about." },
          due_date: { type: "string", description: "Optional due date in ISO format (YYYY-MM-DD)." },
          assignee_name: { type: "string", description: "Optional name of another church leader to assign the task to. Omit to assign to the current user." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description: "Prepare a change to one of the user's open tasks: mark it done, or move it to a new due date. Never saves immediately; it creates a confirmation.",
      parameters: {
        type: "object",
        properties: {
          task_query: { type: "string", description: "Keywords or person name identifying the task, e.g. 'Sandra call'." },
          complete: { type: "boolean", description: "True to mark the task done." },
          due_date: { type: "string", description: "New due date (YYYY-MM-DD) when rescheduling." },
        },
        required: ["task_query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_form",
      description: "Hand off to the Form Builder specialist to design a new church form (sign-up, registration, interest, RSVP). Never saves immediately; it prepares a preview for approval.",
      parameters: {
        type: "object",
        properties: {
          request: { type: "string", description: "The user's full description of the form: purpose, questions, choices and anything else they said." },
          flow_name: { type: "string", description: "Existing Flow that people who submit should be placed into." },
          step_name: { type: "string", description: "Optional step within that Flow. Defaults to the Flow's first step." },
          no_flow: { type: "boolean", description: "True only when the user explicitly said submissions should NOT go into any Flow." },
          new_flow_name: { type: "string", description: "Name of a NEW Flow to create with the form. Optional: if omitted and no flow_name, a Flow named after the form is created by default." },
          new_flow_steps: { type: "array", items: { type: "string" }, description: "Optional ordered step names for the new Flow. Defaults to Registered, Confirmed, Attended, Follow-up." },
          emails_decided: { type: "boolean", description: "True only when the user stated email preferences; otherwise a default thank-you email is on." },
          confirmation_email: { type: "boolean", description: "Send a thank-you email to the person who submits." },
          from_name: { type: "string", description: "Sender name shown on the thank-you email (e.g. church name)." },
          reply_to: { type: "string", description: "Email address replies should go to." },
          confirmation_subject: { type: "string", description: "Thank-you email subject. May use {first_name}, {form_name}." },
          confirmation_body: { type: "string", description: "Thank-you email message. May use {first_name}, {name}, {form_name}." },
          notify_emails: { type: "array", items: { type: "string" }, description: "Team email addresses that get an alert for each submission." },
        },
        required: ["request"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_my_tasks",
      description: "List the current user's tasks / to-dos (assigned to them). Use when the user asks what their tasks, to-dos or reminders are.",
      parameters: {
        type: "object",
        properties: {
          include_completed: { type: "boolean", description: "Also include completed tasks. Default false." },
        },
      },
    },
  },
];

const TOOL_DEFAULTS: Record<string, boolean> = {
  search_person: true,
  search_people_in_flow: true,
  find_contacts_by_criteria: true,
  add_people_to_flow: false,
  create_contact_note: false,
  create_prayer_request: false,
  create_task: true,
  update_task: true,
  list_my_tasks: true,
  create_form: true,
};

async function executeListMyTasks(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  let q = adminClient.from("tasks")
    .select("id, title, description, contact_id, due_at, completed_at")
    .eq("organization_id", orgId).eq("assigned_to_user_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(50);
  if (!args?.include_completed) q = q.is("completed_at", null);
  const { data, error } = await q;
  if (error) return `Could not load tasks: ${error.message}`;
  if (!data?.length) return "The user has no open tasks.";
  const ids = [...new Set(data.map((t: any) => t.contact_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: cs } = await adminClient.from("contacts").select("id, first_name, last_name").in("id", ids);
    (cs || []).forEach((c: any) => names.set(c.id, `${c.first_name || ""} ${c.last_name || ""}`.trim()));
  }
  const now = Date.now();
  const lines = data.map((t: any) => {
    const due = t.due_at ? new Date(t.due_at) : null;
    const status = t.completed_at ? "completed" : due && due.getTime() < now ? "overdue" : "";
    const who = t.contact_id && names.get(t.contact_id) ? ` — about [${names.get(t.contact_id)}](/contacts/${t.contact_id})` : "";
    return `- ${t.title}${who}${due ? ` (due ${due.toISOString().split("T")[0]}${status ? `, ${status}` : ""})` : status ? ` (${status})` : ""}${t.description ? `: ${t.description}` : ""}`;
  });
  return `User's tasks (${data.length}). Full list at [Tasks](/tasks):\n${lines.join("\n")}`;
}

async function prepareTask(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const title = String(args?.title || "").trim();
  const description = String(args?.description || "").trim();
  const personName = String(args?.person_name || "").trim();
  const dueRaw = String(args?.due_date || "").trim();
  if (!title) return "Please tell me what the task should be.";
  if (title.length > 200) return "That task title is too long. Please keep it under 200 characters.";
  if (description.length > 5000) return "Those task details are too long.";
  let dueAt: string | null = null;
  if (dueRaw) {
    const d = new Date(dueRaw.length === 10 ? `${dueRaw}T12:00:00Z` : dueRaw);
    if (isNaN(d.getTime())) return `I couldn't understand the due date "${dueRaw}".`;
    dueAt = d.toISOString();
  }
  let contact: { id: string; name: string } | null = null;
  if (personName) {
    const { data: contacts } = await adminClient.from("contacts").select("id, name").eq("organization_id", orgId).ilike("name", personName).limit(2);
    if (!contacts || contacts.length !== 1) return contacts?.length ? `I found more than one person matching "${personName}". Please use their full name.` : `I couldn't find ${personName} in your church records.`;
    contact = contacts[0] as any;
  }
  let assignee: { id: string; name: string } | null = null;
  const assigneeName = String(args?.assignee_name || "").trim();
  if (assigneeName && !/^(me|myself)$/i.test(assigneeName)) {
    const { data: members } = await adminClient.from("organization_members").select("user_id").eq("organization_id", orgId);
    const ids = (members || []).map((m: any) => m.user_id);
    const { data: profs } = ids.length ? await adminClient.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] as any[] };
    const needle = assigneeName.toLowerCase().replace(/^(pastor|ps\.?|rev\.?)\s+/, "");
    const matches = (profs || []).filter((p: any) => (p.full_name || "").toLowerCase().includes(needle) || (p.email || "").toLowerCase().startsWith(needle));
    if (matches.length !== 1) return matches.length ? `More than one leader matches "${assigneeName}": ${matches.map((p: any) => p.full_name || p.email).join(", ")}. Which one?` : `I couldn't find a leader named ${assigneeName} on your church team.`;
    if (matches[0].user_id !== userId) assignee = { id: matches[0].user_id, name: matches[0].full_name || matches[0].email };
  }
  const summary = [title, contact ? `For: ${contact.name}` : null, assignee ? `Assigned to: ${assignee.name}` : null, dueAt ? `Due: ${dueAt.slice(0, 10)}` : null, description || null].filter(Boolean).join("\n");
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "create_task",
    summary, expires_at: expiresAt,
    action_payload: { title, description: description || null, contact_id: contact?.id || null, contact_name: contact?.name || null, due_at: dueAt, assignee_user_id: assignee?.id || null },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare task");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "create_task", action_request_id: request.id, outcome: "prepared", affected_records: contact ? [{ type: "contact", id: contact.id }] : [] });
  return `Ready for review. Nothing has been saved yet.\n\n${actionMarker({ id: request.id, type: "create_task", summary, expires_at: expiresAt })}`;
}

async function prepareForm(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const requestText = String(args?.request || "").trim();
  if (!requestText) return "What should the form be for, and which questions should it ask?";
  let pipeline: { id: string; name: string } | null = null;
  let stage: { id: string; name: string } | null = null;
  let newFlow: { name: string; steps: string[] } | null = null;
  const flowName = String(args?.flow_name || "").trim();
  const newFlowName = String(args?.new_flow_name || "").trim().slice(0, 80);
  const listFlows = async () => {
    const { data } = await adminClient.from("pipelines").select("name").eq("organization_id", orgId).order("name").limit(40);
    return (data || []).map((f: any) => f.name);
  };
  const DEFAULT_STEPS = ["Registered", "Confirmed", "Attended", "Follow-up"];
  const blueprint = await designForm(requestText);
  const makeNewFlow = async (name: string, rawSteps: unknown) => {
    const steps = (Array.isArray(rawSteps) ? rawSteps : []).map((s: unknown) => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 10);
    let finalName = name.slice(0, 80);
    const { data: clash } = await adminClient.from("pipelines").select("id").eq("organization_id", orgId).ilike("name", finalName).maybeSingle();
    if (clash) finalName = `${finalName} ${new Date().getFullYear()}`.slice(0, 80);
    return { name: finalName, steps: steps.length >= 2 ? steps : DEFAULT_STEPS };
  };
  if (newFlowName) {
    const { data: clash } = await adminClient.from("pipelines").select("id, name").eq("organization_id", orgId).ilike("name", newFlowName).maybeSingle();
    if (clash) pipeline = clash as any;
    else newFlow = await makeNewFlow(newFlowName, args?.new_flow_steps);
  } else if (flowName) {
    const { data: flows } = await adminClient.from("pipelines").select("id, name").eq("organization_id", orgId).ilike("name", `%${flowName}%`).limit(5);
    const exact = (flows || []).filter((f: any) => f.name.toLowerCase() === flowName.toLowerCase());
    const pick = exact.length === 1 ? exact : (flows || []);
    if (pick.length > 1) return `Several Flows match "${flowName}": ${pick.map((f: any) => f.name).join(", ")}. Ask the user which one.`;
    if (!pick.length) newFlow = await makeNewFlow(flowName, args?.new_flow_steps);
    else pipeline = pick[0] as any;
  } else if (args?.no_flow !== true) {
    // Sensible default: a new Flow named after the form with standard event steps.
    newFlow = await makeNewFlow(blueprint?.name || "New Form", args?.new_flow_steps);
  }
  if (pipeline) {
    const { data: stages } = await adminClient.from("pipeline_stages").select("id, name, stage_order").eq("pipeline_id", pipeline!.id).order("stage_order");
    const stepName = String(args?.step_name || "").trim().toLowerCase();
    stage = ((stepName && (stages || []).find((s: any) => s.name.toLowerCase() === stepName)) || (stages || [])[0] || null) as any;
  }
  const emailsDecided = args?.emails_decided === true;
  const emailRe = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
  const notifyList = (Array.isArray(args?.notify_emails) ? args.notify_emails : String(args?.notify_emails || "").split(/[,;\s]+/))
    .map((s: unknown) => String(s).trim()).filter((s: string) => emailRe.test(s)).slice(0, 10);
  const replyTo = String(args?.reply_to || "").trim();
  const emailSettings = {
    confirmation: {
      // Default: warm thank-you email on, using the church's name (filled in by the form settings defaults).
      enabled: emailsDecided ? args?.confirmation_email === true : true,
      from_name: String(args?.from_name || "").slice(0, 80),
      reply_to: emailRe.test(replyTo) ? replyTo : "",
      subject: String(args?.confirmation_subject || (emailsDecided ? "" : `Thanks for registering — ${blueprint?.name || "see you soon"}`)).slice(0, 200),
      body: String(args?.confirmation_body || (emailsDecided ? "" : "Thank you for signing up! We're so glad you're coming and will be in touch with details soon.")).slice(0, 3000),
    },
    notify: { enabled: notifyList.length > 0, recipients: notifyList.join(", "), subject: "" },
  };
  if (!blueprint) return "The Form Builder couldn't design this form. Ask the user for the form's purpose and questions.";
  const fieldLines = blueprint.fields.map((f) => `- ${f.label} (${f.field_type}${f.required ? ", required" : ""}${f.options?.length ? `: ${f.options.join(", ")}` : ""})`);
  const dest = newFlow ? `Creates new Flow: ${newFlow.name} (${newFlow.steps.join(" → ")}); submissions go to ${newFlow.steps[0]}` : pipeline ? `Adds people to: ${pipeline.name}${stage ? ` → ${stage.name}` : ""}` : "Not linked to a Flow";
  const emailLines = [
    emailSettings.confirmation.enabled ? `Thank-you email: from ${emailSettings.confirmation.from_name || "FlowLeed"}${emailSettings.confirmation.subject ? `, subject "${emailSettings.confirmation.subject}"` : ""}` : "Thank-you email: off",
    notifyList.length ? `Team alert email: ${notifyList.join(", ")}` : "Team alert email: off",
  ];
  const summary = [`Form: ${blueprint.name}`, dest, blueprint.description, ...emailLines, "Questions:", ...fieldLines].filter(Boolean).join("\n");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "create_form", summary, expires_at: expiresAt,
    action_payload: { blueprint, pipeline_id: pipeline?.id || null, stage_id: stage?.id || null, new_flow: newFlow, email_settings: emailSettings },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare form");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "create_form", action_request_id: request.id, outcome: "prepared", affected_records: [] });
  return `Ready for review. Nothing has been created yet. Show the user this preview under a "### Form" heading:\n${summary}\n\n${actionMarker({ id: request.id, type: "create_form", summary, expires_at: expiresAt })}`;
}

async function prepareUpdateTask(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const query = String(args?.task_query || "").trim().toLowerCase();
  const complete = args?.complete === true;
  const dueRaw = String(args?.due_date || "").trim();
  if (!query) return "Which task do you mean?";
  if (!complete && !dueRaw) return "Should I mark it done or move it to a new date?";
  let dueAt: string | null = null;
  if (!complete) {
    const d = new Date(dueRaw.length === 10 ? `${dueRaw}T12:00:00Z` : dueRaw);
    if (isNaN(d.getTime())) return `I couldn't understand the date "${dueRaw}".`;
    dueAt = d.toISOString();
  }
  const { data: tasks } = await adminClient.from("tasks")
    .select("id, title, description, due_at, contact:contacts(id, name)")
    .eq("organization_id", orgId).is("completed_at", null)
    .or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`).limit(200);
  const words = query.split(/\s+/).filter((w) => w.length > 1);
  const matches = (tasks || []).filter((t: any) => {
    const hay = `${t.title} ${t.description || ""} ${t.contact?.name || ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  if (!matches.length) return `I couldn't find an open task matching "${args.task_query}".`;
  if (matches.length > 1) return `Several open tasks match: ${matches.slice(0, 6).map((t: any) => `"${t.title}"${t.contact?.name ? ` (${t.contact.name})` : ""}`).join(", ")}. Ask the user which one.`;
  const t: any = matches[0];
  const summary = complete
    ? `Mark done: ${t.title}${t.contact?.name ? `\nFor: ${t.contact.name}` : ""}`
    : `Reschedule: ${t.title}${t.contact?.name ? `\nFor: ${t.contact.name}` : ""}\nFrom: ${t.due_at ? t.due_at.slice(0, 10) : "no date"} → ${dueAt!.slice(0, 10)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "update_task",
    summary, expires_at: expiresAt, action_payload: { task_id: t.id, complete, due_at: dueAt },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare task change");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "update_task", action_request_id: request.id, outcome: "prepared", affected_records: [{ type: "task", id: t.id }] });
  return `Ready for review. Nothing has been changed yet.\n\n${actionMarker({ id: request.id, type: "update_task", summary, expires_at: expiresAt })}`;
}


const actionMarker = (payload: Record<string, unknown>) =>
  `<!--flowleed:action=${JSON.stringify(payload).replace(/-->/g, "--\\u003e")}-->`;

async function prepareAddToFlow(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const personName = String(args?.person_name || "").trim();
  const flowName = String(args?.flow_name || "").trim();
  const stepName = String(args?.step_name || "").trim();
  const [{ data: contacts }, { data: flows }] = await Promise.all([
    adminClient.from("contacts").select("id, name").eq("organization_id", orgId).ilike("name", personName).limit(2),
    adminClient.from("pipelines").select("id, name, pipeline_stages(id, name, stage_order)").eq("organization_id", orgId).ilike("name", flowName).limit(2),
  ]);
  if (!contacts || contacts.length !== 1) return contacts?.length ? `I found more than one person matching "${personName}". Please use their full name.` : `I couldn't find ${personName} in your church records.`;
  if (!flows || flows.length !== 1) return flows?.length ? `I found more than one Flow matching "${flowName}". Please use the exact Flow name.` : `I couldn't find a Flow named ${flowName}.`;
  const flow = flows[0] as any;
  const matchingSteps = (flow.pipeline_stages || []).filter((step: any) => step.name.toLowerCase() === stepName.toLowerCase());
  if (matchingSteps.length !== 1) return `I couldn't find the step "${stepName}" in ${flow.name}.`;
  const contact = contacts[0];
  const step = matchingSteps[0];
  const summary = `${contact.name} → ${flow.name} → ${step.name}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "add_people_to_flow",
    summary, expires_at: expiresAt,
    action_payload: { contact_id: contact.id, contact_name: contact.name, pipeline_id: flow.id, pipeline_name: flow.name, stage_id: step.id, stage_name: step.name, stage_order: step.stage_order },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare action");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "add_people_to_flow", action_request_id: request.id, outcome: "prepared", affected_records: [{ type: "contact", id: contact.id }, { type: "flow", id: flow.id }, { type: "step", id: step.id }] });
  return `Ready for review: **${summary}**. Nothing has changed yet.\n\n${actionMarker({ id: request.id, type: "add_people_to_flow", summary, expires_at: expiresAt })}`;
}

async function prepareContactNote(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const personName = String(args?.person_name || "").trim();
  const content = String(args?.content || "").trim();
  const allowedTypes = new Set(["general", "prayer", "pastoral", "follow-up"]);
  const noteType = allowedTypes.has(String(args?.note_type || "general")) ? String(args?.note_type || "general") : "general";
  const isPrivate = args?.is_private === true;
  if (!personName) return "Please tell me whose profile should receive the note.";
  if (!content) return "Please tell me what the note should say.";
  if (content.length > 5000) return "That note is too long. Please keep it under 5,000 characters.";
  const { data: contacts } = await adminClient.from("contacts").select("id, name").eq("organization_id", orgId).ilike("name", personName).limit(2);
  if (!contacts || contacts.length !== 1) return contacts?.length ? `I found more than one person matching "${personName}". Please use their full name.` : `I couldn't find ${personName} in your church records.`;
  const contact = contacts[0];
  const privacyLabel = isPrivate ? "Private" : "Shared";
  const summary = `${contact.name} • ${noteType} • ${privacyLabel}\n\n${content}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "create_contact_note",
    summary, expires_at: expiresAt,
    action_payload: { contact_id: contact.id, contact_name: contact.name, content, note_type: noteType, is_private: isPrivate },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare note");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "create_contact_note", action_request_id: request.id, outcome: "prepared", affected_records: [{ type: "contact", id: contact.id }] });
  return `Ready for review. Nothing has been saved yet.\n\n${actionMarker({ id: request.id, type: "create_contact_note", summary, expires_at: expiresAt })}`;
}

async function preparePrayerRequest(
  adminClient: ReturnType<typeof createClient>, orgId: string, userId: string, args: any,
): Promise<string> {
  const personName = String(args?.person_name || "").trim();
  const title = String(args?.title || "").trim();
  const description = String(args?.description || "").trim();
  if (!personName) return "Please tell me whose profile should receive the prayer request.";
  if (!title) return "Please provide a short title for the prayer request.";
  if (!description) return "Please tell me the prayer request details.";
  if (title.length > 200) return "That prayer request title is too long. Please keep it under 200 characters.";
  if (description.length > 5000) return "That prayer request is too long. Please keep it under 5,000 characters.";
  const { data: contacts } = await adminClient.from("contacts").select("id, name").eq("organization_id", orgId).ilike("name", personName).limit(2);
  if (!contacts || contacts.length !== 1) return contacts?.length ? `I found more than one person matching "${personName}". Please use their full name.` : `I couldn't find ${personName} in your church records.`;
  const contact = contacts[0];
  const summary = `${contact.name} • ${title}\n\n${description}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data: request, error } = await adminClient.from("ai_action_requests").insert({
    organization_id: orgId, requested_by_user_id: userId, tool_key: "create_prayer_request",
    summary, expires_at: expiresAt,
    action_payload: { contact_id: contact.id, contact_name: contact.name, title, description },
  }).select("id").single();
  if (error || !request) throw error || new Error("Could not prepare prayer request");
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: "create_prayer_request", action_request_id: request.id, outcome: "prepared", affected_records: [{ type: "contact", id: contact.id }] });
  return `Ready for review. Nothing has been saved yet.\n\n${actionMarker({ id: request.id, type: "create_prayer_request", summary, expires_at: expiresAt })}`;
}

async function executePendingAction(adminClient: ReturnType<typeof createClient>, userClient: ReturnType<typeof createClient>, orgId: string, userId: string, requestId: string) {
  const { data: request } = await adminClient.from("ai_action_requests").select("*").eq("id", requestId).eq("organization_id", orgId).eq("requested_by_user_id", userId).maybeSingle();
  if (!request || request.status !== "pending") return { ok: false, message: "This confirmation is no longer available." };
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await adminClient.from("ai_action_requests").update({ status: "expired" }).eq("id", request.id).eq("status", "pending");
    return { ok: false, message: "That confirmation expired. Ask FlowLeed AI to prepare it again." };
  }
  const { data: setting } = await adminClient.from("ai_tool_settings").select("enabled").eq("organization_id", orgId).eq("tool_key", request.tool_key).maybeSingle();
  if (!(setting?.enabled ?? TOOL_DEFAULTS[request.tool_key] ?? false)) return { ok: false, message: "This AI action is disabled in Organization Settings." };
  const payload = request.action_payload as any;
  if (request.tool_key === "update_task") {
    const { data: existing } = await userClient.from("tasks").select("id, title, completed_at").eq("id", payload?.task_id).eq("organization_id", orgId).maybeSingle();
    if (!existing) return { ok: false, message: "That task is no longer available." };
    const patch: Record<string, unknown> = payload.complete ? { completed_at: new Date().toISOString() } : { due_at: payload.due_at };
    if (!payload.complete && !payload.due_at) return { ok: false, message: "This change is no longer valid." };
    const { data: updated, error } = await userClient.from("tasks").update(patch).eq("id", existing.id).select("id").maybeSingle();
    if (error || !updated) {
      const errorMessage = error?.message || "The task could not be updated.";
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: errorMessage } }).eq("id", request.id).eq("status", "pending");
      return { ok: false, message: "I couldn't update this task." };
    }
    const now = new Date().toISOString();
    const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { task_id: existing.id } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
    await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "task", id: existing.id }] });
    return { ok: true, message: payload.complete ? `Marked "${existing.title}" as done. [Tasks](/tasks)` : `Moved "${existing.title}" to ${String(payload.due_at).slice(0, 10)}. [Tasks](/tasks)` };
  }
  if (request.tool_key === "create_form") {
    const blueprint = validateBlueprint(payload?.blueprint);
    if (!blueprint) return { ok: false, message: "This form is no longer valid. Ask FlowLeed AI to prepare it again." };
    let pipelineId: string | null = payload.pipeline_id || null;
    let stageId: string | null = payload.stage_id || null;
    let createdFlow: { id: string; name: string } | null = null;
    if (pipelineId) {
      const { data: p } = await adminClient.from("pipelines").select("id").eq("id", pipelineId).eq("organization_id", orgId).maybeSingle();
      if (!p) return { ok: false, message: "That Flow is no longer available." };
    } else if (payload.new_flow?.name && Array.isArray(payload.new_flow.steps) && payload.new_flow.steps.length >= 2) {
      const flowName = String(payload.new_flow.name).slice(0, 80);
      const steps: string[] = payload.new_flow.steps.map((s: unknown) => String(s).slice(0, 60)).slice(0, 10);
      const { count: flowCount } = await adminClient.from("pipelines").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
      const newId = crypto.randomUUID();
      const { error: pErr } = await userClient.from("pipelines").insert({ id: newId, name: flowName, icon: "Workflow", organization_id: orgId, flow_type: "linear", flow_order: flowCount || 0 });
      if (pErr) return { ok: false, message: "I couldn't create the new Flow, so nothing was created." };
      await userClient.from("pipeline_team_members").upsert({ pipeline_id: newId, user_id: userId, role: "lead" }, { onConflict: "pipeline_id,user_id" });
      const colors = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#EC4899", "#84CC16", "#6366F1", "#14B8A6"];
      const stageRows = steps.map((name, i) => ({ id: crypto.randomUUID(), pipeline_id: newId, name, color: colors[i % colors.length], stage_order: i, is_start_step: i === 0, is_end_step: i === steps.length - 1 }));
      const { error: sErr } = await userClient.from("pipeline_stages").insert(stageRows);
      if (sErr) { await userClient.from("pipelines").delete().eq("id", newId); return { ok: false, message: "I couldn't set up the new Flow's steps, so nothing was created." }; }
      pipelineId = newId; stageId = stageRows[0].id; createdFlow = { id: newId, name: flowName };
    }
    const base = blueprint.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "form";
    let slug = base;
    for (let n = 2; n < 50; n++) {
      const { data: clash } = await adminClient.from("forms").select("id").eq("organization_id", orgId).eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${n}`;
    }
    const { data: form, error } = await userClient.from("forms").insert({
      organization_id: orgId, name: blueprint.name, slug, description: blueprint.description, success_message: blueprint.success_message,
      pipeline_id: pipelineId, stage_id: stageId, is_published: false, created_by: userId,
      email_settings: payload.email_settings || {},
    }).select("id, slug").single();
    const fail = async (msg: string) => {
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: msg } }).eq("id", request.id).eq("status", "pending");
      await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "failed", affected_records: [], error_message: msg });
    };
    if (error || !form) { await fail(error?.message || "Form insert failed"); return { ok: false, message: "I couldn't create this form." }; }
    const { error: fErr } = await userClient.from("form_fields").insert(blueprint.fields.map((f, idx) => ({ ...f, form_id: form.id, sort_order: idx })));
    if (fErr) { await userClient.from("forms").delete().eq("id", form.id); await fail(fErr.message); return { ok: false, message: "I couldn't add the form's questions, so nothing was created." }; }
    const { count } = await userClient.from("form_fields").select("id", { count: "exact", head: true }).eq("form_id", form.id);
    if (!count) return { ok: false, message: "The form could not be verified, so I won't report it as created." };
    const now = new Date().toISOString();
    const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { form_id: form.id } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
    await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "form", id: form.id }] });
    const { data: orgRow } = await adminClient.from("organizations").select("slug").eq("id", orgId).maybeSingle();
    const formPath = orgRow?.slug ? `/${orgRow.slug}/f/${form.slug}` : null;
    const formMarker = formPath ? `\n\n<!--flowleed:form=${JSON.stringify({ id: form.id, path: formPath })}-->` : "";
    return { ok: true, message: `Created the form "${blueprint.name}" with ${count} questions${createdFlow ? ` and the new Flow [${createdFlow.name}](/flows/${createdFlow.id})` : ""}. It's a draft until you publish it. Preview it, then publish it when you're ready. [Open in Form Builder](/forms/${form.id})${formMarker}` };
  }
  if (request.tool_key === "create_task") {
    const title = String(payload?.title || "").trim();
    if (!title || title.length > 200) return { ok: false, message: "This task is no longer valid. Ask FlowLeed AI to prepare it again." };
    let contactName: string | null = null;
    if (payload.contact_id) {
      const { data: contact } = await adminClient.from("contacts").select("id, name").eq("id", payload.contact_id).eq("organization_id", orgId).maybeSingle();
      if (!contact) return { ok: false, message: "This person is no longer available." };
      contactName = contact.name;
    }
    let assigneeId = userId;
    if (payload.assignee_user_id && payload.assignee_user_id !== userId) {
      const { data: m } = await adminClient.from("organization_members").select("user_id").eq("organization_id", orgId).eq("user_id", payload.assignee_user_id).maybeSingle();
      if (!m) return { ok: false, message: "That leader is no longer part of your church team." };
      assigneeId = payload.assignee_user_id;
    }
    const { data: task, error } = await userClient.from("tasks").insert({ organization_id: orgId, title, description: payload.description || null, contact_id: payload.contact_id || null, due_at: payload.due_at || null, assigned_to_user_id: assigneeId, created_by_user_id: userId }).select("id").single();
    if (error || !task) {
      const errorMessage = error?.message || "The task could not be saved.";
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: errorMessage } }).eq("id", request.id).eq("status", "pending");
      await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "failed", affected_records: [], error_message: errorMessage });
      return { ok: false, message: "I couldn't save this task." };
    }
    const now = new Date().toISOString();
    const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { task_id: task.id } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
    await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "task", id: task.id }] });
    return { ok: true, message: `Added the task "${title}"${contactName ? ` for [${contactName}](/contacts/${payload.contact_id})` : ""} to your [Tasks](/tasks).` };
  }
  if (request.tool_key === "create_contact_note") {
    const content = String(payload?.content || "").trim();
    const allowedTypes = new Set(["general", "prayer", "pastoral", "follow-up"]);
    if (!content || content.length > 5000 || !allowedTypes.has(String(payload?.note_type))) return { ok: false, message: "This note is no longer valid. Ask FlowLeed AI to prepare it again." };
    const { data: contact } = await adminClient.from("contacts").select("id, name").eq("id", payload.contact_id).eq("organization_id", orgId).maybeSingle();
    if (!contact) return { ok: false, message: "This person is no longer available." };
    const { data: note, error } = await userClient.from("contact_notes").insert({ contact_id: contact.id, content, note_type: payload.note_type, is_private: payload.is_private === true, created_by_user_id: userId }).select("id").single();
    if (error || !note) {
      const errorMessage = error?.message || "The note could not be saved.";
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: errorMessage } }).eq("id", request.id).eq("status", "pending");
      await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "failed", affected_records: [], error_message: errorMessage });
      return { ok: false, message: "I couldn't save this note. You may not have permission to update this person." };
    }
    const { data: verified } = await userClient.from("contact_notes").select("id").eq("id", note.id).eq("contact_id", contact.id).maybeSingle();
    if (!verified) return { ok: false, message: "The note could not be verified, so I won't report it as saved." };
    const now = new Date().toISOString();
    const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { contact_note_id: verified.id } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
    await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "contact_note", id: verified.id }, { type: "contact", id: contact.id }] });
    return { ok: true, message: `Added the note to [${contact.name}](/contacts/${contact.id}).` };
  }
  if (request.tool_key === "create_prayer_request") {
    const title = String(payload?.title || "").trim();
    const description = String(payload?.description || "").trim();
    if (!title || title.length > 200 || !description || description.length > 5000) return { ok: false, message: "This prayer request is no longer valid. Ask FlowLeed AI to prepare it again." };
    const { data: contact } = await adminClient.from("contacts").select("id, name").eq("id", payload.contact_id).eq("organization_id", orgId).maybeSingle();
    if (!contact) return { ok: false, message: "This person is no longer available." };
    const { data: prayerRequest, error } = await userClient.from("contact_prayer_requests").insert({ contact_id: contact.id, title, description, status: "active", created_by_user_id: userId }).select("id").single();
    if (error || !prayerRequest) {
      const errorMessage = error?.message || "The prayer request could not be saved.";
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: errorMessage } }).eq("id", request.id).eq("status", "pending");
      await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "failed", affected_records: [], error_message: errorMessage });
      return { ok: false, message: "I couldn't save this prayer request. You may not have permission to update this person." };
    }
    const { data: verified } = await userClient.from("contact_prayer_requests").select("id").eq("id", prayerRequest.id).eq("contact_id", contact.id).maybeSingle();
    if (!verified) return { ok: false, message: "The prayer request could not be verified, so I won't report it as saved." };
    const now = new Date().toISOString();
    const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { prayer_request_id: verified.id } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
    await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "contact_prayer_request", id: verified.id }, { type: "contact", id: contact.id }] });
    return { ok: true, message: `Added the prayer request to [${contact.name}](/contacts/${contact.id}).` };
  }
  const [{ data: contact }, { data: flow }, { data: step }] = await Promise.all([
    adminClient.from("contacts").select("id, name").eq("id", payload.contact_id).eq("organization_id", orgId).maybeSingle(),
    adminClient.from("pipelines").select("id, name").eq("id", payload.pipeline_id).eq("organization_id", orgId).maybeSingle(),
    adminClient.from("pipeline_stages").select("id, name, pipeline_id, stage_order, default_assignee_user_id").eq("id", payload.stage_id).eq("pipeline_id", payload.pipeline_id).maybeSingle(),
  ]);
  if (!contact || !flow || !step) return { ok: false, message: "The person, Flow, or step is no longer available." };
  const { data: existing } = await userClient.from("pipeline_contacts").select("id").eq("pipeline_id", flow.id).eq("contact_id", contact.id).maybeSingle();
  if (!existing) {
    const { data: lastInStep } = await adminClient
      .from("pipeline_contacts")
      .select("stage_order")
      .eq("pipeline_id", flow.id)
      .eq("stage_id", step.id)
      .order("stage_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((lastInStep?.stage_order as number | null) ?? -1) + 1;
    const { error } = await userClient.from("pipeline_contacts").insert({ contact_id: contact.id, pipeline_id: flow.id, stage_id: step.id, stage_order: nextOrder, assigned_to_user_id: step.default_assignee_user_id || null, source_type: "manual" });
    if (error) {
      await adminClient.from("ai_action_requests").update({ status: "failed", completed_at: new Date().toISOString(), result_payload: { error: error.message } }).eq("id", request.id).eq("status", "pending");
      await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "failed", affected_records: [], error_message: error.message });
      return { ok: false, message: "I couldn't add this person. You may not have permission for that Flow." };
    }
  }
  const { data: verified } = await userClient.from("pipeline_contacts").select("id").eq("pipeline_id", flow.id).eq("contact_id", contact.id).maybeSingle();
  if (!verified) return { ok: false, message: "The change could not be verified, so I won't report it as completed." };
  const now = new Date().toISOString();
  const statusUpdate = await adminClient.from("ai_action_requests").update({ status: "completed", confirmed_at: now, completed_at: now, result_payload: { pipeline_contact_id: verified.id, already_present: !!existing } }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
  if (!statusUpdate.data) return { ok: false, message: "This action was already handled." };
  await adminClient.from("ai_tool_audit_logs").insert({ organization_id: orgId, requested_by_user_id: userId, tool_key: request.tool_key, action_request_id: request.id, outcome: "completed", affected_records: [{ type: "pipeline_contact", id: verified.id }] });
  return { ok: true, message: existing ? `${contact.name} is already in ${flow.name}.` : `Added ${contact.name} to ${flow.name} at ${step.name}.` };
}


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

    // Groups the person belongs to (role + recent attendance)
    try {
      const { data: gm } = await adminClient
        .from("group_members")
        .select("*, groups(name)")
        .eq("contact_id", contactId)
        .limit(20);
      const active = (gm || []).filter((m: any) => !m.left_at && m.status !== "inactive" && m.is_active !== false);
      if (active.length > 0) {
        lines.push(`\n**Groups (${active.length}):**`);
        for (const m of active) {
          lines.push(`- ${(m.groups as any)?.name || "Group"}${m.role ? ` — ${m.role}` : ""}`);
        }
      } else {
        lines.push(`\n**Groups:** Not in any active group`);
      }
      const { data: att } = await adminClient
        .from("group_attendance")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (att && att.length) {
        const attended = att.filter((a: any) => a.attended !== false).length;
        lines.push(`- Recent group attendance: ${attended} of last ${att.length} meetings`);
      }
    } catch (_e) { /* ignore group lookup failures */ }

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

  // PostgREST caps each response at ~1000 rows, so every id set must be paged.
  const PAGE = 1000;
  const pageAll = async (build: (from: number, to: number) => any): Promise<any[]> => {
    const all: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data || [];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  };

  const KNOWN_ARGS = [
    "flow_moment_names", "pc_membership", "in_any_group", "group_name", "serving_min_days",
    "marker_codes", "engagement_level", "campus_name", "gender", "in_group_between",
    "not_in_active_group", "exclude_group_names", "limit",

  ];
  const unsupported = Object.keys(args || {}).filter((k) => !KNOWN_ARGS.includes(k));
  const appliedNotes: string[] = [];
  const lines_unmatchedGroups: string[] = [];


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
    appliedNotes.push(`Flow moment: ${names.join(", ")}`);
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
    appliedNotes.push(`Membership: ${args.pc_membership.join(", ")}`);
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
    appliedNotes.push(args?.group_name ? `Group: ${args.group_name}` : (args?.in_any_group === false ? "Not in any active group" : "In an active group"));
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
    appliedNotes.push(`Serving ${args.serving_min_days}+ days`);
    if (!candidateIds || candidateIds.size === 0) return `No contacts have been serving for ${args.serving_min_days}+ days.`;
  }

  // Markers (marker_definitions uses `key`; contact_markers stores marker_key)
  if (Array.isArray(args?.marker_codes) && args.marker_codes.length > 0) {
    const { data: defs } = await adminClient
      .from("marker_definitions")
      .select("key")
      .in("key", args.marker_codes);
    const keys = (defs || []).map((d: any) => d.key);
    if (keys.length === 0) return `No signals found for: ${args.marker_codes.join(", ")}`;
    const cm = await pageAll((from, to) =>
      adminClient
        .from("contact_markers")
        .select("contact_id")
        .eq("organization_id", orgId)
        .in("marker_key", keys)
        .order("contact_id", { ascending: true })
        .range(from, to)
    );
    intersect(cm.map((m: any) => m.contact_id).filter(Boolean));
    appliedNotes.push(`Signals: ${keys.join(", ")}`);
    if (!candidateIds || candidateIds.size === 0) return "No contacts have those signals.";
  }

  // Engagement level
  if (Array.isArray(args?.engagement_level) && args.engagement_level.length > 0) {
    const rows = await pageAll((from, to) =>
      adminClient
        .from("contact_engagement_scores")
        .select("contact_id")
        .eq("organization_id", orgId)
        .in("engagement_level", args.engagement_level)
        .order("contact_id", { ascending: true })
        .range(from, to)
    );
    intersect(rows.map((c: any) => c.contact_id).filter(Boolean));
    appliedNotes.push(`Engagement: ${args.engagement_level.join(", ")}`);
    if (!candidateIds || candidateIds.size === 0) return "No contacts at that engagement level.";
  }

  // Campus
  if (args?.campus_name) {
    const { data: campuses } = await adminClient
      .from("campuses")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", `%${args.campus_name}%`);
    const campusIds = (campuses || []).map((c: any) => c.id);
    if (campusIds.length === 0) {
      const { data: all } = await adminClient
        .from("campuses")
        .select("name")
        .eq("organization_id", orgId);
      const names = (all || []).map((c: any) => c.name).join(", ");
      return `CRITERIA NOT APPLIED: no campus matches "${args.campus_name}". Available campuses: ${names || "none"}. Ask the user which campus they mean instead of answering without a campus filter.`;
    }
    const rows = await pageAll((from, to) =>
      adminClient
        .from("contacts")
        .select("id")
        .eq("organization_id", orgId)
        .in("campus_id", campusIds)
        .order("id", { ascending: true })
        .range(from, to)
    );
    intersect(rows.map((c: any) => c.id));
    appliedNotes.push(`Campus: ${(campuses || []).map((c: any) => c.name).join(", ")}`);
    if (!candidateIds || candidateIds.size === 0) return "No contacts at that campus.";
  }

  // Gender (Planning Center demographics) - always scoped to this org's people
  if (typeof args?.gender === "string" && args.gender.trim()) {
    const g = args.gender.trim().toLowerCase();
    const wanted = g.startsWith("f") ? ["female", "f"] : ["male", "m"];

    // contact_demographics has no organization_id, so restrict to this org's contacts.
    let scopeIds: string[];
    if (candidateIds) {
      scopeIds = [...candidateIds];
    } else {
      const orgContacts = await pageAll((from, to) =>
        adminClient
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId)
          .order("id", { ascending: true })
          .range(from, to)
      );
      scopeIds = orgContacts.map((c: any) => c.id);
    }

    const ids: string[] = [];
    for (let i = 0; i < scopeIds.length; i += 200) {
      const slice = scopeIds.slice(i, i + 200);
      const rows = await pageAll((from, to) =>
        adminClient
          .from("contact_demographics")
          .select("contact_id, gender")
          .in("contact_id", slice)
          .order("contact_id", { ascending: true })
          .range(from, to)
      );
      for (const r of rows as any[]) {
        if (r.contact_id && wanted.includes(String(r.gender || "").trim().toLowerCase())) {
          ids.push(r.contact_id);
        }
      }
    }

    intersect(ids);
    appliedNotes.push(`Gender: ${g.startsWith("f") ? "female" : "male"}`);
    if (!candidateIds || candidateIds.size === 0) {
      return `CRITERIA NOT APPLIED FULLY: nobody matched gender "${args.gender}" — gender may not be synced from Planning Center for these people. Tell the user plainly instead of dropping the filter.`;
    }
  }


  // Group participation history window
  if (args?.in_group_between && (args.in_group_between.from || args.in_group_between.to)) {
    const from = String(args.in_group_between.from || "").slice(0, 10) || "1970-01-01";
    const to = String(args.in_group_between.to || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const fromIso = `${from}T00:00:00.000Z`;
    const toIso = `${to}T23:59:59.999Z`;

    const { data: orgGroups } = await adminClient
      .from("groups")
      .select("id")
      .eq("organization_id", orgId);
    const orgGroupIds = (orgGroups || []).map((g: any) => g.id);
    const historical = new Set<string>();

    if (orgGroupIds.length > 0) {
      // Members whose membership or last attendance falls in the window
      for (let i = 0; i < orgGroupIds.length; i += 100) {
        const slice = orgGroupIds.slice(i, i + 100);
        const members = await pageAll((f, t) =>
          adminClient
            .from("group_members")
            .select("contact_id, joined_at, last_attended_at")
            .in("group_id", slice)
            .order("contact_id", { ascending: true })
            .range(f, t)
        );
        for (const m of members as any[]) {
          const dates = [m.joined_at, m.last_attended_at].filter(Boolean) as string[];
          if (m.contact_id && dates.some((d) => d >= fromIso && d <= toIso)) historical.add(m.contact_id);
        }
      }

      // Actual meeting attendance in the window
      const meetings = await pageAll((f, t) =>
        adminClient
          .from("group_meetings")
          .select("id")
          .in("group_id", orgGroupIds)
          .gte("meeting_date", from)
          .lte("meeting_date", to)
          .order("id", { ascending: true })
          .range(f, t)
      );
      const meetingIds = meetings.map((m: any) => m.id);
      for (let i = 0; i < meetingIds.length; i += 100) {
        const slice = meetingIds.slice(i, i + 100);
        const att = await pageAll((f, t) =>
          adminClient
            .from("group_attendance")
            .select("contact_id, status")
            .in("group_meeting_id", slice)
            .order("contact_id", { ascending: true })
            .range(f, t)
        );
        for (const a of att as any[]) {
          if (a.contact_id && String(a.status || "present").toLowerCase() === "present") historical.add(a.contact_id);
        }
      }
    }

    intersect([...historical]);
    appliedNotes.push(`Was in a group between ${from} and ${to}`);
    if (!candidateIds || candidateIds.size === 0) {
      return `No contacts were in a group between ${from} and ${to}.`;
    }
  }

  // Not currently in any active group
  if (args?.not_in_active_group === true) {
    const { data: activeGroups } = await adminClient
      .from("groups")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active");
    let groupRows = (activeGroups || []) as any[];
    const excludeNames: string[] = Array.isArray(args?.exclude_group_names)
      ? args.exclude_group_names.filter((n: any) => typeof n === "string" && n.trim())
      : [];
    if (excludeNames.length > 0) {
      const matched: string[] = [];
      const unmatched: string[] = [];
      for (const raw of excludeNames) {
        const needle = raw.toLowerCase().trim();
        const hits = groupRows.filter((g) => String(g.name || "").toLowerCase().includes(needle));
        if (hits.length > 0) matched.push(...hits.map((g) => g.name)); else unmatched.push(raw);
      }
      const matchedSet = new Set(matched);
      groupRows = groupRows.filter((g) => !matchedSet.has(g.name));
      if (matched.length > 0) appliedNotes.push(`Not counting these groups as active: ${[...matchedSet].join(", ")}`);
      if (unmatched.length > 0) {
        lines_unmatchedGroups.push(
          `CRITERIA NOT APPLIED: no active group matched these names to exclude: ${unmatched.join(", ")}`
        );
      }
    }
    const activeIds = groupRows.map((g: any) => g.id);

    const current = new Set<string>();
    for (let i = 0; i < activeIds.length; i += 100) {
      const slice = activeIds.slice(i, i + 100);
      const members = await pageAll((f, t) =>
        adminClient
          .from("group_members")
          .select("contact_id")
          .in("group_id", slice)
          .eq("status", "active")
          .order("contact_id", { ascending: true })
          .range(f, t)
      );
      for (const m of members as any[]) if (m.contact_id) current.add(m.contact_id);
    }
    if (candidateIds === null) {
      const rows = await pageAll((f, t) =>
        adminClient
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId)
          .order("id", { ascending: true })
          .range(f, t)
      );
      intersect(rows.map((c: any) => c.id).filter((id: string) => !current.has(id)));
    } else {
      candidateIds = new Set([...(candidateIds as Set<string>)].filter((id) => !current.has(id)));
    }
    appliedNotes.push("Not in an active group right now");
    if (!candidateIds || candidateIds.size === 0) return "Everyone matching the other criteria is already in an active group.";
  }

  // If no filters at all
  if (candidateIds === null) {
    return "No criteria were provided. Please specify at least one filter (flow moment, membership, group, group history, serving, signal, engagement level, campus, or gender).";
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
  if (unsupported.length > 0) {
    lines.push(`CRITERIA NOT SUPPORTED (tell the user these were NOT applied): ${unsupported.join(", ")}`);
    lines.push("");
  }
  if (lines_unmatchedGroups.length > 0) {
    lines.push(...lines_unmatchedGroups);
    lines.push("");
  }

  lines.push(`Criteria applied: ${appliedNotes.length ? appliedNotes.join(" · ") : "none"}`);
  lines.push("");
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

/**
 * The people-finder result is written for the model and carries internal
 * instruction text. When we have to show it to the user directly (the model
 * returned no words), rewrite those markers into plain pastor-facing language.
 */
function humanizeFinderResult(raw: string): string {
  return raw
    .split("\n")
    .map((line) => {
      let l = line;
      l = l.replace(
        /^CRITERIA NOT SUPPORTED[^:]*:\s*/i,
        "I couldn't filter on part of your question: "
      );
      l = l.replace(/^CRITERIA NOT APPLIED FULLY:\s*/i, "");
      l = l.replace(/^CRITERIA NOT APPLIED:\s*/i, "");
      l = l.replace(/^Criteria applied:/i, "**What I used:**");
      // Drop sentences addressed to the model rather than the user.
      l = l.replace(/\s*(Ask the user|Tell the user)[^.]*\.\s*/gi, " ");
      return l.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/**
 * Remove any person the model invented. Only person links whose contact id was
 * actually returned by a tool survive; a list line naming an unknown person is
 * dropped entirely, and stray person links elsewhere become plain text.
 */
function sanitizePeopleMentions(
  text: string,
  allowed: Map<string, string>
): { text: string; removed: number } {
  if (!text) return { text, removed: 0 };
  const linkRe = /\[([^\]\n]+)\]\(\/contacts\/([^)\s]+)\)/g;
  let removed = 0;
  const outLines: string[] = [];

  for (const line of text.split("\n")) {
    const links = [...line.matchAll(linkRe)];
    if (links.length === 0) {
      outLines.push(line);
      continue;
    }
    const badLinks = links.filter((m) => !allowed.has(String(m[2]).toLowerCase()));
    if (badLinks.length === 0) {
      // Keep the link, but always use the real stored name.
      outLines.push(
        line.replace(linkRe, (_all, _name, id) => `[${allowed.get(String(id).toLowerCase())}](/contacts/${id})`)
      );
      continue;
    }
    const isListLine = /^\s*(?:[-*+]|\d+\.)\s/.test(line);
    if (isListLine && badLinks.length === links.length) {
      // A list entry that is entirely about an unknown person - drop it.
      removed += badLinks.length;
      continue;
    }
    removed += badLinks.length;
    // Keep the sentence readable: an unverified link degrades to plain text.
    outLines.push(
      line.replace(linkRe, (all, name, id) =>
        allowed.has(String(id).toLowerCase()) ? all : String(name)
      ).replace(/\s{2,}/g, " ").trimEnd()
    );
  }

  // No trim: the reply is cleaned one streamed chunk at a time, and trimming each chunk
  // would delete the line breaks and spaces between chunks (headings and lists then
  // run into the previous sentence). Callers trim the start and end of the whole reply.
  const cleaned = outLines.join("\n").replace(/\n{3,}/g, "\n\n");
  return { text: cleaned, removed };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const { messages } = body;
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

    if (body.action === "confirm" && typeof body.action_request_id === "string") {
      const result = await executePendingAction(adminClient, userClient, orgId, userId, body.action_request_id);
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: toolSettings } = await adminClient
      .from("ai_tool_settings")
      .select("tool_key, enabled")
      .eq("organization_id", orgId);
    const settingMap = new Map((toolSettings || []).map((row: any) => [row.tool_key, row.enabled]));
    const masterEnabled = settingMap.get("flowleed_ai_tools") ?? true;
    const isEnabled = (key: string) => masterEnabled && (settingMap.get(key) ?? TOOL_DEFAULTS[key] ?? false);
    const tools = TOOL_REGISTRY.filter((tool) => isEnabled(tool.function.name));

    const latestUserText = String(messages[messages.length - 1]?.content || "").trim();
    if (/^(yes|confirm|do it|go ahead|add (him|her|them)|save (it|the note|the prayer request|the task))\W*$/i.test(latestUserText)) {
      for (let i = messages.length - 2; i >= 0; i--) {
        const marker = String(messages[i]?.content || "").match(/<!--flowleed:action=({.*?})-->/);
        if (!marker) continue;
        try {
          const pending = JSON.parse(marker[1]);
          if (["add_people_to_flow", "create_contact_note", "create_prayer_request", "create_task", "update_task", "create_form"].includes(pending?.type) && typeof pending.id === "string") {
            const result = await executePendingAction(adminClient, userClient, orgId, userId, pending.id);
            const encoder = new TextEncoder();
            const response = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result.message } }] })}\n\ndata: [DONE]\n\n`)); controller.close(); } });
            // Always 200: the explanation (expired, already used, tool disabled) is the
            // streamed answer. A 4xx here would make the client discard it and show a bare code.
            return new Response(response, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }
        } catch { /* ignore malformed historical marker */ }
        break;
      }
    }

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
- **search_person**: When the user mentions a person by name, or asks about someone specific, ALWAYS call this tool to get their full profile (demographics, family, tags, engagement, notes, flow moments, groups, etc.)
- PICKING A PERSON: If you just asked "which person?" and the user replies with only a name (or clicks/points to one), they are choosing that person. Call search_person with that name and continue the conversation about them using their profile. Never pass a person's name to find_contacts_by_criteria (group_name is for group titles only).
- **search_people_in_flow**: When the user asks who is in a specific flow or wants details about a flow's people, call this tool.
- **find_contacts_by_criteria**: When the user wants a LIST of people meeting one or more conditions (e.g. "Fairfield women who were in a small group earlier this year but aren't in one now"), call this tool. Map EVERY part of the request to an argument: campus -> campus_name, women/men -> gender, "was in a group earlier this year" -> in_group_between {from: Jan 1 of this year, to: today}, "not in a group now" -> not_in_active_group: true, "Member" -> pc_membership, "served N months" -> serving_min_days = N*30. Set limit to 200 so counts are accurate.
${isEnabled("add_people_to_flow") ? '- **add_people_to_flow**: When the user clearly names one person, one Flow, and one step, prepare the exact action for confirmation. Never say it happened until the structured execution result confirms it.' : '- Adding people to a Flow is disabled. Explain that an organization owner or admin can enable it in FlowLeed AI Tools settings.'}
${isEnabled("create_contact_note") ? '- **create_contact_note**: When the user asks to add or save a note about one person, prepare the exact note for confirmation. Preserve the user’s wording, default to a shared general note unless they request another type or privacy, and never say it was saved until execution confirms it.' : '- Adding profile notes is disabled. Explain that an organization owner or admin can enable it in FlowLeed AI Tools settings.'}
${isEnabled("create_task") ? '- **create_task**: When the user asks to create a task, to-do, or reminder (optionally about one person, optionally with a due date), prepare it for confirmation. Resolve relative dates like "Friday" against today. If the user wants it assigned to another leader ("assign Pastor Marcus to call John"), pass that leader\'s name as assignee_name. Never say it was saved until execution confirms it.' : '- Creating tasks is disabled. Explain that an organization owner or admin can enable it in FlowLeed AI Tools settings.'}
${isEnabled("update_task") ? '- **update_task**: When the user says a task is done ("mark Sandra\'s task done", "I called Rachel") or wants to move/reschedule one ("move Sandra\'s call to Friday"), call this with a keyword or person name to identify the task and either complete=true or a new due_date. If several tasks match, ask which one. Never say it was changed until execution confirms it.' : ''}
- **list_my_tasks**: When the user asks what their tasks, to-dos or reminders are (e.g. "what are my tasks?", "what's on my plate?"), ALWAYS call this tool and list them (overdue first), keeping the person links exactly as returned. Never say you can't see their tasks. Format the answer as a markdown bullet list: one task per line, each line starting with "- ", person name link first, then the task and due date. Never write the tasks as a run-on paragraph. Put any closing question on its own line after the list.
${isEnabled("create_form") ? '- **create_form**: When the user asks for a form or plans an event (sign-up, registration, RSVP, interest, e.g. Men\'s Night), call create_form IMMEDIATELY with sensible defaults instead of asking questions first. Defaults: if they named an existing Flow use flow_name; otherwise leave flow fields empty and a new Flow named after the form (Registered → Confirmed → Attended → Follow-up) is prepared automatically; a warm thank-you email is on by default; only pass emails_decided=true when the user actually stated email preferences. Include obvious questions (name, email, phone, plus event-relevant ones like guests or dietary needs) in request. If the user\'s request or "Yes" covers several things (form, Flow, task), prepare ALL of them in the same turn by calling every relevant tool, so each gets its own Approve button. After the preview, offer one short line saying they can tweak anything (Flow, emails, questions) before approving. Show the returned preview under a "### Form" heading. Never say the form was created until execution confirms it.' : '- Creating forms is disabled. Explain that an organization owner or admin can enable it in FlowLeed AI Tools settings.'}
${isEnabled("create_prayer_request") ? '- **create_prayer_request**: When the user asks to create or save a prayer request for one person, prepare the person, title, and exact request details for confirmation. Never say it was saved until execution confirms it.' : '- Creating prayer requests is disabled. Explain that an organization owner or admin can enable it in FlowLeed AI Tools settings.'}

CRITICAL RULES FOR PEOPLE LISTS (never break these):
1. ALWAYS write a real answer in text. Start by restating the criteria you applied ("Fairfield - women - in a group since Jan 1 - not in a group now"), give the count, then LIST THE PEOPLE as markdown links exactly as returned by the tool.
2. NEVER invent, guess, complete or extend a list of people. Every name and every /contacts/<id> link you write MUST be copied verbatim from a tool result in this conversation. Never add a person because they seem relevant, and never write a name without the id the tool gave you. Fabricated names are removed automatically and make your answer wrong.
3. Your count must equal the number of people you list from the tool result. Never adjust a count by hand.
4. If part of the request can't be filtered (e.g. "don't count the youth group as active"), first try the right argument (exclude_group_names). If the tool reports "CRITERIA NOT SUPPORTED" or "CRITERIA NOT APPLIED", say plainly which part you could NOT filter on and ask how they'd like to narrow it. NEVER compensate by adding or removing people yourself.
5. If a request needs data you have no filter for, ASK a clarifying question instead of answering a different question.
6. Only after the written answer, add one short line like "Want to review these people and add them to a Flow?" - the UI renders a review button automatically.

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
- CRITICAL: NEVER describe more than one person in the same paragraph. Each person gets their own paragraph: start the paragraph with the linked name, then an em dash, then 1-2 sentences about them. Put a blank line between people. Example:

  [Alexa Yarmolatii](/contacts/abc-123) — She shared a prayer request today about being sick.

  [Nick Sevier](/contacts/def-456) — No active prayer requests; a simple check-in would mean a lot.
- When suggesting actions, be specific and actionable.
- Formatting: write plain prose. Reserve bold (**) for section titles ONLY - never put bold inside a paragraph, sentence, or list item. Use a short ### heading for each section title, on its own line, with a blank line before and after it.
- Keep headings the same visual importance as body text. Do not use oversized or title-style headings in an answer.
- Start directly with the answer. Use short, natural paragraphs of 1–3 sentences, separated by one blank line.
- Every section title must be on its own line with a blank line above and below it. ALWAYS start a new paragraph after a title. Never join a heading, title, sentence, or list item to the next text.
- NEVER place a person or flow link directly after a word. Always leave a space first: "household with [Lauchlan Jean](/contacts/def-456)."
- Before finishing, verify there is whitespace after every period and that no words from separate sentences or sections are joined together.
- NEVER put two labeled items in the same paragraph. Each must be its own paragraph with a blank line before it.
- When describing multiple flows, moments, or categories, use this format EXACTLY:

  ### Flow Name

  Description of the flow here.

  ### Another Flow

  Description of another flow here.

  Notice the blank line between each item. ALWAYS follow this pattern.
- After any section title followed by its description, ALWAYS add a blank line before the next section title.
- If asked about something not in the data, say so honestly.
- Keep responses focused and concise — pastors are busy!
- When appropriate, suggest next steps or follow-up actions.
- Use emojis sparingly for warmth (🙏 ❤️ ✅).`;

    // Build the message list for the AI
    // Earlier prepared items are stripped from the visible history (so the model
    // never copies them into its reply) and summarized once in a system note.
    const earlierPrepared: string[] = [];
    const historyMessages = messages.map((m: any) => typeof m?.content === "string" && m.role === "assistant"
      ? { ...m, content: m.content
          .replace(/<!--flowleed:action=(\{.*?\})-->/g, (_x: string, j: string) => {
            try { const a = JSON.parse(j); const s = String(a.summary ?? "").replace(/\s+/g, " ").slice(0, 160); if (s) earlierPrepared.push(s); } catch { /* ignore */ }
            return "";
          })
          .replace(/\[Earlier prepared for confirmation:[^\]]*\]/g, "")
          .replace(/<!--flowleed:[\s\S]*?-->/g, "") }
      : m);
    const aiMessages = [
      { role: "system", content: systemPrompt + "\n\nAction rule: only say something is prepared or ready to confirm when you called the matching tool in THIS turn. Earlier prepared items may have expired; if the user asks again, call the tool again. Never write hidden <!-- --> markers yourself. Never quote or list internal notes about earlier prepared items in your reply.\n\nHARD RULE — never claim completion: NEVER say or imply that anything was created, saved, added, sent, scheduled, updated, or done (e.g. \"I've set up a task\", \"Done\", \"Added\", \"Saved\") unless a structured tool result in THIS conversation explicitly confirms the write succeeded. Preparing an action is NOT completing it. When you prepare an action, say only that it is ready for the user to review and confirm — e.g. \"I've prepared this for you — please confirm below to save it.\" If you did not call a tool, say you have not done it yet and offer to prepare it." +
        (earlierPrepared.length ? `\n\nINTERNAL (do not repeat to the user): earlier in this chat you prepared: ${earlierPrepared.slice(-6).join("; ")}.` : "") },
      ...historyMessages,
    ];

    // Tool call loop: make non-streaming calls until we get a final response, then stream it
    const MAX_TOOL_ROUNDS = 5;
    let toolRound = 0;
    // Plain-language activity log shown behind the (i) button on each answer.
    const turnStart = Date.now();
    const trace: { label: string; detail?: string; ms: number; status: "ok" | "error" }[] = [];
    const traceLabel = (fn: string, a: any): string => {
      switch (fn) {
        case "search_person": return a?.query ? `Looked up ${a.query}` : "Looked up a person";
        case "search_people_in_flow": return a?.flow_name ? `Checked people in ${a.flow_name}` : "Checked people in a Flow";
        case "find_contacts_by_criteria": return "Searched people matching your request";
        case "add_people_to_flow": return "Prepared adding someone to a Flow";
        case "create_contact_note": return "Prepared a private note";
        case "list_my_tasks": return "Read your tasks";
        case "create_task": return "Prepared a reminder";
        case "create_form": return "Asked the Form Builder to design a form";
        case "update_task": return "Prepared a task update";
        case "create_prayer_request": return "Prepared a prayer request";
        default: return `Used ${fn.replace(/_/g, " ")}`;
      }
    };
    let collectedContactIds: string[] | null = null;
    let lastFinderResult: string | null = null;
    let pendingActionMarkers: string[] = [];
    let pendingActionMarker: string | null = null;
    // Every person id/name the tools actually returned. Anything else the model
    // writes is a fabrication and gets stripped before the user sees it.
    const allowedPeople = new Map<string, string>();
    const registerPeople = (toolResult: string) => {
      const re = /\[([^\]\n]+)\]\(\/contacts\/([0-9a-fA-F-]{36})\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(toolResult)) !== null) allowedPeople.set(m[2].toLowerCase(), m[1]);
    };

    // People named earlier in this conversation stay valid, but only after the
    // ids are re-checked against this organization's contacts (history comes
    // from the browser and cannot be trusted on its own).
    try {
      const historyIds = new Set<string>();
      const histRe = /\[([^\]\n]+)\]\(\/contacts\/([0-9a-fA-F-]{36})\)/g;
      for (const msg of messages as Array<{ role?: string; content?: string }>) {
        if (msg?.role !== "assistant" || typeof msg.content !== "string") continue;
        let m: RegExpExecArray | null;
        while ((m = histRe.exec(msg.content)) !== null) historyIds.add(m[2].toLowerCase());
      }
      if (historyIds.size > 0) {
        const ids = [...historyIds].slice(0, 500);
        const { data: knownContacts } = await adminClient
          .from("contacts")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", ids);
        for (const c of knownContacts || []) {
          allowedPeople.set(String(c.id).toLowerCase(), String(c.name));
        }
      }
    } catch (historyError) {
      console.error("[chat] could not verify people from history:", historyError);
    }




    let lastDirectAnswer = "";
    let lastToolResult = "";
    while (toolRound < MAX_TOOL_ROUNDS) {
      // Make a non-streaming call to check for tool calls
      const roundStart = Date.now();
      let toolCheckData: GlooChatCompletion;
      try {
        toolCheckData = await glooChat({
          messages: aiMessages,
          tools,
          tool_choice: "auto",
        });
      } catch (error) {
        const status = glooErrorStatus(error);
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
        console.error("AI Gateway error:", status, error);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const choice = toolCheckData.choices[0];
      trace.push({ label: toolRound === 0 ? "Read your question" : "Reviewed what it found", ms: Date.now() - roundStart, status: "ok" });

      if (!choice) {
        return new Response(JSON.stringify({ error: "No AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = glooToolCalls(toolCheckData);

      if (toolCalls.length === 0) {
        if (typeof choice.message?.content === "string") lastDirectAnswer = choice.message.content;
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
        const toolStart = Date.now();
        try {
          if (fnName === "search_person") {
            result = await executeSearchPerson(adminClient, orgId, args.query || "", team);
          } else if (fnName === "search_people_in_flow") {
            result = await executeSearchPeopleInFlow(adminClient, orgId, args.flow_name || "", team);
          } else if (fnName === "find_contacts_by_criteria") {
            result = await executeFindContactsByCriteria(adminClient, orgId, args);
            lastFinderResult = result.replace(/<!--flowleed:contact_ids=\[[^\]]*\]-->/g, "").trim();
            // Extract contact ids from the marker so we can append it after the model's stream
            const m = result.match(/<!--flowleed:contact_ids=(\[[^\]]*\])-->/);
            if (m) {
              try {
                const ids = JSON.parse(m[1]);
                if (Array.isArray(ids) && ids.length > 0) collectedContactIds = ids;
              } catch { /* ignore */ }
            }
          } else if (fnName === "add_people_to_flow") {
            result = await prepareAddToFlow(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else if (fnName === "create_contact_note") {
            result = await prepareContactNote(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else if (fnName === "list_my_tasks") {
            result = await executeListMyTasks(adminClient, orgId, userId, args);
          } else if (fnName === "create_task") {
            result = await prepareTask(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else if (fnName === "update_task") {
            result = await prepareUpdateTask(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else if (fnName === "create_form") {
            result = await prepareForm(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else if (fnName === "create_prayer_request") {
            result = await preparePrayerRequest(adminClient, orgId, userId, args);
            { const mk = result.match(/<!--flowleed:action=({.*?})-->/)?.[0] || null; if (mk) { pendingActionMarkers.push(mk); pendingActionMarker = mk; } }
          } else {
            result = `Unknown tool: ${fnName}`;
          }
        } catch (e) {
          console.error(`Tool ${fnName} error:`, e);
          result = `Error executing ${fnName}: ${e instanceof Error ? e.message : "Unknown error"}`;
        }
        {
          const failed = /^(Error executing|Unknown tool)/.test(result);
          const firstLine = result.replace(/<!--[\s\S]*?-->/g, "")
            .split("\n").map((l) => l.replace(/[#*_`>]/g, "").trim())
            .find((l) => l && !/^(INSTRUCTION|NOTE|IMPORTANT|SYSTEM)\b/i.test(l)) ?? "";
          trace.push({
            label: traceLabel(fnName, args),
            detail: firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine || undefined,
            ms: Date.now() - toolStart,
            status: failed ? "error" : "ok",
          });
        }

        registerPeople(result);
        lastToolResult = result;


        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      toolRound++;
    }

    // Final streaming response (with tool results in context but no tools offered)
    const streamStart = Date.now();
    let upstream: ReadableStream<Uint8Array>;
    try {
      upstream = await glooChatStream({ messages: aiMessages });
    } catch (error) {
      const status = glooErrorStatus(error);
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
      console.error("AI Gateway stream error:", status, error);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the model's answer as it arrives, sanitizing each completed segment so
    // invented people are still stripped without holding back the whole reply.
    const injected = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const send = (content: string) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
          );
        };

        let removedTotal = 0;
        let sentAnything = false;
        const clean = (chunk: string) => {
          const { text: safe0, removed } = sanitizePeopleMentions(chunk, allowedPeople);
          // Markers are appended by the server; never let the model echo them
          // (or the internal history notes about earlier prepared items).
          const safe = safe0
            .replace(/<!--flowleed:[\s\S]*?-->/g, "")
            .replace(/\[?Earlier prepared[^\]\n]*\]?/gi, "");
          removedTotal += removed;
          // Deterministic guard: the model must never claim it saved anything.
          // Writes only happen when the leader taps Approve, so any completion
          // claim is false. Rewrite it to honest wording.
          const claimRe = /\b(?:I(?:'ve| have| just)?|we(?:'ve| have)?)\s+(?:already\s+|now\s+|just\s+|gone ahead and\s+)?(?:added|created|saved|set up|setup|scheduled|written(?: down)?|wrote(?: down)?|noted|logged|recorded|made|put|sent|updated|assigned|completed|marked|booked|jotted(?: down)?)\b[^.!?\n]*[.!?]?/gi;
          const doneRe = /\b(?:Done|All set|Reminder (?:added|set|created|saved)|Task (?:added|created|saved))\b[!.]?/g;
          let out = safe;
          if (claimRe.test(out) || doneRe.test(out)) {
            claimRewrites++;
            const replacement = pendingActionMarker
              ? "I've prepared this for you — please review and tap Approve below to save it."
              : "I haven't saved anything yet. Just say \"create the reminder\" and I'll prepare it for you to approve.";
            out = out.replace(claimRe, replacement).replace(doneRe, "");
          }
          return out;
        };
        let claimRewrites = 0;

        let raw = "";
        let pending = "";
        let fullText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = raw.indexOf("\n")) !== -1) {
              const line = raw.slice(0, nl).trim();
              raw = raw.slice(nl + 1);
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const c = parsed.choices?.[0]?.delta?.content;
                if (typeof c === "string") {
                  pending += c;
                  fullText += c;
                }
              } catch { /* ignore partial */ }
            }

            // Flush only up to the last safe boundary so links and sentences stay whole.
            const boundary = Math.max(pending.lastIndexOf("\n"), pending.lastIndexOf(". "));
            if (boundary > 0) {
              const chunk = pending.slice(0, boundary + 1);
              pending = pending.slice(boundary + 1);
              const safeChunk = clean(chunk);
              if (safeChunk) {
                const toSend = sentAnything ? safeChunk : safeChunk.replace(/^\s+/, "");
                if (toSend) {
                  send(toSend);
                  sentAnything = true;
                }
              }
            }
          }
        } catch (e) {
          controller.error(e);
          return;
        }

        const tail = clean(pending).trimEnd();
        if (tail) {
          const toSend = sentAnything ? tail : tail.replace(/^\s+/, "");
          if (toSend) {
            send(toSend);
            sentAnything = true;
          }
        }

        // The model sometimes returns no words after a tool call. Never leave the
        // user with a bare action button - show the finder's own answer, rewritten
        // into plain language (the raw tool text contains internal instructions).
        if (!fullText.trim() && !sentAnything && lastFinderResult) {
          const fallback = clean(humanizeFinderResult(lastFinderResult)).trim();
          if (fallback) { send(fallback); sentAnything = true; }
        }
        // Never end with silence: fall back to the model's earlier answer, the
        // last tool's plain message, or a short honest note.
        if (!sentAnything) {
          const toolText = lastToolResult
            .replace(/<!--[\s\S]*?-->/g, "")
            .split("\n").filter((l) => !/^(INSTRUCTION|NOTE|IMPORTANT|SYSTEM)\b/i.test(l.trim())).join("\n").trim();
          const fb = clean(lastDirectAnswer).trim()
            || (pendingActionMarker ? "Here's what I prepared. Please review it and confirm below." : "")
            || (toolText && toolText.length < 600 ? toolText : "")
            || "Sorry, I couldn't put together an answer for that. Could you say it another way, or tell me the person's full name?";
          send(fb);
          sentAnything = true;
        }

        if (removedTotal > 0) {
          console.log(`[chat] stripped ${removedTotal} unverified person link(s) from the answer`);
        }
        // The bulk "Review people" button is only for list requests; when this turn
        // prepared a one-person action (task, note, prayer), show just that action.
        if (collectedContactIds && collectedContactIds.length > 0 && pendingActionMarkers.length === 0) {
          send(`\n\n<!--flowleed:contact_ids=${JSON.stringify(collectedContactIds)}-->`);
        }
        if (pendingActionMarkers.length) send(`\n\n${pendingActionMarkers.join("")}`);
        trace.push({ label: "Wrote the answer", ms: Date.now() - streamStart, status: "ok" });
        if (claimRewrites > 0) trace.push({ label: "Corrected a false \"saved\" claim", detail: pendingActionMarker ? "Nothing is saved until you tap Approve" : "No reminder or task was actually prepared", ms: 0, status: "error" });
        if (removedTotal > 0) trace.push({ label: "Removed unverified names", detail: `${removedTotal} name(s) not found in your records were left out`, ms: 0, status: "ok" });
        const traceJson = JSON.stringify({ total_ms: Date.now() - turnStart, steps: trace }).replace(/--/g, "\\u002d\\u002d");
        send(`\n\n<!--flowleed:trace=${traceJson}-->`);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
