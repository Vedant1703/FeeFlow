import { NextResponse } from "next/server";
import { refundService } from "@/application/services/refund-service";

export async function GET() {
  try {
    const policy = await refundService.getRefundPolicy();
    return NextResponse.json({
      success: true,
      policy,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch refund policy" },
      { status: 500 }
    );
  }
}

