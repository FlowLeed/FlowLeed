## Plan: Compact Communication Blocks with Accordion

Convert the three always-open cards in the Communication tab of Group Settings into collapsible accordion blocks. Each block shows a title + summary in its collapsed header, and expands on click to reveal the full edit form.

### Changes (single file: `src/pages/settings/GroupSettingsPage.tsx`)

1. **Import** `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion` and `ChevronDown` from lucide-react.

2. **Replace the three `<Card>` blocks** in the Communication tab with a single `<Accordion type="multiple">` containing three `AccordionItem`s:

   | Item | Collapsed header | Expanded content |
   |---|---|---|
   | **Signup Confirmation Email** | Title + short description + enabled/disabled status badge | Subject input, message textarea, variable help, save/reset buttons |
   | **Leader Notification Email** | Title + short description + enabled/disabled status badge | Subject input, message textarea, variable help, save/reset buttons |
   | **Reply-To Address** | Title + short description + current reply-to value (or "default") | Email input + save button |

3. **Keep all existing form logic unchanged** — state variables, `patch()` calls, save/reset handlers stay exactly as they are; only the wrapping container changes from `Card` to `AccordionItem`.

4. **Default state**: all items collapsed (no `defaultValue`), so the tab is compact and scannable on first load.

### What stays the same
- All data fetching / mutation logic
- The other tabs (Types, Defaults, Directory, Lifecycle)
- Edge function / email sending logic

This is a presentation-only refactor with no logic changes.