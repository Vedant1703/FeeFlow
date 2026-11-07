# FeeFlow Agent Instructions

This directory mirrors the agent setup used in the previous CashPilot project, tailored to FeeFlow.

## Structure

```text
.agents/
├── rules/
│   ├── ai-governance.md
│   ├── financial-integrity.md
│   ├── frontend.md
│   └── integrations.md
├── skills/
│   ├── implement-feature/SKILL.md
│   ├── payment-provider-sandbox-check/SKILL.md
│   └── review-financial-integrity/SKILL.md
└── mcp_config.json
```

## How to use

- Treat all four rule files as project-wide guidance. Load the rules relevant to the task before making changes.
- Use `implement-feature` for feature work and bug fixes.
- Use `payment-provider-sandbox-check` for the mock payment provider or Razorpay Test Mode flow.
- Use `review-financial-integrity` before merging or demonstrating financial-operation changes.
- Keep this folder in the FeeFlow repository so the coding agent can reference it.

## MCP configuration

`mcp_config.json` intentionally starts with an empty `mcpServers` object. Add only MCP servers the project actually needs; do not place provider credentials or secrets in this file.

## Project-specific non-negotiables

- Ledger-derived balances; append-only financial history.
- Integer paise/BigInt money arithmetic.
- Verified, idempotent server-side payment events.
- Human review for uncertain payment matches and sensitive approvals.
- Accepted v2.1 refund safeguards, including informational-only part-paid shortfalls.
- Parent mobile experience and staff financial-operations workspace remain distinct.
- Mock/test integrations must never be presented as production delivery or settlement.
