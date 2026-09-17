# FlowLeed mobile experience audit and redesign

## Goal
Make every major signed-in FlowLeed workflow comfortable and readable on phones from 320–430px wide, while preserving the current desktop experience.

## What the screenshot shows
- The desktop sidebar is visible and consumes roughly one-third of the phone screen. The source already contains a mobile drawer, so the first task is to reproduce and resolve why the published phone view is not using it.
- The remaining content is compressed rather than reorganized for a phone, making text and controls too small.
- Long AI results are presented as uninterrupted linked-name lists, requiring excessive scrolling and leaving the composer competing with the content.
- The page needs stronger mobile hierarchy: one clear top bar, one content column, and actions designed for thumbs.

## Plan

### 1. Establish a reliable mobile frame
- Reproduce the published-site behavior at 320, 360, 390, and 430px before changing it; verify viewport detection, deployed CSS, and browser “desktop site” behavior rather than assuming the cause.
- Hide the desktop sidebar below the tablet breakpoint and expose it only through a 44px menu button and full-height drawer.
- Use dynamic viewport height and safe-area spacing so browser bars, notches, keyboards, and home indicators do not cover content.
- Simplify phone headers to: menu/back, short page title, and one primary action; move secondary actions into a More menu.
- Keep desktop and tablet layouts unchanged unless a shared fix is required.

### 2. Redesign FlowLeed AI for long answers
- Use full-width assistant responses on phones with normal-weight type, tighter paragraph spacing, and clear section headings.
- Replace long inline name dumps with a compact result summary and a collapsible people list showing a small preview first.
- Keep “Review N people” close to the result summary and make review the primary action.
- Make the composer keyboard-aware, safe-area-aware, and compact; keep Send/Stop reachable without covering the answer.
- Make History and New conversation compact phone actions, and ensure no action depends on hover.

### 3. Replace desktop tables with mobile people lists
- Contacts: render phone-native person rows/cards with name, Signal, campus, and one useful contact detail; move secondary details into the profile.
- Flows: keep table/board choices on larger screens, but use stage-grouped person lists on phones with stage navigation and touch-friendly selection.
- Tasks: condense badges, prevent the overdue indicator from crowding names, and move filters into a dedicated filter sheet.
- Preserve sorting, selection, filtering, profile navigation, and bulk actions in the mobile layouts.

### 4. Improve Signals, Groups, Analytics, and profiles
- Signals: make tabs horizontally scrollable or use a compact selector; stack filters; simplify cards and move card menus into reachable icon actions.
- Groups: keep search prominent, move secondary header actions and filters into sheets, and ensure cards show only decision-making information first.
- Analytics: use horizontally scrollable tabs, responsive metric values, two-column summaries where they fit, and charts with stable phone heights.
- Person profiles: retain the useful mobile summary already present, then audit each section for clipped controls, dense four-column summaries, and overly wide popovers.

### 5. Standardize dialogs and forms
- Present long forms and multi-step actions as full-width mobile sheets or bottom drawers instead of centered desktop dialogs.
- Pin titles and Save/Continue actions while only the form body scrolls.
- Reduce phone padding, enlarge checkboxes/icon controls to 44px targets, and keep focused fields visible above the keyboard.
- Apply this first to person editing, Flow creation/settings, signal editing, imports, attendance, and AI people review.

### 6. Mobile quality pass
- Test portrait widths at 320, 360, 390, and 430px plus tablet; include long names, large counts, empty/loading/error states, open keyboards, and long AI answers.
- Check for horizontal overflow, clipped text, hidden actions, nested scrolling, and controls below recommended touch size.
- Verify drawer navigation, filters, selection, dialogs, and back navigation with real interactions.
- Keep a lean mobile-audit checklist in the project roadmap so every major page is verified before completion.

## Suggested delivery order
1. Shared frame, header, sidebar, safe areas
2. FlowLeed AI and people-review experience
3. Contacts, Flows, and Tasks
4. Signals, Groups, Analytics, and profiles
5. Dialog/form standardization and final cross-device QA

## Technical notes
- Prefer shared responsive primitives for mobile page headers, action sheets, person rows, and adaptive dialogs instead of one-off page fixes.
- Use semantic design tokens and existing components; no new backend or business-rule changes are needed.
- Preserve desktop behavior and data operations. This work changes presentation and interaction patterns only.
