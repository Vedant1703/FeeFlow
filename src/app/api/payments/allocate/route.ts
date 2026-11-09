import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { getSessionActor } from "@/infrastructure/auth/session";
import { canActorManagePayments } from "@/application/actor";
import { paymentService } from "@/application/services/payment-service";
import { demoPaymentStore } from "@/infrastructure/db/demo-payment-store";

const InstalmentItemSchema = z.object({
  instalmentId: z.string().min(1, "Instalment ID is required"),
  amountPaise: z.union([z.string(), z.number(), z.bigint()]).refine((val) => {
    try {
      return BigInt(val) > 0n;
    } catch {
      return false;
    }
  }, "Allocation amount must be a positive integer"),
});

const AllocatePaymentSchema = z
  .object({
    paymentId: z.string().min(1, "Payment ID is required"),
    studentId: z.string().optional(),
    instalmentId: z.string().optional(),
    amountPaise: z.union([z.string(), z.number(), z.bigint()]).optional(),
    allocations: z.array(InstalmentItemSchema).optional(),
    reason: z.string().trim().min(3, "Mandatory audit reason must be at least 3 characters"),
    idempotencyKey: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.allocations && data.allocations.length > 0) ||
      (data.instalmentId !== undefined && data.amountPaise !== undefined),
    "Either allocations array or instalmentId with amountPaise is required"
  );

export async function POST(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || !canActorManagePayments(actor)) {
      return NextResponse.json(
        { error: "Unauthorized: only Accounts and Director staff can allocate payments" },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const parseResult = AllocatePaymentSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid allocation request" },
        { status: 400 }
      );
    }

    const {
      paymentId,
      studentId: rawStudentId,
      instalmentId,
      amountPaise: rawAmountPaise,
      allocations: rawAllocations,
      reason,
      idempotencyKey,
    } = parseResult.data;

    let allocations: Array<{ instalmentId: string; amountPaise: bigint }> = [];
    if (rawAllocations && rawAllocations.length > 0) {
      allocations = rawAllocations.map((a) => ({
        instalmentId: a.instalmentId,
        amountPaise: BigInt(a.amountPaise),
      }));
    } else if (instalmentId && rawAmountPaise !== undefined) {
      allocations = [{ instalmentId, amountPaise: BigInt(rawAmountPaise) }];
    }

    // Resolve studentId if not explicitly provided
    let studentId = rawStudentId;
    if (!studentId && allocations.length > 0) {
      try {
        const firstInst = await prisma.instalment.findUnique({
          where: { id: allocations[0].instalmentId },
          include: { feePlan: true },
        });
        if (firstInst) {
          studentId = firstInst.feePlan.studentId;
        }
      } catch {
        const demoInst = demoPaymentStore.instalments.get(allocations[0].instalmentId);
        if (demoInst) {
          studentId = demoInst.studentId;
        }
      }
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "Target studentId could not be determined" },
        { status: 400 }
      );
    }

    const result = await paymentService.allocatePayment({
      paymentId,
      studentId,
      allocations,
      reason,
      actor,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      message: "Payment successfully allocated to student instalment",
      result: {
        paymentId: result.paymentId,
        studentId: result.studentId,
        totalAllocatedPaise: result.totalAllocatedPaise.toString(),
        remainingUnallocatedPaise: result.remainingUnallocatedPaise.toString(),
        allocations: result.allocations.map((a) => ({
          allocationId: a.allocationId,
          instalmentId: a.instalmentId,
          allocatedPaise: a.allocatedPaise.toString(),
          newOutstandingPaise: a.newOutstandingPaise.toString(),
        })),
      },
    });
  } catch (err: any) {
    const msg = String(err.message || "");
    if (msg.includes("Unauthorized") || msg.includes("Access denied")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (
      msg.includes("Cannot allocate") ||
      msg.includes("exceeds") ||
      msg.includes("Duplicate") ||
      msg.includes("positive integer") ||
      msg.includes("required") ||
      msg.includes("already assigned") ||
      msg.includes("conflict")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json(
      { error: err.message || "Failed to allocate payment" },
      { status: 500 }
    );
  }
}
