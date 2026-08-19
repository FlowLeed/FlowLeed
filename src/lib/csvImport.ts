// CSV import helpers: field catalog, header auto-detection, and value normalization.

export type ImportFieldKey =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "birthday"
  | "gender"
  | "marital_status"
  | "occupation"
  | "tags"
  | "campus"
  | "assigned_email"
  | "note";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  group: "Name & contact" | "Address" | "Profile" | "Organize";
  hint?: string;
  aliases: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "first_name", label: "First name", group: "Name & contact", aliases: ["first name", "firstname", "first", "given name", "fname"] },
  { key: "last_name", label: "Last name", group: "Name & contact", aliases: ["last name", "lastname", "last", "surname", "family name", "lname"] },
  { key: "full_name", label: "Full name", group: "Name & contact", hint: "Split into first/last automatically", aliases: ["full name", "name", "fullname", "person", "contact name"] },
  { key: "email", label: "Email", group: "Name & contact", aliases: ["email", "email address", "e-mail", "mail", "primary email"] },
  { key: "phone", label: "Phone", group: "Name & contact", aliases: ["phone", "phone number", "mobile", "cell", "cell phone", "mobile number", "telephone", "tel"] },
  { key: "street", label: "Street address", group: "Address", aliases: ["street", "address", "street address", "address line 1", "address1"] },
  { key: "city", label: "City", group: "Address", aliases: ["city", "town"] },
  { key: "state", label: "State", group: "Address", aliases: ["state", "province", "region", "st"] },
  { key: "zip", label: "ZIP / Postal code", group: "Address", aliases: ["zip", "zip code", "zipcode", "postal code", "postcode"] },
  { key: "country", label: "Country", group: "Address", aliases: ["country"] },
  { key: "birthday", label: "Birthday", group: "Profile", aliases: ["birthday", "birth date", "birthdate", "dob", "date of birth"] },
  { key: "gender", label: "Gender", group: "Profile", aliases: ["gender", "sex"] },
  { key: "marital_status", label: "Marital status", group: "Profile", aliases: ["marital status", "marital", "married"] },
  { key: "occupation", label: "Occupation", group: "Profile", aliases: ["occupation", "job", "job title", "profession", "employer"] },
  { key: "tags", label: "Tags", group: "Organize", hint: "Comma-separated inside the cell", aliases: ["tags", "tag", "labels", "groups"] },
  { key: "campus", label: "Campus", group: "Organize", hint: "Matched by name", aliases: ["campus", "location", "site"] },
  { key: "assigned_email", label: "Assigned staff (email)", group: "Organize", hint: "Matched to a team member by email", aliases: ["assigned to", "assigned", "owner", "staff", "assigned email", "follow up by"] },
  { key: "note", label: "Note", group: "Organize", aliases: ["note", "notes", "comment", "comments", "prayer request", "message"] },
];

export const IMPORT_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  IMPORT_FIELDS.map((f) => [f.key, f.label]),
);

export const IGNORE_FIELD = "__ignore__";

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

/** Guess a field for each CSV header. Each field is used at most once. */
export const autoDetectMapping = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  const tryAssign = (header: string, key: ImportFieldKey) => {
    if (used.has(key)) return false;
    mapping[header] = key;
    used.add(key);
    return true;
  };

  // exact alias match first, then partial
  for (const pass of ["exact", "partial"] as const) {
    for (const header of headers) {
      if (mapping[header]) continue;
      const h = norm(header);
      if (!h) continue;
      const match = IMPORT_FIELDS.find((f) =>
        pass === "exact"
          ? f.aliases.includes(h)
          : f.aliases.some((a) => h.includes(a) || a.includes(h)),
      );
      if (match) tryAssign(header, match.key);
    }
  }

  // If we mapped a full name AND first/last, prefer first/last
  if (used.has("first_name") && used.has("full_name")) {
    for (const [header, key] of Object.entries(mapping)) {
      if (key === "full_name") delete mapping[header];
    }
  }

  for (const header of headers) {
    if (!mapping[header]) mapping[header] = IGNORE_FIELD;
  }
  return mapping;
};

export const normalizePhone = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7) return null;
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return digits;
};

export const phoneKey = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};

export const normalizeEmail = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  return v ? v : null;
};

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/** Parse many common date formats into YYYY-MM-DD, or null. */
export const normalizeDate = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = Number(year) > 30 ? `19${year}` : `20${year}`;
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

export const splitName = (full: string): { first: string; last: string } => {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
};

export const parseTags = (raw: string | undefined | null): string[] => {
  if (!raw) return [];
  return String(raw)
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
};

export interface MappedRow {
  rowNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  birthday?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  tags: string[];
  campus?: string | null;
  assigned_email?: string | null;
  note?: string | null;
}

export interface RowProblem {
  rowNumber: number;
  reason: string;
  raw: Record<string, string>;
}

