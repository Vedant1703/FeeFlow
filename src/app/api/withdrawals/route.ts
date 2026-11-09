import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";
import { refundService } from "@/application/services/refund-service";

export async function GET(req: Request) {
  try {
    const actor = await getSessionActor();
    if (!actor || (actor.role !== "ACCOUNTS" && actor.role !== "DIRECTOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const centreId = searchParams.get("centreId") || undefined;

    const cases = await refundService.getWithdrawalCases(actor, {
      status,
      centreId,
    });

    // Format BigInt values as strings for JSON serialization
    const serialized = cases.map((c) => ({
      ...c,
      netFeePaise: c.netFeePaise.toString(),
      paidPaise: c.paidPaise.toString(),
      earnedPaise: c.earnedPaise.toString(),
      refundPaise: c.refundPaise.toString(),
      shortfallPaise: c.shortfallPaise.toString(),
      items: c.items?.map((it) => ({
        ...it,
        amountPaise: it.amountPaise.toString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      count: serialized.length,
      cases: serialized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch withdrawal cases" },
      { status: 500 }
    );
  }
}

