export type Gender = "MALE" | "FEMALE";

export type Role =
  | "ROLE_ADMIN"
  | "ROLE_TEACHER"
  | "ROLE_HEAD_TEACHER"
  | "ROLE_STUDENT"
  | "ROLE_PARENT";

export type SubscriptionPlan = "BASIC" | "PREMIUM" | "ENTERPRISE";

// Billing cadence of a school's subscription. Narrower than the `BillingCycle`
// used for service costs further down — these are the only values
// `SubscriptionRequest.cycle` accepts.
export type SubscriptionCycle = "MONTHLY" | "TERMLY" | "YEARLY";

export type SubscriptionStatus =
  | "PENDING_PAYMENT"
  | "TRIAL"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "CANCELLED_SCHEDULED"
  | "CANCELLED"
  | "EXPIRED";

export type SchoolStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export type RelationType =
  | "MOTHER"
  | "FATHER"
  | "STEP_MOTHER"
  | "STEP_FATHER"
  | "GUARDIAN"
  | "UNCLE"
  | "AUNT"
  | "GRANDPARENT"
  | "FOSTER_PARENT"
  | "ADOPTIVE_PARENT";

export type CustodyType =
  | "PRIMARY"
  | "JOINT"
  | "WEEKEND"
  | "SUPERVISED"
  | "NONE";

export type PreferredContactMethod =
  | "PHONE_CALL"
  | "SMS"
  | "EMAIL"
  | "WHATSAPP";

export type Address = {
  country: string;
  region: string;
  city: string;
  street: string;
  digitalAddress: string;
};

// POST /auth/school/register — three independent blocks: the institution, the
// person who will run it, and the plan it starts on.
export type SchoolRegistrationPayload = {
  school: {
    schoolName: string;
    // Must match ^\+233[0-9]{9}$.
    mobileNumber: string;
    email: string;
    address: Address;
  };
  admin: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    email: string;
    mobileNumber: string;
  };
  subscription: {
    plan: SubscriptionPlan;
    cycle: SubscriptionCycle;
    currency: Currency;
    startWithTrial?: boolean;
  };
};

// GET /auth/school/{schoolId}/profile
export type SchoolSubscriptionSummary = {
  subscriptionId: number;
  planName?: string;
  status?: SubscriptionStatus;
  startDate?: string;
  endDate?: string;
};

export type SchoolProfileResponse = {
  schoolId: number;
  schoolName?: string;
  schoolCode?: string;
  mobileNumber?: string;
  email?: string;
  status?: SchoolStatus;
  // Responses may omit any address line, so every part is optional here.
  schoolAddress?: Partial<Address>;
  schoolLogoUrl?: string | null;
  timezone?: string | null;
  currency?: Currency;
  subscriptions?: SchoolSubscriptionSummary[];
  activeSubscription?: SchoolSubscriptionSummary | null;
};

export type LoginPayload = {
  login: string;
  password: string;
};

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  schoolCode?: string;
  user?: AuthenticatedUser;
  [key: string]: unknown;
};

export type AuthenticatedUser = {
  userId?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: Role[];
  schoolCode?: string;
  schoolId?: number;
};

export type StudentPayload = {
  student: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    gender: Gender;
    dateOfBirth: string;
    admissionDate: string;
    address: Address;
    previousSchoolName?: string;
    medicalNotes?: string | null;
    hasSpecialNeeds: boolean;
    specialNeedsDetails?: string | null;
  };
  parents: StudentParentEntry[];
};

export type ParentRelationship = {
  relationType: RelationType;
  isPrimaryContact: boolean;
  hasPickupPermission: boolean;
  hasFinancialResponsibility: boolean;
  emergencyContactOrder: number;
  custodyType: CustodyType;
  custodyNotes?: string | null;
  preferredContactMethods: PreferredContactMethod[];
};

export type ExistingParentPayload = {
  parentId: number;
  relationship: ParentRelationship;
};

export type NewParentPayload = {
  firstName: string;
  lastName: string;
  otherNames?: string;
  email: string;
  mobileNumber: string;
  relationship: ParentRelationship;
};

export type StudentParentEntry = {
  existingParent: ExistingParentPayload | null;
  newParent: NewParentPayload | null;
};

