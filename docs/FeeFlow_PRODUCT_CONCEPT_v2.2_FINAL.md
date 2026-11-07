# FeeFlow — Product Concept

**Product:** FeeFlow  
**Document:** Product Concept & Product Overview  
**Version:** 2.2 FINAL  
**Specification baseline:** FeeFlow SRS v2.2 FINAL + UI Reference v1.0 & Wireframes v1.0 (22-page visual baseline)  
**Project:** Isocode Software Development Intern — Take-home Task, Problem 4  
**Date:** 6 November 2026  
**Status:** Product concept for the synthetic-data take-home implementation

---

## 1. Executive Summary

FeeFlow is a fee-collection and financial-operations platform designed for a multi-centre coaching institute. It connects the institute's fee-management operations with a simple parent self-service experience. The product brings fee plans, instalments, payment collection, payment verification, ledger updates, receipts, reminders, withdrawals, refunds, academic records, and collection reporting into one consistent workflow.

The product addresses a fragmented operating model in which staff use desktop fee software, spreadsheets, Tally posting, WhatsApp messages, phone calls, and manual refund calculations to manage one student's fee journey. These disconnected processes create avoidable delays, inconsistent balances, stale reminders, weak payment traceability, and limited visibility for management.

FeeFlow is not intended to be a learning-management system or a complete accounting ERP. Its central purpose is to make fee obligations understandable, payment collection dependable, financial records auditable, and collection operations measurable.

The product is built around three connected experiences:

1. **Parent self-service:** parents can understand what is due, when it is due, make an instalment payment, review receipts, and view their linked children's attendance and test results.
2. **Accounts operations:** authorised staff can manage fee plans, review student ledgers, reconcile payments, handle unmatched transactions, monitor reminders, process withdrawal/refund workflows, import academic records, and prepare reports/exports.
3. **Management and counselling oversight:** directors can view cross-centre performance, approve sensitive financial actions, publish policy versions, and review audit information; counsellors can review explainable student-risk flags and record follow-up decisions.

The take-home implementation must follow the brief’s narrow CORE BUILD first. The product has eight primary screen families; supporting login, consent, checkout, receipt, approval and audit views are not additional standalone product screens. Financial correctness, transparent exception handling, parent consent, role/centre access, reliable reminders and a polished mobile-first parent experience take priority over breadth.

## 2. Product Identity and Positioning

### 2.1 Working name

**FeeFlow** — a fee-collection and student-fee operations platform for coaching institutes.

### 2.2 Product category

Education-finance operations software with parent self-service capabilities.

### 2.3 One-line description

> FeeFlow gives coaching institutes one reliable view of every fee obligation and payment, while giving parents a clear, low-friction way to understand and settle dues.

### 2.4 Product promise

- **For parents:** “Know exactly what is due, why it is due, and how to pay.”
- **For accounts teams:** “Every payment, allocation, adjustment, reminder, and refund is traceable.”
- **For management:** “See collection health across centres and act on exceptions before they become larger problems.”

### 2.5 What FeeFlow is — and is not

FeeFlow is:

- A fee-plan, instalment, and student-ledger system.
- A parent-facing portal for dues, payment links, receipts, and academic visibility.
- A payment orchestration and reconciliation workflow.
- A bilingual reminder and collection-operations tool.
- A published-policy-based withdrawal and refund workflow.
- A reporting and export layer for financial operations.
- A transparent rules-based risk-flagging workflow for counsellors.

FeeFlow is not:

- A video-learning or learning-management platform.
- A timetable or class-scheduling product.
- An admissions CRM.
- A replacement for Tally or a general ledger/accounting ERP.
- A trained machine-learning dropout prediction system.
- A live bank settlement platform in the take-home version.

## 3. Client Context and Business Problem

### 3.1 Client profile from the brief

The selected problem statement describes **Company A**, a coaching institute in Jaipur, with the following operating context:

| Attribute | Client-brief context |
|---|---:|
| Centres | 4 |
| Students | Approximately 2,600 |
| Staff | Approximately 140 |
| Annual revenue | Approximately ₹30–34 crore |
| Average annual fee | Approximately ₹1.2 lakh per student |
| Typical instalment pattern | 3 or 4 instalments |
| Academic streams | Engineering and medical entrance coaching |

These figures describe the fictionalised/client scenario in the task brief. They are not independently audited company figures.

### 3.2 Current operating process

The current process is fragmented across tools and teams:

- Centres record fee receipts in desktop fee software.
- Daily totals are posted to Tally.
- Each centre maintains its own Excel due list.
- Parents are contacted through WhatsApp groups and telephone calls.
- Receipts are generated as PDFs.
- Refund calculations are prepared manually.
- Attendance and test-score information is maintained separately from fee operations.

The result is that a parent may not have a single trustworthy view of the outstanding amount, while an accounts executive must reconcile information spread across multiple systems.

### 3.3 Business pain points

| Pain point | Operational consequence | FeeFlow response |
|---|---|---|
| Fee information is distributed across tools | Staff spend time finding the current balance | A common student ledger and derived balance |
| Due lists are spreadsheet-driven | Lists can become stale after payments or adjustments | Live outstanding and ageing views |
| Parents depend on calls and messages | High volume of routine “how much is due?” enquiries | Parent portal with amount, due date, and Pay action |
| Payment confirmations require manual updates | Risk of duplicate or missed updates | Verified payment events and transactional allocation |
| Partial payments are hard to track | Parent and staff may see an outdated amount | Payment allocations and ledger-derived outstanding |
| Unmatched payments require investigation | Money may remain difficult to attribute | Accounts reconciliation queue with suggestions and human approval |
| Reminders are manually coordinated | Messages can be sent after payment or quote stale amounts | Evaluate-at-send reminders using current balance |
| Refunds are calculated by hand | Inconsistent calculations and weak auditability | Versioned policy, deterministic calculation, approval, and refund tracking |
| Month-end reconciliation is slow | Management lacks timely collection visibility | Reconciliation view, period close, and controlled export |
| Academic and fee signals are disconnected | Counsellors may not notice emerging concerns | Explainable risk flag based on fee, attendance, and test trends |

### 3.4 Financial-impact context from the brief

The brief estimates an annual impact of approximately **₹79.2 lakh**, composed of:

- Approximately ₹62.4 lakh associated with an assumed 2% uncollected share of an annual fee base of ₹31.2 crore.
- Approximately ₹16.8 lakh associated with four full-time-equivalent staff time spent chasing dues, using the brief's stated cost assumption.

This is the task brief's illustrative business case, not a guaranteed recoverable saving or a validated ROI forecast. FeeFlow should help the institute measure collection performance and reduce avoidable manual effort; it must not claim that all of this amount will automatically be recovered.

## 4. Product Vision and Objectives

### 4.1 Vision

Create a reliable, parent-friendly fee-operations system in which the institute, its accounts staff, and parents rely on the same financial facts and can understand how each amount was calculated.

### 4.2 Product objectives

