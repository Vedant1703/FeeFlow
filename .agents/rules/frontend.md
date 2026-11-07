# FeeFlow — Frontend Engineering and Design Rules

## 1. Approved frontend foundation

Use the repository's established versions and conventions. The product baseline is:

- Next.js App Router, React, and strict TypeScript.
- Tailwind CSS v4.
- Restyled shadcn/ui primitives (Radix-based where applicable).
- Lucide React icons.
- next-intl for English/Hindi localization and ICU messages.
- React Hook Form + Zod for form state and client-side boundary validation, consistent with existing project patterns.
- TanStack Table for data-heavy operational tables.
- Recharts for dashboards and trend visualizations.
- Motion for purposeful UI transitions only.
- Sonner for non-blocking notifications.

Do not add a second full component framework (for example, MUI, Mantine, or HeroUI) alongside shadcn/ui. Do not add a dependency already covered by the current stack. Check package versions and repository setup before suggesting upgrades.

## 2. Two distinct experiences

FeeFlow has two frontends with a shared visual language but different layout, density, and navigation.

### Parent portal

- Mobile-first, single-column, optimized for a 360px viewport.
- Minimal JavaScript and few navigation choices.
- The amount due, due date/status, and primary Pay action must be visible immediately.
- Use plain-language statuses, large legible INR values, generous spacing, and touch-friendly controls.
- Support linked-child switching, English/Hindi, receipts, payment history, and enabled academic views.
- Use a simple mobile bottom navigation where it improves discoverability; do not expose staff navigation.

### Staff workspace

- Desktop-oriented responsive application with a consistent left navigation/sidebar and top utility bar.
- Use dense tables where they improve reconciliation and operational review; use cards for summaries and mobile fallback.
- Make centre, batch, as-of date, student, and payment-status filters easy to find where relevant.
- Prioritize actionable exception queues: unmatched payments, failed reminders, pending approvals, failed refund items, import errors, and reconciliation discrepancies.
- Keep audit context adjacent to sensitive actions.

Role-based navigation should reflect capabilities and centre scope, but the server remains the authorization boundary. Never rely on hidden controls for security.

## 3. Visual design language

Use a restrained, trustworthy financial-operations aesthetic:

- Warm off-white application background, white surfaces, near-black ink, deep teal primary action, subtle borders, and restrained shadows.
- Suggested starting tokens (adapt to existing tokens if they already exist): primary deep teal `#126B61`; app background `#F7F8F6`; primary text `#171D1B`; secondary text `#697570`; border `#E6EAE7`.
- Use semantic status colors for success, warning, danger, and neutral states. Always pair color with text/icon; never communicate status by color alone.
- Use Inter for Latin text and Noto Sans Devanagari for Hindi. Verify both scripts at actual UI sizes.
- Use tabular numerals for INR amounts, counts, and dates where appropriate.
- Keep spacing, radii, typography, focus rings, and component variants tokenized and consistent.
- Avoid gratuitous gradients, glassmorphism, glow effects, oversized decoration, and animation that competes with financial information.

Do not treat sample colors as a reason to hard-code values throughout components. Define and reuse CSS variables/design tokens.

## 4. Information architecture and page patterns

Primary staff areas:

- Overview/dashboard.
- Students and student ledger.
- Payments and reconciliation.
- Reminder centre.
- Withdrawals and refunds.
- Imports.
- Risk review.
- Reports/exports and audit (capability-gated).

Primary parent areas:

- Home.
- Payments.
- Receipts/history.
- Academics (when enabled).
- Profile, language, linked children, and policy access.

Use separate route layouts/route groups for parent and staff experiences where the repository permits. Keep route names and navigation labels consistent with the product language.

Page patterns:

- Dashboard: page title/actions, filters, KPI cards, charts, exception queue, drill-down table.
- Ledger: student summary, fee plan/instalments, derived outstanding, balance explanation, chronological append-only ledger.
- Reconciliation: tabs/filters, payment/event list, unmatched queue, review drawer, and reconciliation totals.
- Refunds: guided request/calculation/approval/execution flow with policy provenance and item-level status.
- Imports: upload, stage/validate, review differences, explicit commit, and import history.
- Risk review: explainable factors, data sufficiency, trend context, and human review controls.

