export type Gender = "MALE" | "FEMALE";

export type Role =
  | "ROLE_ADMIN"
  | "ROLE_TEACHER"
  | "ROLE_HEAD_TEACHER"
  | "ROLE_STUDENT"
  | "ROLE_PARENT";

export type SubscriptionPlan = "BASIC" | "STANDARD" | "PREMIUM";

export type RelationType =
  | "FATHER"
  | "MOTHER"
  | "GUARDIAN"
  | "OTHER";

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
    address: Address;
    previousSchoolName?: string;
    hasSpecialNeeds: boolean;
    specialNeedsDetails?: string | null;
  };
  parents: ParentPayload[];
};

export type ParentPayload = {
  firstName: string;
  lastName: string;
  otherNames?: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
  relationType: RelationType;
  isPrimaryContact: boolean;
  hasPickupPermission: boolean;
};

export type StaffPayload = {
  firstName: string;
  lastName: string;
  otherNames?: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  address: Address;
};

export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};