1. Establish one consistent, auditable source of truth for fee obligations and payments.
2. Make the amount due, due date, and payment action immediately understandable to parents.
3. Automate the routine reminder lifecycle without sending stale or duplicate messages.
4. Ensure that payment status changes only after trusted payment verification.
5. Make partial payments, unmatched payments, reversals, and refunds safe and traceable.
6. Provide centre- and batch-level visibility into outstanding dues and ageing.
7. Give counsellors explainable indicators for students who may need human follow-up.
8. Make the application demonstrable using realistic synthetic data and provider mocks, with optional gateway Test Mode integration.

### 4.3 Product principles

- **One source of truth:** balances, settlement status, days overdue, and dashboard totals are derived from the append-only fee ledger.
- **Financial history is append-only:** mistakes are corrected with reversal entries, not by rewriting historical transactions.
- **Money is exact:** all monetary values use integer paise and integer arithmetic.
- **Trust the server, not the browser:** the server calculates payment amounts and only a verified provider event confirms a capture.
- **Idempotency by design:** duplicate webhooks, scheduler ticks, imports, and exports must not duplicate financial or communication effects.
- **Evaluate at the moment of action:** reminders use the current amount due at send time.
- **Humans own exceptions:** unmatched payments, sensitive discounts, refunds, and risk flags require authorised human action.
- **Explain automated decisions:** show the factors and policy/version used to produce a result.
- **Parent clarity first:** the parent can see amount due, due date/status, and the next action without navigating complex screens.
- **Honest product boundaries:** a mock gateway does not move money; a heuristic is not a trained prediction; a CSV export is not live Tally synchronisation.

## 5. Target Users and Stakeholders

### 5.1 Parent or guardian

**Primary need:** understand and manage the fees of one or more linked children without repeatedly contacting the institute.

Typical tasks:

- Log in using a one-time password (OTP).
- Accept or review the applicable consent notice.
- Switch between linked children.
- See the current instalment amount, due date, and overdue status.
- Pay the full outstanding amount or an allowed partial amount.
- See payment confirmation and download receipts.
- Review previous receipts and payment history.
- View attendance and test results where enabled.
- Switch between English and Hindi.
- Read the published refund/easy-exit policy.

### 5.2 Accounts executive

**Primary need:** manage fees and resolve collection exceptions for one or more assigned centres.

Typical tasks:

- Search students and inspect their fee ledger.
- Create fee plans and instalment schedules.
- Request discounts for director approval.
- Review successful, failed, pending, and unmatched payments.
- Manually allocate an unmatched or unallocated payment with a reason.
- Reverse a mistaken allocation with an audit trail.
- Monitor reminder dispatches, preview Hindi/English templates, pause reminders for a documented dispute/arrangement, and retry failed dispatches.
- Record student withdrawal and request a refund quote.
- Submit a refund for director approval and track refund items.
- Import attendance and test-score files.
- View collection, ageing, and reconciliation reports.
- Generate Tally-compatible CSV exports where included in the build tier.

### 5.3 Counsellor

**Primary need:** review students who may need academic or welfare follow-up.

Typical tasks:

- View a queue of risk flags within their centre scope.
- See the score, level, contributing factors, and data sufficiency.
- Review relevant attendance and test trends.
- Mark a task as reviewed, follow-up required, or false positive.
- Add a review note and apply a time-limited suppression after a false positive.

A counsellor does not receive access to detailed financial ledger rows and cannot perform accounts actions. The fee signal is exposed as a factor value rather than unrestricted financial history.

### 5.4 Director

**Primary need:** oversee performance and approve sensitive financial and policy actions.

Typical tasks:

- View consolidated results across all centres.
- Approve discounts and refunds requested by other staff.
- Review audit events and system-health indicators.
- Publish immutable refund-policy versions.
- Review monthly reconciliation and Tally export status.
- Monitor over-60 ageing and other collection metrics.

### 5.5 Role and centre scoping

Roles are capability bundles; centre scope is an independent attribute. A user may be assigned one or more centres. A director receives all-centre scope. Parent access is limited to students linked through an active parent-student relationship and active consent.

All permission checks must happen on the server and at the repository/data-access boundary. Hiding an action in the interface is not authorization.

## 6. Product Experience and Main Screens

The product is designed around eight primary screens. Supporting entry points such as OTP login, staff login, a consent gate, the public refund-policy page, and a director audit viewer support these primary screens.

### Screen 1 — Parent Home

**Audience:** Parent or guardian  
**Purpose:** Answer “What do I owe, when is it due, and how do I pay?” immediately.

Main elements:

- Child switcher for parents with multiple linked students.
- English/Hindi language toggle.
- Large amount-due card.
- Due date or clearly worded overdue status.
- Primary Pay button.
- Secondary “Pay a different amount” action with a server-enforced permitted range.
- Other instalments and their settlement states.
- Recent receipts with download actions.
- Attendance and test-score tabs/views.
- Clear states for all paid, payment confirming, consent required, no data, and withdrawn student.

Design target: amount, due date/status, and Pay action are clear on the initial 360 px mobile viewport. The layout is single-column, readable, lightweight, and touch-friendly.

### Screen 2 — Accounts Dashboard

**Audience:** Accounts executive and director  
**Purpose:** Show collection health across centres and batches.

Main elements:

- Filters for centre, batch, and as-of date.
- Collected-in-period total.
- Total outstanding.
- Over-60 ageing ratio.
- Unmatched payment count and amount.
- Refunds due and approaching deadline.
- Ageing breakdown by centre.
- Batch table with drill-down to student ledgers.
- Reconciliation and period-close entry points.
- Tally export entry point when available.

All aggregate values are computed server-side from the same financial source of truth used by the parent and accounts screens.

### Screen 3 — Student Ledger

**Audience:** Accounts executive  
**Purpose:** Explain the student's fee position and financial history.

Main elements:

- Student and batch summary.
- Fee plan and instalment schedule.
- Settlement status and days overdue for each instalment.
- Current outstanding amount derived from signed ledger entries.
- Chronological ledger timeline containing entry type, signed amount, actor, date, and related payment/receipt.
- Actions for discount request, withdrawal recording, and reminder pause where authorised.

The interface should make the balance derivation understandable as charges minus credits, allocations, waivers, and other approved adjustments.

### Screen 4 — Payments and Reconciliation

**Audience:** Accounts executive  
**Purpose:** Ensure every captured amount is matched and allocated correctly.

Main elements:

- Unmatched payment queue.
- Suggested candidates with match score and reasons.
- Manual allocation dialog with validation and mandatory reason.
- Payment list with method, amount, provider reference, and status.
- Provider-event inbox showing accepted, duplicate, rejected, or failed processing events.
- Unallocated/excess amount visibility.
- Reconciliation tab showing captured, refunded, allocated, unallocated, and exported amounts.

A suggested match is never silently auto-applied. An unmatched payment does not change a student's balance until an authorised account user allocates it.

### Screen 5 — Reminder Centre

**Audience:** Accounts executive  
**Purpose:** Give staff control and visibility over automated parent communications.

