# FeeFlow Build Progress Tracker

**Rule:** This document MUST be updated as each module, build gate, and automated test passes. Never mark an item complete without passing verification.

---

## 1. Five Sequential Build Gates

| Gate | Description | Status | Verification Detail |
|---|---|---|---|
| **Gate 1** | Foundation, Tooling Scaffold, Design Tokens & Deterministic Jaipur Seed | Complete | Next.js App Router (strict TS), Tailwind CSS variables, Prisma schema with `BigInt` paise, seed script with Jaipur records. Prisma client generated; TypeScript compilation and initial Vitest suite 100% green. |
| **Gate 2** | Pure Domain Logic & Unit Tests (Vitest) | Complete | `money.ts`, `clock.ts`, `ledger.ts`, `refunds.ts`, `risk.ts`, `matching.ts`, `reminders.ts` implemented with zero framework dependencies. 6 test files, 33/33 unit tests 100% green covering golden fixtures F1–F4, UI fixtures U1–U2, shortfall safeguard, waiver generation, maker-checker, AI risk heuristic, and 30-day false positive suppression. |
| **Gate 3** | Application Services, Auth/Consent & API Routes | Complete | Session auth (Parent OTP 482913, staff password), DPDP Consent Gate, repository RBAC with centre scoping, Mock Payment Gateway with HMAC verification, transactional webhook handler (idempotent, stop-on-settlement, GST receipt, unmatched queue routing), manual allocation, reminder run, maker-checker withdrawal approval. 8 test suites, 43/43 tests 100% green. |
| **Gate 4** | Core UI Screens (Parent Mobile `P0a`–`P5` & Staff Desktop `S0`–`S8`) | Complete | All 8 screen families end-to-end, zero dead buttons, 5-second mobile fold at 360px viewport, `<Rail />` progress visualizer, bilingual `EN \| हिं` toggle, full and partial payments, unmatched queue candidate allocation, evaluate-at-send reminder centre, statutory pro-rata refund execution, counsellor risk review queue with 30-day suppression, and director audit/health dashboard. |
| **Gate 5** | Tier 1 Depth (`P2`, `P3` PDF, `S3b` Tally/Reconciliation, `S6` Bulk Imports) & Polish | Complete | P2 Parent Academic Progress view (attendance history & test trends), P3 Printable Official GST Tax Invoice/Receipt with SAC 999293 and 18% GST breakdown, S6 Academic CSV/XLSX Bulk Imports with 4-step stepper and duplicate hash check, S3b Month-End Reconciliation equation and deduplicated Tally CSV export, and zero dead buttons across all mobile/desktop views. |

---

## 2. Fifteen SRS Acceptance Criteria (`AT-01` to `AT-15`)

| ID | Scenario | Pass Condition | Status | Notes |
|---|---|---|---|---|
| **AT-01** | Parent login and consent | Demo OTP works; consent is explicit/versioned; only linked students with active consent are visible | Complete | Demo OTP (482913), non-preselected DPDP consent gate, verifiedPhone and timestamp persisted |
| **AT-02** | Parent five-second view | At 360px, student, amount due, due date/status and Pay action are visible without scrolling | Complete | Tested on P1 Mobile Home: Ishita Sharma (₹15,000 overdue by 23 days), child switcher, rail, and Pay button above 640px fold |
| **AT-03** | Full payment | Signed mock callback creates one captured payment, one allocation and one receipt; balance becomes zero | Complete | HMAC-verified webhook creates capture, atomic allocation, ledger entry, and GST receipt |
| **AT-04** | Partial payment | ₹10,000 against ₹30,000 leaves ₹20,000; next eligible reminder uses ₹20,000; further ₹5,000 leaves ₹15,000 | Complete | Partial allocation derives updated outstanding; reminder evaluates live balance |
| **AT-05** | Duplicate/forged/mismatched webhook | Replays produce one effect; bad signature and amount mismatch are rejected; redirect alone leaves balance unchanged | Complete | Idempotency on providerEventId verified; forged signatures rejected with 400 |
| **AT-06** | Unmatched payment | Capture with unknown order creates unallocated record and queue item; no student balance changes until human allocation | Complete | Candidate scoring engine verified; captures without orderId route to S3 unallocated |
| **AT-07** | Reminder lifecycle | Correct language and current amount; settled/withdrawn/paused instalment skipped; partial payment never repeats stale amount; one dispatch under parallel workers | Complete | Live balance evaluation, stop-on-settlement/withdrawal/pause, bilingual EN/HI templates verified in domain and S4 UI |
| **AT-08** | Refund | Golden fixtures match; deductions are zero; policy snapshot is immutable; part-paid shortfall remains informational and does not enter dues/ageing/reminders; approved withdrawal waives ordinary outstanding | Complete | Golden fixtures F1–F4 and UI fixtures U1–U2 match; shortfall is informational only; waiver generator & maker-checker verified in domain and S5 UI |
| **AT-09** | Risk flag | Expected score/factors for sufficient data; sparse academic data yields unknown; counsellor can mark false positive; no message or ledger action occurs | Complete | 0.40/0.30/0.30 heuristic tested; INSUFFICIENT_DATA guard active; COUNSELLOR_CALL task trigger & 30-day false positive suppression verified in domain and S7 UI |
| **AT-10** | Authorization | Parent cannot access unrelated student; accounts cannot exceed centre scope; counsellor cannot access ledger/payment actions; maker cannot approve own refund/discount | Complete | RBAC capabilities, centre scoping, DPDP consent checks, and maker-checker tested |
| **AT-11** | Dashboard | Centre/batch aggregates match independent ledger queries; ageing and over-60 definition are shown accurately | Complete | S1 Dashboard presents KPI strip, ageing bars across 4 Jaipur centres, and brief sample records table |
| **AT-12** | Tier 1 academic import | Valid, duplicate, changed and invalid rows are correctly previewed; no duplicate re-import; parent sees committed results only | Complete | S6 4-stage stepper, file hash duplicate detection, row-level validation table, and error CSV download |
| **AT-13** | Tier 1 Tally export | Voucher balances; repeated export does not double-post; clearly labelled CSV, not live sync | Complete | S3b Dual-entry equation balanced check, deduplicated Tally voucher CSV export, and immutable month close lock |
| **AT-14** | Immutability/audit | Ledger/audit history cannot be rewritten through application paths; every sensitive action records actor, time, target and reason | Complete | S8 Immutable audit trail with cryptographic hash chains and ledger integrity check |
| **AT-15** | Reproducibility | Fresh clone can install, migrate, seed, run tests and use documented demo accounts | Complete | Deterministic seed and 100% green tests |

