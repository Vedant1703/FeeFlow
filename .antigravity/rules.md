# FeeFlow Agentic Development Rules (Strict)

You are building **FeeFlow**, a multi-centre coaching institute fee-tracking and parent portal web app for **Company A, Jaipur** (Isocode Take-Home Problem 4).

## 1. Authoritative Specifications
Always read and obey `/docs/FeeFlow_SRS_v2.2_FINAL.md`, `/docs/FeeFlow_UI_Reference_v2.2_FINAL.md`, and `/docs/FeeFlow_Wireframes_v2.2_FINAL.md`.

## 2. Non-Negotiable Architecture & Financial Invariants
- **Stack:** Next.js App Router (TypeScript strict), Tailwind CSS, shadcn/ui (Radix), Prisma + PostgreSQL, Zod, Vitest.
- **Integer Paise Only:** Store and compute all money in integer paise (`bigint` in DB and TS). `₹30,000` = `3000000n` paise. Never use floating-point math for money. Format in UI with `Intl.NumberFormat('en-IN')`.
- **Demo Clock:** Inject a `Clock` / `businessDate()` utility defaulting to `2026-11-02` in demo mode so:
  - `STU-0412` (Aarav Meena, JEE 2027 Morning, due `2026-10-10`, ₹30,000 / ₹30,000) -> `Paid`
  - `STU-0587` (Ishita Sharma, JEE 2027 Evening, due `2026-10-10`, ₹30,000 / ₹15,000) -> `Part paid, 23 days overdue`
  - `STU-0219` (Mohit Gurjar, NEET 2027 Morning, due `2026-11-15`, ₹40,000 / ₹0) -> `Due in 13 days`
- **Append-Only Ledger:** Student and instalment balances are derived strictly from signed `ledger_entries` (`CHARGE`, `DISCOUNT`, `ALLOCATION`, `REVERSAL`, `WAIVER`, `REFUND_ADJUSTMENT`). Never mutate or delete historical ledger rows.
- **Webhook-Verified Payments:** Browser redirects never mark an instalment paid (`P1e` shows Confirming). Only a signature-verified webhook (`POST /api/webhooks/payment`) creates a capture, allocates up to outstanding, issues a GST-configured receipt, and cancels pending reminders for settled instalments.
- **Unmatched Payments Queue:** Captures with unknown order IDs or excess amounts stay unallocated in the Accounts Queue (`S3`) with candidate match scores/reasons. Never auto-allocate a suggested match.
- **Pro-Rata Refund & Shortfall Safeguard:** Use inclusive calendar days (`T = days(E) - days(S) + 1`, `c = clamp(days(W) - days(S) + 1, 0, T)`, `earned = roundHalfUp(N * c / T)`, `deduction = 0`). On part-paid withdrawal (`STU-0587`), any shortfall (`earned > paid`) is **informational only** (styled in neutral slate `#505A66`, never red, never added to dues/ageing/reminders). Approved withdrawal waives unpaid ordinary instalments to ₹0 (`WAIVER` entries) and requires maker-checker (`approverId !== requesterId`).
- **AI Dropout-Risk Guardrail:** Deterministic weighted heuristic (`0.40` fee overdue + `0.30` attendance drop + `0.30` test score drop). If `<2` academic signals have data, return `INSUFFICIENT_DATA` (never low risk). `HIGH` (`>=60`) creates a `COUNSELLOR_CALL` task only—it must NEVER send a parent message or alter fees. Counsellors can mark `FALSE_POSITIVE` (suppressing repeat tasks for 30 days).

## 3. UI & Design System Rules
- Use exact CSS variables from `FeeFlow_UI_Reference_v2.2_FINAL.md` (`--paper: #FAF8F4`, `--surface: #FFFFFF`, `--ink: #17191A`, `--teal: #0B5D5A`, `--ok: #1E7A4F`, `--warn: #8F5600`, `--bad: #B3261E`, `--slate: #505A66`).
- Every status chip must pair an **icon + word** (never colour alone).
- Parent Portal (`360px` mobile-first): Above the `640px` fold on `P1`, show Child Switcher, Language Toggle (`EN | हिं`), Hero Amount (`52px`), Due Date/Status Chip, `<Rail />` (3 or 4 segments), and Primary `Pay` button.
- No dead buttons anywhere. Every visible button must work end to end.

