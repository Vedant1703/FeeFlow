# FeeFlow — Software Requirements Specification (Consolidated Final Baseline)

**Version:** 2.2 FINAL (Aligned with UI Reference v1.0, Wireframes v1.0 & 22-Page UI Visual Book)  
**Project:** Isocode Software Development Intern take-home · Problem 4  
**Client scenario:** Company A, Jaipur · Coaching institute fee tracking and parent portal  
**Baseline date:** 7 November 2026  
**Status:** Development baseline for the take-home implementation

> **Authority and precedence.** This document consolidates the original problem statement, the refined SRS v2.0 and the accepted v2.1 refund-policy amendments. It supersedes conflicting priority labels and implementation notes in those earlier drafts. The original problem statement remains authoritative for client requirements. Statements marked **[BRIEF]** come directly from the task; **[DESIGN]** are engineering choices; **[ASSUMPTION]** are provisional values selected so the take-home can be built; **[PRODUCTION GATE]** requires institute, legal or accounting confirmation before real use.

---

## 1. Product summary

FeeFlow is a fee-collection and financial-operations platform for a multi-centre coaching institute. It gives parents a clear view of what they owe and when, while giving accounts staff one reliable way to manage fee plans, instalments, payments, reminders, refunds and collection ageing across centres and batches.

FeeFlow is **not** a learning-management system, admissions CRM or replacement for Tally. Its centre of gravity is the student fee ledger and the workflows around it.

### 1.1 Client context [BRIEF]

| Attribute | Scenario |
|---|---:|
| Location | Jaipur, Rajasthan |
| Centres | 4 |
| Students | Approximately 2,600 |
| Staff | Approximately 140 |
| Annual revenue | Approximately ₹30–34 crore |
| Average annual fee | Approximately ₹1.2 lakh |
| Payment pattern | Usually 3 or 4 instalments |

Current operations use desktop fee software, centre-level Excel due sheets, Tally posting, calls/WhatsApp reminders, PDF receipts and manually calculated refunds. The problem statement estimates an annual operational drag of ₹79.2 lakh from assumed uncollected fees and staff time spent chasing dues. This is the brief's illustrative business case, not a guaranteed saving or ROI forecast.

### 1.2 Product promise

- **Parents:** Know the current amount due, its due date and how to pay without calling the centre.
- **Accounts:** See and reconcile the fee position across centres and batches; every payment and adjustment has a traceable record.
- **Counsellors:** Receive explainable risk-review tasks, not automatic adverse actions.
- **Director:** See collection health and review sensitive decisions.

## 2. Scope hierarchy — the most important delivery rule

The brief asks for a small, real end-to-end product in approximately **6–8 screens**. It explicitly defines a **CORE BUILD** and says the rest of the MUST HAVE list is optional depth. The implementation must therefore follow this order.

### 2.1 Tier 0 — Must ship end to end (the brief's CORE BUILD) [BRIEF]

1. Student fee ledger: fee plan, instalments, discounts, payments, outstanding balance and days overdue.
2. Parent portal: OTP login, current dues and payment link.
3. Payment workflow: instalment payment, server-validated amount, verified asynchronous callback, partial payment and unmatched-payment queue.
4. Reminder workflow: Hindi or English reminders before, on and after due dates; no stale amount; stop when the instalment is fully settled. After a partial payment, later reminders may resume only for the updated outstanding amount.
5. Published-policy pro-rata refund calculator and withdrawal handling.
6. Accounts dashboard: cross-centre and batch dues with ageing.
7. Dropout-risk flag that creates a counsellor task only; counsellor can mark false positives. No parent message or fee action from the flag.
8. Parent/accounts authentication and authorization, centre/student scoping, audit trail and realistic seeded data.

**Required constraints attached to the core:** a minimal verifiable parental-consent gate must protect access to a minor's records; the receipt record/view must have GST/tax fields driven by configuration; all visible core controls must work; loading, empty, error and pending states must be present. These are not decorative stretch goals.

### 2.2 Tier 1 — Remaining MUST HAVE depth, after Tier 0 passes [BRIEF: optional depth]

- Parent receipt history and downloadable PDF receipt with GST/tax breakdown from the configured tax profile.
- Parent attendance and test-score view.
- Bulk attendance and test-score upload per batch, with preview and row-level errors.
- Tally-compatible CSV export and month-end reconciliation view.
- Additional report drill-downs and import history.

These are part of the broader MUST HAVE list, but the brief explicitly allows the remainder to be treated as optional depth after the core slice is complete. Build a small, correct version if time remains; do not let them delay Tier 0.

### 2.3 Tier 2 — Optional integration depth

