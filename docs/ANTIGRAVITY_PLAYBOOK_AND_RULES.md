# FeeFlow — Antigravity IDE Playbook, Agent Rules & Submission Templates

**Version:** 2.2 FINAL  
**Target Deadline:** 9 November 2026, 11:59 PM IST  

---

## 1. How to Load This Pack into Antigravity IDE

1. Create a `/docs` directory in your project root and copy **only these 4 Markdown files** into `/docs` (keep `FeeFlow_UI_Screens.pdf` outside the agent's context window or in a separate `/design-pdf` folder ignored by the agent so it doesn't waste tokens parsing binary PDF streams):
   - `docs/FeeFlow_SRS_v2.2_FINAL.md`
   - `docs/FeeFlow_UI_Reference_v2.2_FINAL.md`
   - `docs/FeeFlow_Wireframes_v2.2_FINAL.md`
   - `docs/FeeFlow_FINAL_ALIGNMENT_AND_BUILD_GATE.md`
2. Create `.antigravity/rules.md` (or `.cursorrules` / `CLAUDE.md`) in your workspace root and paste the **Agent Rules** from Section 2 below.
3. Execute the **5 Sequential Build Gates** in Section 3 one by one. Verify tests at each gate before moving to the next.

---

## 2. Copy-Paste Workspace Rules (`.antigravity/rules.md`)

```markdown
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
```

---

## 3. Five Sequential Prompts for Antigravity IDE

### Gate 1 Prompt — Foundation, Prisma Schema & Deterministic Jaipur Seed
> Read `/docs/FeeFlow_SRS_v2.2_FINAL.md` and `/docs/FeeFlow_UI_Reference_v2.2_FINAL.md`. Initialize the Next.js App Router (strict TypeScript, Tailwind CSS with the exact CSS variables in `globals.css`, shadcn/ui primitives) and create the complete Prisma schema (`prisma/schema.prisma`) covering users, centres (Malviya Nagar, Vaishali Nagar, Mansarovar, Tonk Road), batches, students, parents, consents, fee_plans, instalments, discounts, ledger_entries, payment_intents, provider_events, payments, payment_allocations, receipts, reminder_rules, reminder_dispatches, reminder_pauses, refund_policies, withdrawals, refunds, refund_items, attendance_records, test_results, import_batches, risk_configs, risk_evaluations, risk_tasks, and audit_log. Write `prisma/seed.ts` anchored to demo clock `2026-11-02` with exact brief records `STU-0412`, `STU-0587`, `STU-0219`, sibling `STU-0588` (Kabir Sharma, All Paid), refund student `STU-1038` (Kavya Rathore), risk student `STU-0731` (Rohan Saini), unmatched payment `pay_demo_a91c`, and realistic batch data across all 4 centres. Run migration and seed to verify.

### Gate 2 Prompt — Pure Domain Logic & Unit Tests (Vitest)
> Implement the pure domain modules in `src/domain/` with zero framework dependencies:
> 1. `money.ts` and `clock.ts` (`2026-11-02` demo clock, paise `bigint` math, `roundHalfUp`, `en-IN` formatter).
> 2. `ledger.ts` (derived instalment and student balances, `daysOverdue = max(0, businessDate - dueDate)` when outstanding > 0, append-only validation).
> 3. `refunds.ts` (inclusive calendar-day pro-rata calculator, zero deduction, informational shortfall safeguard, withdrawal waiver generator, and maker-checker check).
> 4. `risk.ts` (versioned 0.40/0.30/0.30 heuristic, weight renormalisation, `INSUFFICIENT_DATA` guard, `COUNSELLOR_CALL` task trigger, 30-day false-positive suppression, zero access to ledger/messaging ports).
> 5. `matching.ts` and `reminders.ts` (exact order match vs candidate suggestion scorer; send-time reminder eligibility evaluator that skips paid/withdrawn/paused instalments and updates partial balances).
> Write comprehensive Vitest unit tests in `src/domain/__tests__/` covering all SRS golden fixtures (`F1`–`F4` and UI fixtures `U1`–`U2`), partial payments, webhook idempotency, and AI false-positive suppression. Run `vitest` until 100% green.

