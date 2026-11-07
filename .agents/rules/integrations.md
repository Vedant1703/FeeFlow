# FeeFlow — Integration and External-System Rules

## 1. Port/adapter architecture

External providers must remain behind domain/application ports. Keep provider-specific SDKs, payload shapes, signatures, network calls, and configuration inside adapters. Domain services should depend on stable interfaces, not vendor SDKs.

Expected integration boundaries include:

- Payment provider: mock adapter; optional Razorpay Test Mode adapter.
- Messaging provider: mock adapter for reminder dispatches.
- OTP sender: mock adapter for the take-home.
- PDF/document renderer: receipt and credit-note rendering with Devanagari support.
- File storage/import boundary: validated staged uploads.
- Clock: injectable/testable time source for due dates, scheduler behavior, and refund calculations.

Every external port should have a deterministic mock adapter and contract tests. A mock must exercise the same application verification/persistence path as the real adapter; it must not bypass domain rules or directly mutate the ledger.

## 2. Payment-provider integration

- Create payment intents on the server using the current ledger-derived outstanding and server-validated requested amount.
- Keep provider order/payment references and internal payment-intent IDs distinct and traceable.
- Verify webhook/callback signatures with the provider-specific adapter using secrets from validated environment configuration.
- Verify event identity, payment identity, amount, currency, order/intent association, and provider status before accepting capture according to the provider contract.
- Use authoritative provider fetch/verification where required by the contract; never rely on an unsigned redirect or browser payload.
- Persist provider events idempotently. Duplicate events must be recorded/recognized safely and must not duplicate captures, allocations, receipts, or outbox effects.
- Process capture, allocation, receipt issuance, and related outbox/audit records through the defined transactional application path.
- Keep rejected, duplicate, pending, and failed provider events inspectable without exposing secrets or full sensitive payloads.
- The mock gateway should support success, failure, pending, invalid signature, unknown order, duplicate event, and replay scenarios.
- Razorpay integration, if implemented, must use Test Mode credentials and be labelled as sandbox/test integration. Do not imply that sandbox transactions move production funds.

## 3. Messaging and reminders

- The take-home messaging adapter is a mock. It records the rendered message and outcome; it does not send a real SMS or WhatsApp message.
- Render reminder text using the current ledger-derived outstanding at send time, not a stale amount saved when the reminder was scheduled.
- Re-check eligibility at dispatch time. Paid, cancelled, withdrawn, paused, and otherwise ineligible instalments must be skipped.
- Respect the parent's saved language preference (English/Hindi), quiet hours (default 21:00–08:00 IST), per-parent/student daily limit, retry/backoff policy, and unique dispatch key.
- Scheduler/outbox processing must be safe under repeated ticks and concurrent workers. Use database claims/locks or the established job-claim pattern.
- Keep sent, skipped, failed, deferred, and retry states distinct. Store a skip reason and provider reference/outcome where available.
- A UI `Run scheduler now` control is a demo operation; it must call the authenticated server endpoint and display truthful execution results.

## 4. OTP and authentication adapters

- OTP delivery is mocked in the take-home unless an explicitly approved provider is integrated.
- Never persist OTP values in plaintext or log them. Follow the project's expiry, attempt, and rate-limit rules.
- Keep parent OTP authentication and staff email/password authentication/session policies distinct.
- Do not include real phone numbers, real OTP credentials, or live personal data in seed fixtures or documentation.

## 5. PDF, files, and data exports

- Receipt PDFs must preserve immutable receipt snapshots and support English/Hindi glyph rendering. Verify the embedded Devanagari font in generated output.
- Refund/credit-note documents must use approved tax configuration and metadata; do not hard-code a GST rate.
- Imports must be staged before commit. Validate file size/type, schema, row values, student/batch membership, dates, marks/status ranges, duplicates, and changed values.
- Detect duplicate files using a content hash according to the repository design.
- Show valid, invalid, unchanged, changed, and duplicate row counts before explicit commit. Provide an error CSV where implemented.
- Neutralize spreadsheet formula injection in CSV exports.
- Tally output is a controlled, reproducible CSV export with immutable batch/item deduplication, not a live Tally API integration.

## 6. Configuration and secrets

- Validate environment variables at startup with the project's schema validation convention.
- Use clearly named variables for test/mock mode and fail closed when required secrets are missing or invalid.
- Never commit actual secrets in `.env`, JSON config, screenshots, logs, or documentation. Provide `.env.example` with placeholders only when needed.
- Do not add real MCP servers, external provider URLs, or credentials to `.agents/mcp_config.json` without an explicit project need and approved configuration.
- Keep sandbox and production configurations separate. Make environment/mode labels visible in the relevant staff UI.

## 7. Reliability and observability

- Make webhook, scheduler, import, export, and refund-item operations idempotent.
- Persist outbox events in the same transaction as the state transition that emitted them.
- Keep retryable failures visible and inspectable. Do not hide failures behind generic success notifications.
- Log correlation/request IDs, provider event IDs, internal entity IDs, and outcomes while redacting secrets and sensitive payloads.
- Add contract tests for mock and real adapters, including signature failure, timeout/failure, duplicate/replay, pending, and malformed payload cases as applicable.
- Do not claim external delivery, settlement, or refund completion without authoritative provider evidence.
