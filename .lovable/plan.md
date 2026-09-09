# Editable Built-in Signals

Yes, it makes sense — and today only half of it exists.

**What already works:** Custom Signals (Signals → Custom) can already be created, edited, turned off, and deleted.

**What doesn't:** The built-in signals like "Attended Sunday recently", "Missed 3 Sundays", "Stopped serving" come from one shared catalog used by every church. Nobody can rename them, hide the ones they don't care about, or change the time windows behind them (14 days, 3 of 4 weeks, 30 days, etc.).

This plan makes the built-in list feel like the church's own, without letting a church break the shared math.

## What the user gets

On the Signals page, each built-in signal gets a small menu with:

- **Turn off / Hide** — the signal stops being calculated and disappears from the page, contact profiles, filters and the AI agent for that church only.
- **Rename** — change the name and the explanation text ("Attended Sunday recently" → "Came to weekend service").
- **Adjust timing** — for signals that are based on a time window or a count, edit the numbers in plain language: "Fires when someone checked in within the last **14** days".
- **Reset to default** — undo any of the above.

Signals whose logic is not just a number (for example group-attendance percentage bands) can be renamed and hidden but not re-timed; the page says so, and points to Custom Signals for anything more.

Only owners and admins see these controls; everyone else sees the resulting names.

Deleting a built-in signal is not offered — turning it off is the safe equivalent, because deleting a shared definition would affect other churches. Custom signals keep their real Delete.

## Technical notes

**New table `public.org_marker_settings`**
- `organization_id`, `marker_key` (FK to `marker_definitions.key`), unique together
- `enabled boolean default true`, `custom_label text`, `custom_description text`, `params jsonb default '{}'`, timestamps + update trigger
- GRANTs: `SELECT` to `authenticated`, `ALL` to `service_role`; RLS: org members read, owners/admins write (`get_user_organization_role`)

**Parameterize `recompute_contact_markers(p_org_id)`**
- Add a settings CTE at the top resolving, per org, each tunable number from `org_marker_settings.params` with the current hardcoded value as the default (recent-attendance days, missed-Sundays min/max days, drifting days, "previously regular" lifetime count, guest window, kids/household window, serve windows and counts, stuck-in-stage days, moment/online/prayer windows).
- Replace the literal `INTERVAL 'N days'` and count literals with those resolved values.
- At the end, skip inserting rows for markers where `enabled = false` for that org.
- Keep behavior byte-identical when no settings row exists.

**Catalog function `get_marker_catalog(...)`**
- Left join `org_marker_settings`; return `enabled`, and `COALESCE(custom_label, label)` / `COALESCE(custom_description, description)`, plus raw defaults so the editor can show "reset".

**Frontend**
- `src/hooks/useMarkerSettings.tsx` — read + upsert + reset mutations, invalidating `marker-catalog`.
- `src/components/signals/MarkerSettingsDialog.tsx` — name, description, and number inputs generated from a per-marker param descriptor map.
- `src/pages/SignalsPage.tsx` — per-card menu (Edit, Turn off/on, Reset), an "Off" section for disabled signals, gated on owner/admin role.
- `src/lib/markerParams.ts` — descriptor map: which params each marker exposes, label, unit, min/max, default. Also becomes the source for the existing `markerFormulas` text so descriptions reflect edited numbers.
- After saving, trigger the existing recompute so counts update.
