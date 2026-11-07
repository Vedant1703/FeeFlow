# FeeFlow Wireframes v2.2 FINAL (Aligned with SRS v2.2 & 22-Page UI PDF)

Low-fidelity structure for every screen in `FeeFlow_UI_Screens.pdf`. Baseline: Product Concept v1.0, SRS v2.0 and the v2.1 addendum. All names, centres and figures are synthetic.

**Conventions**

| Mark | Meaning |
|---|---|
| `[ Button ]` | Action. `[[ Primary ]]` is the one primary action on the screen |
| `( )` / `(•)` | Radio |
| `[x]` | Checkbox |
| `▼` | Dropdown |
| `~~~` | Skeleton or loading block |
| `{Chip}` | Status chip (icon + word) |
| `<A-09>` | Assumption or production gate from the v2.1 register |

Parent viewport is 360 × 776 (fold at 640). Staff layouts are 1180 px wide with a 200 px sidebar; below 768 px tables become stacked cards.

---

## 0. Screen inventory

| ID | Screen | Role | Concept ref | PDF page |
|---|---|---|---|---|
| P0a | Mobile number | Parent | §7.1 | 5 |
| P0b | OTP entry | Parent | §7.1 | 5 |
| P0c | Consent gate | Parent | §7.1 | 5 |
| P1 | Parent Home (Fees) | Parent | Screen 1 | 6 |
| P1b | Pay sheet | Parent | §7.4 | 7 |
| P1c | Hosted mock checkout | Parent | §7.4 | 7 |
| P1d | Payment confirmed | Parent | Journey A | 7 |
| P1e | Confirming / Failed / All paid | Parent | §10.2 | 8 |
| P2 | Attendance, Tests | Parent | Screen 1 | 9 |
| P3 | Receipts | Parent | §7.6 | 9 |
| P4 | Withdrawn, Offline | Parent | §10.2 | 10 |
| P5 | Public refund policy | Parent / public | §7.8 | 10 |
| S0 | Staff sign in | Staff | §7.1 | 11 |
| S1 | Dashboard | Accounts, Director | Screen 2 | 12 |
| S2 | Student ledger | Accounts | Screen 3 | 13 |
| S3 | Payments and unmatched queue | Accounts | Screen 4 | 14 |
| S3b | Reconciliation and export | Accounts | §7.11 | 15 |
| S4 | Reminder centre | Accounts | Screen 5 | 16 |
| S5a | Withdrawal and refund quote | Accounts | Screen 6 | 17 |
| S5b | Refund approval and execution | Director | Screen 6 | 18 |
| S6 | Imports | Accounts, Counsellor | Screen 7 | 19 |
| S7 | Risk review | Counsellor | Screen 8 | 20 |
| S8 | Policy, audit, health | Director | §5.4 | 21 |

---

# Part A. Parent (mobile)

## P0a. Mobile number

```
┌──────────────────────────────┐
│ ≡ FeeFlow            [EN|हिं]│
├──────────────────────────────┤
│                              │
│ Log in to see your child's   │
│ fees                         │
│ Enter the number you gave    │
│ the institute. We'll send a  │
│ 6-digit code.                │
│                              │
│ Mobile number                │
│ ┌──────────────────────────┐ │
│ │ +91 │ 90000 12345        │ │  54px input, numeric keypad
│ └──────────────────────────┘ │
│ [[        Send code        ]]│  54px
│                              │
│ ┌ - - - - - - - - - - - - ┐  │
│ ⓘ Demo build. Code appears   │  dashed demo banner
│ └ - - - - - - - - - - - - ┘  │
│ By continuing you accept ... │
└──────────────────────────────┘
```

States: default · focused · invalid number ("Enter a 10-digit mobile number") · rate-limited ("Too many requests. Try again in 10 minutes") · not registered ("This number isn't linked to a student. Contact your centre").

## P0b. OTP entry

```
│ Enter the 6-digit code       │
│ Sent to +91 90000 12345      │
│ Change number                │
│  [4] [8] [2] [ ] [ ] [ ]     │  autocomplete="one-time-code"
│  ⏱ Resend code in 0:42       │
│ [   Verify and continue   ]  │  disabled until 6 digits
│ ⓘ Demo code: 482913          │  demo only
│ ⚠ Wrong code. 2 tries left.  │  error banner
```

