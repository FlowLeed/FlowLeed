# Full logic editing for built-in signals

Right now editing a built-in signal only lets you rename it, reword it, tweak its numbers, or turn it off. The rule itself ("has a check-in in the last N days") is fixed. Custom signals, by contrast, have the full condition builder: pick a source, an operator, a value, combine with ALL/ANY.

This makes the built-in editor offer that same builder.

## What the user gets

In the Edit signal dialog for a built-in signal there are two tabs:

- **Basics** — what exists today: track on/off, name, explanation, and the timing numbers.
- **Logic** — the same rule builder as New custom signal: Trigger when ALL/ANY match, Add condition, source + operator + value rows, remove rows. Plus polarity and severity.

The Logic tab starts pre-filled with the closest match to the built-in's current rule (for example "Attended Sunday recently" opens as *Days since last service is at most 14*), so a church can adjust one number or rebuild the rule entirely.

Saving on the Logic tab does two things: it creates a church-owned version of the signal with those conditions, and it turns the shared built-in off so people don't see two copies. The signal keeps its name and appears on the Signals page with a small "Edited" note; from then on it behaves exactly like a custom signal (editable, deletable, and it shows up in filters, profiles and the AI agent).

"Reset to default" reverses it: the church-owned version is removed and the original built-in comes back.

Built-in signals whose logic can't be expressed with the available conditions (for example the group-attendance percentage bands are available, but salvation-decision history is not) show the Logic tab with the closest starting point and a short note that anything more specific may need extra conditions.

Only owners and admins see any of this.

## Technical notes

**Shared rule builder** — extract the condition rows, combinator selector, and `CONDITION_SOURCES` out of `src/components/signals/CustomSignalEditorDialog.tsx` into `src/components/signals/ConditionBuilder.tsx` (+ `src/lib/signalConditions.ts` for the source catalog). Both dialogs consume it; no change to the stored rule shape or to `evaluate-custom-signals`.

**Seed map** — `src/lib/markerLogicSeeds.ts`: for each built-in marker key, a `{ polarity, severity, combinator, conditions }` starter derived from the marker's effective `params` (reusing `markerParamSpecs` defaults). Keys with no expressible equivalent fall back to a single sensible attendance/group condition plus a UI note.

**Promotion** — `useMarkerSettings.tsx` gains `usePromoteMarkerToCustom()`: inside one flow, create the custom signal + rule via the existing `custom_signals` / `custom_signal_rules` inserts, write `org_marker_settings` with `enabled = false` and `promoted_signal_id`, recompute markers, then invoke `evaluate-custom-signals` for the org so counts appear immediately. Reset deletes the promoted custom signal and the settings row.

**Migration** — add `promoted_signal_id uuid references public.custom_signals(id) on delete set null` to `public.org_marker_settings`, and surface it from `get_marker_catalog` so the Signals page can label the row "Edited" and route its menu to the custom-signal editor.

**Dialog** — `MarkerSettingsDialog.tsx` becomes tabbed (Basics / Logic); the Logic tab renders `ConditionBuilder` plus polarity/severity and saves through the promotion hook. When a marker is already promoted, the menu opens `CustomSignalEditorDialog` directly instead.
