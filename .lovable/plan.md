# Differentiate Sign In and Create Account screens

## Goal
Make the Sign In and Create Account modes instantly distinguishable while staying inside the existing Flowleed light/purple brand. Keep the current simplified fields (email + password only), Google sign-in, legal links, and direct post-auth navigation.

## Design direction chosen
"Layout form factor" — use a compact, centered card for Sign In and a wider split-panel card for Create Account.

## What will change

### Sign In mode
- Compact single card, centered.
- Header: Flowleed logo + tagline, then "Welcome back" as the main heading.
- Fields: Email, Password.
- Extras: "Remember me" checkbox, "Forgot your password?" link.
- Primary CTA: "Sign In".
- Secondary: Google "Continue with Google" button.
- Footer: legal links + "Don't have an account? Create Account".

### Create Account mode
- Wider split-panel card (responsive: stacked on mobile, side-by-side on desktop).
- Left panel: soft indigo-tinted sidebar with the Flowleed logo, tagline, and 2-3 short value bullets (e.g., "Start with demo data", "Connect Planning Center later", "No credit card required").
- Right panel:
  - Heading: "Create your free account".
  - Google "Continue with Google" button.
  - "or" divider.
  - Fields: Email, Password.
  - Primary CTA: "Create account".
  - Footer: legal links + "Already have an account? Sign In".

## Technical approach
- Update `src/pages/AuthPage.tsx` to render mode-specific layouts inside the existing `mode === 'signin'` / `mode === 'signup'` branches.
- Keep all existing handlers, hooks, validation, and the password-recovery flow untouched.
- Use existing shadcn components (`Card`, `Button`, `Input`, `Label`, `Checkbox`, `Alert`) and Tailwind tokens.
- Preserve the current URL `?mode=signup` / `?mode=signin` behavior and the mode-switch links.
- Add a subtle cross-fade/slide transition when toggling modes using Tailwind transitions.

## Out of scope
- No new fields (no first/last name, no church name, no slug checker).
- No new auth logic or backend changes.
- No dark mode or new color palette.
- No Apple/GitHub social providers.

## Verification
- Build passes without errors.
- Playwright check: both `/auth?mode=signin` and `/auth?mode=signup` render correctly, mode switch links work, and form submission handlers remain intact.