States: filled · wrong · expired ("Code expired. Request a new one") · locked · resend available.

## P0c. Consent gate (per child)

```
│ Allow Company A Institute to │
│ show you Ishita's records?   │
│ You will be able to see:     │
│  ───────────────────────     │
│  ▣ Fees, dues and receipts   │
│  ───────────────────────     │
│  ▣ Attendance                │
│  ───────────────────────     │
│  ▣ Test results              │
│ Only linked parents can see  │
│ this. You can withdraw later │
│ by contacting the centre.    │
│ [[         I agree        ]] │
│ [        Not now          ]  │
│ {Notice wording pending legal review}
```

## P1. Parent Home (Fees)

```
┌──────────────────────────────┐
│ ≡ FeeFlow            [EN|हिं]│
│ ┌────────────┐┌────────────┐ │  child switcher (only if >1 child)
│ │▣ Ishita    ││○ Kabir     │ │
│ └────────────┘└────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Amount due now {Overdue  │ │
│ │                by 23 days}│ │
│ │ ₹15,000                  │ │  52px numerals, the hero
│ │ Instalment 2 of 4 · was  │ │
│ │ due 10 Oct 2026          │ │
│ │ ▰▰▰ ▰▱▱ ▱▱▱ ▱▱▱          │ │  instalment rail
│ │ Paid ₹15,000 of ₹30,000  │ │
│ │ [[    Pay ₹15,000      ]]│ │  54px
│ │   Pay a different amount │ │
│ │ You can pay ₹1,000-15,000│ │
│ └──────────────────────────┘ │
│ ─ ─ ─ ─ ─ 640 px fold ─ ─ ─ ─│
│ All instalments              │
│ Instalment 1  ₹30,000 {Paid} │
│ Instalment 2  ₹30,000 {Part} │
│   ₹15,000 paid · ₹15,000 due │
│ Instalment 3  ₹30,000 {Upcoming}
│ Instalment 4  ₹30,000 {Upcoming}
│ Recent receipts              │
│ RC-2026-004812 ₹15,000 [⬇]  │
│ RC-2026-001944 ₹30,000 [⬇]  │
├──────────────────────────────┤
│ Fees │Receipts│Attend.│Tests │  bottom nav
└──────────────────────────────┘
```

Hard requirement: amount, due status and Pay button are above 640 px.

**State matrix**

| State | Amount card | Primary action |
|---|---|---|
| Overdue, part paid | `₹15,000` + `{Overdue by N days}` | Pay ₹15,000 |
| Due soon | `₹30,000` + `{Due in 13 days}` | Pay ₹30,000 |
| Not yet due | next instalment, `{Upcoming}` | Pay early (optional) |
| All paid | `₹0` + `{All paid}`, rail full | View receipts |
| Payment confirming | amount unchanged + `{Confirming}` banner | Check status |
| Consent required | no amounts; consent card | I agree |
| Withdrawn | `₹0`, enrolment-ended banner | none; refund progress if any |
| No fee plan | "No fee plan yet. Contact your centre." | Contact centre |
| Loading | skeleton same size as amount card | none |
| Offline | cached view + offline strip | Pay disabled, reason shown |
| Error | "Couldn't load. Check your connection." | Retry |

## P1b. Pay sheet (bottom sheet over Home)

```
│ ▒▒▒▒▒▒ scrim ▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│ ┌──────────────────────────┐ │
│ │        ──── grab         │ │
│ │ How much would you like  │ │
│ │ to pay?                  │ │
│ │ ( ) Full amount  ₹15,000 │ │
│ │ (•) Another amount       │ │
│ │     ₹1,000 to ₹15,000    │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ ₹ 5,000              │ │ │
│ │ └──────────────────────┘ │ │
│ │ ⓘ ₹10,000 will still be  │ │
│ │ due. Next reminder shows │ │
│ │ ₹10,000.                 │ │
│ │ [[    Pay ₹5,000       ]]│ │
│ │ We re-check this amount  │ │
│ │ on our server.           │ │
│ └──────────────────────────┘ │
```

Validation: below minimum, above outstanding, non-numeric → inline error under the field; button disabled.

## P1c. Hosted mock checkout

