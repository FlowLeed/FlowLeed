
# Bulk add existing contacts to the current Flow

Add a "Pick from contacts" multi-select dialog that lets you add many existing contacts to the flow you're viewing, in one go.

## Entry point

Convert the current `+` button on the Flow header into a small split button:

```text
[ + Add People ▾ ]
   ├─ Add one person…       (today's single-contact form)
   └─ Pick from contacts…   (NEW — opens the bulk dialog)
```

Single-person flow stays unchanged, so nothing regresses.

## The "Pick from contacts" dialog

A two-pane dialog:

**Left — contact picker**
- Search box (name / email / phone), debounced.
- Quick filters: campus, tag, assigned-to.
- Virtualized list of org contacts with checkboxes.
- Each row shows avatar, name, email, and a small grey "Already in flow" pill for contacts that are already in this flow — those rows are disabled and uncheckable.
- "Select all visible" / "Clear" controls.
- Footer: "X selected".

**Right — destination panel**
- **Stage picker** — defaults to the flow's first stage (`flow.stages[0]`). Shows the stage color swatch.
- **Assignee picker** — defaults to "Use stage's default assignee" (resolved per-contact from `pipeline_stages.default_assignee_user_id`). User can override to "Unassigned" or any flow team member; that override applies to all selected contacts.
- Primary button: **Add N people**.

## Add behavior

On submit:

1. Resolve the chosen stage and (if not overridden) its `default_assignee_user_id`.
2. Query existing `pipeline_contacts` for `(pipeline_id = flow.id, contact_id IN selected)` to find dupes.
3. Bulk insert only the non-duplicate rows into `pipeline_contacts` with `source_type: 'manual'`, `stage_order: 0`, and `assigned_to_user_id` (override OR stage default OR null).
4. Toast result: `"Added 14 people · Skipped 3 already in flow"` (singular/plural handled). If 0 added and >0 skipped: `"All selected people are already in this flow"`.
5. Invalidate `['flows']` and the flow detail query so the kanban/table re-renders.
6. Close the dialog.

No DB schema changes needed. Optionally we add a unique partial index on `pipeline_contacts(pipeline_id, contact_id)` later — out of scope here.

## Files to add / change

**New**
- `src/components/crm/add-people/AddPeopleMenu.tsx` — split-button + dropdown.
- `src/components/crm/add-people/AddFromContactsDialog.tsx` — the picker dialog.
- `src/components/crm/add-people/ContactMultiSelectList.tsx` — searchable virtualized list with "Already in flow" disabling.

**Changed**
- `src/components/crm/FlowView.tsx` — replace the header's `onAddClick` wiring with `AddPeopleMenu`; pass `flow`, `teamMembers`, and existing-contact-IDs (derivable from `flow.stages.flatMap(...)`) into it.
- `src/hooks/useBulkActions.tsx` — add `bulkAddExistingContactsToFlow(contactIds, stageId, assigneeOverride?)` that performs the dedup query + insert and returns `{ added, skipped }`.

## Technical notes

- Dedup is done client-side by comparing against `flow.stages.flatMap(s => s.contacts.map(c => c.id))` for instant UI feedback, then re-checked server-side at insert time so we're safe against stale state.
- Per-contact assignee resolution when "Use stage default" is selected: insert all rows with `assigned_to_user_id = stage.default_assignee_user_id` (it's a single value per stage, so one insert payload works).
- Contacts query uses the existing `useContacts`-style pattern (pageless, capped at e.g. 500 with server-side search) to avoid the 1000-row Supabase ceiling on big orgs.
- Terminology stays on-brand: "Flow", and the dialog title says "Add people to {flowName}".

## Out of scope (kept for later)

- Tag-based bulk add, paste-a-list, CSV import, add-from-group — separate menu items we can add in follow-ups.
