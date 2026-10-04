// Form Builder specialist agent. The main FlowLeed AI hands off a natural-language
// request; this focused agent designs a form blueprint. It never writes to the database.

export const FORM_FIELD_TYPES = ["text", "textarea", "email", "phone", "number", "date", "select", "radio", "checkbox"] as const;
type FieldType = typeof FORM_FIELD_TYPES[number];

export interface FormBlueprintField {
  field_key: string; label: string; field_type: FieldType; required: boolean;
  options: string[] | null; placeholder: string | null; help_text: string | null;
}
export interface FormBlueprint {
  name: string; description: string | null; success_message: string; fields: FormBlueprintField[];
}

const SYSTEM = `You are the FlowLeed Form Builder, a specialist that designs simple, welcoming church sign-up and response forms.
Return ONLY a JSON object: {"name": string, "description": string, "success_message": string, "fields": [{"label": string, "field_type": one of ${FORM_FIELD_TYPES.join("|")}, "required": boolean, "options": string[] (only for select/radio/checkbox), "placeholder": string, "help_text": string}]}.
Rules:
- Always start with "First name" (text, required), "Last name" (text, required), "Email" (email, required) unless the user clearly says otherwise. Add "Phone" (phone, optional) when contact follow-up is likely.
- Include every field the user asked for, in their order, after the contact fields. Keep labels short and friendly.
- Use select for single choice with 4+ options, radio for 2-3 options, checkbox for multi-select or yes/no consent.
- Keep forms short: at most 15 fields. Don't invent sensitive fields (SSN, medical, finances).
- Description: one warm sentence. Success message: one warm sentence thanking them.`;

const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";

export function validateBlueprint(raw: any): FormBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 120);
  if (!name) return null;
  const used = new Set<string>();
  const fields: FormBlueprintField[] = [];
  for (const f of Array.isArray(raw.fields) ? raw.fields.slice(0, 15) : []) {
    const label = String(f?.label || "").trim().slice(0, 120);
    if (!label) continue;
    const type = (FORM_FIELD_TYPES as readonly string[]).includes(f?.field_type) ? f.field_type as FieldType : "text";
    let options: string[] | null = null;
    if (["select", "radio", "checkbox"].includes(type)) {
      options = (Array.isArray(f.options) ? f.options : []).map((o: unknown) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 20);
      if (!options.length && type !== "checkbox") continue;
      if (!options.length) options = null;
    }
    let key = slugKey(label); let n = 2;
    while (used.has(key)) key = `${slugKey(label)}_${n++}`;
    used.add(key);
    fields.push({ field_key: key, label, field_type: type, required: f?.required === true, options,
      placeholder: f?.placeholder ? String(f.placeholder).slice(0, 120) : null,
      help_text: f?.help_text ? String(f.help_text).slice(0, 300) : null });
  }
  if (!fields.length) return null;
  return {
    name,
    description: raw.description ? String(raw.description).trim().slice(0, 500) : null,
    success_message: String(raw.success_message || "Thanks! We'll be in touch soon.").trim().slice(0, 300),
    fields,
  };
}

export async function designForm(request: string): Promise<FormBlueprint | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: request.slice(0, 4000) }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Form agent ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "");
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try { return validateBlueprint(JSON.parse(json)); } catch { return null; }
}