Main elements:

- Dispatches grouped by due, claimed, sent, failed, or skipped status.
- Rule/tone and scheduled date.
- Parent language and channel.
- Current amount snapshot and rendered message body.
- Skip reason, provider reference, and retry status.
- Hindi and English previews.
- Reminder pause controls with reason and date range.
- Run-now action for the scheduler in the demo.

The reminder dispatcher evaluates the current balance when a message is about to be sent. A settled, cancelled, withdrawn, paused, or otherwise ineligible instalment is skipped. Partial payments automatically reduce the next reminder amount.

### Screen 6 — Withdrawals and Refunds

**Audience:** Accounts executive and director  
**Purpose:** Produce a transparent refund calculation and control its approval and execution.

Main elements:

- Withdrawal request form with separate request date and effective withdrawal date.
- Reason code and supporting note.
- Applicable service period and fee components.
- Policy version, content hash, and eligibility basis.
- Itemised formula inputs and intermediate calculations.
- Potential refund or informational shortfall.
- Director approval/rejection action, separate from requester.
- Item-level gateway/offline refund tracking.
- Deadline/status chips and credit-note metadata.

The page should clearly distinguish a statutory/full-payment pathway from a published-policy extension for partial payments. It must not display an unapproved informational shortfall as ordinary collectible student dues.

### Screen 7 — Imports

**Audience:** Accounts executive and counsellor  
**Purpose:** Import batch-level attendance and test results safely.

Main elements:

- Downloadable file templates.
- CSV/XLSX upload.
- File hash and duplicate-file detection.
- Staging and row validation.
- Preview counts for valid, invalid, unchanged, changed, and duplicate rows.
- Old-versus-new values for changed rows.
- Downloadable error CSV.
- Explicit commit action and import history.

Imports are staged before commit. Unknown students, invalid dates, invalid marks, duplicates, and changed values are visible before data is written. CSV exports neutralise spreadsheet formula injection.

### Screen 8 — Risk Review

**Audience:** Counsellor  
**Purpose:** Surface students who may benefit from human outreach.

Main elements:

- Risk queue with score and level.
- Factor breakdown for fee ageing, attendance trend, and test trend.
- Windows, raw inputs, normalized values, and weights.
- Small trend view where data supports it.
- Data-sufficiency state.
- Counsellor review actions and notes.
- False-positive suppression state and measured false-positive rate.
- Clear notice: “No message or fee action is taken by this flag.”

The risk engine is a deterministic, versioned heuristic, not a trained model and not a probability of dropout. Insufficient data produces an unknown/insufficient-data result rather than a false low-risk result.

## 7. Feature Catalogue

### 7.1 Identity, access, and consent

- Parent OTP authentication with rate limits and expiring OTPs.
- Separate staff authentication using email/password and Argon2id password hashing.
- Database-backed sessions with distinct parent and staff policies.
- Parent-student relationships supporting multiple guardians and multiple children.
- Active consent gate for parent access to a linked student.
- Capability-based role authorization and centre scoping.
- Audit trail for sensitive actions.

For the take-home, OTP delivery may use a clearly labelled mock adapter. Real SMS/WhatsApp delivery and staff MFA are outside the initial build unless time and access allow.

### 7.2 Fee plans and instalments

- Create a fee plan for a student using an approved fee structure.
- Define service start and service end dates from the published fee agreement.
- Define instalment amounts and due dates within the service period.
- Support approved discounts with maker-checker approval.
- Create one positive charge ledger entry for each instalment when the fee plan is created.
- Derive settlement and overdue values from the ledger.
- Support withdrawal and fee-plan supersession without deleting historical records.
- Offer a four-equal-instalment option in the Rajasthan-ready configuration, subject to legal applicability/commencement verification.

The synthetic annual fee is ₹1,20,000, demonstrated in both **4 equal instalments of ₹30,000** (e.g., `STU-0412` Aarav Meena and `STU-0587` Ishita Sharma) and **3 equal instalments of ₹40,000** (e.g., `STU-0219` Mohit Gurjar, whose ₹40,000 instalment is due on 15 Nov 2026), matching the brief's 'paid in 3 or 4 instalments' and sample table verbatim. The signature Instalment Rail component dynamically renders 3 or 4 segments based on the student's plan.

### 7.3 Student fee ledger

The ledger is the authoritative record of what is owed. Positive entries increase the family's obligation; negative entries reduce it.

Relevant entry types include:

- `CHARGE` — original instalment charge.
- `DISCOUNT` — approved fee discount.
- `ALLOCATION` — payment allocated against an instalment.
- `REVERSAL` — correction linked to an original entry.
- `WAIVER` — approved reduction in the ordinary receivable, including withdrawal rebase.
- `REFUND_ADJUSTMENT` — controlled adjustment when a failed/reversed refund requires accounting correction.

Ledger and audit history are append-only. The application corrects mistakes by adding linked reversal records, never by updating or deleting the original financial history.

### 7.4 Payment collection

- Parent creates a payment intent for an eligible instalment.
- Server reads the current outstanding and validates the requested amount.
- Parent may pay the full outstanding or a permitted partial amount.
- The current minimum partial-payment default is ₹1,000, or the outstanding if lower; this is a labelled product assumption.
- Payment intent is created through a provider port.
- Mock gateway provides a hosted-checkout-style experience with success, failure, and pending outcomes.
- Mock callbacks are HMAC-signed and asynchronous, exercising the same webhook path as a real provider.
- Razorpay Test Mode is an optional real external integration behind the same payment-provider contract.
- Only captured, signature-verified, authoritative payment events can create a payment record and trigger allocation.

The product does not treat a browser redirect or a front-end success state as proof of payment.

### 7.5 Payment matching, allocation, and reversal

Payment matching has three outcomes:

1. **Exact match:** provider order ID maps to a known payment intent; eligible for automatic allocation.
2. **Suggested match:** no intent exists, but payer reference and other factors suggest a unique student; send to accounts for review.
3. **No match:** no reliable target is found; leave the capture unallocated and send it to the accounts queue.

Allocation rules:

- Lock the target instalment while calculating and applying allocation.
- Never allocate more than the instalment's current outstanding.
- Any excess remains unallocated and visible for accounts review.
- Manual allocation requires centre scope, sufficient unallocated payment amount, target outstanding validation, and a reason note.
- A mistaken allocation is corrected through a linked reversal, not by deleting the allocation.
- Payment allocation and corresponding ledger entries are committed together.

### 7.6 Receipts and financial documents

The refined v2.0 model treats the instalment as the billable unit and issues a receipt per captured payment. It does not introduce a separate first-class invoice lifecycle in the core model.

- One immutable receipt record/view is issued for each captured payment in Tier 0.
- The receipt carries institute/student identity, captured amount, payment reference, capture timestamp, and GST/tax fields sourced from the configured institute tax profile.
- Downloadable bilingual PDF rendering is Tier 1 depth. If the demo tax profile is not configured, the UI must say so; it must not invent a GST rate or imply a valid tax invoice.
- A receipt may be issued even if the payment is not yet allocated; receipt and allocation are different concepts.
- Receipt numbering is sequential within a series and protected against concurrent issuance.
- Refund completion creates corresponding credit-note metadata/documentation under the approved tax configuration.

