# FeeFlow — Financial Integrity Rules

These are non-negotiable invariants for fees, instalments, payments, allocations, ledger entries, receipts, withdrawals, refunds, reconciliation, and exports.

## 1. Money representation

- Represent money as integer paise throughout domain logic and persistence (`bigint` in PostgreSQL and `BigInt` in TypeScript/domain code where the project convention requires it).
- Never use JavaScript floating-point arithmetic for financial calculations. Do not parse or format a decimal rupee value and then use it as the calculation source.
- Convert to/from human-readable INR only at explicit input/output boundaries using tested helpers.
- Use one documented round-half-up helper for the refund proration calculation. Avoid inconsistent rounding implementations.
- Validate positive/non-negative amounts and upper bounds at the server boundary; client validation is only a usability aid.

## 2. Ledger is authoritative and append-only

The student fee ledger is the source of truth for what is owed. Do not introduce independently mutable `amountPaid`, `balance`, `isSettled`, or similar fields as an alternate financial truth.

- Positive signed entries increase the obligation; negative entries reduce it.
- Current outstanding, settlement state, and overdue state must be derived from relevant ledger entries and due dates.
- Ledger history is append-only. Never update or delete a posted financial entry to correct history.
- Correct mistakes with a linked reversal or other explicitly permitted compensating entry, preserving actor, timestamp, reason, and reference to the original entry.
- Keep the transaction that writes a business state change and its corresponding ledger/audit/outbox records atomic where required.

Recognized entry semantics:

- `CHARGE`: original instalment obligation; positive.
- `DISCOUNT`: approved reduction; negative.
- `ALLOCATION`: captured payment applied to an instalment; negative against the receivable.
- `REVERSAL`: compensating entry linked to the entry being reversed; sign and linkage must restore the intended position.
- `WAIVER`: approved reduction, including withdrawal rebase; negative.
- `REFUND_ADJUSTMENT`: controlled correction for failed/reversed refund accounting; must follow the defined refund workflow.

## 3. Payment capture and allocation

- A payment intent amount is calculated and validated by the server against the current ledger-derived outstanding.
- A browser redirect, client callback, query parameter, or UI state must never mark a payment captured.
- Only an authoritative, signature-verified provider event processed by the server may create/confirm a captured payment. Follow the provider contract and verify against the authoritative provider record where the integration contract requires it.
- Enforce unique provider event IDs and provider payment IDs. Webhook processing must be idempotent under retries and replay.
- Do not trust amount, currency, order ID, student ID, or status supplied only by the browser.
- Lock the target instalment or use an equivalent concurrency-safe transaction while calculating and applying an allocation.
- Never allocate more than the payment's remaining unallocated amount or more than the instalment's current outstanding.
- Leave excess funds unallocated and visible for accounts review; do not silently discard or redirect the excess.
- Exact payment-intent matches may follow the defined automatic allocation path. Suggested/no matches require human review. A suggested match must never silently alter a ledger.
- Commit allocation and corresponding ledger entries atomically.
- Reverse a mistaken allocation with linked reversal records, never by deleting the original allocation.

## 4. Receipts

- Issue one immutable receipt for each captured payment, even when the payment is not yet allocated, if that is the existing product flow.
- Receipt and allocation are separate concepts. Do not imply that a receipt proves allocation to a particular instalment.
- Receipt content is a document snapshot of the institute, student, fee lines, tax configuration, captured amount, and other required metadata at issuance time.
- Protect sequential receipt numbering against concurrent issuance.
- Support English and Hindi rendering with the required embedded Devanagari font or documented print fallback.
- Do not hard-code a GST rate or assert tax treatment without the approved configuration.

## 5. Refund and withdrawal policy — accepted v2.1 safeguards

Use the immutable, published refund-policy version that the parent sees and the calculator uses. Store the policy version/content hash and calculation input snapshot with the result.

Current take-home defaults:

- Pro-rata calculation across the fee-service period.
- Inclusive calendar-day counting.
- Fixed deduction: ₹0.
- Percentage deduction: 0 basis points.
- Ten-calendar-day operational target; the clock-start event remains provisional pending legal confirmation.
- Tax and credit-note treatment is a separate accountant-approved configuration; do not hard-code 18% GST.

Calculation inputs and semantics:

- `N`: net fee after approved discounts for the relevant service component.
- `P`: net captured and allocated payments attributable to that component, less completed refunds.
- `S` and `E`: published service-period start and end dates.
- `W`: approved effective withdrawal date.
- `T = days(E) - days(S) + 1`.
- `c = clamp(days(W) - days(S) + 1, 0, T)`.
- `earned = roundHalfUp(N × c / T)`.
- `deduction = 0` under the current take-home defaults.
- `obligation = min(N, earned + deduction)`.
- `indicativeRefund = max(0, P - obligation)`.
- `indicativeShortfall = max(0, obligation - P)`.

Eligibility and display rules:

- Distinguish the full-paid statutory pathway from the proposed published-policy extension for partial payments.
- A part-paid indicative refund is a potential refund under the proposed extension and requires director approval.
- A part-paid indicative shortfall is informational/review-required only in the MVP. It is not an ordinary collectible receivable and must not appear in parent amount due, ordinary dues ageing, standard reminders, or automatic collection.
- Course-not-started means zero consumed days; completed service clamps to the full term.
- Centre registration cancellation/self-closure uses a separate full-fee-refund workflow, not ordinary mid-course proration.
- Hostel/mess components must not be invented. Model them separately only if the institute actually provides them.
- The cited legal sources and product assumptions are not a substitute for current legal/tax review. Do not present provisional assumptions as settled law.

Withdrawal rebase and approvals:

- On approved withdrawal, create waiver ledger entries to reduce ordinary outstanding for the withdrawn course to zero, waiving latest-due instalments first as specified.
- Cancel fully waived instalments and ensure ordinary collection reminders no longer remain eligible.
- Preserve any indicative shortfall in the withdrawal/refund snapshot without converting it into ordinary collectible debt.
- Accounts may request; a different director approves or rejects. Enforce this in the server/domain layer.
- Refund execution is itemized against eligible captured payments, newest first, bounded by each payment's unrefunded captured amount.
- A gateway request accepted/queued is not a completed refund. Completion requires every refund item to be confirmed complete and required records/document metadata to be persisted.
- Keep failed refund items visible and retryable without duplicating completed refunds.

## 6. Reconciliation and exports

- Reconciliation must separately account for captured payments, completed refunds, allocations, unallocated funds, and exported amounts.
- Do not equate captured, allocated, refunded, and exported totals; preserve their distinct meanings.
- Drill-downs must identify the underlying records behind an aggregate or discrepancy.
- Month close is an immutable closure snapshot. Do not rewrite a closed period silently.
- Tally integration in the take-home is a controlled CSV export, not live synchronisation.
- Export batches and item-level deduplication must prevent a payment from being posted twice.
- Neutralize spreadsheet formula injection in CSV exports (including values beginning with formula-triggering characters) using a tested project helper.

## 7. Required invariant tests

For any financial change, add or update tests covering the relevant invariants, including as applicable:

- Concurrent/duplicate event processing does not create duplicate capture, allocation, receipt, or refund effects.
- Allocation cannot exceed payment unallocated amount or instalment outstanding.
- A payment capture without allocation does not reduce a student's outstanding.
- A reversal preserves the original history and restores the intended balance.
- Withdrawal rebase leaves no ordinary collectible balance and stops ordinary reminders.
- Part-paid shortfall is not an ordinary receivable.
- Refund totals cannot exceed eligible captured amounts.
- Refund completion requires all refund items to be confirmed complete.
- Reconciliation totals and export deduplication remain consistent.