### Gate 3 Prompt — Application Services, Auth/Consent & API Routes
> Implement the application services and Next.js Route Handlers / Server Actions:
> 1. Session auth: Parent OTP login (`/api/auth/otp/send`, `/api/auth/otp/verify` with visible demo OTP `482913`) + per-child DPDP Consent Gate (`POST /api/parent/consent`), and Staff email/password login (`accounts@demo.companya.test`, `counsellor@demo.companya.test`, `director@demo.companya.test`).
> 2. Repository-level RBAC and centre scoping (`Actor` context on every call).
> 3. Mock Payment Gateway & Signed Webhook (`/api/payments/intent`, `/api/webhooks/payment` with HMAC verification, idempotent capture, transactional allocation, GST receipt issuance, immediate cancellation of queued reminders on settlement, and unmatched queue routing).
> 4. Manual allocation endpoint, reminder scheduler tick endpoint (`POST /api/reminders/run`), withdrawal & maker-checker refund approval endpoints, and risk task review endpoint.

### Gate 4 Prompt — Core UI Screens (Parent Mobile `P0a`–`P5` & Staff Desktop `S0`–`S8`)
> Build the frontend screens following `/docs/FeeFlow_UI_Reference_v2.2_FINAL.md` and `/docs/FeeFlow_Wireframes_v2.2_FINAL.md`:
> 1. Shared components: `<Rail />` (3 or 4 segments), `<StatusChip />` (icon + word), `<ProvenanceChip />`, bilingual `EN | हिं` toggle (`next-intl`), and Top Demo Bar (`Synthetic data · Demo clock 2 Nov 2026`).
> 2. Parent Mobile (`360px` container): `P0a`/`P0b` OTP Login, `P0c` Consent Gate, `P1` Parent Home (5-second layout above 640px fold + child switcher between Ishita & Kabir), `P1b` Vaul Pay Sheet (full or partial ₹1,000–₹15,000), `P1c` Hosted Mock Checkout (`Succeed` / `Fail` / `Pending`), `P1d` Payment Confirmed with downloadable GST Receipt, `P1e` Confirming/Failed/All Paid states, `P4` Withdrawn/Offline states, and `P5` Public Refund Policy.
> 3. Staff Desktop (`S0`–`S8`): `S0` Sign In, `S1` Accounts Dashboard (KPI strip, centre ageing bars, Needs Attention queue, batch drill-down), `S2` Student Fee Ledger (append-only timeline, discount/withdrawal/pause actions), `S3` Payments & Unmatched Queue (Allocate dialog with required reason + Provider Events tab), `S4` Reminder Centre (Due/Sent/Failed/Skipped tabs, EN/HI preview, Run Scheduler Now), `S5a` Withdrawal & Refund Quote (formula table, dashed slate informational shortfall box, waiver preview), `S5b` Director Refund Approval & Item Execution (`Retry` on failed item), `S7` Counsellor Risk Review (factor table, `Mark reviewed` / `Follow-up required` / `False positive`, no ledger access), and `S8` Director Policy, Audit & Health.

### Gate 5 Prompt — Tier 1 Depth (`P2`, `P3` PDF, `S3b` Tally/Reconciliation, `S6` Bulk Imports) & E2E Polish
> Complete the remaining views from `FeeFlow_Wireframes_v2.2_FINAL.md`:
> 1. `P2` Parent Attendance & Tests view and `P3` Receipt PDF download with GST metadata.
> 2. `S6` Academic CSV/XLSX Imports (4-step Upload -> Validate -> Review -> Commit flow with row-level error CSV download).
> 3. `S3b` Month-End Reconciliation equation view, immutable month close, and deduplicated Tally CSV export.
> 4. Audit every button, loading skeleton, empty state, and error banner across mobile (`360px`) and desktop (`1280px`) viewports.

---

## 4. Mandatory Submission Templates (2-File ZIP < 25 MB)

When submitting to Isocode, zip **only** `TDD.pdf` (exported from the Markdown below) and `deployment.md`.

### Template 1: `TDD.md` (Export to `TDD.pdf` before zipping)