// A parent record returned by the parent lookup/search endpoint.
export type ParentSummary = {
  parentId: number;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  email: string;
  mobileNumber: string;
};

// Spring-style paginated response wrapper.
export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";

export type HeadTeacherPosition =
  | "MAIN"
  | "ASSISTANT"
  | "ACADEMIC"
  | "DOMESTIC";

export type HeadTeacherStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "RETIRED"
  | "ON_LEAVE"
  | "SUSPENDED"
  | "TERMINATED";

export type AdminLevel =
  | "MAIN"
  | "ACADEMIC"
  | "TRANSPORTATION"
  | "FEEDING"
  | "FINANCIAL";

export type AdminStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REVOKED";

export type StaffPersonalDetails = {
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: Gender;
  address: Address;
};

export type TeacherProfileDetails = {
  qualifications: string[];
  employmentType: EmploymentType;
  dateEmployed: string;
};

export type HeadTeacherProfileDetails = {
  position: HeadTeacherPosition;
  qualifications: string[];
  status: HeadTeacherStatus;
  dateAppointed: string;
};

export type AdminProfileDetails = {
  adminLevel: AdminLevel;
  profileStatus: AdminStatus;
  dateAssigned: string;
};

export type StaffProfileDetails =
  | TeacherProfileDetails
  | HeadTeacherProfileDetails
  | AdminProfileDetails;

export type StaffPayload = {
  email: string;
  mobileNumber: string;
  isExistingUser: boolean;
  // Omitted when linking an existing user — the backend resolves them by email.
  personalDetails?: StaffPersonalDetails;
  profileDetails: StaffProfileDetails;
};

// --- Role change (PATCH /auth/users/role-change) ---------------------------

// Roles a user can be moved or added to. Note these are bare role names, not
// the `ROLE_`-prefixed authorities that appear in the JWT.
export type TargetRole =
  | "STUDENT"
  | "PARENT"
  | "TEACHER"
  | "HEADTEACHER"
  | "ADMIN";

// TRANSFER replaces the user's current role; ADD keeps it and grants another.
export type RoleChangeType = "TRANSFER" | "ADD";

// Exactly one of these is filled in, matching `targetRole`.
export type EmploymentProfileDetails = {
  teacherProfile?: TeacherProfileDetails;
  headTeacherProfile?: HeadTeacherProfileDetails;
  adminProfile?: AdminProfileDetails;
};

export type RoleChangePayload = {
  email: string;
  mobileNumber: string;
  targetRole: TargetRole;
  changeType: RoleChangeType;
  profileDetails: EmploymentProfileDetails;
};

// --- User lookup (GET /auth/users/lookup) ----------------------------------
// The API types the page content as a bare object, so every field is optional
// and the UI renders defensively.
export type UserLookupResult = {
  userId?: number;
  publicId?: string;
  firstName?: string;
  lastName?: string;
  otherNames?: string | null;
  fullName?: string;
  email?: string;
  mobileNumber?: string;
  gender?: Gender;
  roles?: string[];
  role?: string;
  status?: string;
  [key: string]: unknown;
};

export type Term = "FIRST_TERM" | "SECOND_TERM" | "THIRD_TERM";

export type AcademicYearRequest = {
  name: string;
  startDate: string;
  endDate: string;
};

export type AcademicTermRequest = {
  academicYearId: number;
  termNumber: Term;
  startDate: string;
  endDate: string;
};

export type AcademicYearTermSummary = {
  academicTermId: number;
  termNumber: Term;
  startDate: string;
  endDate: string;
};

export type AcademicYearResponse = {
  publicId: string;
  // Numeric id used by AcademicTermRequest.academicYearId; not in the sample
  // response, so treat as possibly absent.
  academicYearId?: number;
  schoolId: number;
  schoolName: string;
  name: string;
  startDate: string;
  endDate: string;
  academicTerms: AcademicYearTermSummary[];
  createdById: number;
  createdByName: string;
  createdAt: string;
};

