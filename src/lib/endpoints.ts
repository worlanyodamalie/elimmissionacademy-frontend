// Single source of truth for backend endpoints used by the dashboard.
// All callers should import from here so renames or environment changes are
// trivial. Paths are relative to NEXT_PUBLIC_BACKEND_API_BASE_URL.
//
// Documentation for the full URL surface (app routes + API endpoints) lives at
// `docs/URLS.md`.

export const AUTH = {
  registerSchool: "/auth/school/register",
  adminAccountSetup: "/auth/school/admin/setup",
  login: "/auth/login",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
} as const;

export const USERS = {
  students: "/auth/users/students",
  parentsLookup: "/auth/users/parents/lookup",
  teachers: "/auth/users/teachers",
  headTeachers: "/auth/users/head-teachers",
  admins: "/auth/users/admins",
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
  academics: "/dashboard/academics",
  billing: "/dashboard/billing",
  bill: (publicId: string) => `/dashboard/billing/bills/${publicId}`,
  serviceCosts: "/dashboard/billing/service-costs",
  charges: "/dashboard/billing/charges",
  overdue: "/dashboard/billing/overdue",
  discounts: "/dashboard/billing/discounts",
  collections: "/dashboard/collections",
} as const;
