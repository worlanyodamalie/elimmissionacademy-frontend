// Select options for the billing/collections forms. Kept next to the types so
// a new backend enum value is a one-line change in one place.

import type {
  BillingCycle,
  BillLineItemSource,
  BillPaymentStatus,
  Currency,
  DiscountName,
  DiscountRuleType,
  DiscountType,
  PaymentChannel,
  PaymentMethod,
  ServiceCategory,
} from "./types";

export type Option<T extends string> = { value: T; label: string };

export const SERVICE_CATEGORIES: Option<ServiceCategory>[] = [
  { value: "SCHOOL_FEES", label: "School fees" },
  { value: "EXTRA_CLASSES", label: "Extra classes" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "FEEDING", label: "Feeding" },
  { value: "UNIFORM", label: "Uniform" },
  { value: "BOOKS", label: "Books" },
  { value: "GRADUATION", label: "Graduation" },
  { value: "EXAMINATION", label: "Examination" },
];

export const BILLING_CYCLES: Option<BillingCycle>[] = [
  { value: "TERMLY", label: "Per term" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "DAILY", label: "Daily" },
  { value: "ANNUALLY", label: "Annually" },
  { value: "ONE_TIME", label: "One-time" },
];

export const CURRENCIES: Option<Currency>[] = [
  { value: "GHS", label: "GHS — Ghana cedi" },
  { value: "USD", label: "USD — US dollar" },
  { value: "EURO", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound sterling" },
];

export const BILL_PAYMENT_STATUSES: Option<BillPaymentStatus>[] = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

export const LINE_ITEM_SOURCES: Option<BillLineItemSource>[] = [
  { value: "SYSTEM_GENERATED", label: "System generated" },
  { value: "SERVICE_COST", label: "From price list" },
  { value: "MANUAL", label: "Manual charge" },
];

export const PAYMENT_METHODS: Option<PaymentMethod>[] = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
  { value: "CARD_PAYMENT", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

export const PAYMENT_CHANNELS: Option<PaymentChannel>[] = [
  { value: "CASH_OFFICE", label: "Cash office" },
  { value: "MTN_MOMO", label: "MTN MoMo" },
  { value: "VODAFONE_CASH", label: "Vodafone Cash" },
  { value: "AIRTEL_TIGO_MONEY", label: "AirtelTigo Money" },
  { value: "BANK", label: "Bank" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "PAYSTACK", label: "Paystack" },
  { value: "OTHER", label: "Other" },
];

// Channels that make sense for each method, so the two selects can't disagree.
export const CHANNELS_BY_METHOD: Record<PaymentMethod, PaymentChannel[]> = {
  CASH: ["CASH_OFFICE", "OTHER"],
  MOBILE_MONEY: ["MTN_MOMO", "VODAFONE_CASH", "AIRTEL_TIGO_MONEY", "OTHER"],
  CARD_PAYMENT: ["PAYSTACK", "BANK", "OTHER"],
  CHEQUE: ["CHEQUE", "BANK", "OTHER"],
  BANK_TRANSFER: ["BANK", "OTHER"],
};

export const DISCOUNT_NAMES: Option<DiscountName>[] = [
  { value: "STAFF_CHILDREN", label: "Staff children" },
  { value: "MULTIPLE_SIBLING", label: "Multiple siblings" },
  { value: "SCHOLARSHIP", label: "Scholarship" },
  { value: "PROMOTIONAL", label: "Promotional" },
  { value: "MANUAL", label: "Manual (case by case)" },
];

export const DISCOUNT_TYPES: Option<DiscountType>[] = [
  { value: "PERCENTAGE", label: "Percentage of the bill" },
  { value: "FIXED", label: "Fixed amount off" },
];

export const DISCOUNT_RULE_TYPES: Option<DiscountRuleType>[] = [
  { value: "STAFF_CHILDREN", label: "Staff children" },
  { value: "MULTIPLE_SIBLING", label: "Multiple siblings" },
  { value: "SCHOLARSHIP", label: "Scholarship" },
  { value: "PROMOTIONAL", label: "Promotional" },
];
