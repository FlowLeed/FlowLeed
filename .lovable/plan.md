# Expand signal conditions: Campus, Flows, and Moments

## What the investigation found

The rule engine already supports combining attendance and Flow facts with **ALL (AND)** or **ANY (OR)**. For example:

```text
Trigger when ALL match
  Days since last service is at most 14
  Is in Flow equals First-Time Guest Follow-Up
```

The database already has strong coverage for the requested additions: 19,019 contacts have a campus, 923 active Flow enrollments exist, 186,634 attendance records exist, and 12,709 Flow Moments exist.

A person can be active in multiple Flows, so the clearest option is **Is in Flow** rather than “Current Flow.” No database structure change is needed because signal rules already store flexible condition data.

## Recommended experience

### Organize the condition menu
Group choices with headings so the list is easier to scan:

- **Attendance**
- **Campus**
- **Flows**
- **Flow Moments**
- **Groups**
- **Serving**
- **Tags**

Keep the existing attendance choices under Attendance. The category heading makes it obvious that attendance can be combined with any other condition; a separate generic “Attendance” row would duplicate “Days since last service.”

### Add Campus conditions
- **Campus is** → campus picker
- **Campus is not** → campus picker
- **Campus is not assigned** → no value needed

### Add Flow conditions
- **Is in Flow** → Flow picker
- **Is not in Flow** → Flow picker
- **Is in Flow stage** → stage picker showing `Flow name — Stage name`
- Keep **Is in any active Flow** and **Days in current stage** for broad rules

Only active, incomplete Flow enrollments count. A contact may match more than one Flow.

### Add Flow Moment conditions
- **Has Flow Moment** → moment-type picker
- **Does not have Flow Moment** → moment-type picker
- **Days since Flow Moment** → moment-type picker plus day threshold

Examples include Baptism, Salvation Decision, or any church-created Flow Moment. Only active moment types for the current church appear.

### Improve value entry
Use real pickers rather than typed IDs or names:

- Campus picker from the church’s campuses
- Flow picker from the church’s Flows
- Stage picker grouped/labeled by Flow
- Flow Moment picker from active moment types
- Preserve the selected IDs in rules so renaming an item does not break a signal

## Technical details

- Extend the shared condition catalog to support category headings and dynamic value kinds: campus, Flow, stage, and Flow Moment.
- Let the shared condition builder load organization-specific picker options and render the correct control for each source.
- Extend the custom-signal evaluator’s contact facts with:
  - `campus_id`
  - active Flow IDs
  - active stage IDs
  - Flow Moment type IDs and latest occurrence dates
- Add matching operators for campus, Flow, stage, and moment conditions while preserving existing saved rules.
- Scope supporting reads to the current organization while extending the evaluator, avoiding unnecessary cross-organization scans.
- Reuse this expanded builder in both custom signals and edited built-in signals.

## Validation

- Verify an **Attendance AND Flow** rule matches only contacts satisfying both conditions.
- Verify Campus “is,” “is not,” and unassigned behavior.
- Verify contacts active in multiple Flows can match each applicable Flow.
- Verify completed Flow enrollments do not count as active.
- Verify Flow Moment presence, absence, and recency rules.
- Verify renamed campuses, Flows, stages, and moments continue working because rules store IDs.
- Verify existing signal rules still load and evaluate unchanged.

## Good later additions

Not included in this pass, but natural follow-ups are specific groups, contact status, assigned Leader, membership status, and named attendance events or locations. Arbitrary nested logic and attendance trends would require a larger rule-engine redesign.
