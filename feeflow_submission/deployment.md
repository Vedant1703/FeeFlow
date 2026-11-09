# FeeFlow — Local Setup & Deployment Guide

## 1. Prerequisites
- **Node.js:** v20.x or higher (LTS recommended)
- **Package Manager:** `npm` (v9+) or `pnpm`
- **Database:** PostgreSQL 15+ (Local PostgreSQL, Docker container, or hosted on Neon/Supabase)

## 2. Step-by-Step Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/Vedant1703/feeflow.git
   cd feeflow
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and configure your local PostgreSQL database connection string:
   ```bash
   cp .env.example .env
   ```

3. **Run database migrations and seed deterministic Jaipur data:**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

4. **Run automated test suite (100% green coverage across all 28 test suites, 295 tests):**
   ```bash
   npm test
   ```

5. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

## 3. Required Environment Variables (Names Only)

### Core Application Variables
| Variable Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled / pgbouncer) |
| `DIRECT_URL` | Direct PostgreSQL connection string for Prisma migrations |
| `SESSION_SECRET` | 32-byte secret key for signing HTTP-only session tokens |
| `WEBHOOK_HMAC_SECRET` | Secret key used by the mock/gateway webhook verifier |
| `DEMO_MODE` | Set to `true` to enable demo bar, mock OTP inbox, and fixed demo clock |
| `DEMO_BUSINESS_DATE` | Fixed ISO date (`2026-11-02`) for reproducing brief sample statuses |
| `NEXT_PUBLIC_APP_URL` | Base URL of the application (e.g. `http://localhost:3000` or production domain) |

### Optional Provider Integration Variables (Razorpay Test Mode & MSG91)
| Variable Name | Description |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Test Mode Key ID (e.g. `rzp_test_...`) |
| `RAZORPAY_KEY_SECRET` | Razorpay Test Mode Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret configured in the Razorpay Dashboard |
| `MSG91_AUTHKEY` | MSG91 authentication key for live OTP widget verification |

> **Note:** When `RAZORPAY_KEY_ID` is omitted, FeeFlow automatically defaults to its built-in deterministic `MockPaymentProvider` and `MockRefundProvider` for offline evaluation and test execution.

## 4. Razorpay Test Mode & Webhook Configuration

To test real Razorpay payment checkout and refund flows:
1. Sign in to your Razorpay Dashboard in **Test Mode**.
2. Navigate to **Account & Settings > API Keys** and generate a test key pair.
3. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in your `.env`.
4. In **Webhooks**, create a webhook targeting:
   `https://<your-public-url>/api/webhooks/payment`
5. Select active events:
   - `payment.captured`
   - `payment.failed`
   - `refund.speed_processed`
   - `refund.processed`
   - `refund.failed`
6. Set the configured secret as `RAZORPAY_WEBHOOK_SECRET` in your `.env`.

## 5. Reviewer Demo Login Credentials

### A. Parent Mobile Portal (`/parent/login`)
- **Demo OTP Code (for any seeded parent phone):** `482913` (also displayed in the interactive demo top banner)
- **Parent 1 (Ishita Sharma `STU-0587` — Part paid, 23 days overdue + sibling Kabir `STU-0588` — All paid):**
  - Mobile: `+91 90000 12345`
- **Parent 2 (Aarav Meena `STU-0412` — Fully paid):**
  - Mobile: `+91 90000 12341`
- **Parent 3 (Mohit Gurjar `STU-0219` — ₹40,000 due in 13 days):**
  - Mobile: `+91 90000 12342`
- **Parent 4 (Kavya Rathore `STU-1038` — Withdrawn, statutory refund executing):**
  - Mobile: `+91 90000 12348`

### B. Staff Desktop Workspace (`/staff/login`)
All staff accounts share the default development password: `DemoPassword123!` (quick login buttons are also provided on the login page).
- **Accounts Executive (Vaishali Nagar & Malviya Nagar scope):**
  - Email: `neha.verma@demo.companya.test`
  - Password: `DemoPassword123!`
- **Counsellor (Vaishali Nagar Risk Review & Imports scope):**
  - Email: `pooja.rawat@demo.companya.test`
  - Password: `DemoPassword123!`
- **Founder-Director (All 4 Centres, Refund/Discount Checker, Policy & Audit):**
  - Email: `arvind.mathur@demo.companya.test`
  - Password: `DemoPassword123!`

## 6. Production Deployment & Build Commands

- **Application Hosting:** Next.js App Router deployed on **Vercel**.
- **Database:** Managed **PostgreSQL** hosted on **Neon Serverless**.
- **Production Build Command:**
  ```bash
  npx prisma generate && npm run build
  ```
- **Production Start Command:**
  ```bash
  npm start
  ```