```markdown
# Technical Design Document — FeeFlow

- **GitHub Repository:** https://github.com/<your-username>/feeflow (Public)
- **Live Deployment URL:** https://<your-app>.vercel.app
- **Candidate:** Vedant Vinod Kulkarni
- **Problem Statement:** Brief 4 — Coaching Institute's Fee Tracking System and Parent Portal (Company A, Jaipur)

## 1. Architecture & Rationale
- **Modular Monolith (Next.js App Router + TypeScript + PostgreSQL/Prisma):** Chosen so parent mobile routes, staff desktop workflows, webhook handlers, and pure domain logic share strict end-to-end types and ACID database transactions without microservice latency or distributed-transaction complexity.
- **Hexagonal Domain Boundaries:** Pure domain functions (`src/domain/`) handle integer-paise arithmetic, ledger derivation, pro-rata refund math, payment matching, reminder eligibility, and risk scoring. External dependencies (Payments, Messaging, OTP, Clock, PDF) sit behind typed ports with deterministic mock adapters.

## 2. Data Model & Financial Integrity
- **Integer Paise (`bigint`):** Prevents IEEE-754 floating-point drift across instalments and pro-rata divisions.
- **Append-Only Signed Ledger (`ledger_entries`):** Balances and `daysOverdue` are derived from `CHARGE`, `DISCOUNT`, `ALLOCATION`, `REVERSAL`, `WAIVER`, and `REFUND_ADJUSTMENT` entries. Historical rows are never updated or deleted.
- **Idempotent Webhooks & Allocations:** Unique constraints on `(provider, provider_event_id)` and row-level locking on instalments prevent double-crediting or over-allocation under concurrent webhook replays.

## 3. Main Operational Flows
1. **Parent OTP, DPDP Consent & Verified Payment:** Parent logs in via OTP (`P0a`/`P0b`), grants verifiable per-child consent (`P0c`), views the 5-second dues card (`P1`), and pays full or partial (`>= ₹1,000`) via hosted mock checkout (`P1c`). The UI enters `Confirming` (`P1e`) until the HMAC-signed webhook verifies capture, allocates to the ledger, generates a GST receipt (`P1d`), and immediately marks pending reminders for settled instalments as `SKIPPED`.
2. **Unmatched Payments Queue:** Captures without an exact order match land in `S3` as `UNALLOCATED`. The matching engine computes candidate scores and reasons (e.g., `MOHIT G 0219`), requiring an Accounts Executive to verify and allocate with an audit reason.
3. **Evaluate-at-Send Bilingual Reminders:** Scheduler ticks (`S4`) evaluate live ledger balances at send time in English or Hindi, skipping settled, withdrawn, or paused students and quoting updated balances after partial payments.
4. **Pro-Rata Refund Calculator & Withdrawal Rebase:** Uses immutable `RefundPolicy v1` (`T` inclusive service days, `c` inclusive consumed days, `earned = roundHalfUp(N * c / T)`, ₹0 deduction). On approved withdrawal (maker-checker enforced), unpaid ordinary instalments are waived to ₹0. Any part-paid shortfall (`earned > paid`) is stored strictly as an informational review figure—never as collectible debt.

## 4. AI / Dropout-Risk Engine & When It Is Wrong
- **Explainable Heuristic:** Combines overdue fee days (weight `0.40`), 4-week vs 8-week attendance trend (`0.30`), and recent 3 vs prior 3 test scores (`0.30`). If `<2` academic signals have minimum data, it outputs `INSUFFICIENT_DATA` rather than a false `LOW` risk.
- **Safety When Wrong:** A `HIGH` flag (`>= 60`) only creates a `COUNSELLOR_CALL` task on `S7`. It has zero code path to send parent messages or modify fees. Counsellors can mark `False positive`, which logs the reason, updates the false-positive rate metric, and suppresses repeat tasks for 30 days.

## 5. UI & Design Decisions
- **5-Second Parent Clarity:** At `360px`, `P1` places Child Switcher, `EN | हिं` toggle, Hero Amount (`52px` tabular numerals), overdue chip, signature `<Rail />`, and `Pay` button above the `640px` fold.
- **Semantic Restraint:** Warm paper (`#FAF8F4`), deep teal (`#0B5D5A`) for actions, status chips always pairing icon + text, and neutral slate (`#505A66`) for informational shortfall so it never looks like an overdue debt.