This is an intentional refinement from the earlier concept: the core product is based on instalments, payments, allocations, ledger entries, and receipts rather than a separate invoice entity that could disagree with the ledger.

### 7.7 Reminder automation

Default reminder rule offsets in the SRS are: 7 days before due date, 3 days before, on due date, and 3, 7, 15, and 30 days after due date. Quiet hours are 21:00–08:00 IST. These are assumptions and must be configurable.

Rules:

- Read the latest balance when the reminder is rendered for sending.
- Do not send for paid, cancelled, withdrawn, paused, or otherwise ineligible instalments.
- Use the parent's saved language preference (English or Hindi).
- Limit a parent to at most one reminder per student per day.
- During quiet hours, defer sending.
- Retry failures with backoff; after the configured attempt limit, show the failure to accounts staff.
- Use a unique dispatch key so repeated scheduler runs do not send duplicate reminders.
- The mock messaging adapter records the rendered message and outcome; it does not send a real SMS or WhatsApp message.

### 7.8 Withdrawal and refund management — v2.1 policy boundary

FeeFlow uses a versioned, immutable refund policy. The policy shown to parents must be the same policy record used by the calculator.

**Refund Policy v1 calculation defaults:**

- Pro-rata calculation over the fee-service period.
- Inclusive calendar-day count.
- Fixed deduction: ₹0.
- Percentage deduction: 0 basis points.
- Ten-calendar-day operational target, with the clock-start event provisional pending legal confirmation.
- Tax and credit-note treatment is a separate accountant-approved configuration; no 18% GST rate is hard-coded.

**Calculation model:**

Let:

- `N` = net fee for the relevant course/service component after approved discounts.
- `P` = net captured and allocated payments attributable to that component, less completed refunds.
- `S` = published service-period start date.
- `E` = published service-period end date.
- `W` = approved effective withdrawal date.
- `T` = total service-period calendar days, inclusive.
- `c` = consumed service-period calendar days, inclusive of `W`, clamped between zero and `T`.

Then:

```text
T = days(E) - days(S) + 1
c = clamp(days(W) - days(S) + 1, 0, T)
earned = roundHalfUp(N × c / T)
deduction = 0
obligation = min(N, earned + deduction)
indicativeRefund = max(0, P - obligation)
indicativeShortfall = max(0, obligation - P)
```

All monetary arithmetic uses integer paise and a single round-half-up helper.

**Eligibility and treatment:**

- Full-paid student leaving mid-course: use the statutory/full-payment pathway where the cited source is applicable; calculate the remaining-period pro-rata amount and route it through approval and refund execution.
- Part-paid student with an indicative refund: present it as a potential refund under the institute's proposed published-policy extension; require director approval before creating refund items.
- Part-paid student with an indicative shortfall: record it as informational or review-required only. It is not an ordinary collectible receivable in the MVP. It must not appear in normal dues ageing, parent amount due, reminders, or automatic collection.
- Course not started: consumed days are zero under the formula.
- Course completed: consumed days clamp to the full term; no remaining-period refund arises under this formula.
- Centre registration cancellation or centre self-closure: use a separate full-fee-refund reason/workflow. Do not invoke ordinary mid-course proration.
- Hostel and mess charges: represent them as separate service components if the institute actually provides them; do not invent accommodation charges in synthetic data.

**Withdrawal rebase:**

When a student withdrawal is approved, write waiver ledger entries to reduce the ordinary outstanding for the withdrawn course to zero, latest-due instalments first. Cancel instalments fully waived. Preserve the indicative shortfall in the refund/withdrawal snapshot, but do not turn it into a collection debt in the MVP. No ordinary collection reminder should survive the approved withdrawal.

**Approval and execution:**

- Accounts records the request and effective dates separately and produces the policy snapshot.
- A different director approves or rejects the request.
- Refund execution is split across eligible captured payments, newest first, subject to each payment's unrefunded balance.
- Gateway refunds use the payment-provider adapter; offline refunds require a recorded reference and human confirmation.
- A gateway request being accepted is not the same as a completed refund.
- Refund completion is recorded only when every refund item is confirmed complete and its records/credit-note metadata are persisted.
- Failed refund items remain visible and retryable.

**Legal, policy, and tax limitations:**

- The Ministry of Education's January 2024 coaching-centre guidelines describe a pro-rata refund within ten days for a student who has paid in full and leaves mid-course, and address hostel/mess fees where applicable. Their covering letter forwards the guidelines to States/UTs for consideration through an appropriate legal framework.
- The Rajasthan Coaching Centres (Control and Regulation) Act, 2025 contains relevant provisions in Sections 6(2)(d), 6(2)(i), 6(2)(q), and 13(4). The Act's commencement and applicability must be verified from the relevant Official Gazette notification and current rules before treating it as an operative requirement for the client.
- The cited sources do not prescribe this exact daily formula, inclusive-day convention, or clock-start event. These remain labelled product/policy assumptions.
- The cited provisions do not independently establish a right to collect a partial-payment shortfall or impose fixed/percentage deductions.
- GST rate, tax treatment, receipt wording, and credit-note process require accountant/tax-adviser approval.

### 7.9 Academic records and bulk imports

- Import attendance and test scores per selected batch.
- Accept CSV/XLSX under the SRS file-size and row-count limits.
- Hash files to prevent duplicate committed uploads.
- Stage rows and validate student, batch, date, status, score range, and required fields.
- Classify rows as valid/new, unchanged, changed, duplicate, or invalid.
- Show old and new values for changed rows and require explicit confirmation.
- Provide an error CSV and import history.
- Commit validated data transactionally with import-batch lineage and audit record.
- Neutralise formula-like values in CSV exports to mitigate spreadsheet formula injection.

### 7.10 Student risk intelligence

The risk engine combines three signals:

1. Fee: overdue instalments and days overdue.
2. Attendance: recent attendance rate compared with a preceding baseline window.
3. Test performance: recent assessment results compared with prior assessments.

The SRS uses a deterministic, versioned formula with assumed weights of 0.40 fee, 0.30 attendance, and 0.30 tests. Only signals with sufficient data contribute; weights are renormalised over available signals. If neither academic signal has sufficient data, the result is unknown/insufficient data, not low risk.

Indicative levels in the SRS are high at 60+, medium from 35 to 59, and low below 35. High risk opens a counsellor task; medium appears on a watchlist. A false-positive review suppresses repeat tasks for a configured period unless the score rises materially.

Strict boundaries:

- This is a heuristic, not a trained model and not a probability.
- It cannot send a message, update a fee ledger, change a student's fee status, or trigger an adverse action.
- A counsellor must review the flag and choose the next action.
- Each evaluation stores the configuration version, input hash, factors, windows, and calculation details.

