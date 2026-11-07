import { describe, it, expect } from "vitest";
import {
  canActorAccessStudent,
  canActorViewLedger,
  canActorManagePayments,
  canActorApproveSensitiveAction,
  canActorReviewRisk,
  Actor,
} from "../actor";

describe("Application: Role-Based Access Control (RBAC) & Scoping", () => {
  const directorActor: Actor = {
    userId: "dir-1",
    role: "DIRECTOR",
    name: "Arvind Mathur",
    centreIds: ["c-mn", "c-vn", "c-ms", "c-tr"],
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const accountsNeha: Actor = {
    userId: "acc-1",
    role: "ACCOUNTS",
    name: "Neha Verma",
    centreIds: ["c-vn", "c-mn"], // Vaishali Nagar & Malviya Nagar
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const counsellorPooja: Actor = {
    userId: "coun-1",
    role: "COUNSELLOR",
    name: "Pooja Rawat",
    centreIds: ["c-vn"], // Vaishali Nagar
    linkedStudentIds: [],
    consentedStudentIds: [],
  };

  const parentSanjay: Actor = {
    userId: "parent-1",
    role: "PARENT",
    name: "Sanjay Sharma",
    centreIds: [],
    linkedStudentIds: ["stu-ishita", "stu-kabir"],
    consentedStudentIds: ["stu-ishita"], // Only Ishita consented, Kabir not yet
  };

  const studentIshita = { id: "stu-ishita", centreId: "c-vn" };
  const studentKabir = { id: "stu-kabir", centreId: "c-vn" };
  const studentMohit = { id: "stu-mohit", centreId: "c-ms" }; // Mansarovar

  it("enforces centre scoping on Accounts staff", () => {
    // Neha has Vaishali Nagar and Malviya Nagar
    expect(canActorAccessStudent(accountsNeha, studentIshita)).toBe(true);
    // Student in Mansarovar (c-ms) should be rejected
    expect(canActorAccessStudent(accountsNeha, studentMohit)).toBe(false);
  });

  it("allows Director cross-centre oversight", () => {
    expect(canActorAccessStudent(directorActor, studentIshita)).toBe(true);
    expect(canActorAccessStudent(directorActor, studentMohit)).toBe(true);
  });

  it("enforces DPDP consent gate on parents", () => {
    // Ishita is linked and has active consent: allowed
    expect(canActorAccessStudent(parentSanjay, studentIshita)).toBe(true);
    // Kabir is linked but NOT consented: blocked
    expect(canActorAccessStudent(parentSanjay, studentKabir)).toBe(false);
    // Mohit is not linked: blocked
    expect(canActorAccessStudent(parentSanjay, studentMohit)).toBe(false);
  });

  it("strictly forbids Counsellors from viewing financial ledger rows", () => {
    // Counsellors can see risk/academic factors only (SRS §3)
    expect(canActorViewLedger(counsellorPooja)).toBe(false);
    expect(canActorViewLedger(accountsNeha)).toBe(true);
    expect(canActorViewLedger(directorActor)).toBe(true);
    expect(canActorViewLedger(parentSanjay)).toBe(true);
  });

  it("allows Counsellors to review risk in their assigned centre only", () => {
    expect(canActorReviewRisk(counsellorPooja, "c-vn")).toBe(true);
    expect(canActorReviewRisk(counsellorPooja, "c-ms")).toBe(false);
  });

  it("strictly enforces Maker-Checker on sensitive approvals", () => {
    // Accounts executive cannot approve
    const accApprove = canActorApproveSensitiveAction(accountsNeha, "acc-1");
    expect(accApprove.allowed).toBe(false);

    // Director self-approval (Director requested, Director approving) is forbidden
    const selfApprove = canActorApproveSensitiveAction(directorActor, "dir-1");
    expect(selfApprove.allowed).toBe(false);
    expect(selfApprove.reason).toContain("Maker-checker violation");

    // Director approving Accounts request is allowed
    const validApprove = canActorApproveSensitiveAction(directorActor, "acc-1");
    expect(validApprove.allowed).toBe(true);
  });
});

