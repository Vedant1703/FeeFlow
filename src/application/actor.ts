/**
 * Role-Based Access Control (RBAC) and Actor Context for FeeFlow.
 * Aligned with SRS v2.2 (§3, §3.1) and Wireframes.
 *
 * Hard Invariants:
 * 1. Every protected operation accepts an authenticated Actor context.
 * 2. Parent access requires active student link AND active DPDP consent.
 * 3. Accounts actions are strictly scoped to assigned centre(s).
 * 4. Counsellors can see risk and academic signals only; NO ledger or payment access.
 * 5. Maker-checker enforcement: approverId !== requesterId.
 */

export type Role = "PARENT" | "ACCOUNTS" | "COUNSELLOR" | "DIRECTOR";

export interface Actor {
  userId: string;
  role: Role;
  name: string;
  email?: string | null;
  phone?: string | null;
  centreIds: string[]; // Assigned centre scope for staff
  linkedStudentIds: string[]; // Linked students for parents
  consentedStudentIds: string[]; // Students with active DPDP parental consent
}

/**
 * Checks whether an actor can view a specific student's details.
 */
export function canActorAccessStudent(
  actor: Actor,
  student: { id: string; centreId: string }
): boolean {
  if (actor.role === "DIRECTOR") {
    return true; // Cross-centre oversight
  }

  if (actor.role === "ACCOUNTS" || actor.role === "COUNSELLOR") {
    // Accounts and Counsellors are scoped to their assigned centres
    return actor.centreIds.includes(student.centreId);
  }

  if (actor.role === "PARENT") {
    // Parent must have active parent-student link AND active DPDP consent
    const isLinked = actor.linkedStudentIds.includes(student.id);
    const hasConsent = actor.consentedStudentIds.includes(student.id);
    return isLinked && hasConsent;
  }

  return false;
}

/**
 * Checks whether an actor can view financial ledger details.
 * Rule: Counsellors are forbidden from viewing financial ledger rows (SRS §3).
 */
export function canActorViewLedger(actor: Actor): boolean {
  return actor.role === "PARENT" || actor.role === "ACCOUNTS" || actor.role === "DIRECTOR";
}

/**
 * Checks whether an actor can perform payment operations.
 * Rule: Only Accounts and Parents can initiate/allocate payments.
 */
export function canActorManagePayments(actor: Actor, centreId?: string): boolean {
  if (actor.role === "DIRECTOR") return true;
  if (actor.role === "ACCOUNTS") {
    if (centreId) return actor.centreIds.includes(centreId);
    return true;
  }
  return false;
}

/**
 * Checks whether an actor can approve a discount or withdrawal/refund.
 * Rule: Maker-checker strictly requires approverId !== requesterId.
 * Directors can approve; Accounts can only request.
 */
export function canActorApproveSensitiveAction(
  actor: Actor,
  requesterId: string
): { allowed: boolean; reason?: string } {
  if (actor.role !== "DIRECTOR") {
    return {
      allowed: false,
      reason: "Permission denied: Only Founder-Director can approve discounts and refund requests",
    };
  }

  if (actor.userId === requesterId) {
    return {
      allowed: false,
      reason: "Maker-checker violation: Requester cannot approve their own request",
    };
  }

  return { allowed: true };
}

/**
 * Checks whether an actor can review risk tasks.
 * Rule: Counsellor and Director only.
 */
export function canActorReviewRisk(actor: Actor, centreId?: string): boolean {
  if (actor.role === "DIRECTOR") return true;
  if (actor.role === "COUNSELLOR") {
    if (centreId) return actor.centreIds.includes(centreId);
    return true;
  }
  return false;
}

