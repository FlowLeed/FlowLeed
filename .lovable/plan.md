# Replace onboarding with a Demo Church sandbox

Instead of asking a new pastor to configure anything, drop them straight into a fully populated fictional church. They explore real screens with real-looking data, hit the "Aha!" moment ("here are 4 people who need attention today"), and only then choose **Set Up My Church** — which wipes every trace of the demo.

## 1. Remove the setup wizards

- Delete the owner and member onboarding wizards, the dashboard checklist, the progress bar, and the celebration modal (`src/components/onboarding/*`, `useOrgOwnerOnboarding`, `useMemberOnboarding` usage in `Dashboard.tsx`, `IntegrationsPage.tsx`, `ProfilePage.tsx`, `FlowPage.tsx`).
- Keep the super-admin Onboarding Flows board (internal CRM), but it reads org state instead of wizard flags.
- No more blocking modals on first login.

## 2. Seed a demo church on signup

When a brand-new org is created, seed sample data automatically (and offer a manual "Load sample data" button in settings if they skipped it).

**Grace Community Church (Demo)** contains:

- **30 people** with realistic names, emails, phones, campuses, and staggered created dates
- **10 new guests** in a Guest Follow-Up flow, spread across its stages
- **3 groups** (a men's small group, a young adults group, a Sunday serve team) with demo members, meeting times, and a little attendance history
- **10 people** in Pastoral Care, spread across stages with notes
- **2 baptism candidates** in a Baptism flow
- **5 people** in First Time Givers
- **Assigned leaders** — a few fictional leader names attached as assignees so team columns aren't empty
- **Flow Moments** — first visit, salvation, baptism scheduled, first gift, joined a group, missed 3 weeks
- **Check-in / engagement history** so signals compute naturally: several active, a few at-risk, one or two dormant
- **Interactions & tasks** — past calls/notes plus a couple of upcoming follow-ups
- **Sample AI recommendations** — pre-written suggestion rows so the AI panel shows real recommendations without an API call

## 3. The "Aha!" surface

The dashboard leads with a demo-aware hero: **"Here are 4 people who may need attention today"** — a short list of demo people with the reason (no contact in 21 days, guest never followed up, baptism date unset, gift with no thank-you) and one-click actions that actually work on the demo data.

Below it: three tiny prompts — *See a flow*, *Open a person*, *Ask the AI about your people* — so exploration is guided but not forced.

## 4. Demo mode banner and exit

A persistent, non-intrusive banner while demo data exists:

> You're exploring sample data. **Ready to use your own people? → Set Up My Church**

**Set Up My Church** opens a confirm dialog ("This deletes all sample people, flows, and activity — this can't be undone"), deletes everything demo-flagged, then routes to a lightweight choice: **Connect Planning Center** / **Import a CSV** / **Add people manually** / **Share a signup form**. No multi-step wizard — just the four doors.

Demo data is also auto-deleted the first time real data arrives (PCO sync, CSV import, or form submission) so nobody ends up with mixed data.

## 5. Guardrails

- Demo people are visually marked (subtle "Sample" chip) so nobody mistakes them for real members.
- Demo people are excluded from real outbound actions: no SMS, email, or push send; those buttons show "Not available in sample data".
- Demo data never counts toward org health scores, analytics exports, or super-admin activity metrics.

## Technical notes

- Migration: add `is_demo boolean not null default false` to `contacts` and `pipelines`; add `demo_seeded_at` and `demo_cleared_at` to `organizations`. Flagging contacts and pipelines is enough — child rows (`pipeline_contacts`, `flow_moments`, `contact_interactions`, `contact_notes`, `contact_engagement_scores`, `signal_agent_suggestions`) are removed by cascade or by contact/pipeline id when clearing.
- New edge function `demo-data-seed`: service-role, idempotent per org, builds the flows/stages, people, enrollments, moments, interactions, engagement scores, and suggestion rows in one pass. Called from the signup path and from the manual "Load sample data" action.
- New edge function `demo-data-clear`: verifies the caller is an org owner/admin, deletes demo pipelines and demo contacts for that org, stamps `demo_cleared_at`, returns counts.
- `useDemoMode()` hook derives demo state from `demo_seeded_at`/`demo_cleared_at` plus a count of demo contacts; drives the banner, the "Sample" chips, and the send-action guards.
- Fixed fictional names/emails on an example.com-style domain so nothing can reach a real inbox or phone.
- Existing orgs are untouched (`demo_seeded_at` stays null, no banner).
- Existing engagement/signal logic runs unchanged over demo rows, so the demo shows the real product rather than mocked screenshots.

## Out of scope

Funnel analytics instrumentation, email drips, and product tours — worth doing later, but the sandbox comes first.