## 5. Financial UX requirements

- Clearly distinguish fee charge, outstanding, captured payment, allocated amount, unallocated amount, refund requested, refund completed, and exported amount.
- Never label a payment as paid/settled based only on a client redirect. Display `Payment confirmation pending` until the backend reports verified capture.
- A receipt proves capture, not necessarily allocation. Make this distinction visible when relevant.
- For every computed balance/refund amount, provide an explanation or drill-down to source records.
- Use confirmation dialogs or review steps for allocation, reversal, discount, withdrawal approval, refund approval/execution, import commit, and period close.
- Show the current outstanding and remaining unallocated amount before a manual allocation is confirmed.
- Explain informational refund shortfalls as non-collectible in the MVP; do not style them as normal dues.
- Avoid optimistic UI for irreversible or financially sensitive state transitions. Revalidate/refetch from authoritative server state after completion.

## 6. State, data, and forms

- Prefer Server Components for read-heavy pages and initial data; use Client Components only for real interaction requirements.
- Keep business logic and authorization out of presentation components.
- Use the repository's established server actions/API patterns; validate untrusted input with Zod at the server boundary.
- Use URL search parameters for shareable table filters and pagination when appropriate.
- Use TanStack Query only where client-side server-state synchronization, polling, or mutation invalidation is required; do not duplicate server state in ad hoc global stores.
- Use controlled form patterns consistently and show field-level validation errors.
- Do not calculate authoritative balances, payment amounts, risk decisions, or refund amounts only in the browser.
- Format money and dates through shared locale-aware utilities. Never convert financial values to floating point to format or calculate them.

## 7. Required UI states and accessibility

Every core page/workflow must intentionally handle:

- Loading/skeleton.
- Empty/no results.
- Error with useful recovery/retry guidance.
- Success/confirmation.
- Disabled/permission-limited actions.
- Pending/asynchronous processing.
- Offline/network interruption where relevant.
- Consent required, withdrawn student, and insufficient data where applicable.

Accessibility requirements:

- Semantic landmarks and heading order.
- Keyboard-operable navigation, menus, dialogs, tabs, tables, and form controls.
- Visible focus states and accessible names for icon-only controls.
- Correct dialog focus management and escape behavior.
- Sufficient contrast and reduced-motion support.
- Status text/icons in addition to color.
- Test core flows with axe and keyboard navigation.

## 8. Charts, tables, and responsive behavior

- Charts must have labels, useful tooltips, readable axes, and empty/loading/error states.
- Label synthetic/demo metrics clearly; do not imply that illustrative data is live.
- TanStack Table should own table state/logic when tables require sorting, filtering, pagination, selection, or column visibility. Reuse the established shadcn table presentation.
- Use responsive stacked cards on narrow screens when wide financial tables cannot remain legible. Do not simply shrink desktop tables until text is unreadable.
- Preserve exact values and useful identifiers in drill-downs; avoid truncating critical payment references without a way to inspect them.

## 9. Localization

- Use next-intl and translation messages; do not scatter hard-coded English/Hindi strings through components.
- Provide equivalent Hindi and English meaning, not a partial translation of primary actions or payment states.
- Use locale-aware dates, pluralization, and INR formatting.
- Check line wrapping and layout expansion in Devanagari. Avoid fixed heights that clip Hindi text.
- Ensure receipt and reminder previews use the same language preference as the parent.

## 10. Motion and dependencies

Use Motion for subtle transitions that communicate navigation, drawer/modal entry, status changes, and list updates. Respect `prefers-reduced-motion`. Do not animate financial amounts in ways that make the actual value ambiguous.

Before adding a visual library, explain the concrete interaction that requires it. Prefer one animation system and one primary component system. Do not add GSAP, React Spring, Aceternity, Magic UI, or other visual packages by default; use them only if a specific requirement cannot be met cleanly with the approved foundation.
