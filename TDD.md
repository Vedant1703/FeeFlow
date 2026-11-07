# Technical Design Document — FeeFlow

- **GitHub Repository:** https://github.com/Vedant1703/feeflow (Public)
- **Live Deployment URL:** https://feeflow.vercel.app
- **Candidate:** Vedant Vinod Kulkarni
- **Problem Statement:** Brief 4 — Coaching Institute's Fee Tracking System and Parent Portal (Company A, Jaipur)

## 1. Architecture & Rationale
- **Modular Monolith (Next.js App Router + TypeScript + PostgreSQL/Prisma):** Chosen so parent mobile routes (`/parent/*`), staff desktop workflows (`/staff/*`), webhook handlers, and pure domain logic share strict end-to-end types and ACID database transactions without microservice latency or distributed-transaction complexity.
- **Hexagonal Domain Boundaries:** Pure domain functions (`src/domain/`) handle integer-paise arithmetic, ledger derivation, pro-rata refund math, payment matching, reminder eligibility, and risk scoring. External dependencies (Payments, Messaging, OTP, Clock, PDF) sit behind typed ports with deterministic mock adapters.
- **Client/Server Trust Model:** Zero client payment trust. Browser redirects land only on Confirming/Pending state (`P1e`); only HMAC-SHA256 verified gateway webhooks modify the ledger, issue GST receipts, and skip active reminders.

## 2. Data Model & Financial Integrity
- **Integer Paise (`bigint`):** All monetary amounts across the database schema and application code are represented strictly in integer paise (`₹30,000` = `3000000n` paise). Zero floating-point arithmetic is permitted in any financial calculation.
- **Append-Only Signed Ledger (`ledger_entries`):** Balances and `daysOverdue` are derived strictly from signed `CHARGE`, `DISCOUNT`, `ALLOCATION`, `REVERSAL`, `WAIVER`, and `REFUND_ADJUSTMENT` entries. Historical rows are never modified or deleted; corrections are recorded via offsetting reversal entries.
- **Idempotent Webhooks & Allocations:** Unique constraints on `(provider, provider_event_id)` and atomic transactional allocations prevent duplicate postings or race conditions under concurrent network replays.

## 3. Main Operational Flows
1. **Parent OTP, DPDP Consent & Verified Payment:** Parent logs in via OTP (`P0a`/`P0b`), grants verifiable per-child consent (`P0c`), views the 5-second dues card (`P1`), and pays full or partial (`>= ₹1,000`) via hosted mock checkout (`P1c`). The UI enters `Confirming` (`P1e`) until the HMAC-signed webhook verifies capture, allocates to the ledger, generates a GST receipt (`P1d`/`P3`), and immediately marks pending reminders for settled instalments as `SKIPPED`.
2. **Unmatched Payments Queue:** Captures without an exact order match land in `S3` as `UNALLOCATED`. The matching engine computes candidate scores and reasons (e.g., `MOHIT G 0219` with 88% confidence score), requiring an Accounts Executive to verify and allocate with an audit reason.
3. **Evaluate-at-Send Bilingual Reminders:** Scheduler ticks (`S4`) evaluate live ledger balances at send time in English or Hindi, skipping settled, withdrawn, or paused students and quoting updated balances after partial payments. Quiet hours (21:00–08:00 IST) are strictly enforced.
4. **Pro-Rata Refund Calculator & Withdrawal Rebase:** Uses immutable `RefundPolicy v1` (`T` inclusive service days, `c` inclusive consumed days, `earned = roundHalfUp(N * c / T)`, ₹0 deduction). On approved withdrawal (maker-checker enforced: `approverId !== requesterId`), unpaid ordinary instalments are waived to ₹0. Any part-paid shortfall (`earned > paid`) is stored strictly as an informational review figure—never as collectible debt.

## 4. AI / Dropout-Risk Engine & When It Is Wrong
- **Explainable Heuristic:** Combines overdue fee days (weight `0.40`), 4-week vs 8-week attendance trend (`0.30`), and recent 3 vs prior 3 test scores (`0.30`). If `<2` academic signals have minimum data, it outputs `INSUFFICIENT_DATA` rather than a false `LOW` risk.
- **Safety When Wrong:** A `HIGH` flag (`>= 60`) only creates a `COUNSELLOR_CALL` task on `S7`. It has zero code path to send parent messages or modify fees. Counsellors can mark `False positive`, which logs the reason, updates the false-positive rate metric, and suppresses repeat tasks for 30 days. Counsellors have zero access to financial ledger rows or collection figures.

## 5. UI & Design Decisions
- **5-Second Parent Clarity:** At `360px`, `P1` places Child Switcher, `EN | हिं` toggle, Hero Amount (`52px` tabular numerals), overdue chip, signature `<Rail />`, and `Pay` button above the `640px` fold.
- **Semantic Restraint:** Warm paper (`#FAF8F4`), deep teal (`#0B5D5A`) for actions, status chips always pairing icon + text, and neutral slate (`#505A66`) for informational shortfall so it never looks like an overdue debt.
- **Responsive Parity:** Staff screens (`1280px` desktop) feature dense, high-efficiency data tables with right-aligned tabular numerals and slide-out detail drawers.

