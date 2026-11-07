# FeeFlow UI Reference v2.2 FINAL (Aligned with SRS v2.2)

The design system behind `FeeFlow_UI_Screens.pdf`. Use it with `FeeFlow_Wireframes.md`. Stack follows the SRS: Next.js App Router, React, strict TypeScript, Tailwind CSS and restyled shadcn/ui.

---

## 1. Design intent

| Question | Answer |
|---|---|
| Who | Parents on mid-range phones (360 px, often Hindi-first). Accounts staff on desktops all day. Counsellors and directors who need explained exceptions. |
| Core job | Parent: know what is due and pay. Staff: trace every rupee and clear exceptions. |
| Feel | Calm, exact, trustworthy. Money screens should feel like a well-kept ledger, not a marketing page. |
| Memorable element | **The instalment rail**: four equal segments that show the plan state. It mirrors the logo mark and the Rajasthan four-instalment option. |
| Restraint | One accent (deep teal). Status colour only for status. Borders instead of shadows. No decorative gradients. |

Brief-driven choices (Concept §10): near-black ink on warm white, deep teal action accent, semantic colours with text and icons, a humanist-leaning sans for Latin and Noto Sans Devanagari for Hindi, generous whitespace, mobile-first parent UI.

---

## 2. Design tokens

### 2.1 Colour

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#17191A` | Text, headings, inverted chips |
| `--ink-2` | `#4B5254` | Secondary text |
| `--ink-3` | `#7B8386` | Hints, captions, disabled text |
| `--paper` | `#FAF8F4` | App background |
| `--surface` | `#FFFFFF` | Panels, sheets, tables |
| `--line` | `#E8E4DB` | Hairlines, dividers |
| `--line-2` | `#D6D1C5` | Input borders, dashed outlines |
| `--teal` | `#0B5D5A` | Primary action, active nav, links |
| `--teal-d` | `#074341` | Pressed state, text on teal tint |
| `--teal-t` | `#E1EFEC` | Selected row, active nav background |
| `--ok` / `--ok-t` | `#1E7A4F` / `#E3F3EA` | Paid, confirmed, reconciled |
| `--warn` / `--warn-t` | `#8F5600` / `#FDF0D5` | Part paid, assumption, provisional |
| `--bad` / `--bad-t` | `#B3261E` / `#FCE7E4` | Overdue, failed, destructive |
| `--info` / `--info-t` | `#2A5DA8` / `#E5EDF8` | In progress, information |
| `--slate` / `--slate-t` | `#505A66` / `#ECEEF1` | **Informational shortfall**, skipped, neutral |

Rules
- **Slate is deliberately not red.** A potential shortfall under review is never styled like a debt (SRS v2.1 §4.1).
- Ageing buckets: `#8CBDB7` 0–30, `#F0C879` 31–60, `#E58E86` 61–90, `#A82A22` over 90.
- Every status uses icon + word. Colour is never the only signal.
- Contrast: body text 4.5:1 or better on every surface; verify each chip pair in CI (axe).

### 2.2 Typography

| Role | Latin | Hindi | Size / line | Weight | Notes |
|---|---|---|---|---|---|
| Amount (hero) | Inter | same digits | 52 / 56 | 650 | tracking −3.5%, tabular |
| Page title | Inter | Noto Sans Devanagari | 28 / 32 (parent), 21 / 28 (staff) | 650 | tracking −1.5% |
| Section title | Inter | Noto Sans Devanagari | 17 / 24 | 650 | |
| Body | Inter | Noto Sans Devanagari | 16 / 24 parent, 14 / 20 staff | 400–600 | |
| Table / label | Inter | Noto Sans Devanagari | 13 / 18 | 400–600 | |
| Caption | Inter | Noto Sans Devanagari | 12 / 16 | 500 | minimum size |

