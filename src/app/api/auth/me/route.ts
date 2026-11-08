import { NextResponse } from "next/server";
import { getSessionActor } from "@/infrastructure/auth/session";

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ authenticated: false, actor: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    actor: {
      userId: actor.userId,
      role: actor.role,
      name: actor.name,
      email: actor.email,
      phone: actor.phone,
      centreIds: actor.centreIds,
      linkedStudentIds: actor.linkedStudentIds,
      consentedStudentIds: actor.consentedStudentIds,
    },
  });
}
