---
name: review-financial-integrity
description: Perform a focused code and data-flow review of FeeFlow financial operations for ledger correctness, money precision, webhook trust, allocation bounds, refund safeguards, reconciliation, and auditability.
---

# Skill: Review FeeFlow Financial Integrity

Use this skill before merging or demonstrating changes that can affect fees, payment capture, allocations, receipts, withdrawals, refunds, reminders, reporting, reconciliation, or exports.

## Required context

Read `.agents/rules/ai-governance.md`, `.agents/rules/financial-integrity.md`, and `.agents/rules/integrations.md`. Read `frontend.md` as well if the change affects financial UI or user-visible status.

## Review procedure

### 1. Trace the complete state transition

Trace from the entry point through:

- Authentication and actor/capability/centre-scope enforcement.
- Request/provider input validation.
- Domain/application use case.
- Repository queries, locks, constraints, and transaction boundaries.
- Ledger, payment, allocation, receipt, refund, audit, and outbox writes.
- Read models/queries used by parent, accounts, and director screens.
- Retry, replay, failure, and compensation paths.

Do not review only the UI or only the service method. Identify where authoritative state is created and read.

### 2. Money and ledger checks

- Are all stored/calculated amounts integer paise/BigInt with no floating-point financial arithmetic?
- Is outstanding derived from signed ledger entries rather than mutable duplicate balance fields?
- Are entry signs and types correct?
- Are ledger rows append-only and corrections represented by linked reversals/compensating entries?
- Are multi-record writes transactional?
- Are rounding rules explicit, shared, and tested?

### 3. Payment and allocation checks

- Can a browser redirect or client-supplied status mark payment captured? This must be impossible.
- Are signatures and authoritative provider facts checked?
- Are event/payment IDs unique and processing idempotent under retries/replay?
- Are amount, currency, order/intent, and provider status bound correctly?
- Are allocation bounds enforced under concurrency by transaction/lock/constraint?
- Are unknown or suggested matches kept unallocated until the required human review?
- Are excess amounts visible and preserved as unallocated?
- Are payment capture, allocation, and receipt treated as distinct concepts?

### 4. Refund and withdrawal checks

- Is the immutable published policy version/content hash used and stored with calculation inputs/results?
- Are inclusive-day proration and the single round-half-up helper used?
- Are current take-home deductions zero unless an explicitly approved policy changes them?
- Is a full-paid pathway distinguished from the partial-payment policy extension?
- Is a part-paid shortfall informational only and excluded from ordinary receivables, ageing, parent dues, and reminders?
- Does approved withdrawal create waiver entries to reduce ordinary outstanding to zero and stop ordinary reminders?
- Is maker-checker enforced server-side?
- Are refund items bounded by each payment's remaining refundable amount and processed newest first as specified?
- Is accepted/queued gateway status kept distinct from completed refund?
- Can a refund be marked complete before all required items and document metadata are persisted? This must be impossible.
- Are centre-closure and any separate service components handled through their own documented pathway?

### 5. Reminder, import, reconciliation, and export checks

- Do reminders re-read current outstanding at send time and re-check eligibility?
- Are daily limits, quiet hours, language preference, pause state, retry/backoff, and idempotency applied?
- Are imports staged and reviewed before explicit commit, with file/row duplicate protection?
- Are captured, refunded, allocated, unallocated, and exported amounts separately represented?
- Is month close an immutable snapshot?
- Are Tally CSV batches/items deduplicated and exports protected against formula injection?

### 6. Authorization, privacy, and audit checks

- Are server-side actor, role, centre scope, parent-child relationship, and consent checks applied at the data-access boundary?
- Can a counsellor access detailed ledger rows or perform accounts actions? This must be prevented.
- Are sensitive actions attributable to an actor with timestamp, request/correlation ID, entity, action, and reason where required?
- Are secrets and sensitive provider data redacted from logs and error messages?
- Is all demo data synthetic and labelled?

### 7. Tests and evidence

Inspect existing tests and add targeted cases for any uncovered invariant. Prefer tests that prove the invariant at the domain/database/route boundary, not only a component snapshot.

Run relevant tests, type checking, lint, and build where available. Separate findings into:

- **Critical:** could cause incorrect collection, duplicate/forged financial effects, unauthorized access, or non-compliant refund/withdrawal behavior.
- **High:** significant auditability, reconciliation, idempotency, or recovery weakness.
- **Medium:** incomplete state handling, observability, or confusing financial presentation.
- **Low:** maintainability or non-critical UX issue.

## Review output format

### Verdict
Pass / Pass with conditions / Blocked.

### Findings
For each finding, include severity, file and relevant symbol/line if available, concrete failure scenario, financial/operational impact, and recommended fix.

### Invariants checked
List the invariants actually inspected and the tests/evidence supporting them.

### Verification
List exact commands run and outcomes. Explicitly identify tests not run.

### Residual risk
Record assumptions, policy/legal/tax decisions still awaiting professional confirmation, and any untested provider or concurrency behavior.

Do not declare the system financially safe based only on a code skim or a passing happy-path test.
