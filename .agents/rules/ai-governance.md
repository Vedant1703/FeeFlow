# FeeFlow — AI Governance Rules

These rules govern every AI-assisted change in FeeFlow. Apply them together with `financial-integrity.md`, `frontend.md`, and `integrations.md` whenever relevant.

## 1. Product identity and scope

FeeFlow is a fee-collection and financial-operations platform for a multi-centre coaching institute. It connects:

- Parent self-service for fee dues, payments, receipts, and enabled academic visibility.
- Accounts operations for fee plans, instalments, student ledgers, payment reconciliation, reminders, withdrawals, refunds, imports, and reports.
- Management and counselling oversight for centre-level performance, approvals, audit review, and explainable student-support flags.

FeeFlow is **not** an LMS, timetable, admissions CRM, general-ledger ERP, or trained dropout-prediction system. Do not introduce these products or imply that they are included in the take-home scope.

The implementation is a modular monolith. Preserve the existing module boundaries and keep domain rules independent from UI frameworks, persistence details, payment/messaging vendors, PDF renderers, and clocks.

## 2. Source-of-truth hierarchy

When making product decisions, use this order:

1. The current repository implementation, tests, migrations, and accepted architecture decisions.
2. The FeeFlow Product Concept and accepted SRS/addenda supplied for this project.
3. Explicit instructions in the current task.
4. A clearly labelled, minimal implementation assumption when the sources do not decide the issue.

Do not silently change accepted v2.1 refund safeguards or the documented product boundaries. If a task conflicts with a financial invariant, access boundary, or accepted policy, stop and explain the conflict before implementing a workaround.

Do not invent client-approved policies, legal conclusions, production integrations, or business outcomes. Keep assumptions visible in code, UI, docs, and demo data where material.

## 3. Truthfulness and demo boundaries

- Synthetic data must be deterministic and visibly labelled as synthetic in demo-facing interfaces.
- A mock payment adapter does not move money. A mock messaging adapter does not send real SMS or WhatsApp messages. A mock OTP adapter does not deliver real OTPs.
- Razorpay Test Mode is a sandbox integration, not a production payment integration.
- A CSV export is not live Tally synchronisation.
- A risk score is a deterministic heuristic, not a trained model or probability of dropout.
- A payment redirect or browser-side success state is not proof of capture.
- A gateway refund request being accepted is not proof that the refund completed.
- Do not claim a financial target, collection improvement, ROI, legal compliance, or production readiness merely because seeded demo data or a UI mock displays it.

Use precise labels such as `Demo`, `Synthetic data`, `Mock provider`, `Test Mode`, `Pending confirmation`, and `Informational only` where applicable.

## 4. Security, privacy, and authorization

- Use synthetic people, contact details, payment references, and student records in development and demo fixtures. Never commit real student, parent, or staff data.
- Never commit API keys, webhook secrets, database credentials, OTPs, session tokens, or provider payloads containing sensitive data.
- Redact secrets and sensitive payment data from logs, error messages, screenshots, and test snapshots.
- Every use case must operate on an authenticated actor and enforce role capabilities plus centre scope at the server/repository boundary.
- Parent access requires an active parent-student relationship and the required active consent. Do not trust client-supplied student IDs.
- Counsellors must not gain unrestricted fee-ledger access. Expose only the fee signal needed for the explainable risk review.
- Hiding a button or route in the UI is not authorization. Add or update server-side authorization tests for protected actions.
- Refund and discount approval must enforce maker-checker separation: the approver must differ from the requester.

## 5. Engineering conduct

Before changing code:

1. Inspect the relevant modules, route handlers, domain services, tests, and repository conventions.
2. Identify the authoritative source of data and the invariants the change could affect.
3. Prefer the smallest coherent change that satisfies the task.
4. Reuse existing patterns and dependencies; do not add a library without a concrete need.
5. Preserve backward compatibility unless the task explicitly requires a migration or API change.

While implementing:

- Keep business rules out of React components and route handlers where a domain/use-case layer exists.
- Validate untrusted input at the boundary with the project's Zod conventions.
- Use transactions for multi-record financial state changes.
- Use idempotency for event-driven and retryable operations.
- Avoid broad refactors bundled into feature work.
- Never weaken tests, constraints, authorization, logging redaction, or type safety to make a task pass.

Before completing:

- Run the most relevant tests, type checks, lint checks, and build checks available in the repository.
- Report exactly what ran and what did not run.
- Summarize changed files, behavior, migrations, assumptions, and residual risks.
- Do not state that a check passed unless it was actually executed and passed.

## 6. Scope discipline

The take-home priority is a small, real end-to-end product. Prioritize Tier A workflows and correctness over broad feature coverage. Do not start Tier B/C capabilities unless the task asks for them or the core flow is already complete.

Do not add real SMS/WhatsApp delivery, multi-institute tenancy, a full accounting ERP, a trained risk model, or bank settlement-file reconciliation as incidental scope.
