import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (e.g. +91 90000 12345 -> +919000012345)
    const cleanPhone = phone.replace(/[^\d+]/g, "");

    // Check if phone belongs to a seeded parent
    const parent = await prisma.parent.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: { contains: cleanPhone.slice(-10) } },
        ],
      },
      include: {
        students: {
          include: { student: true },
        },
      },
    });

    if (!parent) {
      return NextResponse.json(
        {
          error: "This mobile number is not registered with any student. Contact your centre.",
        },
        { status: 404 }
      );
    }

    // Demo Mode: Demo OTP is fixed to 482913 and disclosed in response
    return NextResponse.json({
      success: true,
      phone: parent.phone,
      demoCode: "482913",
      message: "6-digit OTP code sent. In demo mode, use code 482913.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