- Razorpay Test Mode adapter behind the payment-provider interface. The signed mock gateway is the required baseline and must exercise the real verification path.
- Enhanced reminder retry dashboard and demo-clock controls.
- Larger generated dataset/performance exercise beyond the brief sample records.

### 2.4 Tier 3 — Document, do not build for this take-home

- Real SMS/WhatsApp delivery and production OTP provider.
- Staff MFA and full user-administration console.
- Spreadsheet column-mapping UI for arbitrary centre formats.
- Multi-institute tenancy.
- General-ledger replacement or live Tally synchronisation.
- Trained machine-learning dropout model.
- Full bank settlement-file reconciliation, production retention/erasure operations and restore rehearsal.

### 2.5 Explicitly out of scope [BRIEF]

Video lectures or a learning platform, timetables, and admissions CRM.

### 2.6 Screen-count interpretation

The product has **eight primary screen families**, not 22 independent product screens. The 22-page `FeeFlow_UI_Screens.pdf` (paired with `FeeFlow_UI_Reference_v2.2_FINAL.md` and `FeeFlow_Wireframes_v2.2_FINAL.md`) contains design foundations (pages 1–4), Parent mobile views `P0a`–`P5` (pages 5–10), Staff desktop views `S0`–`S8` (pages 11–21), and Handoff specs (page 22). Login (`P0a`/`P0b`/`S0`), consent (`P0c`), pay sheet (`P1b`), mock checkout (`P1c`), payment states (`P1d`/`P1e`), public refund policy (`P5`), reconciliation (`S3b`), and director policy/audit (`S8`) are supporting views, tabs, sheets, or states within the 8 core screen families.

## 3. Users and roles

The brief explicitly names parents, students, centre/accounts staff and the founder-director; it also requires a counsellor task for the risk flag. The take-home uses four roles to represent these responsibilities.

| Role | Purpose | Core access |
|---|---|---|
| PARENT | Parent/guardian on mobile | Linked student dues, payment action, consent, receipts and (Tier 1) academic records |
| ACCOUNTS | Centre accounts executive | Students and fee ledgers within assigned centres; payment allocation; reminders; withdrawals/refund requests; dashboard |
| COUNSELLOR | Reviews risk tasks | Academic and risk factors only; no fee ledger rows, payment actions or parent messaging |
| DIRECTOR | Founder-director / oversight | Cross-centre view, policy publication and approval of sensitive requests; cannot approve own request |

A student is a record subject in this release, **not a separate login role**. Parent access is through the guardian account. Centre scope is independent of role and is enforced by repository/service queries, not by hiding UI controls.

### 3.1 Authorization rules [DESIGN]

- Every protected service receives an authenticated `Actor` containing user, role/capabilities, centre scope and linked-student scope.
- Parent reads require a verified parent identity, active parent–student link and active consent.
- Accounts actions are restricted to assigned centre(s).
- Counsellors see risk factors and academic records only. The fee-risk signal is shown as a factor value, not as financial ledger detail.
- A refund or discount approver must differ from its requester (maker-checker). If this is too costly for Tier 0, keep approval in a clearly separate director demo account rather than silently allowing self-approval.
- Out-of-scope parent records return not-found semantics; opaque IDs are used externally.

## 4. Functional requirements

### 4.1 Identity, access and consent — Tier 0

- Parent authenticates with OTP to the registered mobile number. The take-home may use a demo OTP inbox; it must be visibly labelled and must not pretend to send SMS.
- Staff uses a separate demo login with role-specific seeded accounts.
- OTP is single-use, expiring, rate-limited and never stored in plaintext.
- Before viewing a minor's records, capture affirmative guardian consent with notice version, language, purposes, verified-phone reference and timestamp. The checkbox must not be preselected.
- Withdrawal of consent removes parent access to the affected student and creates an internal notice.
- Store only the data required for the demo. Use synthetic records and fake/reserved test phone numbers.

### 4.2 Fee plans, instalments and ledger — Tier 0

- Accounts can create a fee plan with a total, service period and one or more instalments.
- Instalment amounts must sum to the approved plan total after approved discounts.
- The ledger is the source of truth. Positive signed entries increase the amount owed; negative entries reduce it.
- Required entry types include `CHARGE`, `DISCOUNT`, `ALLOCATION`, `REVERSAL`, `WAIVER` and (only where needed to undo a failed withdrawal/refund adjustment) `REFUND_ADJUSTMENT`.
- Balances, settlement (`UNPAID`, `PARTIAL`, `PAID`, `CANCELLED`) and days overdue are derived, not independently editable fields.
- Days overdue is `max(0, businessDate - dueDate)` only while outstanding is greater than zero and the instalment is not cancelled.
- Corrections use reversing entries; historical ledger rows are not edited or deleted.
- Discounts appear in the ledger only after the configured approval path.

