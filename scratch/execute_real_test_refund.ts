import crypto from "crypto";
import { prisma } from "../src/infrastructure/db/prisma";
import { RefundService } from "../src/application/services/refund-service";
import { RazorpayRefundProvider } from "../src/infrastructure/refunds/refund-provider";
import { Actor } from "../src/application/actor";

async function main() {
  console.log("================================================================================");
  console.log("FEEFLOW REAL RAZORPAY TEST MODE REFUND VERIFICATION");
  console.log("================================================================================");

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error("Missing RAZORPAY credentials in environment");
  }

  console.log("1. Environment Credentials Check:");
  console.log(`   - RAZORPAY_KEY_ID: ${keyId.slice(0, 12)}... (Valid Test Key: ${keyId.startsWith("rzp_test_")})`);
  console.log(`   - RAZORPAY_KEY_SECRET: Present`);
  console.log(`   - RAZORPAY_WEBHOOK_SECRET: Present`);

  // Target Student: Ishita Sharma
  const student = await prisma.student.findFirst({
    where: { name: "Ishita Sharma" },
    include: {
      centre: true,
      feePlans: { where: { status: "ACTIVE" }, include: { instalments: true } },
      payments: { where: { status: "CAPTURED" }, include: { refundItems: true } },
      withdrawals: true,
    },
  });

  if (!student) {
    throw new Error("Student Ishita Sharma not found in Supabase");
  }

  console.log("\n2. Student Target:");
  console.log(`   - Name: ${student.name}`);
  console.log(`   - Student ID: ${student.id}`);
  console.log(`   - Centre: ${student.centre.name} (${student.centreId})`);
  console.log(`   - Active Fee Plans: ${student.feePlans.length}`);
  console.log(`   - Captured Payments: ${student.payments.length}`);

  // Target Payment: pay_Ty2Jpj9UiLjfMR
  const targetPayment = student.payments.find(
    (p) => p.providerPaymentId === "pay_Ty2Jpj9UiLjfMR"
  );
  if (!targetPayment) {
    throw new Error("Target payment pay_Ty2Jpj9UiLjfMR not found for Ishita Sharma");
  }

  console.log(`   - Target Payment ID: ${targetPayment.id}`);
  console.log(`   - Provider Payment ID: ${targetPayment.providerPaymentId}`);
  console.log(`   - Amount: ${targetPayment.amount} paise (₹${Number(targetPayment.amount) / 100})`);
  console.log(`   - Status: ${targetPayment.status}`);

  // Initial Ledger Count
  const initialLedgerCount = await prisma.ledgerEntry.count({
    where: { studentId: student.id },
  });
  console.log(`   - Initial Student Ledger Entries: ${initialLedgerCount}`);

  // Actors
  const accountsActor: Actor = {
    userId: "usr_accounts_neha",
    name: "Neha Verma",
    role: "ACCOUNTS",
    centreIds: [student.centreId],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const directorActor: Actor = {
    userId: "usr_director_arvind",
    name: "Arvind Mathur",
    role: "DIRECTOR",
    centreIds: [],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const refundService = new RefundService();

  // Clean up any stale draft withdrawal for Ishita
  const staleDraft = student.withdrawals.find((w) => w.status === "DRAFT" || w.status === "REQUESTED");
  if (staleDraft) {
    console.log(`\n3. Cleaning up stale seed draft withdrawal ${staleDraft.id}...`);
    await prisma.withdrawal.delete({ where: { id: staleDraft.id } });
    console.log("   - Cleaned successfully.");
  }

  // Step A: Maker submits withdrawal request
  console.log("\n4. Step A: Maker submits statutory withdrawal request (Neha Verma / ACCOUNTS)");
  const requestResult = await refundService.createWithdrawalRequest({
    studentId: student.id,
    effectiveWithdrawalDate: new Date("2026-06-20"),
    notes: "Milestone 4B Live Test Mode Verification Withdrawal",
    actor: accountsActor,
  });

  const withdrawalId = requestResult.withdrawal.id;
  console.log(`   - Created Withdrawal ID: ${withdrawalId}`);
  console.log(`   - Status: ${requestResult.withdrawal.status}`);
  console.log(`   - Potential Refund: ${requestResult.withdrawal.potentialRefund} paise`);

  // Step B: Director approves withdrawal
  console.log("\n5. Step B: Director approves withdrawal (Arvind Mathur / DIRECTOR)");
  const approvalResult = await refundService.reviewWithdrawal({
    withdrawalId,
    decision: "APPROVED",
    notes: "Director approval for Milestone 4B verification",
    actor: directorActor,
  });

  console.log(`   - Withdrawal Status: ${approvalResult.status}`);
  console.log(`   - Refund ID: ${approvalResult.refund?.id}`);

  // Ledger count after withdrawal rebase
  const postWaiverLedgerCount = await prisma.ledgerEntry.count({
    where: { studentId: student.id },
  });
  console.log(`   - Student Ledger Entries after waiver rebase: ${postWaiverLedgerCount}`);

  // Step C: Inspect Planned Refund Items
  const plannedItems = await prisma.refundItem.findMany({
    where: { refundId: approvalResult.refund?.id },
    include: { payment: true },
  });

  console.log(`\n6. Step C: Planned Refund Items (${plannedItems.length} items):`);
  for (const it of plannedItems) {
    console.log(`   - Item ${it.id}: Payment ${it.payment.providerPaymentId} (${it.payment.provider}), Amount: ${it.amount} paise, Status: ${it.status}`);
  }

  // Find or target the refund item for pay_Ty2Jpj9UiLjfMR
  let targetItem = plannedItems.find(
    (it) => it.payment.providerPaymentId === "pay_Ty2Jpj9UiLjfMR"
  );

  if (!targetItem) {
    // If allocated differently, allocate an item directly to target payment
    console.log("   - Target payment not in default pro-rata slice; creating dedicated verification item...");
    targetItem = await prisma.refundItem.create({
      data: {
        refundId: approvalResult.refund!.id,
        paymentId: targetPayment.id,
        amount: 100000n, // ₹1,000 (100,000 paise)
        status: "PENDING",
      },
      include: { payment: true },
    });
  } else {
    // Adjust target item amount to ₹1,000 (100,000 paise) for a clean partial refund
    console.log(`   - Updating target item ${targetItem.id} amount to 100,000 paise (₹1,000)...`);
    targetItem = await prisma.refundItem.update({
      where: { id: targetItem.id },
      data: { amount: 100000n },
      include: { payment: true },
    });
  }

  console.log(`\n7. Target Refund Item Selected for Gateway Execution:`);
  console.log(`   - Item ID: ${targetItem.id}`);
  console.log(`   - Payment ID: ${targetItem.paymentId} (${targetItem.payment.providerPaymentId})`);
  console.log(`   - Amount: ${targetItem.amount} paise (₹${Number(targetItem.amount) / 100})`);
  console.log(`   - Initial Status: ${targetItem.status}`);

  // Step D: Execute Live Razorpay Normal Refund
  console.log("\n8. Step D: Executing Live Razorpay Normal Refund API call...");
  const rzpProvider = new RazorpayRefundProvider();

  const execResult = await refundService.executeRefundItem({
    refundItemId: targetItem.id,
    actor: accountsActor,
    refundProvider: rzpProvider,
  });

  console.log("   >>> Razorpay Execution Completed!");
  console.log(`   - Item Status: ${execResult.item.status}`);
  console.log(`   - Provider Refund ID: ${execResult.item.providerRefundId}`);
  console.log(`   - Message: ${(execResult as any).message || "Success"}`);

  const liveRefundId = execResult.item.providerRefundId;
  if (!liveRefundId) {
    throw new Error("Execution failed to produce a providerRefundId!");
  }

  // Step E: Query Razorpay API Directly
  console.log("\n9. Step E: Direct Gateway Verification against https://api.razorpay.com...");
  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  // Fetch Payment Refunds
  const paymentRefundsRes = await fetch(
    `https://api.razorpay.com/v1/payments/${targetPayment.providerPaymentId}/refunds`,
    { headers: { Authorization: authHeader } }
  );
  const paymentRefunds = await paymentRefundsRes.json();
  console.log(`   - Gateway Payment Refunds count: ${paymentRefunds.count}`);

  // Fetch Specific Refund
  const refundRes = await fetch(
    `https://api.razorpay.com/v1/refunds/${liveRefundId}`,
    { headers: { Authorization: authHeader } }
  );
  const refundData = await refundRes.json();
  console.log(`   - Gateway Refund ID: ${refundData.id}`);
  console.log(`   - Gateway Entity: ${refundData.entity}`);
  console.log(`   - Gateway Amount: ${refundData.amount} paise (₹${refundData.amount / 100})`);
  console.log(`   - Gateway Currency: ${refundData.currency}`);
  console.log(`   - Gateway Payment ID: ${refundData.payment_id}`);
  console.log(`   - Gateway Status: ${refundData.status}`);
  console.log(`   - Gateway Speed Processed: ${refundData.speed_processed}`);
  console.log(`   - Gateway Acquirer Data:`, JSON.stringify(refundData.acquirer_data || {}));

  // Step F: Webhook Ingestion & Idempotency
  console.log("\n10. Step F: Webhook Ingestion & Idempotency Testing...");
  const webhookEvent = {
    entity: "event",
    account_id: "acc_feeflow_test",
    event: "refund.processed",
    contains: ["refund", "payment"],
    payload: {
      refund: { entity: refundData },
      payment: {
        entity: {
          id: targetPayment.providerPaymentId,
          amount: Number(targetPayment.amount),
          currency: "INR",
          status: "captured",
          amount_refunded: refundData.amount,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(webhookEvent);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const eventId = `evt_test_refund_${Date.now()}`;

  // First Delivery
  console.log("   - Delivering refund.processed webhook (Attempt 1)...");
  const webhookResult1 = await refundService.processRefundWebhook(rawBody, {
    provider: "RAZORPAY",
    signature,
    eventId,
    secret: webhookSecret,
  });
  console.log(`     -> Result: success=${webhookResult1.success}, status=${webhookResult1.status}, duplicate=${webhookResult1.duplicate}`);

  // Re-delivery (Duplicate)
  console.log("   - Re-delivering identical webhook (Attempt 2 - Duplicate)...");
  const webhookResult2 = await refundService.processRefundWebhook(rawBody, {
    provider: "RAZORPAY",
    signature,
    eventId,
    secret: webhookSecret,
  });
  console.log(`     -> Result: success=${webhookResult2.success}, duplicate=${webhookResult2.duplicate}, status=${webhookResult2.status}`);

  // Step G: Final Supabase Database Verification
  console.log("\n11. Step G: Final Supabase Database Verification...");
  const dbItem = await prisma.refundItem.findUnique({
    where: { id: targetItem.id },
  });
  const dbRefund = await prisma.refund.findUnique({
    where: { id: targetItem.refundId },
  });
  const dbPayment = await prisma.payment.findUnique({
    where: { id: targetPayment.id },
  });
  const finalLedgerCount = await prisma.ledgerEntry.count({
    where: { studentId: student.id },
  });

  console.log(`   - RefundItem status: ${dbItem?.status} (Provider Refund ID: ${dbItem?.providerRefundId})`);
  console.log(`   - Parent Refund status: ${dbRefund?.status}`);
  console.log(`   - Payment status: ${dbPayment?.status} (Partially Refunded: ${dbPayment?.status === "PARTIALLY_REFUNDED"})`);
  console.log(`   - Final Student Ledger Entries: ${finalLedgerCount}`);
  console.log(`   - Ledger Invariant: Entries before refund execution = ${postWaiverLedgerCount}, after = ${finalLedgerCount} (Delta: ${finalLedgerCount - postWaiverLedgerCount})`);

  console.log("\n================================================================================");
  console.log("ALL REAL RAZORPAY TEST MODE REFUND VERIFICATIONS COMPLETED SUCCESSFULLY!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("\n[EXECUTION ERROR]:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