```
│ ⚠ DEMO CHECKOUT · no real money moves
│ [CA] Company A Institute     │
│      Order demo_ord_7F2K     │
│ ₹5,000                       │
│ Pay with                     │
│ (•) UPI   (  ) Card  (  ) NB │
│ [[       Pay ₹5,000       ]] │
│ ┌ demo outcome (hidden in prod) ┐
│ │ [Succeed] [Fail] [Pending]    │
│ └───────────────────────────────┘
```

Replaced by Razorpay Test Mode through the same provider port. Outcome buttons exist only in the mock adapter.

## P1d. Payment confirmed

```
│            ( ✓ )             │
│       Payment received       │
│          ₹5,000              │
│  Confirmed 2 Nov 2026, 10:42 │
│ ──────────────────────────── │
│ Instalment 2 still due ₹10,000│
│ Receipt        RC-2026-005107│
│ Method                    UPI│
│ GSTIN   08AABCC1234D1Z5(Demo)│
│ Tax     As per inst. profile │
│ [[   ⬇ Download receipt   ]] │
│ [      Back to fees       ]  │
```

Shown only after the verified webhook is processed. A gateway redirect alone shows P1e (Confirming).

## P1e. Confirming · Failed · All paid

```
CONFIRMING                       FAILED                          ALL PAID
│     ( spinner )     │          │ ( ✕ )                │       │ Amount due now {All paid}│
│ Confirming your     │          │ We didn't get        │       │ ₹0                       │
│ payment             │          │ confirmation of this │       │ ▰▰▰ ▰▰▰ ▰▰▰ ▰▰▰          │
│ Your bank has sent  │          │ payment              │       │ Paid ₹1,20,000 of        │
│ ₹5,000. Usually     │          │ Instalment 2 still   │       │ ₹1,20,000                │
│ under a minute.     │          │ shows ₹15,000 due.   │       │ [   View receipts   ]    │
│ ⚠ Please don't pay  │          │ ⓘ If money left your │       │ Recent receipts ...      │
│ again.              │          │ account, keep the    │       └──────────────────────────┘
│ [ ⟳ Check status ]  │          │ bank message...      │
                                 │ [[ Try again ]]      │
                                 │ [ Contact centre ]   │
```

## P2. Attendance and Tests

```
ATTENDANCE                         TESTS
│ Attendance, last 30 days │       │ Average of last 4 tests  │
│ 82%                      │       │ 65%                      │
│ Down from 90% before     │       │ Up from 61% in prior 4   │
│ ▇ ▇ ▇ ▃   (W1..W4)       │       │ Physics unit test 4 62/100
│ Recent classes           │       │ ▬▬▬▬▬▬▬▬▬▱▱▱             │
│ Mon 26 {✓ Present}       │       │ Chemistry unit test 4 ...│
│ Wed 28 {✕ Absent}        │       │ ...                      │
```

Insufficient data → "Not enough data yet" card; no percentage shown.

## P3. Receipts

```
│ Receipts for Ishita          │
│ ⓘ Each receipt records one   │
│   payment and cannot change. │
│ RC-2026-004812 · GST profile │
│ 14 Oct 2026 · ₹15,000 [⬇ Download]
│ RC-2026-001944 ...           │
```

## P4. Withdrawn · Offline

```
WITHDRAWN                          OFFLINE
│ [KR] Kavya Rathore       │       │ ⌁ You're offline. Showing the view
│ ⓘ Enrolment ended 28 Oct.│       │   saved at 10:42.        │
│   No fees are due.       │       │ (usual Home card)        │
│ Amount due now  ₹0       │       │ [   Pay ₹15,000 (disabled)]
│ Your refund              │       │ Payment needs a connection.
│ ₹63,724.14 {In progress} │
│ ▰▰▱  1 of 3 returns      │
│ confirmed. Target 8 Nov. │
```

Never shows a part-paid shortfall as an amount due (A-17).

## P5. Public refund policy

```
│ Refund and easy-exit policy  │
│ {Policy v1} {Same record the │
│  calculator uses}            │
│ If you leave during the course
│   plain-language rule        │
│ ┌ Example ────────────────┐  │
│ │ Fee ₹1,20,000 · 290 days│  │
│ │ Left after 136 days     │  │
│ │ Fee for days: ₹56,275.86│  │
│ │ Refund if paid in full: │  │
│ │ ₹63,724.14              │  │
│ └─────────────────────────┘  │
│ No deductions.               │
│ If you paid only part.       │
│ {Draft wording · legal and Hindi review pending}
│ Hash 7c3a…e91 · Published …  │
```