## 6. Labelled Assumptions
- **[A-01]** Demo business clock fixed at `2026-11-02` (`Asia/Kolkata`) so brief sample rows reproduce `23 days overdue` (`STU-0587` Ishita Sharma) and `Due in 13 days` (`STU-0219` Mohit Gurjar).
- **[A-02]** Annual fee `₹1,20,000` is seeded as `4 × ₹30,000` for JEE batches (`STU-0412`, `STU-0587`) and `3 × ₹40,000` for NEET batches (`STU-0219`).
- **[A-03]** Minimum partial payment set to `₹1,000` (or remaining instalment balance if lower).
- **[A-04]** Pro-rata refund uses inclusive calendar days (`T` and `c`) and ₹0 deduction; 10-day target is tracked from withdrawal request date as a provisional operational SLA.
- **[A-05]** Receipts display configurable institute GST metadata (seeded with clearly marked synthetic GSTIN `08AABCC1234D1Z5`, SAC code `999293`, 18% GST breakdown).

## 7. What Was Cut & What Comes Next
- **Cut for Take-Home Scope:** Live SMS/WhatsApp gateway, production Razorpay merchant settlement file ingestion, staff MFA, multi-institute tenancy, and LMS/timetables/admissions CRM (out of scope).
- **Next Steps for Production:** Connect live WhatsApp Business & Razorpay webhooks, complete legal/CA sign-off on DPDP notice text and GST credit-note series, and calibrate risk weights against historical cohort retention data.

## 8. Financial Integrity Audit & Automated Test Verification
- **Automated Test Coverage:** 82 passing tests across 13 test suites (100% green coverage) verifying all domain algorithms, application services, auth flows, components, and the payment sandbox matrix.
- **Test Suite Breakdown:**
  - `money.test.ts` (6 tests): BigInt integer paise conversion, roundHalfUp, formatting boundaries.
  - `ledger.test.ts` (6 tests): Append-only signed ledger derivation, balance updates, status transitions.
  - `risk.test.ts` (4 tests): Explainable 0.40/0.30/0.30 heuristic, sparse data safety, 30-day false-positive suppression.
  - `reminders.test.ts` (5 tests): Evaluate-at-send live balances, stop-on-settlement, quiet hours.
  - `refunds.test.ts` (9 tests): Statutory MoE pro-rata formula, golden fixtures F1–F4, UI fixtures U1–U2, informational shortfall safeguard, waiver generation.
  - `matching.test.ts` (3 tests): Unmatched payment candidate scoring engine (ref/name/amount).
  - `rbac.test.ts` (6 tests): Centre scoping, DPDP consent gating, Counsellor ledger exclusion, maker-checker enforcement (`approverId !== requesterId`).
  - `auth-api.test.ts` (9 tests): Parent demo OTP send/verify, session tokens, staff login.
  - `csv-sanitizer.test.ts` (7 tests): Spreadsheet formula injection neutralization (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - `payment-webhook.test.ts` (4 tests): HMAC-SHA256 signature verification, tampering detection.
  - `payment-sandbox-matrix.test.ts` (14 tests): Full 13-scenario sandbox matrix (valid capture, redirect pending, provider timeout, duplicate idempotency, replay safety, unmatched routing, currency/amount rejection, partial bounds, excess unallocated retention, consecutive captures).
  - `components.test.tsx` (5 tests): `<Rail />` 4-segment & 3-segment progress rendering, StatusChip tones, ProvenanceChip, DemoBar.
  - `parent-nav.test.tsx` (4 tests): `<ParentBottomNav />` 4-destination accessibility, active route indicators, multilingual support.
- **Financial Invariants Certified:**
  1. Money Precision: Integer paise throughout; zero floating-point arithmetic.
  2. Ledger Primacy: Derived balances only; append-only signed entries (`CHARGE`, `DISCOUNT`, `ALLOCATION`, `REVERSAL`, `WAIVER`).
  3. Zero Client Trust: Redirects land on Pending only; only HMAC-verified webhooks mutate the ledger.
  4. Pro-Rata Refund Safeguard: Inclusive calendar days (`T` and `c`), ₹0 deduction, informational shortfall in neutral slate (`#505A66`), approved withdrawal waives unpaid ordinary instalments to ₹0.
  5. Maker-Checker Separation: Server-enforced `approverId !== requesterId` on all refund and waiver decisions.
  6. CSV Injection Hardening: All Tally, audit, and import error exports sanitized against formula triggers.
  7. Dual-Entry Reconciliation: Preserves distinct meaning for captured, allocated, refunded, and exported totals.