/** Turn raw CSV records + mapping into normalized rows, collecting problems. */
export const buildRows = (
  records: Record<string, string>[],
  mapping: Record<string, string>,
): { rows: MappedRow[]; problems: RowProblem[] } => {
  const rows: MappedRow[] = [];
  const problems: RowProblem[] = [];

  const headerFor = (key: ImportFieldKey) =>
    Object.keys(mapping).find((h) => mapping[h] === key);

  const h = {
    first: headerFor("first_name"),
    last: headerFor("last_name"),
    full: headerFor("full_name"),
    email: headerFor("email"),
    phone: headerFor("phone"),
    street: headerFor("street"),
    city: headerFor("city"),
    state: headerFor("state"),
    zip: headerFor("zip"),
    country: headerFor("country"),
    birthday: headerFor("birthday"),
    gender: headerFor("gender"),
    marital: headerFor("marital_status"),
    occupation: headerFor("occupation"),
    tags: headerFor("tags"),
    campus: headerFor("campus"),
    assigned: headerFor("assigned_email"),
    note: headerFor("note"),
  };

  const get = (rec: Record<string, string>, header?: string) =>
    header ? (rec[header] ?? "").toString().trim() : "";

  records.forEach((rec, i) => {
    const rowNumber = i + 2; // +1 for header row, +1 for 1-based
    const hasAnyValue = Object.values(rec).some((v) => String(v ?? "").trim() !== "");
    if (!hasAnyValue) return; // silently skip blank lines

    let first = get(rec, h.first);
    let last = get(rec, h.last);
    if (!first && !last && h.full) {
      const split = splitName(get(rec, h.full));
      first = split.first;
      last = split.last;
    }
    const name = [first, last].filter(Boolean).join(" ").trim();

    const rawEmail = get(rec, h.email);
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(get(rec, h.phone));

    if (!name) {
      problems.push({ rowNumber, reason: "No name found", raw: rec });
      return;
    }
    if (email && !isValidEmail(email)) {
      problems.push({ rowNumber, reason: `Invalid email "${rawEmail}"`, raw: rec });
      return;
    }
    if (!email && !phone) {
      problems.push({ rowNumber, reason: "No email or phone — can't match or contact this person", raw: rec });
      return;
    }

    rows.push({
      rowNumber,
      name,
      email,
      phone,
      street: get(rec, h.street) || null,
      city: get(rec, h.city) || null,
      state: get(rec, h.state) || null,
      zip: get(rec, h.zip) || null,
      country: get(rec, h.country) || null,
      birthday: normalizeDate(get(rec, h.birthday)),
      gender: get(rec, h.gender) || null,
      marital_status: get(rec, h.marital) || null,
      occupation: get(rec, h.occupation) || null,
      tags: parseTags(get(rec, h.tags)),
      campus: get(rec, h.campus) || null,
      assigned_email: normalizeEmail(get(rec, h.assigned)),
      note: get(rec, h.note) || null,
    });
  });

  // De-duplicate inside the file itself (email first, then phone)
  const seen = new Map<string, MappedRow>();
  const deduped: MappedRow[] = [];
  for (const row of rows) {
    const key = row.email ? `e:${row.email}` : `p:${phoneKey(row.phone)}`;
    const existing = seen.get(key);
    if (existing) {
      // merge: fill blanks from the later row, keep first row's identity
      for (const k of Object.keys(row) as (keyof MappedRow)[]) {
        if (k === "rowNumber" || k === "tags") continue;
        if (!existing[k] && row[k]) (existing as any)[k] = row[k];
      }
      existing.tags = Array.from(new Set([...existing.tags, ...row.tags]));
      continue;
    }
    seen.set(key, row);
    deduped.push(row);
  }

  return { rows: deduped, problems };
};

export const buildImportTag = (date = new Date()) => `csv-${date.toISOString().slice(0, 10)}`;

export const SAMPLE_CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Street Address",
  "City",
  "State",
  "Zip",
  "Birthday",
  "Gender",
  "Marital Status",
  "Campus",
  "Tags",
  "Assigned To",
  "Notes",
];

export const SAMPLE_CSV_ROWS = [
  [
    "Jordan",
    "Reyes",
    "jordan.reyes@example.com",
    "(555) 201-8890",
    "418 Oak St",
    "Riverside",
    "CA",
    "92501",
    "1990-04-12",
    "Male",
    "Married",
    "Main Campus",
    "easter guest, first time",
    "pastor@yourchurch.com",
    "Filled out a guest card at Easter",
  ],
  [
    "Avery",
    "Nguyen",
    "avery.nguyen@example.com",
    "555-330-1177",
    "22 Pine Ave",
    "Riverside",
    "CA",
    "92503",
    "03/22/1988",
    "Female",
    "Single",
    "Main Campus",
    "volunteer interest",
    "",
    "Wants to serve on the kids team",
  ],
];