export type AcademicTermResponse = {
  publicId: string;
  schoolId: number;
  schoolName: string;
  academicYearId: number;
  academicYearName: string;
  termNumber: Term;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

export type StudentStatus =
  | "ACTIVE"
  | "GRADUATED"
  | "WITHDRAWN"
  | "ON_LEAVE"
  | "TRANSFERRED"
  | "EXPELLED";

export type RelationshipStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type EmploymentStatus =
  | "EMPLOYED"
  | "SELF_EMPLOYED"
  | "UNEMPLOYED"
  | "RETIRED"
  | "STUDENT";

export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export type TeacherStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ON_LEAVE"
  | "RESIGNED"
  | "TERMINATED";

export type AssignmentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "SUSPENDED";

// Role-specific responses from GET /auth/users/{profileId}/profile.
export type StudentProfile = {
  userId: number;
  studentProfileId: number;
  userProfileImageUrl?: string | null;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  gender: Gender;
  address: Address;
  dateOfBirth: string;
  status: StudentStatus;
  firstAdmissionDate: string;
  currentEnrollment?: {
    currentClassName: string;
    currentAcademicYear: string;
    currentAcademicTerm: string;
    enrollmentDate: string;
  } | null;
  previousSchoolName?: string | null;
  medicalNotes?: string | null;
  hasSpecialNeeds: boolean;
  specialNeedsDetails?: string | null;
  parents: {
    parentId: number;
    firstName: string;
    lastName: string;
    email: string;
    mobileNumber: string;
    relationType: RelationType;
    relationshipStatus: RelationshipStatus;
    isPrimaryContact: boolean;
  }[];
};

export type ParentProfile = {
  userId: number;
  parentProfileId: number;
  userProfileImageUrl?: string | null;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
  employmentStatus: EmploymentStatus;
  verificationStatus: VerificationStatus;
  verifiedAt?: string | null;
  preferredContactMethods: PreferredContactMethod[];
  students: {
    studentId: number;
    admissionNumber: string;
    firstName: string;
    otherNames?: string | null;
    lastName: string;
    status: StudentStatus;
    relationType: RelationType;
    relationshipStatus: RelationshipStatus;
  }[];
};

export type TeacherProfile = {
  userId: number;
  teacherProfileId: number;
  userProfileImageUrl?: string | null;
  staffNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
  qualifications: string[];
  employmentType: EmploymentType;
  dateEmployed: string;
  status: TeacherStatus;
  activeAssignments: {
    id: number;
    subjectName: string;
    className: string;
    termName: Term;
    academicYear: string;
    status: AssignmentStatus;
  }[];
};

export type HeadTeacherProfile = {
  userId: number;
  headTeacherProfileId: number;
  userProfileImageUrl?: string | null;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  academicBio?: string | null;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
  position: string;
  qualifications: string[];
  signatureUrl?: string | null;
  dateAppointed: string;
  status: HeadTeacherStatus;
};

export type AdminProfile = {
  userId: number;
  adminProfileId: number;
  userProfileImageUrl?: string | null;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
  adminLevel: AdminLevel;
  dateAssigned: string;
  status: AdminStatus;
};

// ---------------------------------------------------------------------------
// Billing & collections
// ---------------------------------------------------------------------------

// Note the backend spells the euro code "EURO", not the ISO "EUR".
export type Currency = "GHS" | "USD" | "EURO" | "GBP";

export type ServiceCategory =
  | "SCHOOL_FEES"
  | "EXTRA_CLASSES"
  | "TRANSPORTATION"
  | "FEEDING"
  | "UNIFORM"
  | "BOOKS"
  | "GRADUATION"
  | "EXAMINATION";

export type BillingCycle =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "TERMLY"
  | "ANNUALLY"
  | "ONE_TIME";

// Bill/line-item settlement state (distinct from PaymentStatus below).
export type BillPaymentStatus = "PAID" | "UNPAID" | "PARTIALLY_PAID" | "VOID";

export type BillLineItemSource = "SYSTEM_GENERATED" | "SERVICE_COST" | "MANUAL";

export type ServiceCostStatus = "ACTIVE" | "INACTIVE";

export type FullName = {
  firstName?: string;
  lastName?: string;
  otherNames?: string | null;
};

export type ServiceCostRequest = {
  serviceCostName: string;
  serviceCostDescription?: string;
  // Omit to price the service for every class level.
  classLevelId?: number;
  serviceCategory: ServiceCategory;
  billingCycle: BillingCycle;
  amount: number;
  currency: Currency;
  priorityOrder?: number;
  mandatory?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type ServiceCostResponse = {
  publicId: string;
  schoolId: number;
  schoolName: string;
  classLevelId?: number | null;
  classLevelName?: string | null;
  serviceCostName: string;
  serviceCostDescription?: string | null;
  serviceCategory: ServiceCategory;
  billingCycle: BillingCycle;
  amount: number;
  currency: Currency;
  status: ServiceCostStatus;
  mandatory: boolean;
  priorityOrder?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt?: string;
  createdByName?: string;
  lastModifiedByName?: string | null;
};

export type StudentBillRequest = {
  studentId: number;
  academicTermId: number;
};

export type StudentBillResponse = {
  publicId: string;
  billNumber: string;
  schoolId: number;
  schoolName: string;
  studentId: number;
  studentName: string;
  academicTermId: number;
  academicTermName: string;
  academicYearId: number;
  academicYearName: string;
  issueDate: string;
  dueDate?: string | null;
  currency: Currency;
  totalAmount: number;
  totalDiscount: number;
  totalPaid: number;
  totalBalanceDue: number;
  paymentStatus: BillPaymentStatus;
  billLineItems: BillLineItemResponse[];
  createdById?: number;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
};

export type BillLineItemResponse = {
  billLineItemId: string;
  schoolId: number;
  schoolName: string;
  serviceCostId?: number | null;
  serviceName: string;
  serviceCategory: ServiceCategory;
  billingCycle: BillingCycle;
  currency: Currency;
  studentBillId: number;
  unitCost: number;
  quantity: number;
  totalCost: number;
  amountDue: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: BillPaymentStatus;
  dueDate?: string | null;
  createdById?: number;
  createdByName?: FullName;
  createdAt: string;
};

// Priced from an existing service cost — the amount comes from the price list.
export type AutomaticBillLineItemRequest = {
  serviceCostId: number;
  studentBillId: number;
  quantity: number;
  dueDate?: string;
};

// Ad-hoc charge; requires a reason for the audit trail.
export type ManualBillLineItemRequest = {
  studentBillId: number;
  serviceName: string;
  serviceCategory: ServiceCategory;
  billingCycle: BillingCycle;
  unitCost: number;
  quantity: number;
  currency: Currency;
  manualReason: string;
  dueDate?: string;
};

// Flattened onto the query string, one param per field.
export type BillLineItemFilter = {
  studentBillId?: string;
  studentId?: string;
  paymentStatus?: BillPaymentStatus;
  serviceCategory?: ServiceCategory;
  source?: BillLineItemSource;
  dueDateFrom?: string;
  dueDateTo?: string;
};

export type PaymentMethod =
  | "CASH"
  | "MOBILE_MONEY"
  | "CARD_PAYMENT"
  | "CHEQUE"
  | "BANK_TRANSFER";

export type PaymentChannel =
  | "CASH_OFFICE"
  | "MTN_MOMO"
  | "VODAFONE_CASH"
  | "AIRTEL_TIGO_MONEY"
  | "BANK"
  | "CHEQUE"
  | "PAYSTACK"
  | "OTHER";

export type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SUCCESSFUL"
  | "FAILED"
  | "REVERSED";

export type AllocationStatus = "APPLIED" | "REVERSED" | "ADJUSTED";

export type PaymentRequest = {
  schoolId: number;
  studentId: number;
  parentId?: number;
  payeeName?: string;
  payeeRelationship?: string;
  payeeContact?: string;
  // Omit to let the backend allocate across the student's outstanding bills.
  studentBillId?: number;
  // Required in practice for cash taken at the counter: ties the payment to
  // the cashier's open till so the session reconciles.
  cashCollectionSessionId?: number;
  schoolPaymentAccountId?: number;
  paymentConfigurationId?: number;
  cashAmount: number;
  allowOverpayment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentChannel?: PaymentChannel;
  notes?: string;
  paidAt?: string;
};

export type PaymentAllocationResponse = {
  id: number;
  billLineItemId: number;
  serviceName: string;
  serviceCategory: ServiceCategory;
  allocatedAmount: number;
  lineItemBalanceBefore: number;
  lineItemBalanceAfter: number;
  allocationStatus: AllocationStatus;
  allocationOrder: number;
};

export type PaymentResponse = {
  publicId: string;
  schoolId: number;
  schoolName: string;
  studentId: number;
  studentFullName: string;
  parentId?: number | null;
  parentFullName?: string | null;
  studentBillId?: number | null;
  cashCollectionSessionId?: number | null;
  schoolPaymentAccountId?: number | null;
  paymentConfigurationId?: number | null;
  transactionReference: string;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentChannel: PaymentChannel;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  paidAt: string;
  confirmedAt?: string | null;
  createdById?: number;
  createdByFullName?: string;
  receiptId?: number | null;
  receiptNumber?: string | null;
  paymentAllocations: PaymentAllocationResponse[];
  createdAt: string;
  updatedAt?: string;
};

// The spec types this as a plain string; these are the values the backend
// emits over a session's lifecycle.
export type CashSessionStatus =
  | "OPEN"
  | "CLOSED"
  | "APPROVED"
  | "PENDING_APPROVAL";

export type OpenSessionRequest = {
  schoolId: number;
  cashierId: number;
  openingFloatingAmount: number;
  remarks?: string;
};

export type CloseSessionRequest = {
  closedById?: number;
  actualCashCounted: number;
  // Required by the backend whenever the count doesn't match expectations.
  varianceReason?: string;
  remarks?: string;
};

export type ApproveSessionRequest = {
  approvedById: number;
};

export type CashSessionResponse = {
  publicId: string;
  sessionNumber: string;
  status: CashSessionStatus;
  cashierId: number;
  cashierName: string;
  openingFloatingAmount: number;
  expectedCashAmount: number;
  expectedNonCashAmount: number;
  actualCashCounted?: number | null;
  varianceAmount?: number | null;
  varianceReason?: string | null;
  openedAt: string;
  closedAt?: string | null;
  approvedAt?: string | null;
  paymentCount: number;
  remarks?: string | null;
};

export type DiscountName =
  | "STAFF_CHILDREN"
  | "MULTIPLE_SIBLING"
  | "SCHOLARSHIP"
  | "PROMOTIONAL"
  | "MANUAL";

export type DiscountType = "FIXED" | "PERCENTAGE";

// MANUAL discounts have no automatic rule, so rules exclude it.
export type DiscountRuleType = Exclude<DiscountName, "MANUAL">;

export type DiscountRequest = {
  name: DiscountName;
  discountType: DiscountType;
  // Percentage points for PERCENTAGE, currency amount for FIXED.
  value: number;
  maxAmount?: number;
  active?: boolean;
  reason?: string;
};

export type DiscountResponse = {
  publicId: string;
  schoolId: number;
  schoolName: string;
  discountName: string;
  discountType: string;
  value: number;
  maxAmount?: number | null;
  active: boolean;
  reason?: string | null;
  createdAt: string;
};

export type DiscountRuleRequest = {
  discountId: number;
  ruleType: DiscountRuleType;
  priority?: number;
  active?: boolean;
  reason?: string;
  // STAFF_CHILDREN
  directChildrenOnly?: boolean;
  requireActiveStaff?: boolean;
  // MULTIPLE_SIBLING (minimum 2)
  multiSiblingCount?: number;
  // SCHOLARSHIP
  minAcademicScore?: number;
  requiresFinancialNeedAssessment?: boolean;
  maxHouseholdIncome?: number;
  // PROMOTIONAL
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
};

export type DiscountRuleResponse = {
  publicId: string;
  schoolId: number;
  schoolName: string;
  discountId: number;
  discountName: string;
  ruleType: DiscountRuleType;
  priority?: number;
  active: boolean;
  reason?: string | null;
  directChildrenOnly?: boolean;
  requireActiveStaff?: boolean;
  // Request sends `multiSiblingCount`; the response echoes it back as this.
  minSiblingCount?: number | null;
  minAcademicScore?: number | null;
  requiresFinancialNeedAssessment?: boolean;
  maxHouseholdIncome?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  redemptionCount?: number;
  createdAt: string;
};

export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};
