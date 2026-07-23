# Export selected people from a Flow to CSV

Add an **Export CSV** button to the Flow board's bulk actions toolbar. When people are selected, it exports just those; when nothing is selected, it exports everyone currently visible on the board (respecting active filters).

## Scope

- Only the Flow board (`/flows/:id`). Contacts page is unchanged.
- Client-side CSV generation — no backend/edge function needed.

## Fields exported

Columns, in order:
1. Name
2. Email
3. Phone
4. Campus
5. Assigned To
6. Flow Stage (current stage name in this flow)
7. Tags (semicolon-separated)

## Behavior

- New **Export CSV** button in `BulkActionsToolbar` (between "Remove Tags" and "Delete").
- If `selectedCount > 0` → export selected rows.
- If nothing is selected → the button is still available via a small "Export all filtered" affordance on the Flow header (or we allow the bulk toolbar's export to fall back to filtered-all when no selection). Simplest: add an **Export CSV** button next to the flow header filters that always exports the currently filtered/visible people; the bulk toolbar's Export button exports only the selection. This gives users both paths cleanly.
- Filename: `{flow-name}-{YYYY-MM-DD}.csv`.
- Values are CSV-escaped (quotes, commas, newlines handled). UTF-8 with BOM so Excel opens accents correctly.
- Tags fetched from `contact_tags` for the selected contact IDs in a single query (they aren't always preloaded on the flow board).

## Technical details

Files to add/change:

- `src/lib/csvExport.ts` (new) — pure helpers:
  - `toCsv(rows: string[][]): string` with proper escaping + BOM
  - `downloadCsv(filename, csv)` via Blob + `URL.createObjectURL`
- `src/hooks/useFlowContactsExport.ts` (new) — takes flow context + a set of contact IDs (or "all filtered"), fetches tags in bulk from `contact_tags`, joins with the already-loaded pipeline contacts, returns the row matrix ready for `toCsv`.
- `src/components/crm/BulkActionsToolbar.tsx` — add an **Export CSV** button + `onExport: () => Promise<void>` prop.
- `src/components/crm/FlowView.tsx` (or wherever bulk actions are wired up on the flow board — `useBulkActions` / `FlowContext`) — wire `onExport` for selected IDs, and add a secondary **Export CSV** button in the flow header area for "all filtered".
- No DB migrations, no edge functions, no new dependencies.

## Out of scope

- Contacts page export
- XLSX/PDF formats
- Server-side export for very large datasets (current flow boards are already fully client-loaded, so this is fine)