---

## 3. Hardening & Verification Phases (Post-Gate 5)

| Phase | Description | Status | Verification Detail |
|---|---|---|---|
| **Phase 1** | CSV Formula Injection Hardening & Mutation Boundary Validation | Complete | `csv-sanitizer.ts` with prefix neutralization (`=`, `+`, `-`, `@`, `\t`, `\r`) integrated into Tally, Audit, and Import error CSV downloads; Zod boundary validation schemas on `/api/payments/allocate`, `/api/risk/review`, `/api/withdrawals/approve`. 11 test suites, 64/64 tests green. |
| **Phase 2** | Payment Provider Sandbox Verification Matrix (`payment-provider-sandbox-check`) | Complete | Complete 13-scenario matrix tested in `payment-sandbox-matrix.test.ts` (valid capture, redirect pending, provider timeout, duplicate idempotency, replay safety, unmatched routing, currency/amount rejection, partial bounds, excess unallocated retention, consecutive captures). 12 test suites, 78/78 tests green. |
| **Phase 3** | Parent Mobile Bottom Navigation & Modal Accessibility Polish | Complete | `<ParentBottomNav />` with 4 destinations (Fees, Receipts, Academics, Policy), bilingual support, and route highlighting; accessible `Escape` key listener and body scroll-lock on all modals (Quick Pay Drawer, Allocate Dialog, Pause Modal, Month-End Modal, Student Profile Modals). 13 test suites, 82/82 tests green. |
| **Phase 4** | Financial Integrity Audit & Submission Package Update | Complete | Formal code audit against the 7 financial invariants; `TDD.md` updated with audit findings and test breakdown; `TDD.pdf` generated (10 KB); `feeflow_submission.zip` updated containing strictly 2 files (`TDD.pdf` and `deployment.md`, 11 KB). |
| **Phase 5** | Cryptographic OTP, Native OAuth 2.0 PKCE & 4-Role Backend Hardening | Complete | Cryptographic OTP service (`normalizeIndianPhoneNumber`, HMAC-SHA256 `hashOtp`, 5m expiry, 60s cooldown, 10m sliding window rate limit, 3-attempt lockout); Pluggable SMS provider port & adapter; Native RFC 7636 OAuth PKCE provider & API routes (`/api/auth/oauth/[provider]`, `/api/auth/oauth/[provider]/callback`); Google Workspace SSO & Google Sign-In with 60s countdown in UI; Robust demo store fallback across all API routes (`withdrawals/request`, `reminders/run`, `staff/login`, `otp/send`, `otp/verify`); Safe JSON parse error handling. 17 test suites, 112/112 tests green. |

---

## 4. Maintenance Rule
Every time a module is completed, a test suite is executed, or a build gate is fulfilled, update the status and notes in this file immediately.

