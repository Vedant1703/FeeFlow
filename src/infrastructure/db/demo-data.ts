/**
 * In-memory Demo Data Store for FeeFlow.
 * Provides resilient fallback fixtures when running in DEMO_MODE or when local PostgreSQL is not active.
 */

export interface DemoParent {
  id: string;
  name: string;
  phone: string;
  preferredLanguage: string;
  students: {
    studentId: string;
    studentCode: string;
    name: string;
    hasConsent: boolean;
  }[];
}

export interface DemoStaffUser {
  id: string;
  email: string;
  name: string;
  role: "ACCOUNTS" | "COUNSELLOR" | "DIRECTOR";
  passwordHash: string;
  centreIds: string[];
}

export const DEMO_STAFF_USERS: DemoStaffUser[] = [
  {
    id: "usr_dir_arvind",
    email: "arvind.mathur@demo.companya.test",
    name: "Arvind Mathur (Founder-Director)",
    role: "DIRECTOR",
    passwordHash: "DemoPassword123!",
    centreIds: ["cen_mn", "cen_vn", "cen_ms", "cen_tr"],
  },
  {
    id: "usr_acc_neha",
    email: "neha.verma@demo.companya.test",
    name: "Neha Verma (Accounts Executive)",
    role: "ACCOUNTS",
    passwordHash: "DemoPassword123!",
    centreIds: ["cen_vn", "cen_mn"],
  },
  {
    id: "usr_cou_pooja",
    email: "pooja.rawat@demo.companya.test",
    name: "Pooja Rawat (Student Counsellor)",
    role: "COUNSELLOR",
    passwordHash: "DemoPassword123!",
    centreIds: ["cen_vn"],
  },
];

export const DEMO_PARENTS: DemoParent[] = [
  {
    id: "par_rakesh_sharma",
    name: "Rakesh Sharma",
    phone: "+919000012345",
    preferredLanguage: "hi",
    students: [
      {
        studentId: "stu_ishita_0587",
        studentCode: "STU-0587",
        name: "Ishita Sharma",
        hasConsent: true,
      },
      {
        studentId: "stu_kabir_0588",
        studentCode: "STU-0588",
        name: "Kabir Sharma",
        hasConsent: true,
      },
    ],
  },
  {
    id: "par_rajesh_meena",
    name: "Rajesh Meena",
    phone: "+919000012341",
    preferredLanguage: "hi",
    students: [
      {
        studentId: "stu_aarav_0412",
        studentCode: "STU-0412",
        name: "Aarav Meena",
        hasConsent: true,
      },
    ],
  },
  {
    id: "par_suresh_gurjar",
    name: "Suresh Gurjar",
    phone: "+919000012342",
    preferredLanguage: "en",
    students: [
      {
        studentId: "stu_mohit_0219",
        studentCode: "STU-0219",
        name: "Mohit Gurjar",
        hasConsent: true,
      },
    ],
  },
  {
    id: "par_vikram_rathore",
    name: "Vikram Rathore",
    phone: "+919000012348",
    preferredLanguage: "en",
    students: [
      {
        studentId: "stu_kavya_1038",
        studentCode: "STU-1038",
        name: "Kavya Rathore",
        hasConsent: true,
      },
    ],
  },
];

export function findDemoParentByPhone(phone: string): DemoParent | null {
  const clean = phone.replace(/[^\d+]/g, "");
  const last10 = clean.slice(-10);

  return (
    DEMO_PARENTS.find((p) => {
      const pClean = p.phone.replace(/[^\d+]/g, "");
      return pClean === clean || pClean.slice(-10) === last10;
    }) || null
  );
}

export function findDemoUserByEmail(email: string): DemoStaffUser | null {
  const normalized = email.toLowerCase().trim();
  return DEMO_STAFF_USERS.find((u) => u.email.toLowerCase() === normalized) || null;
}

