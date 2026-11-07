# FeeFlow — Final Alignment, Sanity Check & Development Gate

**Version:** 2.2 FINAL  
**Date:** 7 November 2026  
**Purpose:** Single authoritative reconciliation across the Isocode Problem 4 Brief, `FeeFlow_SRS_v2.2_FINAL.md`, `FeeFlow_PRODUCT_CONCEPT_v2.2_FINAL.md`, `FeeFlow_UI_Reference_v2.2_FINAL.md`, `FeeFlow_Wireframes_v2.2_FINAL.md`, and `FeeFlow_UI_Screens.pdf` (22 pages).

---

## 1. Sanity Check Verdict

**Verdict: 9.6 / 10 — Ready for Immediate Build in Antigravity IDE.**  
Your updated UI system (`FeeFlow_UI_Reference`, `FeeFlow_Wireframes`, and the 22-page `FeeFlow_UI_Screens.pdf`) is a massive improvement over the earlier 28-page CashPilot draft. It directly embodies the client's design brief (*"clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Parents should understand their dues in five seconds: amount, due date and a pay button, nothing more"*).

### Six Cross-Document Ambiguities Resolved in v2.2

1. **UI Artifact Alignment (22-Page Visual Book vs Old 28-Page CashPilot Book):**
   - Removed all legacy references to the 27/28-page CashPilot navy/violet/serif theme. Standardized across all docs on the **22-page `FeeFlow_UI_Screens.pdf`** (`P0a`–`P5` for Parent Mobile, `S0`–`S8` for Staff Desktop) with warm paper (`#FAF8F4`), near-black ink (`#17191A`), deep teal (`#0B5D5A`), neutral slate (`#505A66` for informational shortfall), and `Inter` + `Noto Sans Devanagari`.
2. **3-Instalment vs 4-Instalment Plan Reconciliation (`STU-0219` Mohit Gurjar):**
   - The brief states *"Average fee ₹1.2 lakh a year, paid in 3 or 4 instalments"* and lists `STU-0219` (Mohit Gurjar) with a `₹40,000` instalment due `2026-11-15`.
   - Standardized the seed so `STU-0412` (Aarav) and `STU-0587` (Ishita) use a **4 × ₹30,000** plan (`₹1,20,000`), while `STU-0219` (Mohit) uses a **3 × ₹40,000** plan (`₹1,20,000`). The signature `<Rail />` component dynamically renders `segs.length` segments (3 or 4).
3. **Dual Refund Fixture Alignment (`T = 365` Unit Test Fixtures + `T = 290` UI Screen Fixtures):**
   - Preserved the 4 mathematical boundary fixtures (`F1`–`F4`, `T = 365` days) for unit tests AND added the 2 UI-seeded fixtures (`U1`: `STU-0587` Ishita part-paid withdrawal with `₹14,586.21` informational shortfall; `U2`: `STU-1038` Kavya Rathore full-paid withdrawal with `₹63,724.14` refund across 3 items, `T = 290` days `15 Jun 2026–31 Mar 2027`) so the database seed matches PDF pages 10, 17, and 18 down to the paise.
4. **Explicit GST Visibility on Receipts ("Receipts must show GST"):**
   - Kept GST configuration-driven (per SRS v2.1 legal safeguard) while pre-seeding a clearly marked synthetic tax profile (`Demo GSTIN: 08AABCC1234D1Z5 [SYNTHETIC]`, `SAC: 999293`, and configurable tax breakdown lines) on `P1d` (Payment Confirmed) and `P3` (Receipts) so evaluators immediately see the brief's GST constraint fulfilled.
5. **Immediate Reminder Stop on Payment ("stop the moment someone pays"):**
   - In addition to evaluating current ledger balances at send time, settling an instalment via webhook immediately marks any pending `DUE` reminder dispatches for that instalment as `SKIPPED (Instalment settled)` in the same database transaction.