### 7.11 Reporting, reconciliation, and Tally export

The accounts dashboard supports centre, batch, and as-of-date filters. Measures include billed, collected in period, outstanding, ageing, unmatched payments, and refunds due. Each aggregate should drill down to the student-level records supporting it.

The headline ageing measure is the over-60 ratio. The SRS defines the take-home snapshot metric as outstanding on instalments more than 60 days overdue divided by the amount of instalments whose due date is at least 60 days ago. The brief's success target is to move the over-60 measure from 12% to 6% over two terms. This snapshot definition is an assumption; measuring true improvement over time requires payment-arrival history across periods.

Month-end reconciliation displays captured payments, completed refunds, allocations, unallocated funds, and exported amounts. Each identity should balance or show a drill-down to the discrepancy. A month close is stored as an immutable closure record.

Tally export is a controlled CSV, not live Tally synchronisation. The SRS proposes one balanced voucher per receipt and credit-note entries for refunds, with immutable export batches and item-level deduplication so the same payment is not posted twice.

## 8. End-to-End Product Journeys

### Journey A — Parent pays an instalment

1. Parent opens FeeFlow and authenticates through OTP.
2. Parent accepts/has active consent for the linked student.
3. Parent sees the current outstanding amount, due date, and payment action.
4. Parent chooses full amount or an allowed partial amount.
5. The server recalculates the outstanding and validates the requested amount.
6. FeeFlow creates a payment intent through the configured provider.
7. Parent completes the hosted mock checkout or Razorpay Test Mode checkout.
8. Provider sends an asynchronous callback/webhook.
9. FeeFlow verifies the signature and checks the authoritative payment record.
10. The webhook processor records the capture idempotently.
11. The allocation service locks the instalment, allocates up to its current outstanding, and leaves any excess unallocated.
12. The ledger is updated transactionally, a receipt is issued, and the parent view refreshes after confirmed state.
13. The next reminder run evaluates the current balance and skips a paid instalment or sends the updated partial balance.

### Journey B — Unmatched payment arrives

1. A provider capture arrives without a known order match.
2. FeeFlow records the verified payment without changing any student's ledger.
3. The matching engine may produce a ranked suggestion using payer reference and amount context.
4. The payment appears in the accounts queue with reasons and candidate details.
5. An accounts executive verifies the student and instalment and manually allocates the payment with a reason.
6. Allocation and ledger entries commit together and appear in the audit history.

### Journey C — Student withdraws and a refund is assessed

1. Accounts records the withdrawal request date, effective date, reason, and supporting note.
2. FeeFlow loads the applicable immutable policy version and the published fee-service period.
3. The refund calculation displays its inputs, inclusive days, earned amount, zero deduction, potential refund, and/or informational shortfall.
4. The system labels the eligibility basis, including full-paid statutory pathway versus a partial-payment policy extension.
5. Accounts submits the request; a different director approves or rejects it.
6. On approved withdrawal, the ordinary outstanding is waived to zero and reminders stop.
7. If a refund is approved, refund items are executed against eligible captured payments, newest first, without exceeding the unrefunded amount of any payment.
8. FeeFlow marks the refund complete only after all items are confirmed complete and the required document metadata is persisted.
9. Any failed item remains visible for retry or reassignment.

### Journey D — Attendance and scores are imported; a risk task is raised

1. Accounts or counsellor uploads a batch-specific CSV/XLSX file.
2. FeeFlow stages and validates every row.
3. The user reviews valid, invalid, duplicate, unchanged, and changed rows.
4. The user confirms commit.
5. Academic records are persisted with import lineage and an audit entry.
6. A risk evaluation runs if the student's input hash changed.
7. A high-risk result creates a counsellor task with contributing factors.
8. Counsellor reviews the record and marks it reviewed, follow-up required, or false positive.
9. No fee or parent communication action occurs automatically.

### Journey E — Month-end reconciliation

1. Accounts selects a month and centre/batch scope.
2. FeeFlow totals provider captures, refunds, allocations, unallocated amounts, and exports.
3. The reconciliation view identifies any imbalance with drill-downs.
4. Accounts investigates and resolves exceptions through supported workflows.
5. The authorised user closes the month; FeeFlow stores an immutable closure snapshot.
6. Tally CSV export includes only eligible unexported records and is reproducible on re-download.

## 9. Product Differentiators

1. **Ledger-first financial correctness:** balances are derived from immutable, signed entries instead of loosely synchronised `amountPaid` and `balance` fields.
2. **Real payment verification:** mock and real gateway adapters use the same signed asynchronous callback path.
3. **Unmatched-payment queue:** uncertain matches are visible and explainable but never silently allocated.
4. **Evaluate-at-send reminders:** amounts are rendered from the current balance, avoiding stale reminder amounts and payment-cancellation races.
5. **Policy-versioned refunds:** calculation, policy text, inputs, and results are stored together and remain reproducible.
6. **Withdrawal-safe shortfall handling:** indicative part-paid shortfalls do not become ordinary debts or reminder triggers in the MVP.
7. **Maker-checker governance:** discounts and refunds require a different approver from the requester.
8. **Data-boundary authorization:** parent/centre scope is enforced in repositories rather than relying on UI visibility.
9. **Explainable risk flags:** the system records factors and data sufficiency, and counsellors retain control.
10. **Operational reconciliation:** provider captures, refunds, allocations, unallocated money, and exports are checked against one another.

## 10. Design and User Experience Direction

### 10.1 Visual language

- Minimal layouts with generous whitespace.
- Near-black ink on warm white surfaces.
- Deep teal as the primary action accent.
- Semantic status colours paired with text and icons.
- Clear type scale and legible numeric amounts.
- Humanist sans-serif for Latin text and Noto Sans Devanagari for Hindi.
- Consistent spacing and accessible touch targets.

### 10.2 Parent experience

- Mobile-first, single-column layout.
- Minimal client-side JavaScript on parent routes.
- Amount due is the most prominent element.
- One primary action per payment state.
- English/Hindi parity for labels and reminders.
- Plain-language status labels rather than relying on colour alone.
- Loading, empty, error/retry, offline, consent-required, payment-confirming, and withdrawn states are intentionally designed.

### 10.3 Staff experience

- Desktop-oriented navigation with responsive fallback to stacked cards.
- Dense operational tables where they improve review and reconciliation.
- Filters and drill-downs on centre, batch, date, student, and payment status.
- Clear exception queues rather than burying unmatched, failed, or pending records.
- Audit context attached to sensitive actions.

## 11. Product Scope and Delivery Priorities — FINAL ALIGNMENT

The task brief explicitly asks for a small, real end-to-end product in approximately 6–8 screens. It names a CORE BUILD, then says the rest of the MUST HAVE list is optional depth. The build sequence below follows that exact hierarchy.

### Tier 0 — Core build (must ship end to end)

