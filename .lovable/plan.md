# Onboarding Funnel Rebuild (PCO and non-PCO churches)

## The problem today

A new org owner lands on the AI dashboard and gets a 5-step modal wizard where **3 of 5 steps are Planning Center**. A church without PCO can never complete onboarding, so the checklist never clears, the celebration never fires, and there is no path to their first "Aha!" moment. There is also no funnel data: `src/lib/analytics.ts` exposes `trackEvent` but nothing in the app calls it, so we cannot see where people drop off.

## What we build

### 1. A branching setup path instead of one PCO-shaped wizard

Right after signup the owner sees a short **Setup** experience with a single fork:

- **"We use Planning Center"** → connect PCO → confirm org → map one list to a flow → first contacts appear.
- **"We don't use Planning Center (yet)"** → choose one of:
  - Import a CSV of people (existing import wizard),
  - Publish a public form / group signup link and collect people that way,
  - Add a few people manually to try it out.

Both branches converge on the same finish line: **people are in a flow and one follow-up action has happened.**

### 2. Time-to-value: one activation milestone, not five chores

Onboarding is considered "activated" when the org has:
1. a flow (auto-created defaults already exist — mark done automatically),
2. at least one contact in a flow (via PCO, CSV, form, or manual),
3. one real action on a person (note, task, stage move, or assignment),
4. one teammate invited (optional-but-nudged, not blocking).

Steps 1–3 are the activation core; step 4 becomes a "grow your team" nudge after activation.

### 3. Persistent, dismissible progress instead of a blocking modal

Replace the modal wizard with a **setup panel** on the dashboard plus a small progress pill in the header, always resumable. Every step is auto-detected from real data (flow exists, contacts exist, activity exists) instead of relying on flags that can drift. "Skip for now" hides it; it never fully disappears until complete.

### 4. Non-PCO churches are first-class

- Setup copy never assumes PCO.
- PCO steps only appear if the owner picked the PCO branch, and they can switch branches at any time.
- If PCO connect fails or the account chooser confuses them, the panel offers "Import a CSV instead" as an escape hatch.

### 5. Funnel instrumentation (so we can actually optimize)

Emit a consistent event per funnel step: signup started/completed, email verified, org created, path chosen (`pco` / `no_pco`), PCO connected, list mapped, CSV imported, form published, first contact, first action, teammate invited, activated. Each event carries org id, role, path, and time since signup so we can measure TTV and drop-off per step. Persist the same milestones to the org record so the super-admin **Onboarding Flows** board reflects reality instead of manual dragging.

### 6. Guided help in-product

- Empty states on Flows / People / Tasks link back to the setup panel's next step.
- A short "what happens next" explainer on the first flow view.
- Owners who stall for 48h+ on a step surface in the super-admin board with the exact step they are stuck on, so a human can reach out.

## Technical notes

- Rework `useOrgOwnerOnboarding` into a data-derived hook: query flows, contacts-in-flows, activity, and team counts; keep `organizations.onboarding_progress` as a cache plus the chosen `setup_path` (`pco` | `no_pco` | `undecided`).
- Retire `OwnerOnboardingWizard` modal in favour of a `SetupPanel` built on the existing `OnboardingChecklist` primitives; keep `OnboardingCelebration` for the activation moment.
- Keep `MemberOnboardingWizard` (leaders/contributors) but align its steps with the same event names.
- Add `src/lib/funnel.ts` wrapping `trackEvent` with typed step names, called from the setup panel, PCO callback, CSV import, form publish, and first-action sites.
- Migration: add `setup_path` and milestone timestamp columns to `organizations`; backfill existing orgs from current data so nobody is thrown back into onboarding.
- Super-admin `OnboardingFlowsPage` maps stages from the derived milestones (signup → connected/imported → activated → engaged) while keeping manual drag override.

## Out of scope for this pass

Email drip sequences, in-app product tours with tooltips overlays, and A/B testing infrastructure. Those come after we have funnel data.