## 6. Labelled Assumptions
- **[A-01]** Demo business clock fixed at `2026-11-02` so brief sample rows reproduce `23 days overdue` (`STU-0587`) and `Due in 13 days` (`STU-0219`).
- **[A-02]** Annual fee `₹1,20,000` is seeded as `4 × ₹30,000` for JEE batches (`STU-0412`, `STU-0587`) and `3 × ₹40,000` for NEET batches (`STU-0219`).
- **[A-03]** Minimum partial payment set to `₹1,000` (or remaining instalment balance if lower).
- **[A-04]** Pro-rata refund uses inclusive calendar days (`T` and `c`) and ₹0 deduction; 10-day target is tracked from withdrawal request date as a provisional operational SLA.
- **[A-05]** Receipts display configurable institute GST metadata (seeded with clearly marked synthetic GSTIN `08AABCC1234D1Z5`).

## 7. What Was Cut & What Comes Next
- **Cut for Take-Home Scope:** Live SMS/WhatsApp gateway, production Razorpay merchant settlement file ingestion, staff MFA, multi-institute tenancy, and LMS/timetables/admissions CRM (out of scope).
- **Next Steps for Production:** Connect live WhatsApp Business & Razorpay webhooks, complete legal/CA sign-off on DPDP notice text and GST credit-note series, and calibrate risk weights against historical cohort retention data.
```

---

### Template 2: `deployment.md`

```markdown
# FeeFlow — Local Setup & Deployment Guide

## 1. Prerequisites
- **Node.js:** v20+
- **Package Manager:** `pnpm` (or `npm`)
- **Database:** PostgreSQL 15+ (local or Docker / Neon)

## 2. Step-by-Step Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/<your-username>/feeflow.git
   cd feeflow
   pnpm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and populate the required values (see Section 3 for variable names).

3. **Run database migrations and seed deterministic Jaipur data:**
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma db seed
   ```

4. **Run automated tests (Unit + Integration):**
   ```bash
   pnpm test
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```
   Open `http://localhost:3000`.

## 3. Required Environment Variables (Names Only)

| Variable Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Direct PostgreSQL connection string for Prisma migrations |
| `SESSION_SECRET` | 32-byte secret key for signing HTTP-only session tokens |
| `WEBHOOK_HMAC_SECRET` | Secret key used by the mock/gateway webhook verifier |
| `DEMO_MODE` | Set to `true` to enable demo banners, mock OTP inbox, and fixed demo clock |
| `DEMO_BUSINESS_DATE` | Fixed ISO date (`2026-11-02`) for reproducing brief sample statuses |
| `NEXT_PUBLIC_APP_URL` | Base URL of the application |

## 4. Production Deployment
- **Application Hosting:** Deployed on **Vercel** (Next.js App Router).
- **Database:** Managed **PostgreSQL** on **Neon**.
- **Build Command:** `pnpm prisma generate && pnpm prisma migrate deploy && pnpm next build`

## 5. Reviewer Demo Login Credentials

### A. Parent Mobile Portal (`/parent/login`)
- **Demo OTP Code (for any seeded parent phone):** `482913` (also shown in the on-screen demo banner)
- **Parent 1 (Ishita Sharma `STU-0587` — Part paid, 23 days overdue + sibling Kabir `STU-0588` — All paid):**
  - Mobile: `+91 90000 12345`
- **Parent 2 (Aarav Meena `STU-0412` — Paid):**
  - Mobile: `+91 90000 12341`
- **Parent 3 (Mohit Gurjar `STU-0219` — ₹40,000 due in 13 days):**
  - Mobile: `+91 90000 12342`
- **Parent 4 (Kavya Rathore `STU-1038` — Withdrawn, refund executing):**
  - Mobile: `+91 90000 12348`

### B. Staff Desktop Workspace (`/staff/login`)
- **Accounts Executive (Vaishali Nagar & Malviya Nagar scope):**
  - Email: `neha.verma@demo.companya.test`
  - Password: `DemoPassword123!`
- **Counsellor (Vaishali Nagar Risk Review & Imports scope):**
  - Email: `pooja.rawat@demo.companya.test`
  - Password: `DemoPassword123!`
- **Founder-Director (All 4 Centres, Refund/Discount Checker, Policy & Audit):**
  - Email: `arvind.mathur@demo.companya.test`
  - Password: `DemoPassword123!`
```