---

# Part B. Staff (desktop)

Shell shared by S1 to S8:

```
┌────────────┬──────────────────────────────────────────────────────┐
│ ≡ FeeFlow  │ [🔍 Search student, payment…  Ctrl K] [⚑ Centre ▼]  {Synthetic data · Demo clock}
│            ├──────────────────────────────────────────────────────┤
│ Accounts   │ Page title                              [Secondary][[Primary]]
│  Dashboard │ One-line purpose                                      │
│  Students  │                                                       │
│  Payments 7│  content                                              │
│  Reminders │                                                       │
│  Refunds 3 │                                                       │
│  Imports   │                                                       │
│ Counselling│                                                       │
│  Risk      │                                                       │
│ Director   │                                                       │
│  Policy…   │                                                       │
│ [NV] user  │                                                       │
└────────────┴──────────────────────────────────────────────────────┘
```

Menu items shown per role: Accounts (first six), Counsellor (Risk, Imports), Director (all). Server enforces scope regardless.

## S0. Staff sign in

```
┌───────────────────────┬─────────────────────────────┐
│ FeeFlow               │ What each role can do       │
│ Staff sign in         │ Accounts   …                │
│ Work email  [______]  │ Counsellor …                │
│ Password    [______👁]│ Director   …                │
│ ⚠ doesn't match…      │ ▰▰▰▱ every figure comes     │
│ [[ Sign in ]]         │ from one ledger             │
│ ⓘ Demo accounts: README│                            │
└───────────────────────┴─────────────────────────────┘
```

## S1. Dashboard

```
Collection health                                  [⬇ Export CSV] [[Month-end close]]
[Centre ▼] [Batch ▼] [As of 2 Nov 2026 📅]
┌──────────────────────────────────────────────────────────────────────────┐
│ Collected Oct │ Total outstanding │ Over-60 ratio │ Unmatched │ Refunds due│
│ ₹4.93 cr      │ ₹6.91 cr          │ 11.4%         │ 7         │ 3          │
│ 412 receipts  │ 2,591 students    │ snapshot      │ ₹1.84 lakh│ 1 in 3 days│
└──────────────────────────────────────────────────────────────────────────┘
┌ Outstanding by age and centre ───────────────┐ ┌ Needs attention ──────────┐
│ Malviya Nagar  ▇▇▇▇▇▇▇▇▇▇▓▓▓▓▓███  ₹2.12 cr │ │ Unmatched payments    {7} │
│ Vaishali Nagar ▇▇▇▇▇▇▇▇▇▓▓▓▓▓███   ₹1.94 cr │ │ Refunds near deadline {3} │
│ Mansarovar     …                             │ │ Failed reminders      {4} │
│ Tonk Road      …                             │ │ Rejected webhooks     {1} │
│ legend: 0-30 · 31-60 · 61-90 · Over 90       │ └───────────────────────────┘
└──────────────────────────────────────────────┘
┌ Batches ───────────────────────────────────────────────────────────────┐
│ Batch │ Centre │ Students │ Billed to date │ Outstanding │ Over-60 │ ›   │
│ …rows; click opens filtered student list…                              │
└────────────────────────────────────────────────────────────────────────┘
```

Empty state: "No payments in this period. Change the date or centre." Loading: KPI strip and table skeletons.

## S2. Student ledger

```
[IS] Ishita Sharma STU-0587                 {Reminders active} {Consent active}
     JEE 2027 Evening · Vaishali Nagar · Parent Rakesh Sharma · Hindi
┌ Charges ₹1,20,000 − Discounts ₹0 − Allocations ₹45,000 − Waivers ₹0 = ₹75,000 ┐
│ ₹15,000 overdue now, ₹60,000 not yet due                                      │
└──────────────────────────────────────────────────────────────────────────────┘
┌ Instalments ───────────────────────────────────────┐ ┌ Actions ───────────────┐
│ # │ Due │ Charge │ Allocated │ Outstanding │ Status │ │ [+ Request discount]  │
│ 1 │10 Jul│30,000 │ 30,000    │ 0           │{Paid}  │ │ [⏸ Pause reminders]   │
│ 2 │10 Oct│30,000 │ 15,000    │ 15,000      │{Part·overdue} 23d │ [↶ Record withdrawal]│
│ 3 │10 Jan│30,000 │ 0         │ 30,000      │{Upcoming}│ ├ Reminders ───────────┤
│ 4 │10 Mar│…                                          │ │ Last: 25 Oct (+15d)   │
├ Ledger timeline (append-only) ─────────────────────┤ │ Next: 9 Nov (+30d)    │
│ Date │ Type │ Amount │ Applies to │ Actor │ Ref │ Running
└────────────────────────────────────────────────────┘ └───────────────────────┘
```

