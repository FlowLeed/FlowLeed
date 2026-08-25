# The Promise Center: missing Custom Field Mappings

## What happened

This is a system bug, not something a user deleted intentionally.

The Promise Center's Planning Center integration record was **replaced on Aug 19, 2026 at 18:57 UTC** (during the Planning Center OAuth reconnect work). Custom Field Mappings are stored with a foreign key to the integration record that uses `ON DELETE CASCADE`, so when the old integration row disappeared, **all of the org's field-to-moment mappings were silently deleted with it**.

Supporting evidence from the database:
- The org currently has 0 rows of PCO moment mappings, but 11,000+ Flow Moments with `source_system = 'pco'` that were created by those mappings.
- The very last PCO-generated moment was created Aug 19, 2026 at 17:14 UTC — roughly 90 minutes before the integration was recreated. Nothing has been generated since.
- The only org that still has mappings is one whose integration row dates from Nov 2025 and was never reconnected.
- Two other orgs reconnected on Aug 19 and Aug 21 also have zero mappings, so this affects every org that reconnected Planning Center.

## The good news

The deleted mappings can be reconstructed. Every generated Flow Moment stored the source field in its metadata: PCO field definition ID (`source_reference`), field label, tab name, matched value, and the target Moment Type. That is enough to rebuild the mapping rows.

## Plan

1. **Stop the bleeding (schema fix)**
   Change the mappings' link to the integration so a reconnect no longer wipes them: keep the mapping scoped to the organization and let the integration reference go null instead of cascading. On reconnect, mappings get re-pointed at the new integration record.

2. **Restore The Promise Center's mappings**
   Rebuild mapping rows from the historical Flow Moments: group by PCO field definition ID + tab name + moment type, derive the trigger condition from the observed values (for example "Joined the Church = true", "I have made a decision is any of [To follow Jesus for the first time, To make a Fresh Start with Jesus]"), and attach them to the current integration. Present the reconstructed set for review before writing it, since value-level conditions are inferred and may need tightening.

3. **Restore the other affected orgs**
   Apply the same reconstruction for the two other orgs that reconnected on Aug 19/21, where historical moments exist.

4. **Reconnect flow hardening**
   Where the code deletes and re-inserts the integration on reconnect, switch to an update-in-place/upsert keyed on organization + service so dependent configuration survives. Audit other tables that hang off `integrations` with cascade deletes (list mappings, sync settings) for the same exposure and fix them together.

## Technical notes

- Affected table: `pco_moment_mappings` (`integration_id` FK → `integrations`, currently `ON DELETE CASCADE`).
- Reconstruction source: `flow_moments.metadata` (`pco_field_label`, `pco_field_value`, `tab_name`) plus `source_reference` (PCO field definition ID) joined to `flow_moment_types`.
- Schema changes go through a migration; no destructive statements on existing moments.
- Unique constraint `(organization_id, pco_source_identifier, flow_moment_type_id)` makes the restore idempotent.