- Student fee ledger: plan, instalments, discounts, payments, balance and days overdue.
- Parent portal with OTP login, current dues and payment link.
- Verified payment workflow, including full/partial payment and unmatched-payment queue.
- Automatic Hindi/English reminders before, on and after due dates; full settlement stops future reminders and partial payment updates the amount for later reminders.
- Published-policy pro-rata refund calculator with the accepted v2.1 safeguards.
- Accounts dashboard by centre and batch with ageing.
- Explainable dropout-risk flag that creates a counsellor task only; no automatic message or fee action.
- Authentication, authorization, centre/student scoping, consent gate and audit trail.
- Minimal receipt record/view carrying configurable GST/tax fields. No tax rate is hardcoded.
- Signed mock payment and mock messaging adapters; no real money or messages move.

### Tier 1 — Remaining MUST HAVE depth (optional only after Tier 0 passes)

- Parent receipt history and downloadable PDF receipts with configured GST/tax breakdown.
- Parent attendance and test-score view.
- Bulk upload attendance and test scores per batch, with preview and row-level errors.
- Tally-compatible CSV export and month-end reconciliation.
- Enhanced reports, import history and deeper drill-downs.

These items remain in the broader MUST HAVE list, but the brief permits them to be delivered as optional depth after the core slice. Do not let them delay Tier 0.

### Tier 2 — Optional integration depth

- Razorpay Test Mode adapter behind the payment-provider port. The signed mock provider is the required baseline and must exercise the same verification path.
- Richer reminder retries, scheduler controls and full-scale synthetic data generation beyond the three supplied sample records.

### Tier 3 — Document, do not build

- Real SMS/WhatsApp and production OTP providers.
- Staff MFA and full user-administration console.
- Spreadsheet column-mapping UI, multi-institute tenancy and general-ledger replacement.
- Trained machine-learning dropout model.
- Full bank settlement-file reconciliation and production retention/erasure/restore operations.

### Explicitly out of scope

Video lectures or an LMS, timetables and admissions CRM. FeeFlow is not a replacement for Tally or a complete accounting ERP.

### Eight primary screen families

1. Parent Portal.
2. Accounts Dashboard.
3. Student Fee Ledger.
4. Payments & Exceptions.
5. Reminder Centre.
6. Withdrawals & Refunds.
7. Risk Review.
8. Academic Imports & Reporting (Tier 1 depth).

Login, consent, mock checkout, receipt, payment matching, fee-plan editing, public refund policy and audit/system health are supporting views, dialogs or states.

## 12. High-Level Technical Product Shape

FeeFlow is implemented as a **modular monolith**: one deployable application with enforced business-module boundaries. The product architecture keeps business rules independent from UI frameworks, database persistence, payment providers, messaging providers, OTP senders, PDF rendering, and the clock.

### 12.1 Proposed stack from the refined SRS

| Area | Choice | Product/engineering reason |
|---|---|---|
| Application | Next.js App Router, React, strict TypeScript | One typed codebase for parent/staff UI and server endpoints |
| UI | Tailwind CSS and restyled shadcn/ui primitives | Accessible components without accepting a generic default look |
| Database | PostgreSQL | Transactions, constraints, triggers, views, row locks, and `SKIP LOCKED` |
| Data access | Prisma plus parameterized SQL where required | Typed models plus explicit database-level invariants |
| Validation | Zod at every boundary | API, upload, configuration, and environment validation |
| Staff password hashing | Argon2id | Strong password-hash implementation |
| Sessions/OTP | Database-backed sessions and a dedicated OTP module | Distinct parent and staff session policies with revocation support |
| Background work | PostgreSQL jobs/outbox and authenticated tick endpoint | Persistent, inspectable, idempotent jobs without Redis/Kafka at this scale |
| Payments | Payment-provider port; mock adapter and optional Razorpay Test Mode adapter | Same application path for demo and external sandbox |
| Messaging | Messaging-provider port with mock adapter | Test reminder logic without claiming real delivery |
| PDF | PDF renderer with embedded Devanagari font and print fallback | Receipts and credit-note documents in supported languages |
| i18n | next-intl with ICU messages | English/Hindi strings, plurals, and INR formatting |
| Testing | Vitest, fast-check, Playwright, axe, Lighthouse CI | Domain, property, integration, end-to-end, accessibility, and performance checks |
| Quality gates | ESLint, dependency-cruiser, size-limit, gitleaks, GitHub Actions | Enforce module boundaries, bundle budgets, and secret hygiene |
| Hosting | Vercel and managed PostgreSQL (Neon in the SRS) | Simple deployable for the take-home |

### 12.2 Domain modules

- `identity` — users, sessions, OTP, consent, parent links.
- `org` — centres, courses, batches, students.
- `fees` — fee plans, instalments, discounts, ledger, ageing.
- `payments` — intents, provider events, captures, allocations, receipts.
- `reminders` — rules, templates, dispatches, pauses.
- `refunds` — policies, withdrawals, refund calculations, refund items.
- `academics` — assessments, attendance, imports.
- `risk` — risk configuration, evaluations, counsellor tasks.
- `reporting` — dashboards, reconciliation, Tally exports.
- `audit` — immutable audit history and hash chain.

### 12.3 Core external ports

Payment, messaging, OTP, PDF, file storage, and clock are behind interfaces. Every external port has a mock adapter and a contract test. Mock adapters must exercise the same application verification and persistence path as real adapters; they must not directly mutate the ledger or bypass business rules.

## 13. Data and Privacy Principles

- Use synthetic data only in the take-home repository and demo environment.
- Never commit real student, parent, or staff personal data.
- Use opaque UUIDs for technical identifiers; student codes are display labels, not parent-facing lookup keys.
- Store only required parent identity and consent evidence; never store OTP values in plain text.
- Keep student access scoped to active parent links and active consent.
- Avoid exposing detailed financial history to counsellors.
- Keep payment payloads redacted; do not log secrets, OTPs, or full sensitive payment data.
- Record actor, role, timestamp, request ID, entity, and action for sensitive changes.
- Define retention, erasure, and pseudonymisation policies before production use.
- Treat DPDP implementation, children’s data handling, consent notices, and retention as professional-review items rather than claiming that a demo implementation alone establishes legal compliance.

## 14. Security, Reliability, and Trust Expectations

### 14.1 Financial integrity

- Integer paise in `bigint` columns and BigInt in domain code.
- No floating-point arithmetic for money.
- Ledger, audit rows, receipts, and published policies are immutable.
- Captured payment allocation is transactional.
- Allocation cannot exceed payment amount or current instalment outstanding.
- Cumulative refunds cannot exceed a payment's captured amount.
- Provider event IDs and provider payment IDs are unique.
- Payment success is set only by the verified webhook processor.
- Financial conservation checks run in automated tests and operational verification.

### 14.2 Operational reliability

- Webhooks are idempotent and safe under replay.
- Scheduler ticks can run more than once without duplicate reminders.
- Jobs use claims/locks so concurrent workers do not process the same dispatch.
- Outbox events are written in the same transaction as the state change that produced them.
- Failed reminders and refund items remain visible and retryable.
- Database migrations are applied through a reproducible migration workflow.
- Health view exposes scheduler activity, outbox backlog, failed reminders, unmatched payments, rejected webhooks, and last ledger-verification result.

