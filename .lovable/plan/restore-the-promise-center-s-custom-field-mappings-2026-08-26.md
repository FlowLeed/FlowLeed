# Restore The Promise Center's Custom Field Mappings

## Why they're gone

Disconnecting Planning Center deleted the old integration record, and the field mappings are attached to that record with a delete-cascade rule, so they were removed with it. Reconnecting created a fresh integration record with no mappings.

## What gets restored

Rebuild the mappings from the 11,000+ historical Planning Center Flow Moments still in the database. Each one recorded the source field ID, field label, tab name, matched value, and target Moment Type — enough to recreate each rule.

Reconstructed rules (one row per field/value condition), attached to the current integration:

| Moment Type | PCO field | Tab | Condition |
| --- | --- | --- | --- |
| Fresh Start / Recommitment | I have made a decision: | Fresh Start | is any of "To follow Jesus for the first time." / "To make a Fresh Start with Jesus" |
| Join | Joined the Church | Join the Church | is true |
| Group Leader | Approved | Group Leader Orientation | is true |
| Freedom | Conference Date | FREEDOM | has any value |
| Contributor | Given Last 45 Days | Stewardship | is true |
| Dream Team / Serving | Team | Dream Team | has any value |
| Welcome Party Attended | Attended Welcome Party | Welcome Party | has any value |
| others found in history | — | — | derived the same way |

Before writing anything, the full derived list (every field + condition, including the long tail beyond the rows above) is compiled from the moment history and shown for confirmation, since value-level conditions are inferred: fields whose recorded values are only true/checked become "is true", fields with many distinct values (dates, team names) become "has any value", and fields with a small fixed set of values become an equals/any-of condition.

## How

1. Query the full set of distinct (field ID, field label, tab name, moment type, observed values) combinations from the org's PCO-sourced Flow Moments.
2. Derive the operator per field using the rules above.
3. Insert the mapping rows for The Promise Center, pointed at its current Planning Center integration, marked active.
4. Verify in Integrations → Planning Center → Advanced Settings that each rule appears with the right moment type, conditions, and AND/OR combinator, and adjust anything that looks off.

No schema changes, no changes to existing Flow Moments. The unique constraint on (organization, field, moment type) makes the insert safe to re-run.

## Note

Until the cascade behavior is changed, disconnecting Planning Center again will wipe these mappings a second time. That fix isn't part of this restore — worth scheduling separately.