Ledger rows are never editable. A correction appears as a new `REVERSAL` row linked to the original.

## S3. Payments and unmatched queue

```
Tabs: [Unmatched 7] [All payments] [Provider events 1] [Reconciliation]
┌ ⓘ Captured and receipted, not yet applied. Balances change only when you allocate. ┐
┌ Payment │ Amount │ Method │ Payer ref │ Best candidate │ Score │ ›  ┐ ┌ Why this suggestion ┐
│ pay_a91c│ ₹15,000│ UPI    │ MOHIT G 0219│ Mohit Gurjar │{86 suggested}│ │ reasons…            │
│ pay_b402│ ₹30,000│ UPI    │ R SHARMA    │ 2 possible   │{41 ambiguous}│ │ Student / Instalment│
│ pay_d7e5│ ₹5,000 │ Card   │ —           │ none         │{No match}    │ │ [[Review and allocate]]
│ pay_f012│ ₹2,500 │ UPI    │ STU-0412    │ excess       │{Unallocated excess}│
└                                                                       ┘ └──────────────────────┘
```

**Allocate dialog**

```
┌ Allocate payment                              ✕ ┐
│ pay_demo_a91c · ₹15,000 · Unallocated ₹15,000   │
│ Student and instalment [Mohit · due 15 Nov ▼]   │
│ Amount [₹15,000]  (max ₹15,000)                 │
│ Reason (required) [______________________]     │
│ ⓘ Saved together with the ledger entry.         │
│   Fix mistakes with a reversal, not deletion.   │
│                     [ Cancel ] [[Allocate ₹15,000]]
└─────────────────────────────────────────────────┘
```

Other tabs: **All payments** (filter by status, method, centre) · **Provider events** (accepted, duplicate, rejected, failed with reason).

## S3b. Reconciliation and Tally export

```
[Month: Oct 2026 ▼] [Scope ▼]                               {Month open}
┌ Money identity ─────────────────────────┐ ┌ Tally CSV export ────────────┐
│ Provider captures        ₹4,92,60,000   │ │ Batch TX-2026-10-001         │
│ Completed refunds       −₹3,45,000      │ │ 409 vouchers · 3 credit notes│
│ = Net received           ₹4,89,15,000 ✓ │ │ Not yet exported ₹6,25,000   │
│ Allocated                ₹4,87,31,000   │ │ [⬇ Re-download] [[Export new]]│
│ + Unallocated (7)        ₹1,84,000      │ ├ Close October ───────────────┤
│ = Allocated + unallocated₹4,89,15,000 ✓ │ │ [[🔒 Close month]]           │
│ ✓ Both sides equal.                     │ │ Immutable snapshot           │
└─────────────────────────────────────────┘ └──────────────────────────────┘
```

A mismatch shows a red difference row that opens the payments behind it. Close is confirmed in a dialog repeating the totals.

## S4. Reminder centre

```
Tabs: [Due 12] [Claimed 2] [Sent 148] [Failed 4] [Skipped 31]     [⟳ Retry failed] [[Run scheduler now]]
┌ Scheduled │ Student │ Rule · tone │ Lang · channel │ Amount │ Status ┐ ┌ Preview · Ishita ──┐
│ 2 Nov 09:00 │ Aman Joshi │ +7d Firm │ EN SMS │ ₹30,000 │ {Sent}       │ │ [EN|हिं]           │
│ … Priya     │ …          │ +3d      │ HI WA  │ ₹0      │ {Skipped} Instalment settled │ rendered message    │
│ … Dev       │ …          │ due date │ EN SMS │ ₹30,000 │ {Failed 3/3} Provider timeout│ Amount snapshot     │
│ … Kavya     │ …          │          │        │ ₹0      │ {Skipped} Student withdrawn  │ Pause: reason, until│
│ … Sana      │ …          │          │        │ ₹10,000 │ {Skipped} Paused to 30 Nov   │ [⏸ Pause]           │
└                                                                       ┘ └────────────────────┘
Footnote: amount re-read at send time · quiet hours 21:00-08:00 · max 1 per student per day
```