### 14.3 Authorization

- Every application use case receives an authenticated `Actor`.
- Repositories expose scoped queries; no unscoped student lookup should bypass scope.
- Parent requests for out-of-scope students return not-found to avoid confirming record existence.
- Refund and discount approval requires a different user from the requester.
- Counsellor permissions are limited to academic/risk data and cannot perform accounts actions.
- Automated authorization tests exercise route handlers and server actions against the capability matrix.

## 15. Success Measures and Product Analytics

The brief gives the following business success targets:

| Measure | Client target/context | How FeeFlow supports measurement |
|---|---|---|
| Over-60 overdue ratio | Improve from 12% to 6% over two terms | Ageing dashboard and consistently defined snapshot ratio; arrivals-based trend needs period history |
| Parent calls about dues | Reduce by 70% | Parent self-service, clear current balances, receipts, and payment history; actual call volume must be measured outside the app or imported |
| Month-end reconciliation | Reduce from 4 days to 1 day | Payment reconciliation, immutable month closure, and controlled Tally export |

Additional operational indicators:

- Percentage of payment captures auto-matched to known intents.
- Count and value of unmatched/unallocated payments, with age.
- Time from capture event to ledger allocation and receipt availability.
- Duplicate webhook count safely ignored.
- Reminder send/skip/failure/retry rate.
- Number of reminders skipped because an instalment is paid, cancelled, or withdrawn.
- Refund requests approaching or exceeding the configured deadline.
- Refund completion time and failed refund-item count.
- Import validation error rate and duplicate upload rate.
- Risk-flag volume, data-sufficiency rate, counsellor review rate, and false-positive rate.
- Reconciliation discrepancies and time to close the month.

The product should not claim a target has been achieved merely because seeded demo data displays a target value. Demonstrated metrics should be labelled synthetic in the demo.

## 16. Demo Data and Demonstration Strategy

### 16.1 Synthetic data scale

The seed must preserve the three client sample rows exactly and add enough deterministic synthetic records across all four centres to exercise centre/batch filters, ageing, partial/paid/unpaid states and the dashboards. Generating all 2,600 synthetic students is useful extra depth, but it must not block Tier 0. The interface must visibly disclose synthetic data. Use a fixed demo business date of 2 November 2026 for the supplied overdue labels.

### 16.2 Brief sample records to preserve

| Student ID | Student | Batch | Instalment due | Amount | Paid | Scenario from brief |
|---|---|---|---|---:|---:|---|
| STU-0412 | Aarav Meena | JEE 2027 Morning | 10 Oct 2026 | ₹30,000 | ₹30,000 | Paid |
| STU-0587 | Ishita Sharma | JEE 2027 Evening | 10 Oct 2026 | ₹30,000 | ₹15,000 | Part paid; 23 days overdue in the brief snapshot |
| STU-0219 | Mohit Gurjar | NEET 2027 Morning | 15 Nov 2026 | ₹40,000 | ₹0 | Due in 13 days in the brief snapshot |

The demo business date is fixed at **2 November 2026** so the supplied status labels are reproduced: Ishita is 23 days overdue from 10 October and Mohit is due in 13 days before 15 November. The application uses an injected clock; it must not hardcode status labels. The UI should show “Demo data as of 2 Nov 2026”.

### 16.3 Scenario fixtures

The seed should also exercise:

- Duplicate webhook event.
- Unknown-order payment with and without payer reference.
- Failed and pending payment attempts.
- Partial payment followed by a second partial payment.
- Unmatched payment and manual allocation.
- Excess/unallocated amount.
- Withdrawal with a refund request close to its deadline.
- Part-paid withdrawal with an informational shortfall and no ordinary debt after withdrawal approval.
- Centre-closure refund scenario using a separate reason code.
- Reminder failure and reminder skipped because the instalment is settled.
- High-risk student with all three signals and student with insufficient data.
- Import file containing valid, unknown-student, invalid-date, duplicate, unchanged, and changed rows.
- Parent with two children and a parent who prefers Hindi.

Use reserved fake/test phone numbers and demo-only accounts. Never include real personal data.

### 16.4 Core demonstration journeys

A reviewer should be able to complete at least these end-to-end journeys:

1. Parent logs in, sees a due amount, pays through mock checkout, receives a confirmed receipt, and sees the updated balance.
2. A payment event is replayed or forged; the system rejects/ignores it safely and avoids duplicate allocation.
3. An unmatched payment enters the accounts queue and is manually reconciled with an audit reason.
4. A partial payment reduces the next reminder amount; a full payment prevents further reminders.
5. Accounts calculates a withdrawal refund, director approves it, the normal receivable is waived, and refund items are tracked.
6. Academic data is imported, a risk flag is generated with explanations, and a counsellor records a review.
7. Director/accounts reviews centre-level metrics and monthly reconciliation.

## 17. Delivery Strategy and Definition of Done

### 17.1 Recommended delivery order

1. Project foundation, environment validation, database migrations and seed.
2. Parent/staff authentication, explicit consent, parent links and centre scoping.
3. Fee plans, instalments, append-only ledger, derived balances and ageing.
4. Mock payment provider, signed webhook, full/partial allocation, unmatched queue and receipt record.
5. Parent Home, Accounts Dashboard and Student Fee Ledger.
6. Bilingual reminder dispatcher with stop-on-settlement and stale-amount protection.
7. Published refund policy, calculation snapshot, v2.1 shortfall safeguard, withdrawal waiver and approval.
8. Explainable risk engine and counsellor task.
9. Only after Tier 0 passes: attendance/test import and parent academic view, PDF receipt, Tally CSV, Razorpay Test Mode and richer reports.
10. Security matrix, critical tests, accessibility, deployment, TDD and deployment.md.

### 17.2 Required submission packaging

The task requires one ZIP (maximum 25 MB) containing exactly two files: **TDD** and `deployment.md`. Put the GitHub repository URL and live URL (if deployed) at the top of the TDD. The TDD must explain architecture and rationale, data model, main flows, AI/risk design, UI decisions, assumptions, limitations and what was intentionally not built. `deployment.md` must give step-by-step local setup, environment variable names only (never values), demo login details and demo/provider limitations. Keep the GitHub repository public until review is complete, preserve commit history, and do not commit secrets or real personal data.

### 17.3 Definition of done

The take-home is ready for review when:

- The core parent and accounts journeys work end to end.
- Payment capture is verified through the real webhook processing path, including mock callback signature verification.
- Partial payment, duplicate event, unmatched payment, and over-allocation cases are handled safely.
- Ledger balances and dashboard totals derive from the same underlying records.
- Withdrawal does not leave an ordinary collectible balance or send ordinary reminders in the MVP.
- Refund policy version, input snapshot, formula lines, approver, and item-level completion are traceable.
- Parent and staff access are enforced server-side and tested.
- Loading, empty, error, and success states exist for core screens.
- Seeded data is synthetic, deterministic, and labelled.
- A clean clone can migrate, seed, run verification, and log into documented demo accounts.
- The Git repository contains no secrets or real personal data.
- The TDD, assumptions, deployment instructions, limitations, and demo credentials are documented.

