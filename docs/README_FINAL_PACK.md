# FeeFlow — Final Aligned Development Reference Pack v2.2

This archive is your **clean, deduplicated, zero-ambiguity development pack** for building **FeeFlow** (Isocode Take-Home Problem 4: Coaching Institute's Fee Tracking System and Parent Portal) in Antigravity IDE.

## Files Included in This Pack

1. `FeeFlow_FINAL_ALIGNMENT_AND_BUILD_GATE.md` — Sanity check report, resolution of the 6 cross-document edge cases, and complete Brief-to-UI traceability table.
2. `FeeFlow_SRS_v2.2_FINAL.md` — Consolidated authoritative Software Requirements Specification (aligned with the 22-page UI visual book, 3- and 4-instalment plans, `T=365` + `T=290` refund fixtures, synthetic GST receipt profile, immediate reminder cancellation on settlement, and counsellor call tasks).
3. `FeeFlow_PRODUCT_CONCEPT_v2.2_FINAL.md` — End-to-end product overview, user journeys, and policy boundaries aligned with SRS v2.2.
4. `FeeFlow_UI_Reference_v2.2_FINAL.md` — Complete design tokens (`globals.css` + `tailwind.config.ts`), typography (`Inter` + `Noto Sans Devanagari`), `<Rail />` component code, shadcn/ui mapping, motion rules, and bilingual string table.
5. `FeeFlow_Wireframes_v2.2_FINAL.md` — ASCII wireframes and state matrices for all Parent screens (`P0a`–`P5`) and Staff screens (`S0`–`S8`).
6. `FeeFlow_UI_Screens.pdf` — Your 22-page high-fidelity visual design book (for human visual verification).
7. `ANTIGRAVITY_PLAYBOOK_AND_RULES.md` — Ready-to-use `.antigravity/rules.md` system instructions, the 5-Gate sequential prompt plan for Antigravity IDE, and copy-paste templates for your two final submission files (`TDD.md` and `deployment.md`).

## How to Use in Antigravity IDE

- Copy the `.md` files into `/docs` in your repository.
- Copy Section 2 of `ANTIGRAVITY_PLAYBOOK_AND_RULES.md` into `.antigravity/rules.md`.
- Keep `FeeFlow_UI_Screens.pdf` for your own visual check (do not force the coding agent to parse the binary PDF when the exact layout and tokens are already in `FeeFlow_UI_Reference_v2.2_FINAL.md` and `FeeFlow_Wireframes_v2.2_FINAL.md`).
- Run Gates 1 through 5 from `ANTIGRAVITY_PLAYBOOK_AND_RULES.md`.
