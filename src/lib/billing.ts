// Typed wrappers over the billing, collections and discount endpoints.
//
// Two id conventions are in play, per the backend's design:
//   - path params take a resource's public UUID (`publicId`)
//   - request bodies reference other resources by their numeric id
// The types mirror that, so a UUID never silently lands in a numeric field.

import { apiRequest } from "./api";
import { BILLING, COLLECTIONS, DISCOUNTS } from "./endpoints";
import type {
  ApproveSessionRequest,
  AutomaticBillLineItemRequest,
  BillLineItemFilter,
  BillLineItemResponse,
  CashSessionResponse,
  CloseSessionRequest,
  DiscountRequest,
  DiscountResponse,
  DiscountRuleRequest,
  DiscountRuleResponse,
  ManualBillLineItemRequest,
  OpenSessionRequest,
  PageResponse,
  PaymentRequest,
  PaymentResponse,
  ServiceCostRequest,
  ServiceCostResponse,
  StudentBillRequest,
  StudentBillResponse,
} from "./types";

export type PageParams = {
  page?: number;
  size?: number;
  // Spring syntax, e.g. "createdAt,desc". Repeated for multi-column sorts.
  sort?: string | string[];
};

type Query = Record<string, string | string[] | undefined>;

function pageQuery({ page, size, sort }: PageParams = {}): Query {
  return {
    page: page === undefined ? undefined : String(page),
    size: size === undefined ? undefined : String(size),
    sort,
  };
}

// Some list endpoints return a bare array instead of a page wrapper; normalize
// so callers only handle one shape.
function toPage<T>(data: PageResponse<T> | T[]): PageResponse<T> {
  if (Array.isArray(data)) {
    return {
      content: data,
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: data.length,
    };
  }
  return { ...data, content: data.content ?? [] };
}

// --- Service costs (the school's price list) -------------------------------

export async function listServiceCosts(
  params?: PageParams,
  signal?: AbortSignal,
): Promise<PageResponse<ServiceCostResponse>> {
  return toPage(
    await apiRequest<
      PageResponse<ServiceCostResponse> | ServiceCostResponse[]
    >(BILLING.serviceCosts, { query: pageQuery(params), signal }),
  );
}

export function getServiceCost(
  serviceCostPublicId: string,
  signal?: AbortSignal,
): Promise<ServiceCostResponse> {
  return apiRequest<ServiceCostResponse>(
    BILLING.serviceCost(serviceCostPublicId),
    { signal },
  );
}

export function createServiceCost(
  body: ServiceCostRequest,
  signal?: AbortSignal,
): Promise<ServiceCostResponse> {
  return apiRequest<ServiceCostResponse>(BILLING.serviceCosts, {
    method: "POST",
    body,
    signal,
  });
}

// --- Student bills --------------------------------------------------------

export async function listStudentBills(
  params?: PageParams,
  signal?: AbortSignal,
): Promise<PageResponse<StudentBillResponse>> {
  return toPage(
    await apiRequest<
      PageResponse<StudentBillResponse> | StudentBillResponse[]
    >(BILLING.studentBills, { query: pageQuery(params), signal }),
  );
}

export function getStudentBill(
  studentBillPublicId: string,
  signal?: AbortSignal,
): Promise<StudentBillResponse> {
  return apiRequest<StudentBillResponse>(
    BILLING.studentBill(studentBillPublicId),
    { signal },
  );
}

// Opens a bill for one student in one term; the backend applies mandatory
// service costs and eligible discounts.
export function createStudentBill(
  body: StudentBillRequest,
  signal?: AbortSignal,
): Promise<StudentBillResponse> {
  return apiRequest<StudentBillResponse>(BILLING.studentBills, {
    method: "POST",
    body,
    signal,
  });
}

// Moves a student's unpaid balance from a finished term onto the new one.
// All three ids are public UUIDs passed as query params.
export function carryForwardArrears(
  args: { studentId: string; previousTermId: string; newTermId: string },
  signal?: AbortSignal,
): Promise<void> {
  return apiRequest<void>(BILLING.carryForwardArrears, {
    method: "POST",
    query: {
      studentId: args.studentId,
      previousTermId: args.previousTermId,
      newTermId: args.newTermId,
    },
    signal,
  });
}