## 18. Assumptions, Open Decisions, and Production Gates

The take-home intentionally resolves some missing client information with labelled assumptions so development can proceed. Those assumptions must not be silently presented as client-approved policy.

| Area | Current take-home decision | Required before production |
|---|---|---|
| Institute identity and centres | One Jaipur institute, four centres | Confirm actual legal entity and centre details |
| Fee schedules | Synthetic ₹1.2 lakh annual plan with four equal instalments | Use approved prospectus/fee schedule and contracted service dates |
| Partial-payment minimum | ₹1,000 or lower outstanding | Confirm with institute |
| Partial-payment refund | Candidate refund is a published-policy extension; shortfall informational only | Legal review and explicit published policy |
| Refund day count | Inclusive calendar days | Confirm against approved prospectus/contract and legal advice |
| Refund time limit | 10 calendar-day operational target; request-date trigger provisional | Confirm statutory trigger and relevant rules |
| Deductions | Zero fixed and zero percentage deductions | Do not enable non-zero deductions without legal basis and approved publication |
| Centre closure | Separate full-fee-refund reason/workflow | Confirm scope, eligible components, directions, and calculation details |
| Hostel/mess | Not applicable in synthetic seed unless client confirms | Confirm whether the institute provides accommodation and fee components |
| GST | No hard-coded rate; tax config is synthetic until approved | Accountant/tax adviser approves rate, treatment, receipt text, and credit note |
| Rajasthan Act | Build a four-equal-instalment-ready design | Verify commencement Gazette notification, current rules, and applicability to institute |
| OTP/messaging | Mock adapters for take-home | Select approved providers and complete template review |
| Risk scoring | Versioned deterministic heuristic | Calibrate with labelled data; never use as sole basis for adverse decisions |
| Data governance | Synthetic data and consent workflow | Define retention, erasure, pseudonymisation, and child-data handling with counsel |
| Tally | Controlled CSV export | Confirm ledger mapping and reconcile to actual accounting workflow |
| Bank settlement | Not in initial take-home | Add settlement-file reconciliation for production operations |

## 19. Key Risks and Mitigations

| Risk | Why it matters | Mitigation in FeeFlow |
|---|---|---|
| Incorrect balance after concurrent payments | Parent may be overcharged or dues may be understated | Row locks, transactions, constraints, invariant tests |
| Duplicate/forged webhook | Duplicate or fraudulent ledger changes | Signature verification, authoritative provider fetch, unique event/payment keys |
| Stale reminder after payment | Parent trust and support burden | Evaluate at send time; re-read current ledger balance |
| Wrong student/payment match | Payment applied to the wrong fee account | Exact order match only for automatic allocation; uncertain cases go to human queue |
| Refund formula misunderstood as law | Financial/legal exposure | Policy provenance labels, published policy version, legal-review gates |
| Part-paid shortfall treated as collectible | Unapproved debt collection | Informational shortfall only; waiver of ordinary receivable on approved withdrawal |
| Incorrect GST or credit note | Tax/accounting exposure | Separate tax module/configuration and accountant approval gate |
| Parent accesses another student's data | Sensitive child/financial data exposure | Active link + consent checks at repository/data boundary; authorization tests |
| Risk score creates unfair action | False flags can affect students/families | Explainable heuristic, data sufficiency, counsellor review, no automatic messaging or ledger action |
| Mock integrations mistaken for production | Reviewer/client may overestimate readiness | Visible demo labels and explicit limitations |
| Seed data mistaken for real outcomes | Misleading business claims | Visible synthetic-data banner and careful metric labelling |

## 20. Product Roadmap Beyond the Take-Home

Once the core system is proven and the institute validates its policies, the following can be considered:

- Approved SMS and WhatsApp delivery providers.
- Staff multi-factor authentication.
- Secure role and user administration UI.
- Production Razorpay integration and settlement-file reconciliation.
- Spreadsheet column-mapping UI for real centre formats.
- More complete tax configuration and accountant-approved credit-note workflows.
- Retention, erasure, and pseudonymisation tooling.
- Operational monitoring, backup/restore rehearsal, and support workflows.
- Calibration of risk signals using labelled historical outcomes before considering a trained model.
- Multi-institute tenancy only if a real commercial requirement emerges.

These are future capabilities, not implied take-home commitments.

## 21. Glossary

| Term | Meaning in FeeFlow |
|---|---|
| Fee plan | A student's approved course/service fee structure |
| Instalment | A scheduled part of the fee plan with an amount and due date |
| Ledger entry | Immutable signed financial record that changes the amount owed |
| Outstanding | Sum of relevant signed ledger entries for the instalment/student |
| Payment intent | Server-created request to collect a validated amount through a provider |
| Capture | Provider-confirmed successful receipt of money |
| Allocation | Applying a captured payment to one or more instalment balances |
| Unallocated payment | Captured money not yet applied to an instalment |
| Receipt | Immutable proof/document snapshot for a captured payment |
| Refund policy version | Published immutable set of refund rules used by the calculator |
| Indicative shortfall | Difference between calculated earned fee and amount paid; informational only in the MVP for part-paid withdrawal |
| Withdrawal rebase | Waiving ordinary outstanding for the withdrawn course so it does not remain as collectible dues in the MVP |
| Outbox event | Durable event written in the same transaction as a business state change |
| Over-60 ratio | Snapshot measure of outstanding instalments aged beyond 60 days using the SRS-defined denominator |
| Risk flag | Explainable heuristic indicator for counsellor review, not a dropout probability |

## 22. Source and Specification Alignment

This product concept is derived from:

1. **Isocode take-home task, Problem 4 — Coaching institute's fee tracking system and parent portal.** Client context, required workflows, design constraints, sample data, success targets, and scope boundaries are identified as brief-derived.
2. **FeeFlow: Software Requirements and Architecture Specification v2.0.** Product modules, user roles, screens, architecture, data principles, payment/reminder workflows, risk engine, imports, reporting, seed data, and delivery tiers.
3. **FeeFlow SRS v2.1 — Refund Policy & Compliance Addendum.** Accepted clarifications on partial-payment shortfalls, zero deductions, inclusive calendar-day proration, withdrawal rebase, deadline assumptions, separate accommodation components, centre-closure refunds, tax review, and four-equal-instalment option.
4. **Ministry of Education, Guidelines for Regulation of Coaching Center (January 2024)** and **Rajasthan Coaching Centres (Control and Regulation) Act, 2025 (Act 16 of 2025)** as legal-source references identified by the SRS/addendum. Their applicability, commencement, rules, and production interpretation remain subject to legal verification.

This document is a product concept, not a replacement for the detailed SRS, TDD, deployment guide, or professional legal/tax/accounting review.

---

**End of document — FeeFlow Product Concept v2.2 FINAL**