### 4.3 Parent portal and payments — Tier 0

- Parent home displays the selected child, total amount due, due date or days overdue, instalment detail and one primary Pay action.
- Parent may pay the full outstanding or a permitted partial amount. The minimum partial amount is a labelled assumption of ₹1,000, or the outstanding if lower; the server validates the final amount.
- Parent sees a hosted checkout-style page. The mock provider has deterministic Succeed, Fail and Stay Pending outcomes and calls the same signed asynchronous webhook route used by a real provider.
- The frontend success redirect is never proof of payment.
- Only a signature-verified, provider-confirmed capture can create a payment and affect the ledger.
- A captured payment is allocated up to the current outstanding amount. Any excess stays unallocated for accounts review; no instalment may be over-allocated.
- A payment with no exact order match is stored as unallocated and routed to the accounts queue. A suggestion is never auto-allocated.
- Duplicate webhook events and duplicate provider payment IDs produce one financial effect.
- Receipt record is created for each captured payment; the payment receipt shows captured amount and reference separately from its allocation/outstanding state. To satisfy the brief's constraint ('Receipts must show GST') while maintaining tax configurability, receipts render GST/tax fields from the institute's configured tax profile (seeded in demo mode with clearly labelled synthetic GST metadata: Demo GSTIN `08AABCC1234D1Z5 [SYNTHETIC]`, SAC `999293`, and configurable CGST/SGST display lines so GST is visibly demonstrated on `P1d` and `P3` without hardcoding unapproved statutory claims in business logic).

### 4.4 Reminders — Tier 0

- Rules cover before, on and after due date. The default candidate offsets are -7, -3, 0, +3, +7, +15 and +30 days [ASSUMPTION].
- Messages are in the parent's selected English or Hindi language.
- The system evaluates eligibility at send time and reads the current ledger balance. A stale amount is never sent.
- Full settlement, cancellation, approved withdrawal or an active pause makes the instalment ineligible and the reminder is skipped. In addition to send-time evaluation, when a verified payment settles an instalment in full, any queued `DUE` reminder dispatches for that instalment are immediately marked `SKIPPED` (`reason: 'Instalment settled'`) within the same transaction so reminders stop the moment someone pays.
- After a partial payment, a later eligible reminder may be sent for the updated balance; an obsolete amount must never be repeated.
- Maximum one reminder per parent/student per day. Quiet hours default to 21:00–08:00 IST [ASSUMPTION].
- The mock messaging adapter records the exact rendered message and outcome. It does not send a real SMS/WhatsApp message.
- Retry may use bounded attempts/backoff. Failed deliveries remain visible to accounts.

### 4.5 Withdrawal and refund — Tier 0

- The system stores withdrawal request date and effective withdrawal date separately.
- The refund calculator loads the immutable published policy version and shows all inputs, formula lines, policy hash and output.
- Refund Policy v1 defaults: pro-rata, inclusive calendar days, ₹0 fixed deduction, 0 basis points percentage deduction. The exact day-count convention is a labelled assumption, not a formula expressly provided by the source guideline.
- The ten-day processing target is recorded from the request date as a provisional operational assumption; its legal clock-start event must be confirmed before production.
- For a full-paid student leaving mid-course, the policy calculator provides the remaining-period pro-rata outcome in line with the source principle where applicable.
- For a part-paid withdrawal, the calculator may show an indicative refund or indicative shortfall as an extension of the published policy assumption. An indicative shortfall is **informational only** in the take-home: it is not a collectible receivable, cannot appear in normal dues ageing, cannot be shown as ordinary parent dues, and cannot trigger reminders or collections.
- On approved withdrawal, waive all ordinary unpaid instalment balances for the withdrawn course in the fee ledger. Preserve the indicative shortfall in the refund calculation snapshot only. This supersedes the earlier v2.0 rebase that left a shortfall as an outstanding ledger balance.
- Refund execution is separate from the calculation and approval. Refund items are capped by each payment's unrefunded captured amount. A gateway request being accepted is not the same as a completed refund.
- Maker-checker: the approver differs from the requester. Failed refund items remain visible and retryable.
- Centre registration cancellation/self-closure is a distinct full-refund reason/workflow; do not apply the ordinary mid-course formula blindly.
- Hostel/mess fees are separate components only if the institute actually provides them.
- GST/credit-note treatment is a separate accountant-approved process. No 18% rate or tax rule is assumed.

