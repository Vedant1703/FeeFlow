import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { findDemoParentByPhone } from "@/infrastructure/db/demo-data";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (e.g. +91 90000 12345 -> +919000012345)
    const cleanPhone = phone.replace(/[^\d+]/g, "");

    let parent: any = null;

    try {
      // Attempt database query if PostgreSQL is active
      parent = await prisma.parent.findFirst({
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
    } catch (dbError) {
      // In demo mode or offline, fallback to in-memory demo data
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          phone: demo.phone,
          name: demo.name,
        };
      }
    }

    // If still not found via DB, check demo store fallback
    if (!parent) {
      const demo = findDemoParentByPhone(cleanPhone);
      if (demo) {
        parent = {
          id: demo.id,
          phone: demo.phone,
          name: demo.name,
        };
      }
    }

    if (!parent) {
      return NextResponse.json(
        {
          error: "This mobile number is not registered with any student. In demo mode, use +91 90000 12345.",
        },
        { status: 404 }
      );
    }

    // Demo Mode: Demo OTP is fixed to 482913 and disclosed in response
    return NextResponse.json({
      success: true,
      phone: parent.phone,
      demoCode: "482913",
      message: "6-digit OTP code sent. In demo mode, enter code 482913.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
