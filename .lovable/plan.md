
## Goal

Flip Custom Field Mappings from field-centric to **moment-centric**. Each Flow Moment has a rule made of one or more PCO field conditions combined with **AND / OR** logic. Example: "Leader Ready" fires when Baptism Date has value **AND** Joined Church has value **AND** Team has any value. A rule can also express "Salvation date has value **OR** Prayer response = Yes".

## New UI

Replace the tab-grouped field list with a list of **Moment Rule Cards**.

```text
+-----------------------------------------------------------------+
| [icon] Leader Ready                    [Active] [Edit] [Del]    |
| Fires when [ALL ▼] of the following are true:                   |
|   • Baptism Date          has any value                         |
|   • Joined the Church     has any value                         |
|   • Team                  has any value                         |
|   [+ Add condition]  [+ Add OR group]                           |
+-----------------------------------------------------------------+
+-----------------------------------------------------------------+
| [+ Add Moment Rule]                                             |
+-----------------------------------------------------------------+
```

- Top-level combinator dropdown per card: `ALL (AND)` / `ANY (OR)`.
- One level of nesting supported: within an ALL rule you can add an "OR group" (a sub-block that fires if ANY of its conditions match, and counts as one satisfied item at the top level). Same for ANY rules containing "AND groups". This covers `(A AND B) OR (C AND D)` and `A AND (B OR C)` — enough for real churches without turning it into a full expression builder.
- Condition row: `[Custom Field ▼]  [Trigger ▼]  [value if needed]  [X]`.
- Editing a card is a single transaction: Save persists the full rule; Cancel reverts.

Keep existing "Refresh Fields from PCO", "Manage Moment Types", and stats bar.

## Data model

Extend `pco_moment_mappings` minimally — no new table:

- Add `rule_combinator text` (`'AND' | 'OR'`, default `'AND'`) — set once per moment on every row of that rule.
- Add `condition_group int` (default `0`) — rows sharing `(integration_id, flow_moment_type_id, condition_group)` are combined with the **opposite** of `rule_combinator`. Group `0` = top-level; groups `>0` = nested sub-groups.

Semantics:
- Top-level combinator = `AND` → all top-level items (group 0 rows + each non-zero group) must be true. Non-zero groups are OR'd internally.
- Top-level combinator = `OR` → any top-level item true. Non-zero groups are AND'd internally.

Existing rows migrate cleanly: `rule_combinator='AND'`, `condition_group=0` — behaves exactly like today's single-condition mappings.

Add partial unique index `(integration_id, flow_moment_type_id, condition_group, pco_source_identifier)` to keep condition rows tidy without blocking the same field in different OR branches.

## Frontend changes

- New `MomentRuleCard.tsx` — collapsed + edit modes, combinator toggle, condition rows, nested group blocks, add/remove.
- New `MomentRuleConditionRow.tsx` — searchable field picker grouped by tab, trigger dropdown reusing `pcoFieldOperators`, optional value input.
- Rewrite `FlowMomentsMappingSection.tsx`:
  - Load all mappings, group by `flow_moment_type_id` into rule objects `{ momentTypeId, combinator, groups: { [groupId]: Condition[] } }`.
  - Render one card per rule; "Add Moment Rule" opens an empty card (pick unmapped moment type, then add conditions).
- Extend `usePcoMomentMappings`:
  - `saveRule(momentTypeId, combinator, groups)` — diff against existing rows and bulk insert / update / delete in one call.
  - `deleteRule(momentTypeId)` — delete all rows for that moment on this integration.
- Delete `MappingRow.tsx` once new UI is wired.

## Backend changes (edge functions)

Update both moment-evaluation paths to honor combinator + groups:

- `supabase/functions/pco-backfill-moments/index.ts` (`syncFlowMomentsForContact`)
- `supabase/functions/pco-sync-processor/index.ts` (equivalent block around L994–L1160)

Logic per contact:
1. Group active mappings by `flow_moment_type_id`. Read `rule_combinator` from any row (all rows share it).
2. Evaluate each individual condition against the field_data map (missing field = false).
3. Reduce group `0` conditions with the top combinator; reduce each non-zero group with the opposite; combine group results with the top combinator.
4. If the rule passes, upsert one `flow_moments` row.
   - `source_reference`: `pco_moment_{momentTypeId}_person_{pcPersonId}` — stable per (moment, contact) so re-runs deduplicate.
   - `occurred_at`: latest updated_at among the conditions that contributed to the passing evaluation.
   - `metadata.matched_conditions`: array describing the matched fields/values for audit.
5. Update `last_synced_at` on every row in the group.

Single-condition rules still work (one row, group 0, combinator AND).

## Migration considerations

- Schema migration adds the two columns with defaults; existing data behaves identically.
- Add the partial unique index.
- No data backfill needed.

## Out of scope

- More than one level of nesting (no `(A OR (B AND (C OR D)))`).
- Cross-source conditions mixing custom fields with groups/workflows (still `custom_tab_field` only, matching current UI).
- Changes to the Moment Types manager.

## Files touched

- `src/components/integrations/FlowMomentsMappingSection.tsx` (rewrite)
- `src/components/flow-moments/MomentRuleCard.tsx` (new)
- `src/components/flow-moments/MomentRuleConditionRow.tsx` (new)
- `src/components/flow-moments/MappingRow.tsx` (remove)
- `src/hooks/usePcoMomentMappings.tsx` (add `saveRule`, `deleteRule`, expose combinator/group)
- `supabase/functions/pco-backfill-moments/index.ts` (AND/OR + groups)
- `supabase/functions/pco-sync-processor/index.ts` (AND/OR + groups)
- Migration: add `rule_combinator`, `condition_group`, partial unique index on `pco_moment_mappings`.
