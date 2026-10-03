export type AiToolSafety = "read" | "prepare" | "act";

export type AiToolDefinition = {
  key: string;
  label: string;
  description: string;
  safety: AiToolSafety;
  defaultEnabled: boolean;
  confirmation: string;
};

export const AI_MASTER_TOOL_KEY = "flowleed_ai_tools";

export const AI_TOOLS: AiToolDefinition[] = [
  { key: "search_person", label: "Look up a person", description: "Review a person's profile, journey, household, and recent activity.", safety: "read", defaultEnabled: true, confirmation: "Runs immediately" },
  { key: "search_people_in_flow", label: "List people in a Flow", description: "See who is in a Flow and their current step.", safety: "read", defaultEnabled: true, confirmation: "Runs immediately" },
  { key: "find_contacts_by_criteria", label: "Find people by criteria", description: "Build an organization-scoped list using campus, group, attendance, serving, and other filters.", safety: "read", defaultEnabled: true, confirmation: "Runs immediately" },
  { key: "add_people_to_flow", label: "Add people to a Flow", description: "Prepare and complete a verified Flow placement.", safety: "act", defaultEnabled: false, confirmation: "Always asks for confirmation" },
  { key: "create_contact_note", label: "Add a note to a person", description: "Add a reviewed note to a verified person's profile.", safety: "act", defaultEnabled: false, confirmation: "Always asks for confirmation" },
  { key: "create_prayer_request", label: "Create a prayer request", description: "Add a reviewed prayer request to a verified person's profile.", safety: "act", defaultEnabled: false, confirmation: "Always asks for confirmation" },
  { key: "create_task", label: "Create a task", description: "Add a reviewed task to your Tasks list or another leader's, optionally about one person.", safety: "act", defaultEnabled: true, confirmation: "Always asks for confirmation" },
  { key: "update_task", label: "Complete or reschedule a task", description: "Mark one of your open tasks done or move it to a new date.", safety: "act", defaultEnabled: true, confirmation: "Always asks for confirmation" },
];

export const AI_TOOL_GROUPS: Array<{ safety: AiToolSafety; label: string; description: string }> = [
  { safety: "read", label: "Read", description: "Helps FlowLeed understand your church data. These tools never change records." },
  { safety: "prepare", label: "Prepare", description: "Creates drafts for a person to review before anything is used." },
  { safety: "act", label: "Act", description: "Changes records only after showing the exact change and receiving confirmation." },
];