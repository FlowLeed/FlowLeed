# Fix Contact Search Timeout (Per-Row RLS Function Call)

## Problem
The `contacts` SELECT policy calls `can_user_see_contact(auth.uid(), id)` for **every row** Postgres scans. On Promise Center (~21k contacts) any org-wide query — global search, contacts list, dashboard counts — runs that `SECURITY DEFINER` function ~21k times. Each call does an `EXISTS` against `user_pco_visible_people` (also ~21k rows for Janelle). The query either hits the statement timeout or PostgREST returns an empty payload, so Janelle sees "No contacts found" even though Alexa exists. Direct lookups (household → click person) only invoke the function once, which is why those still work.

Confirmed: this is not a permission/data problem. It's a planner problem — the function is opaque to the planner, so it can't be hoisted, batched, or index-optimized.

## Goal
Org-wide contact queries return in <500 ms regardless of org size, while still respecting per-user PCO visibility when an org has `pco_enforce_user_permissions = true`.

## Fix — single migration

Replace the per-row function call with an **inlined, set-based predicate** Postgres can plan against indexes. No frontend, edge-function, or types changes.

### Steps

1. **Add the composite index the predicate needs** (idempotent):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_upvp_user_org_person
     ON public.user_pco_visible_people (user_id, organization_id, pc_person_id);
   ```
   (Also confirm `contacts (organization_id, pc_person_id)` is indexed; add if missing.)

2. **Drop & recreate** the `"Users can view contacts in their organization"` SELECT policy on `public.contacts` with this `USING`:
   ```sql
   EXISTS (
     SELECT 1 FROM public.organization_members om
     WHERE om.organization_id = contacts.organization_id
       AND om.user_id = auth.uid()
   )
   AND (
     -- Enforcement off → everyone in the org sees everything
     NOT COALESCE(
       (SELECT pco_enforce_user_permissions
          FROM public.organizations
         WHERE id = contacts.organization_id), false)
     -- Owners/admins always see everything
     OR EXISTS (
       SELECT 1 FROM public.organization_members om2
       WHERE om2.organization_id = contacts.organization_id
         AND om2.user_id = auth.uid()
         AND om2.role IN ('owner','admin')
     )
     -- Contact isn't tied to a PCO person → visible
     OR contacts.pc_person_id IS NULL
     -- User has no active personal PCO connection → don't gate them
     OR NOT EXISTS (
       SELECT 1 FROM public.user_pco_connections upc
       WHERE upc.user_id = auth.uid()
         AND upc.organization_id = contacts.organization_id
         AND upc.status = 'active'
     )
     -- Otherwise must be in the user's visible set
     OR EXISTS (
       SELECT 1 FROM public.user_pco_visible_people v
       WHERE v.user_id = auth.uid()
         AND v.organization_id = contacts.organization_id
         AND v.pc_person_id = contacts.pc_person_id
     )
   )
   ```

   Why this is fast:
   - The two org-scoped subqueries (`pco_enforce_user_permissions`, admin check) are parameter-free for a single query and Postgres caches them as initplans — evaluated **once**, not per row.
   - When enforcement is off, the planner short-circuits the entire OR branch and the policy collapses to the org-membership check.
   - When enforcement is on, the remaining `EXISTS` against `user_pco_visible_people` is a single index lookup per row on `idx_upvp_user_org_person`, no SQL function call, no SECURITY DEFINER overhead.

3. **Keep `can_user_see_contact`** in the database — other edge functions call it directly. No code changes needed.

## Out of Scope
- No frontend changes (search, contacts list, hooks).
- No edge-function changes.
- No change to custom-fields/PCO-tabs filtering (separate concern).
- No removal of `user_pco_visible_people` or the enforcement toggle.

## Verification
1. As Janelle on Promise Center, global search for "Alexa Yarmolatii" returns Alexa in <1s.
2. `/contacts` loads for Promise Center without timeout.
3. With `pco_enforce_user_permissions=true` and a personal PCO connection that excludes a person, that person does **not** appear in search/list (visibility still enforced).
4. Owners/admins always see all contacts.
5. With enforcement off, all members see all contacts.
6. `EXPLAIN ANALYZE` on the search query shows an Index Scan on `idx_upvp_user_org_person` and no function calls in the plan.
