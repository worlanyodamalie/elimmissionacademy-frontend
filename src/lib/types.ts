export type Gender = "MALE" | "FEMALE";

export type Role =
  | "ROLE_ADMIN"
  | "ROLE_TEACHER"
  | "ROLE_HEAD_TEACHER"
  | "ROLE_STUDENT"
  | "ROLE_PARENT";

export type SubscriptionPlan = "BASIC" | "STANDARD" | "PREMIUM";

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

export type SchoolRegistrationPayload = {
  school: {
    schoolName: string;
    mobileNumber: string;
    email: string;
    subscriptionPlan: SubscriptionPlan;
    currency: string;
    address: Address;
  };
  admin: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    email: string;
    mobileNumber: string;
  };
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

export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};