- Hindi lines use line-height 1.5 so matras are never clipped.
- Numbers: `font-variant-numeric: tabular-nums`; right-align in tables; Indian grouping `1,20,000` via `Intl.NumberFormat('en-IN')`.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows.
- Scale: 12 · 13 · 14 · 16 · 17 · 21 · 28 · 52.

**Font pairing options (loaded with `next/font`, subset, `display: swap`)**

| Option | Latin | Devanagari | When |
|---|---|---|---|
| **A (used in the PDF)** | Inter | Noto Sans Devanagari | Best tabular figures and ₹ glyph; one install, predictable metrics |
| B | Figtree | Noto Sans Devanagari | Friendlier, more humanist parent feel |
| C | Public Sans | Noto Sans Devanagari | Civic, neutral tone |
| D | Hind (Latin + Devanagari designed together) | included | Best optical match between scripts if parity matters more than numerals |

Receipt PDFs embed the Devanagari font (SRS requirement). The delivered PDF renders Hindi with a system Devanagari fallback because the build environment is offline; production should use Noto Sans Devanagari.

### 2.3 Shape, space, elevation

| Token | Values |
|---|---|
| Radius | input 8 · button 8 (mobile primary 13) · chip 999 · panel 12 · amount card 18 · phone sheet 22 top |
| Space | 4 · 8 · 12 · 16 · 24 · 32 |
| Touch target | 44 px minimum; primary mobile button 54 px |
| Elevation | None by default (1 px border). Shadow only for dialogs and sheets: `0 30px 60px -20px rgba(0,0,0,.5)` |
| Breakpoints | 360 parent · 768 tablet · 1280 desktop |

### 2.4 CSS variables (drop into `globals.css`)

```css
:root {
  --ink:#17191A; --ink-2:#4B5254; --ink-3:#7B8386;
  --paper:#FAF8F4; --surface:#FFFFFF; --line:#E8E4DB; --line-2:#D6D1C5;
  --teal:#0B5D5A; --teal-d:#074341; --teal-t:#E1EFEC;
  --ok:#1E7A4F; --ok-t:#E3F3EA;
  --warn:#8F5600; --warn-t:#FDF0D5;
  --bad:#B3261E; --bad-t:#FCE7E4;
  --info:#2A5DA8; --info-t:#E5EDF8;
  --slate:#505A66; --slate-t:#ECEEF1;
  --radius-input:8px; --radius-panel:12px; --radius-hero:18px;
  --focus-ring:0 0 0 3px rgba(11,93,90,.28);
}
body { font-feature-settings:"tnum" 1,"cv11" 1; background:var(--paper); color:var(--ink); }
:lang(hi) { line-height:1.5; }
```

### 2.5 Tailwind mapping

```ts
// tailwind.config.ts (extend)
colors: {
  ink:{DEFAULT:'var(--ink)',2:'var(--ink-2)',3:'var(--ink-3)'},
  paper:'var(--paper)', surface:'var(--surface)',
  line:{DEFAULT:'var(--line)',2:'var(--line-2)'},
  teal:{DEFAULT:'var(--teal)',d:'var(--teal-d)',t:'var(--teal-t)'},
  ok:{DEFAULT:'var(--ok)',t:'var(--ok-t)'}, warn:{DEFAULT:'var(--warn)',t:'var(--warn-t)'},
  bad:{DEFAULT:'var(--bad)',t:'var(--bad-t)'}, info:{DEFAULT:'var(--info)',t:'var(--info-t)'},
  slate:{DEFAULT:'var(--slate)',t:'var(--slate-t)'},
},
fontSize:{ amount:['52px',{lineHeight:'56px',letterSpacing:'-0.035em',fontWeight:'650'}] },
borderRadius:{ hero:'18px' },
```

---

## 3. Signature component: instalment rail

