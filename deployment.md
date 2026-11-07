# FeeFlow — Local Setup & Deployment Guide

## 1. Prerequisites
- **Node.js:** v20+
- **Package Manager:** `npm` (or `pnpm`)
- **Database:** PostgreSQL 15+ (local, Docker, or hosted on Neon/Supabase)

## 2. Step-by-Step Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/vedantkulkarni/feeflow.git
   cd feeflow
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and populate the required database connection string:
   ```bash
   cp .env.example .env
   ```

3. **Run database migrations and seed deterministic Jaipur data:**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

4. **Run automated test suite (100% green coverage across all domain & integration invariants):**
   ```bash
   npm run test
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

## 3. Required Environment Variables (Names Only)

| Variable Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled / pgbouncer) |
| `DIRECT_URL` | Direct PostgreSQL connection string for Prisma migrations |
| `SESSION_SECRET` | 32-byte secret key for signing HTTP-only session tokens |
| `WEBHOOK_HMAC_SECRET` | Secret key used by the mock/gateway webhook verifier |
| `DEMO_MODE` | Set to `true` to enable demo bar, mock OTP inbox, and fixed demo clock |
| `DEMO_BUSINESS_DATE` | Fixed ISO date (`2026-11-02`) for reproducing brief sample statuses |
| `NEXT_PUBLIC_APP_URL` | Base URL of the application (e.g. `http://localhost:3000` or production domain) |

## 4. Production Deployment
- **Application Hosting:** Deployed on **Vercel** (Next.js App Router).
- **Database:** Managed **PostgreSQL** on **Neon Serverless**.
- **Build Command:** `npx prisma generate && npm run build`

## 5. Reviewer Demo Login Credentials

### A. Parent Mobile Portal (`/parent/login`)
- **Demo OTP Code (for any seeded parent phone):** `482913` (also shown in the on-screen demo banner)
- **Parent 1 (Ishita Sharma `STU-0587` — Part paid, 23 days overdue + sibling Kabir `STU-0588` — All paid):**
  - Mobile: `+91 90000 12345`
- **Parent 2 (Aarav Meena `STU-0412` — Paid):**
  - Mobile: `+91 90000 12341`
- **Parent 3 (Mohit Gurjar `STU-0219` — ₹40,000 due in 13 days):**
  - Mobile: `+91 90000 12342`
- **Parent 4 (Kavya Rathore `STU-1038` — Withdrawn, refund executing):**
  - Mobile: `+91 90000 12348`

### B. Staff Desktop Workspace (`/staff/login`)
- **Accounts Executive (Vaishali Nagar & Malviya Nagar scope):**
  - Email: `neha.verma@demo.companya.test`
  - Password: `DemoPassword123!`
- **Counsellor (Vaishali Nagar Risk Review & Imports scope):**
  - Email: `pooja.rawat@demo.companya.test`
  - Password: `DemoPassword123!`
- **Founder-Director (All 4 Centres, Refund/Discount Checker, Policy & Audit):**
  - Email: `arvind.mathur@demo.companya.test`
  - Password: `DemoPassword123!`