**Source boundary and derivation:** the brief cites the Ministry of Education's January 2024 coaching-centre guidelines, whose fee provision describes a pro-rata refund within 10 days for a student who has paid the course fee in full and leaves mid-course, and addresses hostel/mess fees where applicable. The source establishes the pro-rata/10-day principle; it does **not** prescribe the exact inclusive-calendar-day formula above, the request-date clock trigger, a fixed/percentage deduction, or an automatic right to recover a part-paid shortfall. Those are therefore labelled product assumptions and are not represented as statutory wording. The Rajasthan Coaching Centres (Control and Regulation) Act, 2025 contains related fee/refund provisions and a four-equal-instalment option, but commencement, current rules and institute applicability must be verified from the relevant Gazette notification before the product claims compliance. This SRS is not legal, tax or accounting advice.

**Formula (policy assumption):**

Let `N` = net fee after approved discounts; `P` = captured payments allocated to the service component less completed refunds attributed to it; `S` and `E` = service-period start/end; `W` = effective withdrawal date; `T` = inclusive total calendar days; `c` = inclusive consumed days, clamped to `[0,T]`.

```text
T = days(E) - days(S) + 1
c = clamp(days(W) - days(S) + 1, 0, T)
earned = roundHalfUp(N * c / T)
deduction = 0
indicativeObligation = min(N, earned + deduction)
potentialRefund = max(0, P - indicativeObligation)
indicativeShortfall = max(0, indicativeObligation - P)
```

All money is integer paise (`bigint`); no floating-point arithmetic. The result is a deterministic policy calculation, **not legal advice and not proof that a part-paid shortfall is recoverable**.

**Golden fixtures (term 1 Apr 2026–31 Mar 2027, `N = ₹1,20,000`, `T = 365`):**

| Fixture | Paid (`P`) | Effective withdrawal (`W`) | Consumed days | Earned fee | Potential refund | Indicative shortfall |
|---|---:|---|---:|---:|---:|---:|
| F1 | ₹60,000 | 12 Jun 2026 | 73 | ₹24,000.00 | ₹36,000.00 | ₹0 |
| F2 | ₹60,000 | 18 Oct 2026 | 201 | ₹66,082.19 | ₹0 | ₹6,082.19 (informational only) |
| F3 | ₹30,000 | 20 Mar 2026 | 0 | ₹0.00 | ₹30,000.00 | ₹0 |
| F4 | ₹1,20,000 | 1 May 2027 | 365 (clamped) | ₹1,20,000.00 | ₹0 | ₹0 |

F2 must not create an ordinary receivable or collection action. These fixtures validate the chosen formula; they do not expand the legal source beyond its stated pro-rata principle.

**UI-Seeded Demo Refund Fixtures (Service period `15 Jun 2026–31 Mar 2027`, `N = ₹1,20,000`, `T = 290` inclusive days):**

| UI Fixture | Student | Paid (`P`) | Effective withdrawal (`W`) | Consumed days (`c`) | Earned fee | Potential refund | Indicative shortfall | UI Screen |
|---|---|---:|---|---:|---:|---:|---:|---|
| U1 (Part-paid) | `STU-0587` Ishita Sharma | ₹45,000 | 5 Nov 2026 | 144 | ₹59,586.21 | ₹0.00 | ₹14,586.21 (informational only) | `S5a` (PDF p. 17) |
| U2 (Full-paid) | `STU-1038` Kavya Rathore | ₹1,20,000 | 28 Oct 2026 | 136 | ₹56,275.86 | ₹63,724.14 (split ₹30k + ₹30k + ₹3,724.14) | ₹0.00 | `P4`, `P5`, `S5b` (PDF pp. 10, 18) |

### 4.6 Dashboard and ageing — Tier 0

- Filters: centre, batch and as-of date.
- Measures: billed, verified collected, outstanding, ageing buckets, unmatched-payment count/amount and refunds due.
- Ageing buckets: not due, 1–30, 31–60 and over 60 days.
- Every aggregate drills to the records supporting it.
- The client success target is to reduce the over-60 measure from 12% to 6% over two terms. The take-home can show a clearly defined snapshot metric; it must not claim that a few demo days prove the two-term outcome.
- Parent calls reduced by 70% and month-end reconciliation reduced from 4 days to 1 are business targets. Parent calls require external measurement; month-end process can be supported by a reconciliation view.

### 4.7 Dropout-risk flag — Tier 0

