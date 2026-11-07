# FeeFlow Build Progress Tracker

**Rule:** This document MUST be updated as each module, build gate, and automated test passes. Never mark an item complete without passing verification.

---

## 1. Five Sequential Build Gates

| Gate | Description | Status | Verification Detail |
|---|---|---|---|
| **Gate 1** | Foundation, Tooling Scaffold, Design Tokens & Deterministic Jaipur Seed | Complete | Next.js App Router (strict TS), Tailwind CSS variables, Prisma schema with `BigInt` paise, seed script with Jaipur records. Prisma client generated; TypeScript compilation and initial Vitest suite 100% green. |
| **Gate 2** | Pure Domain Logic & Unit Tests (Vitest) | Complete | `money.ts`, `clock.ts`, `ledger.ts`, `refunds.ts`, `risk.ts`, `matching.ts`, `reminders.ts` implemented with zero framework dependencies. 6 test files, 33/33 unit tests 100% green covering golden fixtures F1–F4, UI fixtures U1–U2, shortfall safeguard, waiver generation, maker-checker, AI risk heuristic, and 30-day false positive suppression. |
| **Gate 3** | Application Services, Auth/Consent & API Routes | Pending | Parent OTP login, per-child DPDP consent, staff login, HMAC payment webhook, manual allocation, reminder run, maker-checker refund. |
| **Gate 4** | Core UI Screens (Parent Mobile `P0a`–`P5` & Staff Desktop `S0`–`S8`) | Pending | All 8 screen families end-to-end, zero dead buttons, 5-second mobile fold, `<Rail />`, bilingual toggle, full & partial payment flow. |
| **Gate 5** | Tier 1 Depth (`P2`, `P3` PDF, `S3b` Tally/Reconciliation, `S6` Bulk Imports) & Polish | Pending | Academic imports, Tally CSV export, month-end equation, PDF receipt generation, responsive and accessibility QA. |

---

## 2. Fifteen SRS Acceptance Criteria (`AT-01` to `AT-15`)

| ID | Scenario | Pass Condition | Status | Notes |
|---|---|---|---|---|
| **AT-01** | Parent login and consent | Demo OTP works; consent is explicit/versioned; only linked students with active consent are visible | Pending | |
| **AT-02** | Parent five-second view | At 360px, student, amount due, due date/status and Pay action are visible without scrolling | Pending | |
| **AT-03** | Full payment | Signed mock callback creates one captured payment, one allocation and one receipt; balance becomes zero | Pending | |
| **AT-04** | Partial payment | ₹10,000 against ₹30,000 leaves ₹20,000; next eligible reminder uses ₹20,000; further ₹5,000 leaves ₹15,000 | In Progress | Domain ledger derivation & evaluate-at-send reminder tests passing (33/33 green) |
| **AT-05** | Duplicate/forged/mismatched webhook | Replays produce one effect; bad signature and amount mismatch are rejected; redirect alone leaves balance unchanged | Pending | |
| **AT-06** | Unmatched payment | Capture with unknown order creates unallocated record and queue item; no student balance changes until human allocation | In Progress | Candidate scoring engine tested (MOHIT G 0219); non-auto-allocation rule enforced |
| **AT-07** | Reminder lifecycle | Correct language and current amount; settled/withdrawn/paused instalment skipped; partial payment never repeats stale amount; one dispatch under parallel workers | In Progress | Live balance evaluation, stop-on-settlement/withdrawal/pause, bilingual EN/HI templates tested |
| **AT-08** | Refund | Golden fixtures match; deductions are zero; policy snapshot is immutable; part-paid shortfall remains informational and does not enter dues/ageing/reminders; approved withdrawal waives ordinary outstanding | In Progress | Golden fixtures F1–F4 and UI fixtures U1–U2 match down to paise; shortfall is informational only; waiver generator & maker-checker tested |
| **AT-09** | Risk flag | Expected score/factors for sufficient data; sparse academic data yields unknown; counsellor can mark false positive; no message or ledger action occurs | In Progress | 0.40/0.30/0.30 heuristic tested; INSUFFICIENT_DATA guard active; COUNSELLOR_CALL task trigger & 30-day false positive suppression verified |
| **AT-10** | Authorization | Parent cannot access unrelated student; accounts cannot exceed centre scope; counsellor cannot access ledger/payment actions; maker cannot approve own refund/discount | Pending | |
| **AT-11** | Dashboard | Centre/batch aggregates match independent ledger queries; ageing and over-60 definition are shown accurately | Pending | |
| **AT-12** | Tier 1 academic import | Valid, duplicate, changed and invalid rows are correctly previewed; no duplicate re-import; parent sees committed results only | Pending | |
| **AT-13** | Tier 1 Tally export | Voucher balances; repeated export does not double-post; clearly labelled CSV, not live sync | Pending | |
| **AT-14** | Immutability/audit | Ledger/audit history cannot be rewritten through application paths; every sensitive action records actor, time, target and reason | Pending | |
| **AT-15** | Reproducibility | Fresh clone can install, migrate, seed, run tests and use documented demo accounts | Pending | |

---

## 3. Maintenance Rule
Every time a module is completed, a test suite is executed, or a build gate is fulfilled, update the status and notes in this file immediately.