// --- Bill line items ------------------------------------------------------

export async function listBillLineItems(
  filter?: BillLineItemFilter,
  params?: PageParams,
  signal?: AbortSignal,
): Promise<PageResponse<BillLineItemResponse>> {
  return toPage(
    await apiRequest<
      PageResponse<BillLineItemResponse> | BillLineItemResponse[]
    >(BILLING.billLineItems, {
      query: { ...(filter as Query | undefined), ...pageQuery(params) },
      signal,
    }),
  );
}

export function getBillLineItem(
  lineItemPublicId: string,
  signal?: AbortSignal,
): Promise<BillLineItemResponse> {
  return apiRequest<BillLineItemResponse>(
    BILLING.billLineItem(lineItemPublicId),
    { signal },
  );
}

// Adds a charge priced from the service-cost list.
export function addBillLineItemFromServiceCost(
  body: AutomaticBillLineItemRequest,
  signal?: AbortSignal,
): Promise<BillLineItemResponse> {
  return apiRequest<BillLineItemResponse>(
    BILLING.billLineItemFromServiceCost,
    { method: "POST", body, signal },
  );
}

// Adds an ad-hoc charge that isn't on the price list.
export function addManualBillLineItem(
  body: ManualBillLineItemRequest,
  signal?: AbortSignal,
): Promise<BillLineItemResponse> {
  return apiRequest<BillLineItemResponse>(BILLING.manualBillLineItem, {
    method: "POST",
    body,
    signal,
  });
}

// --- Collections: payments ------------------------------------------------

// Records money received and allocates it across the student's line items.
// For cash at the counter, pass the open session's numeric
// `cashCollectionSessionId` so the till reconciles at close.
export function createPayment(
  body: PaymentRequest,
  signal?: AbortSignal,
): Promise<PaymentResponse> {
  return apiRequest<PaymentResponse>(COLLECTIONS.payments, {
    method: "POST",
    body,
    signal,
  });
}

// --- Collections: cash sessions -------------------------------------------

// Opens a cashier's till for a shift. 409 if that cashier already has one open.
export function openCashSession(
  body: OpenSessionRequest,
  signal?: AbortSignal,
): Promise<CashSessionResponse> {
  return apiRequest<CashSessionResponse>(COLLECTIONS.cashSessions, {
    method: "POST",
    body,
    signal,
  });
}

export function getCashSession(
  cashSessionPublicId: string,
  signal?: AbortSignal,
): Promise<CashSessionResponse> {
  return apiRequest<CashSessionResponse>(
    COLLECTIONS.cashSession(cashSessionPublicId),
    { signal },
  );
}

// Closes the till against a physical cash count. The backend computes the
// variance from what the session's payments say it should hold.
export function closeCashSession(
  cashSessionPublicId: string,
  body: CloseSessionRequest,
  signal?: AbortSignal,
): Promise<CashSessionResponse> {
  return apiRequest<CashSessionResponse>(
    COLLECTIONS.closeCashSession(cashSessionPublicId),
    { method: "POST", body, signal },
  );
}

// Supervisor sign-off on a closed session. 403 if the approver lacks the role.
export function approveCashSession(
  cashSessionPublicId: string,
  body: ApproveSessionRequest,
  signal?: AbortSignal,
): Promise<CashSessionResponse> {
  return apiRequest<CashSessionResponse>(
    COLLECTIONS.approveCashSession(cashSessionPublicId),
    { method: "POST", body, signal },
  );
}

// --- Discounts ------------------------------------------------------------

export function createDiscount(
  body: DiscountRequest,
  signal?: AbortSignal,
): Promise<DiscountResponse> {
  return apiRequest<DiscountResponse>(DISCOUNTS.discounts, {
    method: "POST",
    body,
    signal,
  });
}

// Attaches eligibility criteria to a discount so it applies automatically.
export function createDiscountRule(
  body: DiscountRuleRequest,
  signal?: AbortSignal,
): Promise<DiscountRuleResponse> {
  return apiRequest<DiscountRuleResponse>(DISCOUNTS.rules, {
    method: "POST",
    body,
    signal,
  });
}
