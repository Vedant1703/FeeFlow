import { PrismaClient, Role, StudentStatus, FeePlanStatus, InstalmentStatus, LedgerEntryType, PaymentStatus, MatchStatus, RiskLevel, RiskTaskStatus, WithdrawalStatus, RefundStatus, RefundItemStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting FeeFlow deterministic Jaipur seed anchored to 2026-11-02...");

  // Clean existing tables in reverse dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.riskTask.deleteMany({});
  await prisma.riskEvaluation.deleteMany({});
  await prisma.riskConfig.deleteMany({});
  await prisma.importBatch.deleteMany({});
  await prisma.testResult.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.refundItem.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.withdrawal.deleteMany({});
  await prisma.refundPolicy.deleteMany({});
  await prisma.reminderPause.deleteMany({});
  await prisma.reminderDispatch.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.receipt.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.providerEvent.deleteMany({});
  await prisma.paymentIntent.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.discount.deleteMany({});
  await prisma.instalment.deleteMany({});
  await prisma.feePlan.deleteMany({});
  await prisma.consent.deleteMany({});
  await prisma.parentStudent.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.parent.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.userCentre.deleteMany({});
  await prisma.centre.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Centres (4 Jaipur Centres)
  const malviyaNagar = await prisma.centre.create({
    data: {
      code: "JPR-MN",
      name: "Malviya Nagar",
      city: "Jaipur",
      state: "Rajasthan",
    },
  });

  const vaishaliNagar = await prisma.centre.create({
    data: {
      code: "JPR-VN",
      name: "Vaishali Nagar",
      city: "Jaipur",
      state: "Rajasthan",
    },
  });

  const mansarovar = await prisma.centre.create({
    data: {
      code: "JPR-MS",
      name: "Mansarovar",
      city: "Jaipur",
      state: "Rajasthan",
    },
  });

  const tonkRoad = await prisma.centre.create({
    data: {
      code: "JPR-TR",
      name: "Tonk Road",
      city: "Jaipur",
      state: "Rajasthan",
    },
  });

  // 2. Staff Users
  const directorUser = await prisma.user.create({
    data: {
      email: "arvind.mathur@demo.companya.test",
      name: "Arvind Mathur (Founder-Director)",
      role: Role.DIRECTOR,
      passwordHash: "DemoPassword123!",
      userCentres: {
        create: [
          { centreId: malviyaNagar.id },
          { centreId: vaishaliNagar.id },
          { centreId: mansarovar.id },
          { centreId: tonkRoad.id },
        ],
      },
    },
  });

  const accountsUser = await prisma.user.create({
    data: {
      email: "neha.verma@demo.companya.test",
      name: "Neha Verma (Accounts Executive)",
      role: Role.ACCOUNTS,
      passwordHash: "DemoPassword123!",
      userCentres: {
        create: [
          { centreId: vaishaliNagar.id },
          { centreId: malviyaNagar.id },
        ],
      },
    },
  });

  const counsellorUser = await prisma.user.create({
    data: {
      email: "pooja.rawat@demo.companya.test",
      name: "Pooja Rawat (Student Counsellor)",
      role: Role.COUNSELLOR,
      passwordHash: "DemoPassword123!",
      userCentres: {
        create: [{ centreId: vaishaliNagar.id }],
      },
    },
  });

  // 3. Courses
  const jeeCourse = await prisma.course.create({
    data: {
      code: "JEE",
      name: "JEE Advanced & Main (2-Year Integrated)",
    },
  });

  const neetCourse = await prisma.course.create({
    data: {
      code: "NEET",
      name: "NEET Medical (2-Year Integrated)",
    },
  });

  // 4. Batches
  const batchJeeMornMN = await prisma.batch.create({
    data: {
      code: "JEE-2027-M-MN",
      name: "JEE 2027 Morning",
      centreId: malviyaNagar.id,
      courseId: jeeCourse.id,
      academicYear: "2026-2027",
      startDate: new Date("2026-06-15T00:00:00Z"),
      endDate: new Date("2027-03-31T00:00:00Z"),
    },
  });

  const batchJeeEveVN = await prisma.batch.create({
    data: {
      code: "JEE-2027-E-VN",
      name: "JEE 2027 Evening",
      centreId: vaishaliNagar.id,
      courseId: jeeCourse.id,
      academicYear: "2026-2027",
      startDate: new Date("2026-06-15T00:00:00Z"),
      endDate: new Date("2027-03-31T00:00:00Z"),
    },
  });

  const batchNeetMornMS = await prisma.batch.create({
    data: {
      code: "NEET-2027-M-MS",
      name: "NEET 2027 Morning",
      centreId: mansarovar.id,
      courseId: neetCourse.id,
      academicYear: "2026-2027",
      startDate: new Date("2026-06-15T00:00:00Z"),
      endDate: new Date("2027-03-31T00:00:00Z"),
    },
  });

  // 5. Refund Policy v1.0
  await prisma.refundPolicy.create({
    data: {
      version: "v1.0",
      policyHash: "sha256_mock_v1_0_pro_rata_inclusive_calendar_zero_deduction",
      policyJson: JSON.stringify({
        convention: "INCLUSIVE_CALENDAR_DAYS",
        deductionPaise: 0,
        deductionBasisPoints: 0,
        targetProcessingDays: 10,
        shortfallRule: "INFORMATIONAL_ONLY",
      }),
      effectiveFrom: new Date("2026-04-01T00:00:00Z"),
      isActive: true,
    },
  });

  // 6. Risk Configuration v1.0
  await prisma.riskConfig.create({
    data: {
      version: "v1.0",
      feeWeight: 0.40,
      attendanceWeight: 0.30,
      testWeight: 0.30,
      highThreshold: 60.0,
      mediumThreshold: 35.0,
      isActive: true,
    },
  });

  // 7. Reminder Rules
  const reminderRules = [
    { name: "Upcoming 7 Days", offsetDays: -7 },
    { name: "Upcoming 3 Days", offsetDays: -3 },
    { name: "Due Date Today", offsetDays: 0 },
    { name: "Overdue 3 Days", offsetDays: 3 },
    { name: "Overdue 7 Days", offsetDays: 7 },
    { name: "Overdue 15 Days", offsetDays: 15 },
    { name: "Overdue 30 Days", offsetDays: 30 },
  ];

  for (const r of reminderRules) {
    await prisma.reminderRule.create({ data: r });
  }

  // =========================================================================
  // RECORD 1: STU-0412 Aarav Meena (JEE 2027 Morning, Malviya Nagar)
  // 4 × ₹30,000 plan. Due 10 Oct 2026: ₹30,000 / Paid ₹30,000 -> Paid
  // =========================================================================
  const parentAarav = await prisma.parent.create({
    data: {
      phone: "+91 90000 12341",
      name: "Rajesh Meena",
      preferredLanguage: "hi",
    },
  });

  const studentAarav = await prisma.student.create({
    data: {
      studentCode: "STU-0412",
      name: "Aarav Meena",
      centreId: malviyaNagar.id,
      batchId: batchJeeMornMN.id,
      enrollmentDate: new Date("2026-05-10T00:00:00Z"),
    },
  });

  await prisma.parentStudent.create({
    data: { parentId: parentAarav.id, studentId: studentAarav.id, relationship: "Father" },
  });

  await prisma.consent.create({
    data: {
      parentId: parentAarav.id,
      studentId: studentAarav.id,
      noticeVersion: "v1.0",
      language: "hi",
      purposes: "fee_tracking,academic_progress,attendance",
      verifiedPhone: "+91 90000 12341",
      consentedAt: new Date("2026-05-10T10:00:00Z"),
    },
  });

  const planAarav = await prisma.feePlan.create({
    data: {
      studentId: studentAarav.id,
      name: "JEE 2026-27 Standard 4-Instalment Plan",
      serviceStartDate: new Date("2026-06-15T00:00:00Z"),
      serviceEndDate: new Date("2027-03-31T00:00:00Z"),
      totalServiceDays: 290,
      baseAmount: 12000000n, // ₹1,20,000
      netAmount: 12000000n,
      numberOfInstalments: 4,
    },
  });

  // Instalments for Aarav
  const aaravInstalments = [
    { seq: 1, due: new Date("2026-07-10T00:00:00Z"), amount: 3000000n, status: InstalmentStatus.PAID },
    { seq: 2, due: new Date("2026-10-10T00:00:00Z"), amount: 3000000n, status: InstalmentStatus.PAID },
    { seq: 3, due: new Date("2027-01-10T00:00:00Z"), amount: 3000000n, status: InstalmentStatus.UNPAID },
    { seq: 4, due: new Date("2027-03-10T00:00:00Z"), amount: 3000000n, status: InstalmentStatus.UNPAID },
  ];

  for (const inst of aaravInstalments) {
    const createdInst = await prisma.instalment.create({
      data: {
        feePlanId: planAarav.id,
        sequence: inst.seq,
        dueDate: inst.due,
        amount: inst.amount,
        status: inst.status,
      },
    });

    // Ledger charge
    await prisma.ledgerEntry.create({
      data: {
        studentId: studentAarav.id,
        instalmentId: createdInst.id,
        entryType: LedgerEntryType.CHARGE,
        amount: inst.amount,
        entryDate: inst.due,
        referenceType: "PLAN_CREATION",
        notes: `Instalment ${inst.seq} charge`,
      },
    });

    // If paid, create payment, allocation, receipt, and ledger credit
    if (inst.status === InstalmentStatus.PAID) {
      const payRef = `PAY-AARAV-${inst.seq}`;
      const payment = await prisma.payment.create({
        data: {
          paymentReference: payRef,
          providerPaymentId: `prov_${payRef.toLowerCase()}`,
          studentId: studentAarav.id,
          amount: inst.amount,
          unallocatedAmount: 0n,
          paymentDate: inst.due,
          method: "UPI",
          status: PaymentStatus.CAPTURED,
          matchStatus: MatchStatus.MATCHED_AUTOMATIC,
        },
      });

      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          instalmentId: createdInst.id,
          amount: inst.amount,
          allocatedAt: inst.due,
          allocationReason: "Prompt UPI payment",
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          studentId: studentAarav.id,
          instalmentId: createdInst.id,
          entryType: LedgerEntryType.ALLOCATION,
          amount: -inst.amount,
          entryDate: inst.due,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          notes: `Payment for instalment ${inst.seq}`,
        },
      });

      await prisma.receipt.create({
        data: {
          receiptNumber: `REC-2026-0412-${inst.seq}`,
          paymentId: payment.id,
          studentId: studentAarav.id,
          amount: inst.amount,
          issuedAt: inst.due,
          gstin: "08AABCC1234D1Z5 [SYNTHETIC]",
          sacCode: "999293",
          taxableAmount: inst.amount,
        },
      });
    }
  }

  // =========================================================================
  // RECORD 2: STU-0587 Ishita Sharma (JEE 2027 Evening, Vaishali Nagar)
  // Multi-child parent with Kabir Sharma (STU-0588).
  // 4 × ₹30,000 plan. Due 10 Oct 2026: ₹30,000 / Paid ₹15,000 -> Part paid, 23 days overdue
  // =========================================================================
  const parentSharma = await prisma.parent.create({
    data: {
      phone: "+91 90000 12345",
      name: "Sanjay Sharma",
      preferredLanguage: "en",
    },
  });

  const studentIshita = await prisma.student.create({
    data: {
      studentCode: "STU-0587",
      name: "Ishita Sharma",
      centreId: vaishaliNagar.id,
      batchId: batchJeeEveVN.id,
      enrollmentDate: new Date("2026-05-15T00:00:00Z"),
    },
  });

  const studentKabir = await prisma.student.create({
    data: {
      studentCode: "STU-0588",
      name: "Kabir Sharma",
      centreId: vaishaliNagar.id,
      batchId: batchJeeEveVN.id,
      enrollmentDate: new Date("2026-05-15T00:00:00Z"),
    },
  });

  await prisma.parentStudent.create({
    data: { parentId: parentSharma.id, studentId: studentIshita.id, relationship: "Father" },
  });
  await prisma.parentStudent.create({
    data: { parentId: parentSharma.id, studentId: studentKabir.id, relationship: "Father" },
  });

  // Consent for both children
  await prisma.consent.create({
    data: {
      parentId: parentSharma.id,
      studentId: studentIshita.id,
      noticeVersion: "v1.0",
      language: "en",
      purposes: "fee_tracking,academic_progress,attendance",
      verifiedPhone: "+91 90000 12345",
      consentedAt: new Date("2026-05-15T11:00:00Z"),
    },
  });

  await prisma.consent.create({
    data: {
      parentId: parentSharma.id,
      studentId: studentKabir.id,
      noticeVersion: "v1.0",
      language: "en",
      purposes: "fee_tracking,academic_progress,attendance",
      verifiedPhone: "+91 90000 12345",
      consentedAt: new Date("2026-05-15T11:05:00Z"),
    },
  });

  // Ishita's Plan: 4 × ₹30,000
  const planIshita = await prisma.feePlan.create({
    data: {
      studentId: studentIshita.id,
      name: "JEE 2026-27 Standard 4-Instalment Plan",
      serviceStartDate: new Date("2026-06-15T00:00:00Z"),
      serviceEndDate: new Date("2027-03-31T00:00:00Z"),
      totalServiceDays: 290,
      baseAmount: 12000000n,
      netAmount: 12000000n,
      numberOfInstalments: 4,
    },
  });

  // Instalment 1: 10 Jul 2026, ₹30,000 -> Paid
  const inst1Ishita = await prisma.instalment.create({
    data: {
      feePlanId: planIshita.id,
      sequence: 1,
      dueDate: new Date("2026-07-10T00:00:00Z"),
      amount: 3000000n,
      status: InstalmentStatus.PAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst1Ishita.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 3000000n,
      entryDate: new Date("2026-07-10T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });
  const pay1Ishita = await prisma.payment.create({
    data: {
      paymentReference: "PAY-ISHITA-1",
      providerPaymentId: "prov_ishita_1",
      studentId: studentIshita.id,
      amount: 3000000n,
      unallocatedAmount: 0n,
      paymentDate: new Date("2026-07-09T14:30:00Z"),
      method: "UPI",
      status: PaymentStatus.CAPTURED,
      matchStatus: MatchStatus.MATCHED_AUTOMATIC,
    },
  });
  await prisma.paymentAllocation.create({
    data: {
      paymentId: pay1Ishita.id,
      instalmentId: inst1Ishita.id,
      amount: 3000000n,
      allocatedAt: new Date("2026-07-09T14:30:00Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst1Ishita.id,
      entryType: LedgerEntryType.ALLOCATION,
      amount: -3000000n,
      entryDate: new Date("2026-07-09T14:30:00Z"),
      referenceType: "PAYMENT",
      referenceId: pay1Ishita.id,
    },
  });
  await prisma.receipt.create({
    data: {
      receiptNumber: "REC-2026-0587-1",
      paymentId: pay1Ishita.id,
      studentId: studentIshita.id,
      amount: 3000000n,
      issuedAt: new Date("2026-07-09T14:30:00Z"),
      taxableAmount: 3000000n,
    },
  });

  // Instalment 2: 10 Oct 2026, ₹30,000 -> Part Paid ₹15,000 (leaves ₹15,000 overdue by 23 days at 2026-11-02)
  const inst2Ishita = await prisma.instalment.create({
    data: {
      feePlanId: planIshita.id,
      sequence: 2,
      dueDate: new Date("2026-10-10T00:00:00Z"),
      amount: 3000000n,
      status: InstalmentStatus.PARTIAL,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst2Ishita.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 3000000n,
      entryDate: new Date("2026-10-10T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });
  const pay2Ishita = await prisma.payment.create({
    data: {
      paymentReference: "PAY-ISHITA-2-PART",
      providerPaymentId: "prov_ishita_2_part",
      studentId: studentIshita.id,
      amount: 1500000n, // ₹15,000
      unallocatedAmount: 0n,
      paymentDate: new Date("2026-10-15T11:20:00Z"),
      method: "NETBANKING",
      status: PaymentStatus.CAPTURED,
      matchStatus: MatchStatus.MATCHED_AUTOMATIC,
    },
  });
  await prisma.paymentAllocation.create({
    data: {
      paymentId: pay2Ishita.id,
      instalmentId: inst2Ishita.id,
      amount: 1500000n,
      allocatedAt: new Date("2026-10-15T11:20:00Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst2Ishita.id,
      entryType: LedgerEntryType.ALLOCATION,
      amount: -1500000n,
      entryDate: new Date("2026-10-15T11:20:00Z"),
      referenceType: "PAYMENT",
      referenceId: pay2Ishita.id,
    },
  });
  await prisma.receipt.create({
    data: {
      receiptNumber: "REC-2026-0587-2",
      paymentId: pay2Ishita.id,
      studentId: studentIshita.id,
      amount: 1500000n,
      issuedAt: new Date("2026-10-15T11:20:00Z"),
      taxableAmount: 1500000n,
    },
  });

  // Instalment 3 & 4: Upcoming
  const inst3Ishita = await prisma.instalment.create({
    data: {
      feePlanId: planIshita.id,
      sequence: 3,
      dueDate: new Date("2027-01-10T00:00:00Z"),
      amount: 3000000n,
      status: InstalmentStatus.UNPAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst3Ishita.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 3000000n,
      entryDate: new Date("2027-01-10T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });

  const inst4Ishita = await prisma.instalment.create({
    data: {
      feePlanId: planIshita.id,
      sequence: 4,
      dueDate: new Date("2027-03-10T00:00:00Z"),
      amount: 3000000n,
      status: InstalmentStatus.UNPAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentIshita.id,
      instalmentId: inst4Ishita.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 3000000n,
      entryDate: new Date("2027-03-10T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });

  // U1 Fixture: Draft withdrawal quote for Ishita Sharma (PDF p. 17)
  // S=15 Jun 2026, E=31 Mar 2027, T=290, W=5 Nov 2026, c=144, earned=₹59,586.21, P=₹45,000, shortfall=₹14,586.21 (informational)
  await prisma.withdrawal.create({
    data: {
      studentId: studentIshita.id,
      requestDate: new Date("2026-11-02T10:00:00Z"),
      effectiveWithdrawalDate: new Date("2026-11-05T00:00:00Z"),
      consumedDays: 144,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 4500000n,
      earnedFee: 5958621n, // ₹59,586.21
      deductionAmount: 0n,
      potentialRefund: 0n,
      indicativeShortfall: 1458621n, // ₹14,586.21 (informational only)
      slaTargetDate: new Date("2026-11-12T00:00:00Z"),
      status: WithdrawalStatus.DRAFT,
      requesterId: accountsUser.id,
    },
  });

  // Kabir Sharma (STU-0588) — All Paid Sibling
  const planKabir = await prisma.feePlan.create({
    data: {
      studentId: studentKabir.id,
      name: "JEE 2026-27 Standard 4-Instalment Plan",
      serviceStartDate: new Date("2026-06-15T00:00:00Z"),
      serviceEndDate: new Date("2027-03-31T00:00:00Z"),
      totalServiceDays: 290,
      baseAmount: 12000000n,
      netAmount: 12000000n,
      numberOfInstalments: 4,
    },
  });

  for (let seq = 1; seq <= 4; seq++) {
    const dueDate = new Date(`2026-0${5 + seq}-10T00:00:00Z`);
    const inst = await prisma.instalment.create({
      data: {
        feePlanId: planKabir.id,
        sequence: seq,
        dueDate,
        amount: 3000000n,
        status: InstalmentStatus.PAID,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        studentId: studentKabir.id,
        instalmentId: inst.id,
        entryType: LedgerEntryType.CHARGE,
        amount: 3000000n,
        entryDate: dueDate,
        referenceType: "PLAN_CREATION",
      },
    });

    const payment = await prisma.payment.create({
      data: {
        paymentReference: `PAY-KABIR-${seq}`,
        providerPaymentId: `prov_kabir_${seq}`,
        studentId: studentKabir.id,
        amount: 3000000n,
        unallocatedAmount: 0n,
        paymentDate: dueDate,
        method: "UPI",
        status: PaymentStatus.CAPTURED,
        matchStatus: MatchStatus.MATCHED_AUTOMATIC,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        instalmentId: inst.id,
        amount: 3000000n,
        allocatedAt: dueDate,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        studentId: studentKabir.id,
        instalmentId: inst.id,
        entryType: LedgerEntryType.ALLOCATION,
        amount: -3000000n,
        entryDate: dueDate,
        referenceType: "PAYMENT",
        referenceId: payment.id,
      },
    });

    await prisma.receipt.create({
      data: {
        receiptNumber: `REC-2026-0588-${seq}`,
        paymentId: payment.id,
        studentId: studentKabir.id,
        amount: 3000000n,
        issuedAt: dueDate,
        taxableAmount: 3000000n,
      },
    });
  }

  // =========================================================================
  // RECORD 3: STU-0219 Mohit Gurjar (NEET 2027 Morning, Mansarovar)
  // 3 × ₹40,000 plan. Due 15 Nov 2026: ₹40,000 / Paid ₹0 -> Due in 13 days
  // =========================================================================
  const parentMohit = await prisma.parent.create({
    data: {
      phone: "+91 90000 12342",
      name: "Ramesh Gurjar",
      preferredLanguage: "hi",
    },
  });

  const studentMohit = await prisma.student.create({
    data: {
      studentCode: "STU-0219",
      name: "Mohit Gurjar",
      centreId: mansarovar.id,
      batchId: batchNeetMornMS.id,
      enrollmentDate: new Date("2026-05-20T00:00:00Z"),
    },
  });

  await prisma.parentStudent.create({
    data: { parentId: parentMohit.id, studentId: studentMohit.id, relationship: "Father" },
  });

  await prisma.consent.create({
    data: {
      parentId: parentMohit.id,
      studentId: studentMohit.id,
      noticeVersion: "v1.0",
      language: "hi",
      purposes: "fee_tracking,academic_progress,attendance",
      verifiedPhone: "+91 90000 12342",
      consentedAt: new Date("2026-05-20T12:00:00Z"),
    },
  });

  const planMohit = await prisma.feePlan.create({
    data: {
      studentId: studentMohit.id,
      name: "NEET 2026-27 Standard 3-Instalment Plan",
      serviceStartDate: new Date("2026-06-15T00:00:00Z"),
      serviceEndDate: new Date("2027-03-31T00:00:00Z"),
      totalServiceDays: 290,
      baseAmount: 12000000n,
      netAmount: 12000000n,
      numberOfInstalments: 3,
    },
  });

  // Instalment 1: 15 Jul 2026, ₹40,000 -> Paid
  const inst1Mohit = await prisma.instalment.create({
    data: {
      feePlanId: planMohit.id,
      sequence: 1,
      dueDate: new Date("2026-07-15T00:00:00Z"),
      amount: 4000000n,
      status: InstalmentStatus.PAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentMohit.id,
      instalmentId: inst1Mohit.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 4000000n,
      entryDate: new Date("2026-07-15T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });
  const pay1Mohit = await prisma.payment.create({
    data: {
      paymentReference: "PAY-MOHIT-1",
      providerPaymentId: "prov_mohit_1",
      studentId: studentMohit.id,
      amount: 4000000n,
      unallocatedAmount: 0n,
      paymentDate: new Date("2026-07-14T10:00:00Z"),
      method: "UPI",
      status: PaymentStatus.CAPTURED,
      matchStatus: MatchStatus.MATCHED_AUTOMATIC,
    },
  });
  await prisma.paymentAllocation.create({
    data: {
      paymentId: pay1Mohit.id,
      instalmentId: inst1Mohit.id,
      amount: 4000000n,
      allocatedAt: new Date("2026-07-14T10:00:00Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentMohit.id,
      instalmentId: inst1Mohit.id,
      entryType: LedgerEntryType.ALLOCATION,
      amount: -4000000n,
      entryDate: new Date("2026-07-14T10:00:00Z"),
      referenceType: "PAYMENT",
      referenceId: pay1Mohit.id,
    },
  });
  await prisma.receipt.create({
    data: {
      receiptNumber: "REC-2026-0219-1",
      paymentId: pay1Mohit.id,
      studentId: studentMohit.id,
      amount: 4000000n,
      issuedAt: new Date("2026-07-14T10:00:00Z"),
      taxableAmount: 4000000n,
    },
  });

  // Instalment 2: 15 Nov 2026, ₹40,000 -> Unpaid (Due in 13 days from 2026-11-02)
  const inst2Mohit = await prisma.instalment.create({
    data: {
      feePlanId: planMohit.id,
      sequence: 2,
      dueDate: new Date("2026-11-15T00:00:00Z"),
      amount: 4000000n,
      status: InstalmentStatus.UNPAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentMohit.id,
      instalmentId: inst2Mohit.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 4000000n,
      entryDate: new Date("2026-11-15T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });

  // Instalment 3: 15 Feb 2027, ₹40,000 -> Upcoming
  const inst3Mohit = await prisma.instalment.create({
    data: {
      feePlanId: planMohit.id,
      sequence: 3,
      dueDate: new Date("2027-02-15T00:00:00Z"),
      amount: 4000000n,
      status: InstalmentStatus.UNPAID,
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      studentId: studentMohit.id,
      instalmentId: inst3Mohit.id,
      entryType: LedgerEntryType.CHARGE,
      amount: 4000000n,
      entryDate: new Date("2027-02-15T00:00:00Z"),
      referenceType: "PLAN_CREATION",
    },
  });

  // =========================================================================
  // FIXTURE U2: STU-1038 Kavya Rathore (Full-paid withdrawn student)
  // S=15 Jun 2026, E=31 Mar 2027, T=290, W=28 Oct 2026, c=136
  // Earned fee = ₹56,275.86, Refund = ₹63,724.14 split ₹30k + ₹30k + ₹3,724.14
  // =========================================================================
  const parentKavya = await prisma.parent.create({
    data: {
      phone: "+91 90000 12348",
      name: "Vikram Rathore",
      preferredLanguage: "hi",
    },
  });

  const studentKavya = await prisma.student.create({
    data: {
      studentCode: "STU-1038",
      name: "Kavya Rathore",
      status: StudentStatus.WITHDRAWN,
      centreId: vaishaliNagar.id,
      batchId: batchJeeEveVN.id,
      enrollmentDate: new Date("2026-05-18T00:00:00Z"),
    },
  });

  await prisma.parentStudent.create({
    data: { parentId: parentKavya.id, studentId: studentKavya.id, relationship: "Father" },
  });

  await prisma.consent.create({
    data: {
      parentId: parentKavya.id,
      studentId: studentKavya.id,
      noticeVersion: "v1.0",
      language: "hi",
      purposes: "fee_tracking,academic_progress",
      verifiedPhone: "+91 90000 12348",
      consentedAt: new Date("2026-05-18T10:00:00Z"),
    },
  });

  const planKavya = await prisma.feePlan.create({
    data: {
      studentId: studentKavya.id,
      name: "JEE 2026-27 Standard 4-Instalment Plan",
      serviceStartDate: new Date("2026-06-15T00:00:00Z"),
      serviceEndDate: new Date("2027-03-31T00:00:00Z"),
      totalServiceDays: 290,
      baseAmount: 12000000n,
      netAmount: 12000000n,
      numberOfInstalments: 4,
      status: FeePlanStatus.WITHDRAWN,
    },
  });

  // 4 instalments paid by Kavya
  const kavyaPayments = [];
  for (let seq = 1; seq <= 4; seq++) {
    const dueDate = new Date(`2026-0${5 + seq}-10T00:00:00Z`);
    const inst = await prisma.instalment.create({
      data: {
        feePlanId: planKavya.id,
        sequence: seq,
        dueDate,
        amount: 3000000n,
        status: InstalmentStatus.PAID,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        studentId: studentKavya.id,
        instalmentId: inst.id,
        entryType: LedgerEntryType.CHARGE,
        amount: 3000000n,
        entryDate: dueDate,
        referenceType: "PLAN_CREATION",
      },
    });

    const payment = await prisma.payment.create({
      data: {
        paymentReference: `PAY-KAVYA-${seq}`,
        providerPaymentId: `prov_kavya_${seq}`,
        studentId: studentKavya.id,
        amount: 3000000n,
        unallocatedAmount: 0n,
        paymentDate: dueDate,
        method: "UPI",
        status: PaymentStatus.CAPTURED,
        matchStatus: MatchStatus.MATCHED_AUTOMATIC,
      },
    });
    kavyaPayments.push(payment);

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        instalmentId: inst.id,
        amount: 3000000n,
        allocatedAt: dueDate,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        studentId: studentKavya.id,
        instalmentId: inst.id,
        entryType: LedgerEntryType.ALLOCATION,
        amount: -3000000n,
        entryDate: dueDate,
        referenceType: "PAYMENT",
        referenceId: payment.id,
      },
    });
  }

  // Approved Withdrawal for Kavya
  const withdrawalKavya = await prisma.withdrawal.create({
    data: {
      studentId: studentKavya.id,
      requestDate: new Date("2026-10-25T09:00:00Z"),
      effectiveWithdrawalDate: new Date("2026-10-28T00:00:00Z"),
      consumedDays: 136,
      totalServiceDays: 290,
      netFee: 12000000n,
      totalPaid: 12000000n,
      earnedFee: 5627586n, // ₹56,275.86
      deductionAmount: 0n,
      potentialRefund: 6372414n, // ₹63,724.14
      indicativeShortfall: 0n,
      slaTargetDate: new Date("2026-11-04T00:00:00Z"),
      status: WithdrawalStatus.APPROVED,
      requesterId: accountsUser.id,
      approverId: directorUser.id,
      approvedAt: new Date("2026-10-29T14:00:00Z"),
      approvalNotes: "Approved under MoE 2024 pro-rata refund policy",
    },
  });

  const refundKavya = await prisma.refund.create({
    data: {
      withdrawalId: withdrawalKavya.id,
      studentId: studentKavya.id,
      totalApprovedAmount: 6372414n,
      status: RefundStatus.PROCESSING,
    },
  });

  // 3 refund items: ₹30,000 + ₹30,000 + ₹3,724.14 against payments 4, 3, 2
  await prisma.refundItem.create({
    data: {
      refundId: refundKavya.id,
      paymentId: kavyaPayments[3].id,
      amount: 3000000n,
      status: RefundItemStatus.SUCCEEDED,
      providerRefundId: "rfnd_kavya_item_1",
    },
  });

  await prisma.refundItem.create({
    data: {
      refundId: refundKavya.id,
      paymentId: kavyaPayments[2].id,
      amount: 3000000n,
      status: RefundItemStatus.SUCCEEDED,
      providerRefundId: "rfnd_kavya_item_2",
    },
  });

  await prisma.refundItem.create({
    data: {
      refundId: refundKavya.id,
      paymentId: kavyaPayments[1].id,
      amount: 372414n, // ₹3,724.14
      status: RefundItemStatus.PENDING,
    },
  });

  // =========================================================================
  // FIXTURE: High Risk Student STU-0731 Rohan Saini
  // =========================================================================
  const studentRohan = await prisma.student.create({
    data: {
      studentCode: "STU-0731",
      name: "Rohan Saini",
      centreId: vaishaliNagar.id,
      batchId: batchJeeEveVN.id,
      enrollmentDate: new Date("2026-06-01T00:00:00Z"),
    },
  });

  const evalRohan = await prisma.riskEvaluation.create({
    data: {
      studentId: studentRohan.id,
      evaluatedAt: new Date("2026-11-01T08:00:00Z"),
      overallScore: 72.0,
      riskLevel: RiskLevel.HIGH,
      feeScore: 85.0,
      attendanceScore: 65.0,
      testScore: 60.0,
      sufficientSignals: 2,
      factorsJson: JSON.stringify({
        fee: { overdueDays: 35, outstandingPaise: "3000000", score: 85.0 },
        attendance: { recentPct: 52, baselinePct: 88, dropPct: 36, score: 65.0 },
        testTrend: { recentAvg: 48, priorAvg: 74, dropPct: 26, score: 60.0 },
      }),
    },
  });

  await prisma.riskTask.create({
    data: {
      studentId: studentRohan.id,
      evaluationId: evalRohan.id,
      taskType: "COUNSELLOR_CALL",
      status: RiskTaskStatus.PENDING,
    },
  });

  // =========================================================================
  // FIXTURE: Insufficient Data Student STU-1456 Tanvi Arora
  // =========================================================================
  const studentTanvi = await prisma.student.create({
    data: {
      studentCode: "STU-1456",
      name: "Tanvi Arora",
      centreId: malviyaNagar.id,
      batchId: batchJeeMornMN.id,
      enrollmentDate: new Date("2026-10-15T00:00:00Z"),
    },
  });

  await prisma.riskEvaluation.create({
    data: {
      studentId: studentTanvi.id,
      evaluatedAt: new Date("2026-11-01T08:00:00Z"),
      overallScore: 0.0,
      riskLevel: RiskLevel.INSUFFICIENT_DATA,
      sufficientSignals: 0,
      factorsJson: JSON.stringify({
        note: "Fewer than 2 academic signals with minimum data points",
        fee: { overdueDays: 0, outstandingPaise: "0", score: 0 },
        attendance: { dataPoints: 3, required: 12, status: "INSUFFICIENT" },
        testTrend: { dataPoints: 1, required: 3, status: "INSUFFICIENT" },
      }),
    },
  });

  // =========================================================================
  // UNMATCHED PAYMENT: pay_demo_a91c (₹15,000, "MOHIT G 0219")
  // =========================================================================
  await prisma.payment.create({
    data: {
      paymentReference: "pay_demo_a91c",
      providerPaymentId: "prov_unmatched_a91c",
      amount: 1500000n, // ₹15,000
      unallocatedAmount: 1500000n,
      paymentDate: new Date("2026-11-01T16:45:00Z"),
      method: "NEFT",
      payerDetails: "MOHIT G 0219 / PUNB0123456",
      status: PaymentStatus.CAPTURED,
      matchStatus: MatchStatus.UNMATCHED,
      notes: "Direct bank transfer; potential candidate STU-0219 Mohit Gurjar (score 0.88)",
    },
  });

  console.log("✅ Deterministic Jaipur seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

