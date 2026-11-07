import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink">
      <div className="w-full max-w-md p-8 bg-surface rounded-panel border border-line shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-t text-teal text-xs font-semibold">
            <span>Company A · Jaipur</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">FeeFlow</h1>
          <p className="text-sm text-ink-2">
            Coaching Institute Fee-Tracking System & Mobile Parent Portal
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/parent/login"
            className="flex items-center justify-between p-4 rounded-input border border-line hover:border-teal hover:bg-teal-t/30 transition-colors group"
          >
            <div>
              <div className="font-semibold text-ink group-hover:text-teal">Parent Mobile Portal</div>
              <div className="text-xs text-ink-3">OTP login, 5-second dues, UPI/Card pay, receipts</div>
            </div>
            <span className="text-teal font-semibold text-sm">Open →</span>
          </Link>

          <Link
            href="/staff/login"
            className="flex items-center justify-between p-4 rounded-input border border-line hover:border-teal hover:bg-teal-t/30 transition-colors group"
          >
            <div>
              <div className="font-semibold text-ink group-hover:text-teal">Staff Desktop Workspace</div>
              <div className="text-xs text-ink-3">Accounts, ledger, reminders, refunds, risk review</div>
            </div>
            <span className="text-teal font-semibold text-sm">Open →</span>
          </Link>
        </div>

        <div className="text-center pt-4 border-t border-line text-xs text-ink-3">
          Synthetic data · Demo clock 2 Nov 2026
        </div>
      </div>
    </main>
  );
}