- A deterministic, versioned and explainable heuristic uses missed instalments, attendance trend and test-score trend.
- Default weights/windows/thresholds from the refined design are assumptions, not trained-model parameters: fee 0.40, attendance 0.30, tests 0.30; attendance recent/baseline windows 28/56 days; tests compare recent three with prior three within 120 days; high ≥60, medium 35–59, low <35.
- Signals with insufficient data are excluded and weights renormalised. If neither academic signal is sufficient, show unknown/insufficient data, not low risk.
- High risk creates a **counsellor call task** (`task_type: 'COUNSELLOR_CALL'`); medium appears on the watchlist. Counsellor may mark reviewed, follow-up required or false positive (which suppresses repeat tasks for 30 days unless the score rises materially by >=15 points).
- The flag never sends a parent message, changes fees, changes payment state or takes adverse action. This separation is enforced by module dependencies and tests.
- UI calls this a “risk score” or “risk flag”, never dropout probability.

### 4.8 Tier 1 depth features

- CSV/XLSX attendance and test-score import with upload hash, staging, row validation, preview, duplicate/changed detection, row-level error CSV and transaction commit.
- Parent academic progress view showing imported attendance and test results, not internal risk score or counsellor notes.
- Tally-compatible CSV export with balanced vouchers, deduplication and immutable export-batch metadata; it is not live Tally sync.
- Downloadable PDF receipts with configured GST fields and the exact captured payment snapshot.

## 5. Eight primary screen families

| # | Primary screen family | Primary user | Required content | Priority |
|---:|---|---|---|---|
| 1 | Parent Portal | Parent | OTP/consent entry, child switcher, amount due, due date, pay action, payment state | Tier 0; academic/receipt depth Tier 1 |
| 2 | Accounts Dashboard | Accounts / Director | Centre/batch metrics, outstanding, ageing, exceptions | Tier 0 |
| 3 | Student Fee Ledger | Accounts | Plan, instalments, discounts, payments, balance, days overdue, timeline | Tier 0 |
| 4 | Payments & Exceptions | Accounts | Payment attempts/captures, webhook outcomes, unmatched queue, manual allocation | Tier 0 |
| 5 | Reminder Centre | Accounts | Rules, bilingual preview, current amount, sent/skipped/failed states | Tier 0 |
| 6 | Withdrawals & Refunds | Accounts / Director | Published policy, calculation, informational shortfall, approval and refund items | Tier 0 |
| 7 | Risk Review | Counsellor | Risk task queue, factors, data sufficiency and review outcome | Tier 0 |
| 8 | Academic Imports & Reporting | Accounts / Counsellor | Batch imports, parent progress data, Tally export and month close | Tier 1 depth |

Supporting views/drawers (not separate primary screens): staff login, parent OTP verification, consent gate, fee-plan editor, pay-amount sheet, mock checkout, payment result/receipt, public refund policy, payment-match dialog, audit/system-health viewer.

## 6. Data model summary

The detailed schema may evolve, but the following business entities are required:

- Identity/org: `users`, `user_centres`, `parents`, `parent_students`, `consents`, `centres`, `courses`, `batches`, `students`.
- Fees: `fee_plans`, `instalments`, `discounts`, `ledger_entries`.
- Payments: `payment_intents`, `provider_events`, `payments`, `payment_allocations`, `receipts`, `number_sequences`.
- Reminders: `reminder_rules`, `reminder_templates`, `reminder_dispatches`, `reminder_pauses`, `communication_logs`.
- Refunds: `refund_policies`, `withdrawals`, `refunds`, `refund_items`.
- Tier 1 academics: `assessments`, `attendance_sessions`, `attendance_records`, `test_results`, `import_batches`, `import_rows`.
- Risk/governance: `risk_configs`, `risk_evaluations`, `risk_tasks`, `audit_log`, `outbox_events`, `settings`.

### 6.1 Domain invariants

1. INR is stored as integer paise in PostgreSQL `bigint` and TypeScript `bigint`.
2. Ledger history and audit history are append-only; corrections are compensating entries.
3. Outstanding is derived from signed ledger entries and cannot be negative.
4. Allocations cannot exceed a payment amount or an instalment's current outstanding.
5. Only a provider-verified captured payment can be allocated.
6. Provider event IDs and provider payment IDs are unique per provider.
7. Cumulative completed refunds cannot exceed the captured amount.
8. Receipt issuance is idempotent per captured payment.
9. Approved withdrawal removes ordinary collectible unpaid balances for that course; indicative shortfall is stored only in the refund snapshot.
10. No reminder is sent when an instalment is settled/cancelled, the student has withdrawn, or a pause is active.
11. Risk evaluation cannot write ledger records or send messages.
12. Parent data reads require active link and active consent.
13. Published refund policy versions are immutable; each request stores the policy snapshot/hash.

## 7. Architecture and technology

### 7.1 Architecture style

