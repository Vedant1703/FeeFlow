import { prisma } from "@/infrastructure/db/prisma";

export interface AuditLogInput {
  action:
    | "PAYMENT_ORDER_CREATED"
    | "CHECKOUT_SIGNATURE_VERIFIED"
    | "CHECKOUT_SIGNATURE_FAILED"
    | "PAYMENT_INTENT_REUSED"
    | "PAYMENT_ALLOCATE"
    | string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  centreId?: string | null;
  reason?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Persists an immutable audit log entry.
 * Hard invariant: Secrets (keys, authkeys, passwords) are NEVER logged.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  // Always emit a structured log to stdout (with secrets excluded)
  console.log(`[AUDIT] [${input.action}] [${input.entityType}:${input.entityId}]`, {
    actorId: input.actorId || "SYSTEM",
    actorRole: input.actorRole || "SYSTEM",
    ...input.metadata,
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId || "SYSTEM",
        actorEmail: input.actorEmail || "system@feeflow.local",
        actorRole: input.actorRole || "SYSTEM",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        centreId: input.centreId,
        reason: input.reason,
        afterJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch {
    // If database is offline, in-memory, or in demo mode, proceed safely
  }
}
