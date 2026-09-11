# Make every built-in signal rule exactly editable

## Goal
Replace approximate built-in signal conditions with exact, editable versions. Opening a built-in signal will show the complete rule that currently determines its matches, so saving it unchanged preserves the same people count. The approximation warning can then be removed. Also update the Signals page summary card to say "Active Signals tracked" instead of "Active markers tracked".

## What will change

1. **Add the missing condition choices**
   - Attendance within a configurable time window, distinct attended weeks, and lifetime attendance.
   - Household check-ins for the kids signal.
   - Attendance change compared with the previous period.
   - Group meeting count and time since last group attendance, including people who never attended.
   - Serving count within a time window.
   - Any recent Flow Moment and recorded salvation decisions.
   - Recent online attendance and prayer requests.
   - Add strict comparison operators where the built-in formulas use them.

2. **Rebuild every built-in starting rule exactly**
   - Represent all thresholds and paired requirements, including consistency windows, prior attendance, group meeting minimums, serving history, and inactivity ranges.
   - Keep the existing category-first layout and allow users to combine these exact starting conditions with Campus, Flow, stage, tags, and other conditions.
   - Remove the “closest match” warning once no built-in uses an approximation.

3. **Make custom evaluation match built-in calculations**
   - Calculate service versus volunteer check-ins correctly instead of treating every check-in as service attendance.
   - Support household attendance, distinct weekly attendance, historical/current period comparisons, latest group-meeting windows, serving counts, online events, prayer events, and Flow Moment categories.
   - Load enough historical data for each configured window and paginate large datasets so matching does not silently stop at current row limits.
   - Preserve current AND/OR behavior and saved custom rules.

4. **Protect conversions and existing rules**
   - Keep previously rewritten signals readable and evaluable.
   - Ensure opening and saving an unchanged built-in produces the same matches as the built-in calculation.
   - Keep rewritten signal counts, filters, polarity, severity, and enabled state working as they do now.

5. **Verify parity**
   - Add focused tests for every built-in seed and each new condition evaluator.
   - Compare representative built-in results with their newly promoted custom equivalents, including edge cases such as no attendance, household attendance, exact threshold boundaries, and overlapping periods.
   - Check the editor at desktop and narrow widths so the expanded conditions and remove control remain inside the popup.

## Technical details
- Primary areas: the condition catalog and editor, built-in seed definitions, and the custom-signal evaluation function.
- Existing rule storage already accepts JSON conditions, so no new table is expected. A database migration will only be added if exact, scalable fact loading requires a server-side query function after implementation profiling.
- Existing saved condition names and values remain supported for backward compatibility.
