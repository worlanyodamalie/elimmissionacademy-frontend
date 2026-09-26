// Single source of truth for backend endpoints used by the dashboard.
// All callers should import from here so renames or environment changes are
// trivial. Paths are relative to NEXT_PUBLIC_BACKEND_API_BASE_URL.
//
// Documentation for the full URL surface (app routes + API endpoints) lives at
// `docs/URLS.md`.

export const AUTH = {
  registerSchool: "/auth/school/register",
  adminAccountSetup: "/auth/school/admin/setup",
  // School users sign in here; the system-admin console has its own endpoint.
  login: "/auth/users/login",
  systemAdminLogin: "/auth/system-admin/login",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  // Takes the school's public UUID, not the numeric `schoolId` that appears
  // inside the profile response.
  schoolProfile: (schoolPublicId: string) =>
    `/auth/school/${schoolPublicId}/profile`,
} as const;

export const USERS = {
  students: "/auth/users/students",
  parentsLookup: "/auth/users/parents/lookup",
  // Active students of the current school. Returns a bare array (no page
  // wrapper) of `StudentSearchResult`, which carries both id flavours the
  // billing endpoints need.
  studentsLookup: "/auth/users/students/lookup",
  // Searches every user in the current school (staff, parents, students).
  lookup: "/auth/users/lookup",
  teachers: "/auth/users/teachers",
  headTeachers: "/auth/users/head-teachers",
  admins: "/auth/users/admins",
  // Moves a user to another role, or adds a second role alongside the current
  // one (PATCH).
  roleChange: "/auth/users/role-change",
  setupPassword: "/auth/users/setup-password",
  resendOnboarding: "/auth/users/resend-onboarding",
  // Role-specific profile (student/parent/teacher/head-teacher/admin).
  // Takes the profile's public UUID, not the numeric *ProfileId fields that
  // appear inside profile responses. Response shape depends on the role.
  profile: (profilePublicId: string) => `/auth/users/${profilePublicId}/profile`,
} as const;

export const ACADEMICS = {
  years: "/school/academics/years",
  year: (publicId: string) => `/school/academics/years/${publicId}`,
  terms: "/school/academics/terms",
  term: (publicId: string) => `/school/academics/terms/${publicId}`,
} as const;

// Academic management: the classes a school teaches, the streams inside them,
// and which class each student sits in for a given year.
export const CLASSES = {
  classLevels: "/school/academics/class_levels",
  // Takes the class level's public UUID, not the numeric `classLevelId` that
  // the list and create responses carry. Only the lookup hands out the UUID.
  classLevel: (classLevelPublicId: string) =>
    `/school/academics/class_levels/${classLevelPublicId}`,
  // Search-as-you-type over class levels. The only response that carries both
  // the numeric id (for enrolment bodies) and the UUID (for the paths above).
  classLevelsLookup: "/school/academics/class_levels/lookup",
  // Active students of a class level, grouped by stream.
  classLevelStudents: (classLevelPublicId: string) =>
    `/school/academics/class_levels/${classLevelPublicId}/students`,
  enrolments: "/school/academics/enrolments",
  // Takes the student's profile UUID (`profilePublicId` from the lookup).
  studentEnrolment: (studentPublicId: string) =>
    `/school/academics/enrolments/student/${studentPublicId}/enrolment`,
} as const;

// Billing: service costs (the price list), student bills (per term) and the
// bill line items that make up a bill.
export const BILLING = {
  serviceCosts: "/school/payments/service-costs",
  serviceCost: (publicId: string) =>
    `/school/payments/service-costs/${publicId}`,
  studentBills: "/school/payments/student-bills",
  studentBill: (publicId: string) =>
    `/school/payments/student-bills/${publicId}`,
  carryForwardArrears: "/school/payments/student-bills/arrears/carry-forward",
  billLineItems: "/school/payments/bill-line-items",
  billLineItem: (publicId: string) =>
    `/school/payments/bill-line-items/${publicId}`,
  // Two ways to add a line item: priced from a service cost, or ad-hoc.
  billLineItemFromServiceCost: "/school/payments/bill-line-items/service-cost",
  manualBillLineItem: "/school/payments/bill-line-items/manual",
} as const;

// Collections: money coming in. A cash session is the cashier's till for a
// shift; cash payments reference the open session they were taken in.
export const COLLECTIONS = {
  payments: "/school/payments",
  cashSessions: "/school/cash-sessions",
  cashSession: (publicId: string) => `/school/cash-sessions/${publicId}`,
  closeCashSession: (publicId: string) =>
    `/school/cash-sessions/${publicId}/close`,
  approveCashSession: (publicId: string) =>
    `/school/cash-sessions/${publicId}/approve`,
} as const;

// Discounts reduce what a bill charges; rules decide who qualifies.
export const DISCOUNTS = {
  discounts: "/school/discounts",
  rules: "/school/discounts/rules",
} as const;

// App routes (used by Link / router.push). Keeping them here lets us refactor
// route folders without grepping for stringly-typed paths.
export const ROUTES = {
  home: "/",
  login: "/login",
  registerSchool: "/register-school",
  adminSetup: "/admin-setup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  setupPassword: "/setup-password",
  dashboard: "/dashboard",
  students: "/dashboard/students",
  newStudent: "/dashboard/students/new",
  teachers: "/dashboard/teachers",
  newTeacher: "/dashboard/teachers/new",
  headTeachers: "/dashboard/head-teachers",
  newHeadTeacher: "/dashboard/head-teachers/new",
  admins: "/dashboard/admins",
  newAdmin: "/dashboard/admins/new",
  directory: "/dashboard/directory",
  roleChange: "/dashboard/directory/role-change",
  school: "/dashboard/school",
  academics: "/dashboard/academics",
  classes: "/dashboard/academics/classes",
  classLevel: (classLevelPublicId: string) =>
    `/dashboard/academics/classes/${classLevelPublicId}`,
  enrolments: "/dashboard/academics/enrolments",
  // `student` pre-fills the student search on the enrolment form — how student
  // onboarding hands off to enrolment.
  enrolStudent: (query?: string) =>
    query
      ? `/dashboard/academics/enrolments?student=${encodeURIComponent(query)}`
      : "/dashboard/academics/enrolments",
  billing: "/dashboard/billing",
  bill: (publicId: string) => `/dashboard/billing/bills/${publicId}`,
  serviceCosts: "/dashboard/billing/service-costs",
  charges: "/dashboard/billing/charges",
  overdue: "/dashboard/billing/overdue",
  discounts: "/dashboard/billing/discounts",
  collections: "/dashboard/collections",
} as const;
