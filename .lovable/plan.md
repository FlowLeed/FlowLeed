## Add optional Step description

Add an optional `description` field to flow steps (stages), editable in the Flow Settings dialog and persisted to the database.

### Scope

- Add `description text` column to `public.pipeline_stages` (nullable).
- In **FlowSettingsDialog** (`src/components/crm/FlowSettingsDialog.tsx`):
  - Extend the local `flowSteps` state type with `description?: string | null`.
  - Add a small `Textarea` (or compact `Input`) under each step row labeled "Description (optional)" — placed below the existing name/color/start/end controls.
  - Include `description` in both the insert and update branches of the save loop.
  - Pass `description` through `initialFlowStages` from the parent so existing values prefill on open.
- In **FlowContext** (`src/contexts/FlowContext.tsx`) and any stage-fetching hooks, include the new `description` column on stages so it flows into the settings dialog.

### Out of scope (not changing)

- No display of the description on the kanban/table views, AI prompts, or analytics — this iteration only adds the field and its editor.
- No required validation; field is fully optional and nullable.

### Technical notes

- Migration: `ALTER TABLE public.pipeline_stages ADD COLUMN description text;` — no GRANT changes needed (existing grants cover new column).
- Types in `src/integrations/supabase/types.ts` regenerate automatically after the migration runs.
- The `flowStages` prop type on FlowSettingsDialog (and the analogous shape in `FlowView.tsx` line ~655 where stages are passed in) needs `description?: string | null` added.

### Open question

Should the step description also be shown anywhere user-facing (e.g. as a tooltip on the kanban column header or as helper text on the stage in the Add-to-Flow dialog), or only stored for now and surfaced later? Default: store only, no display, until you ask for it.
