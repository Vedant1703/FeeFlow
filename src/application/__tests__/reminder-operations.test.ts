import { describe, it, expect, beforeEach } from "vitest";
import { reminderService, ReminderService } from "@/application/services/reminder-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";
import {
  mockNotificationProvider,
  getNotificationProvider,
} from "@/infrastructure/notifications/notification-provider";
import { Actor } from "@/application/actor";

describe("Milestone 5B: Reminder Operations & Dispatch Integrity", () => {
  const directorActor: Actor = {
    userId: "usr_dir_vikram",
    role: "DIRECTOR",
    name: "Dr. Vikram Singhania",
    centreIds: [],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const vaishaliAccountsActor: Actor = {
    userId: "usr_acc_neha",
    role: "ACCOUNTS",
    name: "Neha Verma",
    centreIds: ["cen_vaishali"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const mansarovarAccountsActor: Actor = {
    userId: "usr_acc_suresh",
    role: "ACCOUNTS",
    name: "Suresh Meena",
    centreIds: ["cen_mansarovar"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  beforeEach(() => {
    demoPaymentStore.reset();
    mockNotificationProvider.reset();
  });

  // Scenario 1: Partial payment sends updated outstanding amount
  it("Scenario 1: partial payment sends updated outstanding balance, never stale original amount", async () => {
    // Ishita has instalment 2 (original ₹30,000, ₹15,000 paid via allocation, ₹15,000 remaining)
    const reminderId = "rem_ishita_inst2";
    const reminder = demoPaymentStore.findReminderById(reminderId);
    expect(reminder).toBeDefined();
    expect(reminder?.status).toBe("QUEUED");

    const result = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(result.success).toBe(true);
    expect(result.status).toBe("SENT");
    expect(result.currentOutstandingPaise).toBe(1500000n);
    // Rendered message must quote ₹15,000 (the remaining balance), NOT ₹30,000
    expect(result.renderedMessage).toContain("15,000");
    expect(result.renderedMessage).not.toContain("30,000");

    const updated = demoPaymentStore.findReminderById(reminderId);
    expect(updated?.status).toBe("SENT");
    expect(updated?.attemptCount).toBe(1);

    const details = await reminderService.getReminderDetails(reminderId, directorActor);
    expect(details.reminder.evaluatedAmountPaise).toBe(1500000n);
  });

  // Scenario 2: Fully paid instalment suppresses dispatch
  it("Scenario 2: fully paid instalment automatically suppresses dispatch and marks reminder SKIPPED", async () => {
    // Ishita pays the remaining ₹15,000 before dispatch
    demoPaymentStore.ledgerEntries.push({
      id: "led_ishita_settle_full",
      studentId: "stu_ishita_0587",
      instalmentId: "inst_ishita_2",
      entryType: "ALLOCATION",
      amount: -1500000n,
      entryDate: new Date("2026-10-14"),
    });

    const reminderId = "rem_ishita_inst2";
    const result = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(result.success).toBe(true);
    expect(result.status).toBe("SKIPPED");
    expect(result.skipReason).toContain("settled in full");
    expect(result.currentOutstandingPaise).toBe(0n);

    // Notification provider must NOT have been called
    expect(mockNotificationProvider.sentHistory.length).toBe(0);

    const updated = demoPaymentStore.findReminderById(reminderId);
    expect(updated?.status).toBe("SKIPPED");
    expect(updated?.skipReason).toContain("settled in full");
  });

  // Scenario 3: Withdrawn/cancelled student suppresses dispatch
  it("Scenario 3: withdrawn student automatically suppresses reminder dispatch", async () => {
    // Ishita withdrawal wd-001 is executed/approved
    const wd = demoPaymentStore.withdrawals.get("wd-001");
    expect(wd).toBeDefined();
    if (wd) wd.status = "EXECUTED";

    const reminderId = "rem_ishita_inst2";
    const result = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(result.success).toBe(true);
    expect(result.status).toBe("SKIPPED");
    expect(result.skipReason).toContain("withdrawn");

    // Notification provider must NOT have been called
    expect(mockNotificationProvider.sentHistory.length).toBe(0);

    const updated = demoPaymentStore.findReminderById(reminderId);
    expect(updated?.status).toBe("SKIPPED");
  });

  // Scenario 4: Failed delivery is recorded and retryable
  it("Scenario 4: failed delivery is recorded with error details and can be retried to success", async () => {
    // Configure mock notification provider to fail once
    mockNotificationProvider.setFailNext(1, "Gateway timeout (DLR error 30008)");

    const reminderId = "rem_mohit_inst1";
    const failResult = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(failResult.success).toBe(false);
    expect(failResult.status).toBe("FAILED");
    expect(failResult.error).toContain("Gateway timeout");

    const failedReminder = demoPaymentStore.findReminderById(reminderId);
    expect(failedReminder?.status).toBe("FAILED");
    expect(failedReminder?.lastError).toContain("Gateway timeout");
    expect(failedReminder?.attemptCount).toBe(1);

    const attemptsAfterFail = demoPaymentStore.getAttemptsForReminder(reminderId);
    expect(attemptsAfterFail.length).toBe(1);
    expect(attemptsAfterFail[0].status).toBe("FAILED");

    // Now retry the failed reminder
    const retryResult = await reminderService.retryReminder(reminderId, directorActor);

    expect(retryResult.success).toBe(true);
    expect(retryResult.status).toBe("SENT");

    const retriedReminder = demoPaymentStore.findReminderById(reminderId);
    expect(retriedReminder?.status).toBe("SENT");
    expect(retriedReminder?.lastError).toBeNull();
    expect(retriedReminder?.attemptCount).toBe(2);

    const attemptsAfterRetry = demoPaymentStore.getAttemptsForReminder(reminderId);
    expect(attemptsAfterRetry.length).toBe(2);
    expect(attemptsAfterRetry[0].status).toBe("SENT");
  });

  // Scenario 5: Successful delivery cannot be duplicated by retry
  it("Scenario 5: successful delivery cannot be duplicated by retry or dispatch", async () => {
    // Aman Joshi reminder is already SENT in seed data
    const sentReminderId = "rem_aman_sent";
    const reminder = demoPaymentStore.findReminderById(sentReminderId);
    expect(reminder?.status).toBe("SENT");

    await expect(
      reminderService.retryReminder(sentReminderId, directorActor)
    ).rejects.toThrow("Cannot re-send already dispatched reminder");

    await expect(
      reminderService.dispatchReminder(sentReminderId, directorActor)
    ).rejects.toThrow("Cannot re-send already dispatched reminder");

    expect(mockNotificationProvider.sentHistory.length).toBe(0);
  });

  // Scenario 6: Concurrent dispatch attempts do not send twice
  it("Scenario 6: concurrent dispatch attempts are protected by lock and do not send duplicate messages", async () => {
    const reminderId = "rem_mohit_inst1";

    // Simulate concurrency by dispatching twice in parallel
    const promise1 = reminderService.dispatchReminder(reminderId, directorActor);
    const promise2 = reminderService.dispatchReminder(reminderId, directorActor);

    const results = await Promise.allSettled([promise1, promise2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, or the second is rejected by concurrency lock
    if (rejected.length > 0) {
      expect(rejected[0].status).toBe("rejected");
      expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
        /currently claimed|Concurrent dispatch in progress/i
      );
      expect(fulfilled.length).toBe(1);
    } else {
      // If run sequentially in microtasks, second must reject because status became SENT
      expect(fulfilled.length).toBe(1);
    }

    // Provider was called at most once
    expect(mockNotificationProvider.sentHistory.length).toBe(1);
  });

  // Scenario 7: Ledger changes between queueing and dispatch are reflected
  it("Scenario 7: ledger changes between queueing and dispatch are dynamically reflected in quotes", async () => {
    // Mohit starts with ₹40,000 outstanding (charge 4000000n)
    const reminderId = "rem_mohit_inst1";

    // Parent pays ₹15,000 before staff clicks Send
    demoPaymentStore.ledgerEntries.push({
      id: "led_mohit_partial_pay",
      studentId: "stu_mohit_0219",
      instalmentId: "inst_mohit_1",
      entryType: "ALLOCATION",
      amount: -1500000n,
      entryDate: new Date("2026-11-01"),
    });

    const result = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(result.success).toBe(true);
    expect(result.status).toBe("SENT");
    // Remaining balance is ₹25,000 (40k - 15k)
    expect(result.currentOutstandingPaise).toBe(2500000n);
    expect(result.renderedMessage).toContain("25,000");
    expect(result.renderedMessage).not.toContain("40,000");
  });

  // Scenario 8: English and Hindi template rendering
  it("Scenario 8: generates accurate bilingual English and Hindi template previews", async () => {
    const reminderId = "rem_ishita_inst2";
    const details = await reminderService.getReminderDetails(reminderId, directorActor);

    expect(details.renderedPreviews.en).toBeDefined();
    expect(details.renderedPreviews.hi).toBeDefined();

    // Hindi preview checks
    expect(details.renderedPreviews.hi.body).toContain("Ishita Sharma");
    expect(details.renderedPreviews.hi.body).toContain("किस्त 2");
    expect(details.renderedPreviews.hi.body).toContain("15,000");

    // English preview checks
    expect(details.renderedPreviews.en.body).toContain("Ishita Sharma");
    expect(details.renderedPreviews.en.body).toContain("Instalment 2");
    expect(details.renderedPreviews.en.body).toContain("15,000");
  });

  // Scenario 9: Accounts centre scoping and Director permissions
  it("Scenario 9: enforces centre scoping on Accounts staff and allows cross-centre access to Director", async () => {
    // Mohit is in Mansarovar (cen_mansarovar)
    const mohitReminderId = "rem_mohit_inst1";

    // Vaishali staff attempts to dispatch Mansarovar reminder -> must be denied
    await expect(
      reminderService.dispatchReminder(mohitReminderId, vaishaliAccountsActor)
    ).rejects.toThrow(/Access denied: centre cen_mansarovar/);

    // Vaishali staff attempts to view details -> must be denied
    await expect(
      reminderService.getReminderDetails(mohitReminderId, vaishaliAccountsActor)
    ).rejects.toThrow(/Access denied: centre cen_mansarovar/);

    // Mansarovar staff can access Mohit
    const mansarovarDetails = await reminderService.getReminderDetails(mohitReminderId, mansarovarAccountsActor);
    expect(mansarovarDetails.reminder.studentName).toBe("Mohit Gurjar");

    // Director has unrestricted cross-centre access
    const directorDetails = await reminderService.getReminderDetails(mohitReminderId, directorActor);
    expect(directorDetails.reminder.studentName).toBe("Mohit Gurjar");
  });

  // Scenario 10: Provider failure and recovery handling
  it("Scenario 10: records detailed attempt history on failure and preserves audit integrity upon recovery", async () => {
    // Dev Sharma has a seeded FAILED reminder with 3 attempts
    const failedReminderId = "rem_dev_failed";
    const details = await reminderService.getReminderDetails(failedReminderId, directorActor);

    expect(details.reminder.status).toBe("FAILED");
    expect(details.reminder.attemptCount).toBe(3);
    expect(details.attempts.length).toBe(3);
    expect(details.reminder.lastError).toContain("Provider delivery timeout");

    // Retry Dev Sharma's reminder
    const retryResult = await reminderService.retryReminder(failedReminderId, directorActor);

    expect(retryResult.success).toBe(true);
    expect(retryResult.status).toBe("SENT");

    // Updated details must show 4 attempts with latest as SENT
    const updatedDetails = await reminderService.getReminderDetails(failedReminderId, directorActor);
    expect(updatedDetails.reminder.status).toBe("SENT");
    expect(updatedDetails.reminder.attemptCount).toBe(4);
    expect(updatedDetails.attempts.length).toBe(4);
    expect(updatedDetails.attempts[0].status).toBe("SENT");
  });

  // Scenario 11: Two concurrent dispatch requests across separate service instances
  it("Scenario 11: two concurrent dispatch requests against the same reminder across separate service instances result in at most one provider invocation", async () => {
    const serviceA = new ReminderService();
    const serviceB = new ReminderService();
    const reminderId = "rem_mohit_inst1";

    const [resA, resB] = await Promise.allSettled([
      serviceA.dispatchReminder(reminderId, directorActor),
      serviceB.dispatchReminder(reminderId, directorActor),
    ]);

    const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
    const rejected = [resA, resB].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /currently claimed|Concurrent dispatch in progress/i
    );

    // Provider must be invoked at most once
    expect(mockNotificationProvider.sentHistory.length).toBe(1);
  });

  // Scenario 12: Concurrent retry requests cannot dispatch the same failed reminder twice
  it("Scenario 12: concurrent retry requests cannot dispatch the same failed reminder twice", async () => {
    const serviceA = new ReminderService();
    const serviceB = new ReminderService();
    const reminderId = "rem_dev_failed"; // Seeded with status FAILED

    const [resA, resB] = await Promise.allSettled([
      serviceA.retryReminder(reminderId, directorActor),
      serviceB.retryReminder(reminderId, directorActor),
    ]);

    const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
    const rejected = [resA, resB].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /currently claimed|Concurrent dispatch in progress/i
    );

    // Provider invoked exactly once for the retry
    expect(mockNotificationProvider.sentHistory.length).toBe(1);
  });

  // Scenario 13: Process restart or stale dispatch claim does not cause blind duplicate delivery
  it("Scenario 13: process restart with an active or stale dispatch claim does not cause blind duplicate delivery", async () => {
    const reminderId = "rem_mohit_inst1";

    // Simulate a previous server instance that claimed the reminder (status PROCESSING, claimId set) and crashed/restarted
    demoPaymentStore.updateReminder(reminderId, {
      status: "PROCESSING",
      claimId: "claim_crashed_instance_8921",
      claimedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    });

    // A brand new service instance starts up after restart
    const newServiceInstance = new ReminderService();

    // Attempting to dispatch must reject safely without calling the provider
    await expect(
      newServiceInstance.dispatchReminder(reminderId, directorActor)
    ).rejects.toThrow(/currently claimed|in progress|ambiguous/i);

    // Attempting to retry must also reject safely
    await expect(
      newServiceInstance.retryReminder(reminderId, directorActor)
    ).rejects.toThrow(/currently claimed|expected FAILED|in progress|ambiguous/i);

    expect(mockNotificationProvider.sentHistory.length).toBe(0);
  });

  // Scenario 14: Ambiguous provider timeout is not automatically retried
  it("Scenario 14: ambiguous provider timeout enters uncertain state and is not automatically retried", async () => {
    const reminderId = "rem_mohit_inst1";

    // Configure provider to return an ambiguous network timeout
    mockNotificationProvider.setAmbiguousTimeoutNext(
      1,
      "Gateway timeout (HTTP 504): delivery unconfirmed"
    );

    const result = await reminderService.dispatchReminder(reminderId, directorActor);

    expect(result.success).toBe(false);
    expect(result.isAmbiguousTimeout).toBe(true);
    expect(result.status).toBe("PROCESSING");

    const reminder = demoPaymentStore.findReminderById(reminderId);
    expect(reminder?.status).toBe("PROCESSING");
    expect(reminder?.isAmbiguousTimeout).toBe(true);

    // Subsequent dispatch attempt must reject without calling provider
    await expect(
      reminderService.dispatchReminder(reminderId, directorActor)
    ).rejects.toThrow(/ambiguous unconfirmed state/i);

    // Subsequent retry attempt must also reject without calling provider
    await expect(
      reminderService.retryReminder(reminderId, directorActor)
    ).rejects.toThrow(/ambiguous unconfirmed state/i);

    // Provider was called only once during initial attempt, zero blind retries
    expect(mockNotificationProvider.sentHistory.length).toBe(1);
  });

  // Scenario 15: Production configuration cannot select MockNotificationProvider
  it("Scenario 15: production configuration fails closed and cannot select MockNotificationProvider", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    const originalMockFlag = process.env.FEEFLOW_USE_MOCK_NOTIFICATIONS;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
      delete process.env.FEEFLOW_USE_MOCK_NOTIFICATIONS;

      expect(() => getNotificationProvider()).toThrow(
        /Production notification provider is not configured|MockNotificationProvider is disabled in production/i
      );
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalDemoMode !== undefined) process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
      if (originalMockFlag !== undefined) process.env.FEEFLOW_USE_MOCK_NOTIFICATIONS = originalMockFlag;
    }
  });

  // Scenario 16: Explicit demo/test configuration still supports existing mock-provider tests
  it("Scenario 16: explicit demo/test configuration correctly provides MockNotificationProvider", () => {
    const provider = getNotificationProvider();
    expect(provider).toBeDefined();
    expect(provider.name).toBe("MOCK_NOTIFICATION_PROVIDER");
  });
});