**Modular monolith**: one deployable Next.js application with enforced feature/domain boundaries. Do not introduce microservices for the take-home.

### 7.2 Recommended stack

| Layer | Technology | Purpose |
|---|---|---|
| Web application | Next.js App Router + React | Parent/staff UI, server actions and route handlers |
| Language | TypeScript strict | Shared types and safer business logic |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI or Radix primitives) | Accessible, consistent components with custom product styling |
| Database | PostgreSQL | Relational integrity, transactions, constraints, locking and derived views |
| ORM | Prisma + explicit SQL migrations | Type-safe data access; SQL for views, locks and triggers where needed |
| Validation | Zod | Validate forms, API boundaries, imports and environment variables |
| Sessions | Database-backed sessions; parent OTP and staff password login | Revocation and role-aware session policies without extra auth abstraction overhead |
| Password hashing | argon2id | Staff password storage |
| Payment | Mock provider required; Razorpay Test Mode optional | Same provider port and callback verification path |
| Messaging | Mock provider | Store rendered bilingual messages and outcomes; no real sending |
| PDF | `@react-pdf/renderer` | Receipt PDF when Tier 1 is implemented |
| i18n | `next-intl` or equivalent message catalog | English/Hindi parity and Indian number formatting |
| Testing | Vitest, fast-check, Playwright | Unit/property, integration and end-to-end verification |
| Deployment | Vercel + managed PostgreSQL | Small, reproducible deployment |

Use a persistent PostgreSQL job table and an authenticated scheduler tick endpoint for reminders. Redis/Kafka and microservices are not justified for this workload.

### 7.3 Layer boundaries

```text
UI / Route Handlers
        -> Application use-cases (authorize, transact, audit)
              -> Domain functions (pure rules: money, ledger, allocation,
                 ageing, reminders, refunds, matching, risk)
              <- Ports (PaymentProvider, MessagingProvider, OtpSender,
                 PdfRenderer, Clock)
        -> Infrastructure adapters (Prisma, SQL, mock/Razorpay, mock messaging)
```

- UI and route handlers do not query Prisma directly.
- Domain code does not import Next.js, Prisma or network clients.
- Business modules call other modules through public service interfaces, not each other's repositories.
- Provider calls do not happen while a financial row lock is held.
- Use database transactions and unique constraints for payment allocation/idempotency.
- A minimal transactional outbox is useful for decoupled follow-up work; do not build a general event platform.

### 7.4 Payment-provider port

```ts
interface PaymentProvider {
  createOrder(input: CreatePaymentInput): Promise<PaymentOrder>;
  verifyWebhook(rawBody: string, headers: Headers): VerifiedPaymentEvent | null;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
  refund(input: RefundInput): Promise<ProviderRefundResult>;
}
```

`MockPaymentProvider` is required. `RazorpayProvider` is optional after Tier 0 passes. Both must use the same payment service and verification workflow. No PayPal adapter is required for this India-domestic client scenario.

### 7.5 Time and demo clock

Inject a `Clock`/`businessDate()` abstraction. In demo mode, use a fixed business date of **2 November 2026** so the supplied sample labels are reproduced: Ishita is 23 days overdue from 10 October; Mohit is due in 13 days before 15 November. The demo UI must disclose “Demo data as of 2 Nov 2026”. Production mode uses the actual Asia/Kolkata business date.

## 8. Security, privacy and trust

- Server-side capability and centre/student scope on every data operation.
- OTP and login rate limits; secure, HTTP-only session cookies.
- CSRF/origin validation for state-changing operations where applicable.
- Validate webhook signature against raw body; fetch authoritative payment data and compare amount/currency/status.
- Secrets only in environment variables; never in source, sample `.env`, logs or submission ZIP.
- Redact payment payloads and personal data in logs; never store card data or OTP plaintext.
- Use synthetic student/parent records and fake reserved test phone numbers.
- Parental consent evidence is part of the take-home implementation; production notices, child-data handling, retention and erasure require qualified review.
- GSTIN/tax rate/receipt wording/credit-note processing must come from accountant-approved institute configuration; demo data must be visibly synthetic.

## 9. Acceptance criteria

The following are the release gates. Tier 0 cases must pass before Tier 1 work starts.

