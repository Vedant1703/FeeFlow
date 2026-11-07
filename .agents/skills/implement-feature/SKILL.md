---
name: implement-feature
description: Implement a FeeFlow feature end to end while preserving product scope, modular boundaries, financial invariants, role authorization, and the established UI system.
---

# Skill: Implement a FeeFlow Feature

Use this workflow for feature work, bug fixes, and vertical slices.

## Required context

Before coding, read the applicable files in `.agents/rules/`:

- Always: `ai-governance.md`.
- Any money, fees, payments, ledger, refund, export, or reconciliation change: `financial-integrity.md`.
- Any route, component, interaction, form, chart, table, or localization change: `frontend.md`.
- Any provider, webhook, scheduler, upload, PDF, or external-system change: `integrations.md`.

Inspect the existing repository before assuming paths, versions, module names, data models, or available scripts.

## Workflow

### 1. Understand the request

- Restate the requested behavior in implementation terms.
- Identify the user role(s), centre scope, affected modules, entry points, and success/failure states.
- Identify whether the work is Tier A, Tier B, Tier C, or out of scope.
- List the financial, authorization, idempotency, and data-integrity invariants that apply.
- Identify unclear policy or legal decisions. Do not invent an answer; preserve the documented assumption or surface the decision needed.

### 2. Reconnaissance

Inspect:

- Relevant domain entities, use cases/services, repositories, and ports/adapters.
- Route handlers/server actions and their authorization patterns.
- Existing UI primitives, design tokens, layouts, localization messages, and page patterns.
- Database schema, migrations, constraints, and transaction conventions.
- Nearby unit, integration, contract, and end-to-end tests.

Search for an existing reusable implementation before adding a new abstraction or dependency.

### 3. Define the implementation plan

Provide a compact plan covering:

- Files/modules to change.
- Data model or migration impact.
- Server-side validation and authorization.
- UI screens/components and all key states.
- Provider/mock impact, if any.
- Tests and verification commands.

Keep the plan proportional to the task. Do not perform broad unrelated refactors.

### 4. Implement in the correct layer

- Put business rules in the domain/application layer, not in React components or route handlers.
- Pass an authenticated actor into use cases and enforce capabilities/centre scope in server-side code and scoped repositories.
- Validate API, form, import, and provider inputs at their boundaries.
- Use transactions for multi-record financial changes.
- Use idempotency for webhooks, retries, scheduler ticks, imports, and exports.
- Keep ports vendor-neutral; provider-specific code belongs in adapters.
- Keep the UI consistent with the FeeFlow design system and role-specific experience.
- Add loading, empty, error, pending, success, disabled, and permission states as relevant.
- Keep English/Hindi message parity for parent-facing and reminder-facing strings.

### 5. Test the behavior

Add/update the narrowest useful tests, then expand to integration/e2e coverage where risk warrants it.

Required test categories as applicable:

- Domain unit tests for calculations and state transitions.
- Authorization tests for role, centre scope, parent-child link, consent, and maker-checker separation.
- Database/integration tests for transactionality, constraints, locking, and idempotency.
- Provider contract tests for signature verification and provider failure/replay cases.
- UI/e2e tests for the complete user journey and error/pending states.
- Accessibility checks for keyboard/focus/labels/status communication.

For financial changes, apply the invariants in `financial-integrity.md`. For UI changes, apply the requirements in `frontend.md`.

### 6. Verify and report

Run the relevant commands available in the repository, normally including targeted tests, type checking, lint, and build when practical. Do not fabricate command output or claim unrun checks passed.

Finish with:

1. Summary of behavior implemented.
2. Key files/modules changed.
3. Tests and commands executed, with outcomes.
4. Migration/configuration/demo-data notes.
5. Assumptions, limitations, and remaining risks.

## Completion standard

A feature is not complete merely because the happy-path UI renders. It must preserve server-side authorization, validation, failure/pending behavior, observability, and applicable financial invariants.
