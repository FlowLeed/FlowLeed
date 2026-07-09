
# Lead Magnet: Free Church Health Audit

Marketing lives on flowleed.com. This app ships:
1. A minimal signup route at `/audit`
2. A one-step PCO connect
3. A background analyzer that generates a **Church Health Report**
4. An in-app report dashboard where each finding shows **20 people preview → View all → Add to Flow** (existing or new)
5. One-click branded PDF export

## Funnel

```text
flowleed.com/audit  →  /audit (short WHY + signup)
                    →  /audit/connect  (Connect Planning Center)
                    →  /audit/generating  (progress polling)
                    →  /audit/report/:id  (dashboard + drill-downs + Add to Flow + PDF)
```

## `/audit` route (in this app)

Public, no header/sidebar chrome. Sole purpose: convert an ad click into an account.

- Short WHY block (~3 lines): "See who's drifting, where your leaders are stretched, and which groups need attention — free, in 10 minutes."
- 3 tiny bullets naming the report sections.
- Trust line: "Read-only Planning Center access. Your data stays in your account."
- **Signup form** (email + password + org name) — reuses `AuthPage` signup logic inline.
- After email verify → `/audit/connect`.

Attribution: capture `utm_*` and referrer on signup, store on `profiles`.

## `/audit/connect`

Single-screen: "Connect Planning Center to generate your report." One button → existing PCO OAuth. On return with a valid connection, immediately calls `run-church-audit` and routes to `/audit/generating`.

## `/audit/generating`

Progress screen. Polls `church_health_reports.status`. Shows the three sections lighting up as their analyzers finish (`queued → running → ready`). Redirects to `/audit/report/:id` when `status = 'ready'`.

## `/audit/report/:id` — the report

Header
- Org name + logo, generation timestamp, "Download PDF" button, optional "Share" toggle (public read-only aggregate link).
- Large **Overall Church Health Score** gauge (weighted average of section grades).

Three section cards. Each card renders identically:

```
[Section title]                       [Grade A–F]
[Headline number]                     [Trend indicator]
[Short interpretation sentence]

Findings (top 3):
  • Finding title — metric — severity
  • Finding title — metric — severity
  • Finding title — metric — severity

People preview (first 20 avatars/names)  [View all N]  [Add to Flow]
```

Sections in v1 (per prior decision):

1. **At-Risk / Drifting People**
   - Uses `contact_engagement_scores`, `pco_checkins`, `contact_interactions`.
   - Metrics: count with engagement drop ≥ 25% vs 90d baseline; count with no check-in in 60d who were previously regular; median days since last interaction; breakdown by campus.
2. **Volunteer & Leader Health**
   - Uses `group_members` roles, `groups`, `contact_interactions`.
   - Metrics: active volunteers, leader workload distribution, leaders with no recent care (no staff interaction 60d), teams missing co-leader/host.
3. **Groups Health**
   - Uses `groups`, `group_meetings`, `group_attendance`.
   - Metrics: % groups meeting monthly vs dormant (no meeting 45d), attendance trend 90d vs prior 90d, at/over capacity, no co-leader, orphaned members.

## Drill-down + Add to Flow (the key interaction)

Every finding is a **cohort**. Clicking "View all" opens a full-screen drawer:

- Sortable list of the people in that cohort with the metric that landed them there (e.g., "42 days since last check-in").
- Bulk selection (default: all selected).
- **Add to Flow** button opens the existing `BulkAddToFlowDialog` component (already in the codebase — same one used on Contacts). Two options in the flow-selection step:
  - **Existing flow** — the standard picker.
  - **Create a new flow from this cohort** — new "+ New flow" tile at the top of the picker; opens a small dialog (name + optional icon + default first stage "New") and, on save, creates the flow, adds the current user as flow lead, seeds one stage, then continues the bulk-add. Implemented by reusing existing `CreateFlowDialog` chained into `BulkAddToFlowDialog`.
- After add: toast confirms count added / skipped (already-in-flow), and a link to open the flow.

The report card's inline "Add to Flow" button behaves the same, defaulting the cohort to the top finding's people.

## PDF export

Edge function `generate-audit-pdf` renders the report to a branded PDF (org logo, score gauge, three section pages, top findings, name lists capped at 25 per section with a "+ N more" line). Uses the PDF skill pattern already in the project. Uploads to `audit-reports` bucket, returns a signed URL. Button downloads directly.

## Optional share link

Toggle on the report header. When on, `/audit/shared/:token` renders a **read-only aggregate summary** — scores, counts, top findings — **no names or contact IDs**. Safe to send to elders/board.

## Data model

New tables (with GRANTs, RLS scoped to `organization_id`, `updated_at` trigger):

- `church_health_reports`
  - `organization_id`, `created_by_user_id`, `status` (`queued|running|ready|failed`), `overall_score numeric`, `section_scores jsonb`, `metrics jsonb`, `pdf_storage_path text`, `share_token text`, `share_enabled boolean default false`, `generated_at timestamptz`, `error text`.
- `church_health_findings`
  - `report_id`, `section` (`at_risk|volunteers|groups`), `key` (stable slug e.g. `no_checkin_60d`), `title`, `description`, `severity` (`low|medium|high`), `metric_value numeric`, `metric_label text`, `contact_ids uuid[]`, `sort_order int`.

Private storage bucket: `audit-reports`.

## Edge functions

- `run-church-audit` — orchestrator. Creates the report row, updates status per section, computes findings, sets `status=ready`. Uses data already synced by PCO (no extra PCO API calls; if the org has zero synced people yet, it enqueues a one-time sync first and shows an extended progress step).
- `generate-audit-pdf` — renders PDF from report + findings, uploads to `audit-reports`, returns signed URL.
- `audit-share-token` — mints/rotates share token server-side.

## Frontend files

- `src/pages/audit/AuditSignupPage.tsx` — `/audit` (short WHY + signup form).
- `src/pages/audit/AuditConnectPage.tsx` — `/audit/connect`.
- `src/pages/audit/AuditGeneratingPage.tsx` — `/audit/generating`.
- `src/pages/audit/AuditReportPage.tsx` — `/audit/report/:id`.
- `src/pages/audit/PublicAuditSharePage.tsx` — `/audit/shared/:token`.
- `src/components/audit/ScoreGauge.tsx`, `SectionCard.tsx`, `FindingRow.tsx`, `CohortDrawer.tsx`, `ReportHeader.tsx`, `AuditPdfButton.tsx`.
- Hook `useChurchAudit(reportId)` — react-query polling + finding queries + cohort fetch.
- `BulkAddToFlowDialog` gets a small addition: a "+ New flow" tile that opens `CreateFlowDialog` then re-enters the picker with the new flow preselected.
- `AuthPage` already handles `?mode=signup`; we set `?intent=audit` so post-verify redirects to `/audit/connect`.

## Tracking

GA4 events: `audit_signup_view`, `audit_signup_submit`, `audit_pco_connected`, `audit_report_ready`, `audit_pdf_downloaded`, `audit_cohort_add_to_flow` (with section + finding key).

## Out of scope for v1

- Guest follow-up section (sparse data early).
- Emailed PDF (download only for now).
- Landing/marketing copy on flowleed.com (handled outside this repo).