| ID | Scenario | Pass condition |
|---|---|---|
| AT-01 | Parent login and consent | Demo OTP works; consent is explicit/versioned; only linked students with active consent are visible |
| AT-02 | Parent five-second view | At 360 px, student, amount due, due date/status and Pay action are visible without scrolling |
| AT-03 | Full payment | Signed mock callback creates one captured payment, one allocation and one receipt; balance becomes zero |
| AT-04 | Partial payment | ₹10,000 against ₹30,000 leaves ₹20,000; next eligible reminder uses ₹20,000; further ₹5,000 leaves ₹15,000 |
| AT-05 | Duplicate/forged/mismatched webhook | Replays produce one effect; bad signature and amount mismatch are rejected; redirect alone leaves balance unchanged |
| AT-06 | Unmatched payment | Capture with unknown order creates unallocated record and queue item; no student balance changes until human allocation |
| AT-07 | Reminder lifecycle | Correct language and current amount; settled/withdrawn/paused instalment skipped; partial payment never repeats stale amount; one dispatch under parallel workers |
| AT-08 | Refund | Golden fixtures match; deductions are zero; policy snapshot is immutable; part-paid shortfall remains informational and does not enter dues/ageing/reminders; approved withdrawal waives ordinary outstanding |
| AT-09 | Risk flag | Expected score/factors for sufficient data; sparse academic data yields unknown; counsellor can mark false positive; no message or ledger action occurs |
| AT-10 | Authorization | Parent cannot access unrelated student; accounts cannot exceed centre scope; counsellor cannot access ledger/payment actions; maker cannot approve own refund/discount |
| AT-11 | Dashboard | Centre/batch aggregates match independent ledger queries; ageing and over-60 definition are shown accurately |
| AT-12 | Tier 1 academic import | Valid, duplicate, changed and invalid rows are correctly previewed; no duplicate re-import; parent sees committed results only |
| AT-13 | Tier 1 Tally export | Voucher balances; repeated export does not double-post; clearly labelled CSV, not live sync |
| AT-14 | Immutability/audit | Ledger/audit history cannot be rewritten through application paths; every sensitive action records actor, time, target and reason |
| AT-15 | Reproducibility | Fresh clone can install, migrate, seed, run tests and use documented demo accounts |

### 9.1 Edge states that must exist

At minimum: loading skeleton, empty workspace, no search results, validation error, provider pending/unknown, provider failure, webhook rejected, offline/last-known data, permission denied/not found, no consent, all fees paid, withdrawal, failed reminder, unmatched payment and retry state.

## 10. Seed data and demonstration

### 10.1 Preserve the three brief records verbatim [BRIEF]

| Student ID | Name | Batch | Due date | Amount | Paid | Expected label in 2 Nov 2026 demo |
|---|---|---|---|---:|---:|---|
| STU-0412 | Aarav Meena | JEE 2027 Morning | 10 Oct 2026 | ₹30,000 | ₹30,000 | Paid |
| STU-0587 | Ishita Sharma | JEE 2027 Evening | 10 Oct 2026 | ₹30,000 | ₹15,000 | Part paid; 23 days overdue |
| STU-0219 | Mohit Gurjar | NEET 2027 Morning | 15 Nov 2026 | ₹40,000 | ₹0 | Due in 13 days |

**Fee Plan Instalment Structure for Brief Sample Records (`₹1,20,000` annual fee in 3 or 4 instalments):**
- `STU-0412` (Aarav Meena, JEE 2027 Morning, Malviya Nagar): ₹1,20,000 in **4 equal instalments of ₹30,000** (Due: 10 Jul 2026 [Paid], 10 Oct 2026 [Paid], 10 Jan 2027 [Upcoming], 10 Mar 2027 [Upcoming]).
- `STU-0587` (Ishita Sharma, JEE 2027 Evening, Vaishali Nagar): ₹1,20,000 in **4 equal instalments of ₹30,000** (Due: 10 Jul 2026 [Paid ₹30,000], 10 Oct 2026 [Part paid ₹15,000, ₹15,000 due, **23 days overdue** as of 2 Nov 2026], 10 Jan 2027 [Upcoming ₹30,000], 10 Mar 2027 [Upcoming ₹30,000]).
- `STU-0219` (Mohit Gurjar, NEET 2027 Morning, Mansarovar): ₹1,20,000 in **3 equal instalments of ₹40,000** (Due: 15 Jul 2026 [Paid ₹40,000], 15 Nov 2026 [Unpaid ₹40,000, **Due in 13 days** as of 2 Nov 2026], 15 Feb 2027 [Upcoming ₹40,000]).

Seed synthetic parent accounts and related consent evidence (including a multi-child parent linking `STU-0587` Ishita Sharma and sibling `STU-0588` Kabir Sharma [All Paid] to demonstrate the child switcher on `P1` and `P1e`). Add deterministic synthetic students across all four Jaipur centres (Malviya Nagar, Vaishali Nagar, Mansarovar, Tonk Road) to demonstrate filtering, ageing, unmatched payments (`pay_demo_a91c` for Mohit Gurjar),refunds (`STU-1038` Kavya Rathore), and risk review (`STU-0731` Rohan Saini). Generating all 2,600 rows is a useful extra only after the core workflows work; it is not a Tier 0 gate.

