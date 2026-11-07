import { NextResponse } from "next/server";
import { mockSmsProvider } from "@/infrastructure/auth/sms/sms-provider";
import { normalizeIndianPhoneNumber } from "@/infrastructure/auth/otp-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    // Return all recent messages (up to 10)
    return NextResponse.json({
      success: true,
      messages: mockSmsProvider.history.slice(-10).reverse(),
    });
  }

  const norm = normalizeIndianPhoneNumber(phone);
  const cleanPhone = norm.isValid ? norm.normalized : phone;

  const msg = mockSmsProvider.getLatestMessage(cleanPhone);
  if (!msg) {
    return NextResponse.json(
      { error: `No recent SMS found for ${cleanPhone}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    phone: msg.phone,
    otp: msg.otp,
    sentAt: msg.sentAt,
    expiresInMinutes: msg.expiresInMinutes,
    renderedBody: `Your FeeFlow verification code is ${msg.otp}. Valid for ${msg.expiresInMinutes} minutes. Do not share this OTP with anyone.`,
  });
}