## S5a. Withdrawal and refund quote

```
[Student (locked)] [Request recorded 🔒 2 Nov] [Effective date 📅 5 Nov] [Reason ▼]
┌ Calculation · {Refund Policy v1} hash 7c3a…e91 ──┐ ┌ Basis {Published policy extension} ┐
│ Service period 15 Jun 2026 – 31 Mar 2027 (T=290) │ │ ┌ - - - - - - - - - - - - - - - ┐ │
│ Net fee N                       ₹1,20,000.00      │ │ ⓘ Potential shortfall ₹14,586.21│ │
│ Paid P                          ₹45,000.00        │ │ For review only. Not added to   │ │
│ Consumed days c  {Assumption}   144               │ │ dues, ageing, reminders.        │ │
│ Earned = N×c÷T                  ₹59,586.21        │ └ - - - - - - - - - - - - - - - ┘ │
│ Deduction {Design 🔒}           ₹0.00             │ On approval, ordinary dues → ₹0   │
│ Obligation                      ₹59,586.21        │  Inst 4  −₹30,000 cancelled       │
│ Indicative refund               ₹0.00             │  Inst 3  −₹30,000 cancelled       │
│ Indicative shortfall {Info}     ₹14,586.21        │  Inst 2  −₹15,000                 │
└───────────────────────────────────────────────────┘ Reminders stop · Target 12 Nov {Provisional}
                                          [ Save draft ] [[ Submit for director approval ]]
```

The shortfall box is dashed slate, never red.

## S5b. Refund approval and execution

```
Track: Requested ━ Calculated ━ Approved ━ Executing ┄ Complete
┌ [KR] Kavya Rathore · STU-1038     {Statutory full-payment pathway} {Due in 6 days} ┐ ┌ Approval ────────────┐
│ Requested 29 Oct │ Effective 28 Oct │ 136 of 290 days │ Earned ₹56,275.86 │ Refund ₹63,724.14 │ │ Requested by Neha V.  │
└──────────────────────────────────────────────────────────────────────────────────┘ │ Approved by Arvind M. │
Refund items (newest payment first, capped at each unrefunded balance)               │ ✓ differs from maker  │
 # │ Payment        │ Amount     │ Route   │ Status        │ Provider ref  │          ├ Director view ───────┤
 1 │ pay_k4 · 9 Oct │ ₹30,000.00 │ Gateway │ {Completed}   │ rf_91a        │          │ [[Approve]] [Reject]  │
 2 │ pay_k3 · 9 Aug │ ₹30,000.00 │ Gateway │ {Processing}  │ rf_91b        │          └───────────────────────┘
 3 │ pay_k2 · 9 Jul │ ₹3,724.14  │ Gateway │ {Failed}      │ error  [Retry]│
⚠ Not complete yet. Done only when all 3 items are confirmed.
Three paths: [Full-paid statutory ✔] [Part-paid policy extension] [Centre closure: full fee, no proration]
```

Offline items require a bank or cash reference and a human confirmation step.

## S6. Imports

```
(✓ Upload) ── (✓ Validate) ── (3 Review) ── (4 Commit)
┌ JEE2027_Eve_Attendance_Oct.csv · 214 rows · hash a41c…77d ─ [Replace file] ┐ ┌ Templates ───┐
┌ Valid new 176 │ Unchanged 21 │ Changed 9 │ Duplicate 4 │ Invalid 4 ┐        │ [⬇ Attendance]│
Rows needing a decision                                                        │ [⬇ Scores]    │
 Row │ Student │ Problem or change │ Result │ Old → new                         ├ History ──────┤
 14  │ STU-0999│ Unknown student   │{Invalid}                                  │ file · Done   │
 88  │ STU-0731│ Absent → Present  │{Changed}                                  └───────────────┘
[⬇ Download error CSV]        Nothing is saved until you commit   [[Commit 185 rows]]
```

Duplicate file hash → "This file was already imported on 3 Oct" with a link to that import.

## S7. Risk review

