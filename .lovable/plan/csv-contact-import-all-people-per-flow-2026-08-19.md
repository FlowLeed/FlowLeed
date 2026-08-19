# CSV Contact Import (all people + per-flow)

Bring people into FlowLeed from a spreadsheet, with column mapping, a preview of what will happen, and safe handling of people already synced from Planning Center.

## Where it lives

1. **Contacts page → "Import CSV"** (next to the existing add/export actions): imports into the org's people, optionally enrolling everyone into a flow at the end.
2. **Inside a Flow → "Import CSV"**: same wizard, but the flow is pre-selected and locked, and you pick one stage for the whole file.

Both open the same 4-step wizard, so there's one thing to learn.

## The wizard

**Step 1 — Upload**
Drag & drop or pick a `.csv` file (also accept `.tsv`). Show file name, detected delimiter, row count, and the first few rows. A "Download sample template" link gives a correctly-headed starter file. Cap at 10,000 rows per file with a clear message if larger.

**Step 2 — Map columns**
Each CSV column gets a dropdown to a FlowLeed field, with smart auto-guessing from the header text ("Email Address" → Email, "Cell" → Phone, "DOB" → Birthday). Unmapped columns are simply ignored, and shown as ignored so nothing is silently dropped.

Mappable fields:
- First name, Last name (or a single Full name column, split automatically)
- Email, Phone (phone normalized to digits, US formatting tolerated)
- Street, City, State, ZIP, Country
- Birthday, Gender, Marital status
- Tags (comma-separated inside the cell)
- Campus (matched by name to an existing campus)
- Assigned staff member (matched by email to a team member in the org)
- Note (imported as a note on the person, stamped "Imported from CSV — <file name>")

**Step 3 — Options & preview**
- Flow to enroll into (pre-filled and locked when launched from a flow) + one stage for the whole file.
- Tag every imported person with an import tag, on by default (e.g. `csv-2026-08-18`) so the batch is findable and undoable later.
- Duplicate handling defaults to **update the existing person**, matched by email first, then phone. The preview shows three counts before you commit: *new people*, *existing people to update*, *rows with problems*.
- Rows with problems (no name, invalid email, unmatched campus) are listed with row numbers and the reason, and can be skipped individually. Nothing is written until you press Import.

**Step 4 — Result**
Progress bar while it runs, then a summary: created / updated / enrolled / skipped, a link to view the imported batch (filtered by the import tag), and a downloadable error CSV of the failed rows so they can be fixed and re-uploaded.

## Rules the import always follows

- **Planning Center people are protected.** If a match is already synced from PCO, the import never overwrites their name, email, phone, or profile fields — it only adds tags, notes, flow enrollment, and assignment. The preview labels these rows "PCO-managed — will enroll only".
- **Non-PCO matches are updated**, filling blanks and refreshing changed values.
- **Empty CSV cells never erase existing data.**
- Everything is scoped to the current organization, and enrollment respects existing flow team permissions.
- Re-running the same file is safe (idempotent): matched people are updated, not duplicated.

## Extra ideas worth including

- **Import history**: a small list of past imports (file name, who ran it, counts, date) with an **Undo import** action that removes people created by that batch and un-enrolls them — the safety net that makes people willing to try imports at all.
- **Duplicate detection inside the file itself** (same email twice in one CSV) merged before writing.
- **Household grouping** (optional, later): rows sharing an address get linked as a household, matching how PCO households already behave.
- **Saved mappings per organization**: remember the mapping for a given set of headers so a recurring weekly export maps itself next time.
- **Use cases this covers**: Easter/Christmas guest card batches, a conference or event registration export, migrating from another ChMS or a legacy spreadsheet, a volunteer interest list dropped straight into the Volunteer flow, a texting list from a kiosk, and re-importing a corrected error file.

## Technical notes

- New table `contact_imports` (organization_id, created_by, file_name, mapping JSON, options JSON, status, counts, error rows) plus `contact_import_rows` for per-row outcome tracking and undo. Both RLS-scoped to org members with GRANTs.
- Parsing happens in the browser (Papa Parse) for preview speed; the commit runs through a new `contacts-csv-import` edge function in batches of ~200 rows with service-role access, so 10k-row files don't hit statement or RLS limits.
- Writes touch `contacts`, `contact_addresses`, `contact_demographics`, `contact_tags`, `contact_notes`, and `pipeline_contacts` (with `source_type: 'csv_import'`, `source_id` = import id).
- Matching: normalize email lowercase and phone to digits; skip field overwrites when `pc_person_id` is present.
- Frontend: shared `ImportContactsDialog` used by both `ContactsPage` and the flow view, so the two entry points stay identical.
