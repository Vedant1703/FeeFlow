---
name: payment-provider-sandbox-check
description: Verify FeeFlow's mock payment gateway or Razorpay Test Mode integration through the real intent, webhook verification, capture, allocation, receipt, and parent refresh flow without confusing sandbox behavior with production settlement.
---

# Skill: Payment Provider Sandbox Check

Use this skill when implementing, debugging, or demonstrating the FeeFlow mock payment adapter or optional Razorpay Test Mode adapter.

## Safety and scope

- Read `.agents/rules/ai-governance.md`, `financial-integrity.md`, and `integrations.md` first.
- Use synthetic students and test credentials only.
- Do not use production credentials or real customer payment data.
- Do not report that funds moved or settled. Mock and Test Mode transactions are not production settlement.
- Never bypass webhook verification or directly mutate the ledger from a test helper/UI action.

## Preflight

1. Inspect the payment-provider port/interface and current adapter implementation.
2. Inspect payment-intent creation, webhook route/handler, event persistence, capture processing, allocation, receipt issuance, and outbox/audit handling.
3. Confirm the environment explicitly identifies mock or sandbox mode.
4. Confirm required environment variables are schema-validated and secrets are not logged.
5. Confirm the test database is isolated and has deterministic synthetic fixtures.
6. Confirm provider event/payment IDs have the required uniqueness constraints and idempotency path.

## Test matrix

Exercise the scenarios supported by the adapter and current scope:

| Scenario | Expected behavior |
|---|---|
| Valid success/capture | Signature and provider facts verified; capture persisted once; eligible amount allocated transactionally; receipt issued; parent state refreshes from server truth |
| Browser returns before webhook | UI shows payment confirmation pending; no captured/paid state is inferred from redirect |
| Pending provider outcome | Remains pending; no allocation or receipt that requires capture |
| Failed payment | Failure is visible; no ledger reduction |
| Invalid signature | Event rejected; no capture, allocation, or receipt side effect |
| Duplicate event | Idempotently recognized; no duplicate financial or document side effects |
| Replayed event | Safe no-op or recorded rejection according to event state; no duplicate effect |
| Unknown order/reference | Verified capture may remain unallocated and enter accounts review; no guessed student allocation |
| Amount/currency mismatch | Reject or quarantine according to the adapter contract; never allocate based on browser-supplied values |
| Partial payment | Allocate no more than current outstanding; remaining balance is derived from ledger |
| Excess payment | Allocate only up to outstanding; preserve excess as unallocated for accounts review |
| Concurrent captures | Lock/transaction/constraints preserve allocation bounds and ledger consistency |
| Provider timeout/error | Show a truthful retryable/pending/error state; do not claim capture |

## End-to-end verification

1. Sign in as a seeded parent with active parent-student relationship and required consent.
2. Open an eligible instalment and record the server-displayed outstanding.
3. Create a payment intent for the full or permitted partial amount.
4. Complete the mock hosted-checkout/Test Mode flow.
5. Before the verified provider event is processed, confirm the UI does not claim payment success.
6. Deliver the valid callback/webhook through the normal route.
7. Verify signature/event handling and authoritative payment facts.
8. Inspect persisted capture, allocation, ledger entry, receipt snapshot, audit, and outbox records.
9. Refresh the parent view and confirm the displayed balance comes from server data.
10. Replay the same event and verify no duplicate records or side effects.
11. Inspect the accounts payment/reconciliation view for remaining unallocated amounts or failures.

## Required assertions

- A client redirect alone cannot create capture state.
- Payment amount/currency/order binding are verified server-side.
- Event and payment idempotency are enforced in persistence, not only in memory.
- Allocation does not exceed the payment remainder or instalment outstanding.
- Receipt issuance is tied to confirmed capture and remains distinct from allocation.
- Provider secrets and sensitive payloads are absent from logs and UI errors.
- Sandbox/mock labels are visible in the relevant demo/admin interface.

## Report format

Provide a concise report with:

- Adapter checked: mock or Razorpay Test Mode.
- Environment mode and test fixture used (no secrets).
- Scenarios executed and pass/fail result.
- Evidence from tests/log-safe identifiers or database assertions.
- Any skipped scenarios and why.
- Open defects and whether they block a safe demo.
- An explicit statement that sandbox/mock verification is not production settlement verification.

Never claim a scenario passed unless the test or observed flow was actually executed.