6. **AI Dropout-Risk Flag Wording ("creates a counsellor call task"):**
   - Standardized the task created by a `HIGH` risk flag (`score >= 60`) as a **Counsellor Call Task** (`COUNSELLOR_CALL`), with explicit UI actions on `S7` to mark `Reviewed`, `Follow-up required`, or `False positive` (30-day suppression), and a hard architectural barrier preventing any parent message or fee action.

---

## 2. Complete Brief-to-Implementation Traceability Matrix

| Brief Section | Requirement in Brief | Screen / Module ID | Tier | Status |
|---|---|---|---|---|
| **CORE BUILD** | Fee ledger per student: plan, instalments, discounts, payments, balance, days overdue | `S2` Student Ledger + `fees` module | Tier 0 | Must ship |
| **CORE BUILD** | Parent portal with OTP login: dues and pay link (5-second rule: amount, due date, pay button above 640px fold) | `P0a`–`P0c`, `P1`, `P1b`–`P1e` | Tier 0 | Must ship |
| **CORE BUILD** | Automatic Hindi or English reminders before, on, and after due date, stopping on payment | `S4` Reminder Centre + `reminders` module | Tier 0 | Must ship |
| **CORE BUILD** | Pro-rata refund calculator following written policy (MoE 2024 10-day rule, maker-checker) | `P5`, `S5a`, `S5b`, `S8` + `refunds` module | Tier 0 | Must ship |
| **CORE BUILD** | Accounts dashboard by centre and batch with ageing | `S1` Dashboard + `reporting` module | Tier 0 | Must ship |
| **CORE BUILD** | Roles: Parent and Accounts Executive (+ minimal Counsellor & Director for risk/approval) | `S0`, RBAC middleware & repository scope | Tier 0 | Must ship |
| **CORE BUILD** | AI dropout-risk flag from missed instalments, falling attendance, and test trends; creates counsellor call task only; mark false flags | `S7` Risk Review + `risk` module | Tier 0 | Must ship |
| **AI / AUTO** | Unmatched payments go to an accounts queue instead of marking anything paid | `S3` Payments & Unmatched Queue | Tier 0 | Must ship |
| **CONSTRAINTS** | DPDP Act 2023 verifiable parental consent for minors | `P0c` Consent Gate (per child) | Tier 0 | Must ship |
| **CONSTRAINTS** | Receipts must show GST | `P1d`, `P3` Receipt View + PDF | Tier 0 view / Tier 1 PDF | Must ship |
| **CONSTRAINTS** | Low-end phones (360px viewport, lightweight JS) & Hindi required (`EN | हिं` toggle) | All `P*` routes (`next-intl`) | Tier 0 | Must ship |
| **SAMPLE DATA** | Seed `STU-0412` (Aarav), `STU-0587` (Ishita), `STU-0219` (Mohit) with demo clock `2026-11-02` | `prisma/seed.ts` | Tier 0 | Must ship |
| **MUST HAVE (Depth)** | Parent attendance, test scores, and downloadable PDF receipts | `P2`, `P3` | Tier 1 | Build after Tier 0 passes |
| **MUST HAVE (Depth)** | Bulk upload of attendance and test scores per batch | `S6` Imports | Tier 1 | Build after Tier 0 passes |
| **MUST HAVE (Depth)** | Month-end reconciliation and Tally CSV export | `S3b` Reconciliation | Tier 1 | Build after Tier 0 passes |

---

## 3. Start-Development Gate for Antigravity IDE

1. **Do not build Tier 1 before Tier 0 works end-to-end.** However, because `P2` (Parent Attendance/Tests), `S6` (Imports), and `S3b` (Reconciliation/Tally CSV) are completely specified in `FeeFlow_Wireframes_v2.2_FINAL.md`, Antigravity can ship Tier 0 in Gates 1–4 and add Tier 1 in Gate 5 within your schedule.
2. **Zero dead buttons:** Every visible button on every rendered screen must trigger a real action, dialog, sheet, or download.
3. **Final submission rule:** Remember that the ZIP you upload to Isocode by **9 Nov 2026, 11:59 PM IST** must contain **only two files**: `TDD.pdf` (or `.docx`) and `deployment.md` (< 25 MB).