```
ⓘ No message or fee action is taken by this flag. Rule-based, not a prediction.
┌ Review queue (FP 18%) ┐ ┌ Rohan Saini · STU-0731 ········· Score 72 {High} ──────────┐
│ Rohan Saini  72 High  │ │ {All 3 signals have enough data} {Config v1 · .40/.30/.30} │
│ Ananya Bhatt 66 High  │ │ Factor and window         │ Norm │ Wt  │ Contributes     │
│ Tarun Yadav  48 Med   │ │ Fee overdue: 41 days      │ 0.70 │ .40 │ 28.0            │
│ Mehak Jain   37 Med   │ │ Attendance 58% vs 86%     │ 0.75 │ .30 │ 22.5            │
│ Tanvi Arora  — Insuff.│ │ Tests 41% vs 63%          │ 0.72 │ .30 │ 21.6   Total 72.1│
└───────────────────────┘ │ [attendance sparkline] [test sparkline]                   │
                          │ [Mark reviewed] [[Follow-up required]] [False positive]    │
                          │ Note [__________]  FP suppresses 30 days unless score rises │
                          └────────────────────────────────────────────────────────────┘
```

Counsellor sees only the fee signal value, never ledger rows or amounts.

## S8. Policy, audit, health

```
┌ Scheduler ✓ │ Outbox 0 │ Failed reminders 4 │ Unmatched 7 │ Rejected webhooks 1 │ Ledger check ✓ ┐
┌ Refund policy {v1 published 🔒}{v2 draft} ──────┐ ┌ Audit events [Action ▼][Actor ▼] ────────────┐
│ Method        Pro-rata       {Assumption}       │ │ When │ Actor │ Action │ Target               │
│ Day count     Inclusive      {Assumption}       │ │ 2 Nov 10:21 Arvind  Approved refund …        │
│ Fixed deduction 🔒 ₹0        {Design}           │ │ 2 Nov 10:15 Neha    Allocated payment …      │
│ % deduction     🔒 0 bp      {Design}           │ │ 2 Nov 09:58 System  Duplicate event ignored  │
│ Refund window 10 days from request {Provisional}│ │ Append-only, hash-chained                    │
│ 🔒 Non-zero deductions disabled until legal OK  │ └──────────────────────────────────────────────┘
│ v1 hash 7c3a…e91                  [[Publish v2]]│
└─────────────────────────────────────────────────┘
```

---

# Part C. Overlay and edge patterns

| Pattern | Wireframe summary |
|---|---|
| Discount request (maker) | Dialog: amount, reason, supporting note → `[[Submit for approval]]`. Pending chip on ledger. |
| Discount approval (checker) | Director list: requester, amount, reason, `[Approve] [Reject + reason]`. Own requests disabled with tooltip. |
| Fee plan builder | Course template ▼, service start/end dates, instalment mode `(•) Four equal` `( ) Custom`; preview rail and dates inside service period; total must equal fee. `{Rajasthan option · applicability pending <A-20>}` |
| Hostel/mess component | Shown only when applicable; separate rows with their own amount and service period. Absent otherwise (A-18). |
| Centre closure refund | Reason `CENTRE_REGISTRATION_CANCELLED` or `CENTRE_SELF_CLOSED`; quote hides the proration table and shows full-fee workflow notes. |
| Unauthorised / not found | Parent out-of-scope student → "Not found" page (never confirm existence). Staff missing capability → "You don't have access. Ask a director." |
| Session expired | Modal "Signed out for safety. Sign in again." and returns to same screen. |
| Global toast | Bottom-left, repeats the action verb ("Allocated ₹15,000"), Undo only where reversal is allowed. |
| Demo labels | Top-bar chip `Synthetic data · Demo clock`; dashed banners on mocks. |

## Responsive rules

| Width | Behaviour |
|---|---|
| 360 to 767 | Parent layout unchanged. Staff sidebar becomes bottom sheet menu; every table row becomes a stacked card with the same fields in the same order. |
| 768 to 1279 | Sidebar collapses to icons; right-hand panels (preview, approval, actions) move below the main table. |
| 1280+ | Layouts as drawn. |

## Accessibility checklist per screen

- Every status has icon and word.
- Focus order follows reading order; dialogs trap and restore focus.
- Amounts read with units; Hindi passages carry `lang="hi"`.
- Touch target 44 px minimum, primary 54 px.
- Errors linked with `aria-describedby`; live regions for "Confirming" and toasts.