Three or four equal segments (`segs.length`, matching the student's 3- or 4-instalment plan, with 4 segments as the signature default). States: paid, part-paid (filled to the paid fraction), upcoming. Part-paid remainder is tinted `--bad-t` when overdue and `--warn-t` when not yet due.

```tsx
type Seg = { state:'paid'|'part'|'upcoming'; paidPct?:number; overdue?:boolean };
export function Rail({ segs, tall }: { segs: Seg[]; tall?: boolean }) {
  return (
    <div role="img" aria-label={railLabel(segs)} className="flex gap-1">
      {segs.map((s,i)=>(
        <i key={i} style={{ '--f': `${s.paidPct ?? 0}%` } as React.CSSProperties}
           className={cn('block flex-1 rounded-[2px]', tall?'h-3':'h-2',
             s.state==='paid' && 'bg-teal',
             s.state==='upcoming' && 'border-[1.5px] border-line-2 bg-surface',
             s.state==='part' && (s.overdue
               ? 'bg-[linear-gradient(90deg,var(--teal)_var(--f),#F2C6C2_var(--f))]'
               : 'bg-[linear-gradient(90deg,var(--teal)_var(--f),#F4DDAF_var(--f))]'))}/>
      ))}
    </div>
  );
}
```

Always pair with words nearby ("Instalment 2: part paid, overdue 23 days"). Provide the `aria-label`.

---

## 4. Component catalogue and shadcn mapping

| Component | shadcn / Radix base | Customisation |
|---|---|---|
| Button | `button` | Variants: `primary`, `secondary`, `destructive`, `ghost`, `disabled`; sizes `sm 30`, `md 38`, `mobile 54`. Label names the action ("Pay ₹15,000"). |
| Status chip | `badge` | Props: `tone` (ok, warn, bad, info, slate, teal), `icon`, `text`. Icon and text required. |
| Provenance chip | `badge` | `Assumption`, `Design`, `Source`, `Provisional`, `Synthetic data` map to warn or slate tones. |
| Input / amount field | `input` | Focus ring teal; error ring red; locked variant with lock icon and reason. Amount field uses `inputMode="numeric"`. |
| OTP | `input-otp` | 6 cells, `autoComplete="one-time-code"`. |
| Select, date | `select`, `calendar` + `popover` | `react-day-picker`, Asia/Kolkata, `date-fns`. |
| Banner | `alert` | Tones info, warn, bad, ok, slate (informational), demo (dashed). Icon always present. |
| Dialog | `dialog` | 500 px, focus trapped, Escape closes, restores focus. |
| Bottom sheet | `vaul` drawer | Parent pay sheet; 240 ms rise. |
| Tabs | `tabs` | Underline style with count chip. |
| Data table | `table` + TanStack Table | Sticky header, right-aligned numerics, selected row tint, row → card at < 768. |
| Command search | `cmdk` | `Ctrl K`; searches student code, name, payment ref, receipt no. |
| Toast | `sonner` | Repeats the action verb; Undo only where reversible. |
| Stepper / track | custom | Import steps (numbered, because it is a real sequence) and refund track (Requested → Complete). |
| Hbar | custom | Ageing bars and refund progress. Plain divs, no chart library. |
| Skeleton | `skeleton` | Same dimensions as final content to avoid layout shift. |

### Status vocabulary (single source)

| State | Tone | Icon | Parent text (EN / HI) |
|---|---|---|---|
| Paid | ok | check | Paid / जमा |
| Part paid | warn | clock | Part paid / आंशिक जमा |
| Upcoming | slate | none | Upcoming / आगामी |
| Overdue | bad | warning | Overdue by N days / N दिन से बकाया |
| Confirming | info | clock | Confirming |
| Failed | bad | x | Failed |
| Informational (shortfall) | slate | info | staff only |
| Review required | warn | flag | staff only |
| Skipped | slate | none | staff only |

---

## 5. Motion

Principle: non-user-triggered motion only to draw attention; everything else answers an action.

| Where | Spec | Reduced motion |
|---|---|---|
| Parent Home first load | One moment: rail segments fill left to right, 600 ms ease-out, once per session | No animation |
| Pay sheet | Rise 240 ms ease-out; scrim fade 160 ms; close 180 ms | Instant |
| Confirming | Ring spin 1.2 s linear; swap to check with 200 ms stroke draw | Static ring, static check |
| Staff dialogs | Fade + 8 px rise, 160 ms | No rise |
| Dashboard filter change | 250 ms cross-fade of figures | None |
| Tables, tabs, row select | Instant | Instant |

Never count figures up. Animated money can be read as a changing balance.

```css
@media (prefers-reduced-motion: no-preference) {
  .rail i { transform-origin:left; animation: fill .6s cubic-bezier(.2,.7,.2,1) both; }
  .rail i:nth-child(2){animation-delay:.08s} .rail i:nth-child(3){animation-delay:.16s} .rail i:nth-child(4){animation-delay:.24s}
}
@keyframes fill { from { transform:scaleX(0) } to { transform:scaleX(1) } }
```

---

## 6. Library and font exposure

Chosen to respect the SRS size budget: parent routes stay light; staff routes lazy-load richer parts.

| Need | Choice | Why | Alternatives considered |
|---|---|---|---|
| Framework | Next.js App Router, React, TypeScript | SRS stack | none |
| Styling | Tailwind CSS + CSS variables | Tokens in one place, tiny runtime | CSS Modules |
| Base components | shadcn/ui on Radix | Accessible, owned code, restyleable | Mantine, MUI (heavier, harder to give a distinct look) |
| Tables | TanStack Table | Headless; fits dense staff tables | AG Grid (too heavy) |
| Forms | React Hook Form + Zod | Same Zod schemas as server boundaries | Formik |
| Mobile sheet | Vaul | Native-feel drawer, small | Radix Dialog styled as sheet |
| Command search | cmdk | Fast student lookup | Algolia (unneeded) |
| Toasts | Sonner | Small, accessible | react-hot-toast |
| Dates | react-day-picker + date-fns | Light; Asia/Kolkata handling | Day.js |
| Charts | **Parent:** none (SVG/divs). **Staff:** visx or Recharts, lazy-loaded | Meets parent JS budget | Chart.js, Tremor |
| Motion | **Parent:** CSS. **Staff:** Motion (framer-motion) lazy-loaded only if needed | One orchestrated moment only | GSAP, Lottie (unnecessary weight) |
| Icons | Lucide | Consistent 2 px stroke | Phosphor |
| i18n | next-intl, ICU messages, `Intl` INR formatting | SRS | react-i18next |
| PDF receipts | React-PDF with embedded Devanagari font | SRS | Puppeteer (heavier) |
| Fonts | `next/font` Inter + Noto Sans Devanagari | Self-hosted, subset | Google Fonts CDN (privacy, latency) |
| A11y testing | axe, Playwright, Lighthouse CI | SRS | none |

Parent bundle guidance: no charting or animation library on `/parent/*`; keep first-load JS small (`size-limit` in CI per SRS).

---

## 7. Content and tone

- Write for the parent: "Pay ₹15,000", not "Initiate payment".
- Same action name throughout: button "Allocate", toast "Allocated".
- Errors say what happened and what to do; no apology, no blame.
- Empty states invite an action ("No fee plan yet. Contact your centre.").
- Do not call a shortfall "due", "owed" or "balance". Use "potential shortfall, for review only".
- Do not claim legal force the sources do not give. Use provenance chips: `Source`, `Assumption`, `Design`, `Provisional`.
- Bilingual parity: every parent string exists in English and Hindi at the same size; Hindi copy needs native review (production gate).

Core strings

| Key | English | Hindi |
|---|---|---|
| amount_due | Amount due now | अभी देय राशि |
| overdue_days | Overdue by {n} days | {n} दिन से बकाया |
| pay_full | Pay {amount} | {amount} का भुगतान करें |
| pay_other | Pay a different amount | कोई अन्य राशि भरें |
| all_instalments | All instalments | सभी किस्तें |
| recent_receipts | Recent receipts | हाल की रसीदें |
| tab_fees / receipts / attendance / tests | Fees / Receipts / Attendance / Tests | फीस / रसीदें / उपस्थिति / परीक्षा |

---

## 8. Accessibility and quality floor

- 4.5:1 text contrast; status uses icon and word.
- 3 px teal focus ring on every control; logical tab order; skip link on staff shell.
- Dialogs trap focus, restore it, close on Escape. Sheets are focus-trapped too.
- Screen reader text includes units: "15,000 rupees, overdue by 23 days".
- Set `lang="hi"` on Hindi passages.
- Live regions for Confirming, toasts and import progress.
- Parent routes render server-side with minimal JS and work on slow networks; offline shows the cached view and disables payment with the reason.
- Axe on every route in CI; Lighthouse budgets on the parent home.

---

## 9. Production gates reflected in the UI

| Gate (SRS v2.1 §11) | How the UI shows it |
|---|---|
| Rajasthan Act commencement and scope | Chip `Rajasthan option · applicability pending` beside the four-equal-instalment option |
| Clock start for 10-day refund window | `Provisional` chip on the due-by date; policy text avoids claiming the request date is the legal trigger |
| Partial-payment treatment | Shortfall is informational only; dashed slate box; never in dues, ageing, reminders or parent amount due |
| Non-zero deductions | Fields visible but locked at ₹0 / 0 bp with explanation |
| GST and credit notes | No tax rate shown on refund quote; receipts (`P1d`, `P3`) visibly display the institute's configured GST snapshot (Demo GSTIN `08AABCC1234D1Z5 [SYNTHETIC]`, SAC `999293`, and configured tax breakdown) to satisfy the brief's 'Receipts must show GST' constraint while keeping tax rates configuration-driven |
| Hostel and mess | Components absent unless the institute provides them |
| Hindi and legal wording | `Draft wording · legal and Hindi review pending` chip on policy and consent text |

---

## 10. Data used in the mocks (synthetic)

| Item | Value |
|---|---|
| Parent journey | STU-0587 Ishita Sharma, JEE 2027 Evening, instalment 2 of 4 due 10 Oct 2026, ₹30,000, paid ₹15,000, 23 days overdue at demo clock 2 Nov 2026 |
| Plan | ₹1,20,000 in 4 × ₹30,000, due 10 Jul 2026, 10 Oct 2026, 10 Jan 2027, 10 Mar 2027 |
| Refund (part-paid) | S 15 Jun 2026, E 31 Mar 2027, T 290, W 5 Nov 2026, c 144, earned ₹59,586.21, P ₹45,000, shortfall ₹14,586.21 (informational) |
| Refund (full-paid) | STU-1038, W 28 Oct 2026, c 136, earned ₹56,275.86, refund ₹63,724.14 split ₹30,000 + ₹30,000 + ₹3,724.14 |
| Dashboard | 4 centres, 2,591 students, outstanding ₹6.91 cr, over-60 11.4% (snapshot) |
| Other brief records | STU-0412 Aarav Meena (paid), STU-0219 Mohit Gurjar (₹40,000 due 15 Nov) |

Centre names, staff names and phone numbers are invented. Every figure is labelled synthetic in the interface.

---

## 11. Handoff checklist

- [ ] Tokens loaded from CSS variables; no hard-coded hex in components
- [ ] Status chips use the shared component (icon + word enforced by types)
- [ ] Money formatted with `en-IN`, integer paise in, formatted string out
- [ ] Rail component has `aria-label` and nearby text
- [ ] All eleven parent states and all staff empty, loading, error states built
- [ ] Hindi strings present for every parent key
- [ ] Reduced-motion branch tested
- [ ] Parent bundle budget checked (no chart or motion library)
- [ ] Demo labels and provenance chips present and removable by configuration only