### 10.2 Demo journeys

1. Parent logs in, consents, sees dues, pays a partial amount, receives a confirmed receipt and sees the updated balance.
2. Duplicate/forged payment callback is handled safely; unmatched capture goes to accounts queue.
3. Reminder run skips settled instalments and uses current amount for partially paid instalments.
4. Accounts records a withdrawal, sees the policy calculation and informational shortfall, and director approves; ordinary unpaid balance is waived.
5. Counsellor reviews a high-risk task and marks reviewed/false-positive without any automatic parent or fee action.
6. If Tier 1 is complete: import attendance/test data, parent views progress, and accounts generates the Tally CSV.

## 11. Delivery plan and scope discipline

Build in this order:

1. Repository, environment validation, PostgreSQL, Prisma migrations and deterministic seed.
2. Session/auth, parent link, consent and role/centre scoping.
3. Fee plan, instalments, append-only ledger, balance/ageing queries and student ledger screen.
4. Mock payment provider, hosted mock checkout, signed webhook, partial/full allocation, unmatched queue and receipt record.
5. Parent home and accounts dashboard, using the same derived financial data.
6. Reminder scheduler and bilingual mock messages; prove stop-on-settlement and updated partial balance.
7. Refund policy, pure formula, calculation snapshot, withdrawal rebase, approval and refund-item states.
8. Risk engine and counsellor task.
9. Only after Tier 0 acceptance passes: academic import/progress, receipt PDF, Tally export, Razorpay Test Mode and richer reporting.
10. QA, responsive/accessibility checks, TDD, deployment.md, public GitHub URL/live demo and final submission ZIP.

Do not build decorative dashboards, a chat copilot, a standalone invoice engine, advanced user administration, microservices or a full accounting ERP. A button shown in the implemented application must work; otherwise remove it or mark it clearly unavailable.

## 12. Submission requirements from the task

The final submission ZIP must contain **exactly two files**:

1. `TDD.pdf` or `TDD.docx` — GitHub URL and live URL (if deployed) at the top; architecture and why; data model; main flows; AI/risk design; UI decisions; what was deliberately not built and why; assumptions and limitations.
2. `deployment.md` — step-by-step local run; environment variable names only, never values; demo login details; test/demo mode explanation; deployed URL and any limitations.

The ZIP must be no larger than 25 MB. Keep the Git repository public until Isocode finishes reviewing it, preserve commit history, and never commit credentials or real personal data. The product concept, SRS, wireframes and design reference are engineering documentation; they do not replace the two required submission files.

## 13. Assumptions and production gates

| Topic | Take-home implementation | Production gate |
|---|---|---|
| Refund formula | Pro-rata inclusive calendar days; zero deduction | Institute/legal review of written policy, day-count convention and exact legal trigger |
| Part-paid withdrawal | Indicative shortfall only; never normal collectible dues | Explicit contract/policy basis and legal advice before recovery |
| Refund 10-day clock | Request-date + 10 calendar days as provisional operational target | Confirm legal clock-start event and applicable rules |
| Centre closure | Separate full-refund workflow | Confirm applicable statute/rules and eligible components |
| Hostel/mess | Not included unless institute offers it | Confirm fee components and policy |
| GST | Configurable fields; no hardcoded rate | Accountant approves rate, tax treatment, GSTIN and credit note |
| Instalment options / Rajasthan Act 2025 | Keep fee plans configurable and demonstrate a four-equal-instalment option if useful | Verify commencement Gazette notification, current rules and institute applicability before claiming statutory compliance; the task brief itself only says 3 or 4 instalments |
| OTP/messaging | Mock adapters | Approved providers and native-language template review |
| Payment gateway | Mock signed callback is core; Razorpay Test Mode optional | Merchant onboarding, credentials, settlement reconciliation |
| Risk | Explainable rules heuristic | Calibrate using labelled outcomes; never sole basis for adverse action |
| Data governance | Synthetic data + consent flow | Legal review of notice, child data, retention, erasure and pseudonymisation |

## 14. Definition of done

Tier 0 is done only when the parent, accounts and counsellor workflows are genuinely end to end; balances are ledger-derived; payment callbacks are verified/idempotent; reminders evaluate current balances; refund shortfall safeguards work; role/consent checks are enforced server-side; seed data reproduces the three brief records; tests cover the critical paths; and there are no dead buttons or unhandled core states.

**End of FeeFlow SRS v2.2 FINAL.**
