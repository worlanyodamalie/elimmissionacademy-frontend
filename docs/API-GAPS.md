# API gaps — billing & collections

Written while building the billing and collections UI against
`/api/v1/school/payments`, `/api/v1/school/cash-sessions` and
`/api/v1/school/discounts`. Everything below is something the frontend wanted
and the API doesn't currently offer. Ordered by how much it costs the UI.

Source of truth for the current surface: the backend's own
`/v3/api-docs`. Frontend wrappers: `src/lib/billing.ts`.

---

## 1. Numeric ids are required in requests but never returned — blocking

Every response identifies a resource by a UUID (`publicId`, `billLineItemId`),
but request bodies reference other resources by **numeric** id. There is no
endpoint that maps one to the other, so several forms can't be built as pickers
and ask the user to type a raw database id.

| Request field                          | Endpoint                                  | Where the numeric id would come from |
| -------------------------------------- | ----------------------------------------- | ------------------------------------ |
| `serviceCostId`                        | `POST /payments/bill-line-items/service-cost` | Nothing — `ServiceCostResponse` has only `publicId` |
| `studentBillId`                        | `POST /payments/bill-line-items/*`, `POST /payments` | Only readable off an existing `BillLineItemResponse`; a bill with no charges yet exposes nothing |
| `discountId`                           | `POST /discounts/rules`                   | Nothing — `DiscountResponse` has only `publicId` |
| `cashCollectionSessionId`              | `POST /payments`                          | Nothing — `SessionResponse` has only `publicId` |
| `studentId`, `academicTermId`, `classLevelId`, `cashierId`, `approvedById` | various | Not exposed by any list endpoint the dashboard can reach |

**Ask:** either include the numeric id in each response (e.g. `serviceCostId`,
`studentBillId`, `discountId`, `cashSessionId`), or accept the public UUID in
request bodies. Either one removes every "type the numeric id" field in the UI.

## 1b. `BillLineItemResponse` doesn't say who owes the money — blocking

The response carries `studentBillId` (numeric) and `schoolName`, but no
`studentId`, no `studentName`, and no bill `publicId`. So the overdue worklist at
`/dashboard/billing/overdue` can list *what* is overdue and *how* overdue, but
cannot name the student to call — the one thing the person working the list
needs. It also can't link a row to the bill, because the bill's UUID (what
`GET /payments/student-bills/{studentBillId}` expects in the path) isn't there.

**Ask:** add `studentId` (UUID), `studentName`, and the bill's `publicId` to
`BillLineItemResponse`. Three fields turn the worklist from informational into
actionable.

## 1c. No sums on filtered queries

`Page` returns `totalElements` — a count — and nothing else. There is no way to
ask "what is the total balance of these filtered charges?" without downloading
every page and adding it up in the browser.

The aging row on the overdue page therefore shows **counts** (one `size=1`
request per bucket, reading `totalElements`), clearly labelled as such, because
counts are the only aggregate the API can produce cheaply. Amounts are shown
per row and never totalled across pages, since any such total would silently
describe only the loaded page.

**Ask:** either a `summary` object on the page response (`totalAmountDue`,
`totalAmountPaid`, `totalBalanceDue` for the whole filtered set), or a dedicated
`GET /school/payments/summary` — see §7.

## 2. Missing list endpoints

Creating works; finding what was created often doesn't.

| Missing                                     | What the UI can't do today |
| ------------------------------------------- | -------------------------- |
| `GET /cash-sessions` (filter by status, cashier, date) | Show which tills are open. The page currently remembers session UUIDs in `localStorage` (`src/lib/cash-session-store.ts`) — a per-device workaround that loses sessions opened elsewhere. |
| `GET /payments` (filter by student, bill, session, date range) | No payment history, no daily collections report, no receipt reprint, no "payments in this session" list for close-of-day reconciliation. |
| `GET /discounts` and `GET /discounts/rules`  | The discounts page can only list what the current visit created. |
| A student list/search (`GET /auth/users/students`) | No student picker anywhere — bills, payments and charge filters all need a typed id. Parents have `parentsLookup`; students have nothing equivalent. |
| `GET` class levels                           | `ServiceCostRequest.classLevelId` can't be a dropdown. |

## 3. No filters on `GET /payments/student-bills`

Only `pageable`. There's no way to fetch one student's bills, a term's bills, or
just the unpaid ones — which is exactly what a bursar's screen needs. Bill line
items already have a good filter object (`BillLineItemFilterRequest`); student
bills want the same treatment (`studentId`, `academicTermId`, `paymentStatus`,
`billNumber`).

## 4. No update, void or reversal anywhere

Every billing endpoint is create-or-read. In practice a school needs to correct
mistakes:

- Change or retire a service cost when fees change (currently: no `PUT`/`PATCH`,
  no deactivate — `status: ACTIVE|INACTIVE` exists on the response but nothing
  can set it).
- Void a bill line item added in error (`VOID` is a valid `paymentStatus`, but
  no endpoint produces it).
- Reverse a payment (`PaymentStatus.REVERSED` exists, no endpoint reaches it).
- Deactivate a discount or a rule (`active` is settable at create only).

Without these, the only fix for a mistyped charge is a database edit.

## 5. Cash session details

- `SessionResponse.status` is typed as a plain `string`. The UI needs the enum
  documented (the frontend currently assumes
  `OPEN | CLOSED | PENDING_APPROVAL | APPROVED`). Please confirm or correct.
- Close returns totals but there's no breakdown of the payments that make up
  `expectedCashAmount`, so the close-of-day screen can't show the cashier what
  they're counting against.
- No endpoint to reopen or amend a session closed with a wrong count.

## 6. Inconsistencies worth fixing while you're in there

- **UUID vs numeric in the same feature:**
  `POST /payments/student-bills/arrears/carry-forward` takes
  `studentId`/`previousTermId`/`newTermId` as **UUIDs**, while
  `POST /payments/student-bills` takes `studentId`/`academicTermId` as
  **numbers**. Same nouns, two id types, on adjacent endpoints.
- **`multiSiblingCount` in, `minSiblingCount` out** — `DiscountRuleRequest`
  accepts one name, `DiscountRuleResponse` returns the other.
- **`EURO`** as a currency code, where ISO 4217 is `EUR`. The frontend maps it
  for display, but any client formatting money has to special-case it.
- **Validation getters leak into the API contract.** These appear as writable
  request properties in the OpenAPI schema and look like real fields:
  `effectiveDateRangeValid` (ServiceCostRequest), `validDiscountValue`
  (DiscountRequest), `validDateRange`, `validStaffChildrenRule`,
  `validMultipleSiblingRule`, `validScholarshipRule`, `validHouseholdIncome`,
  `validPromotionalRule` (DiscountRuleRequest). They're presumably `@AssertTrue`
  methods — `@JsonIgnore` would keep them out of the published schema.
- **`carry-forward` returns an empty 200.** A small summary (amount carried, new
  line item) would let the UI confirm what happened instead of saying "done".

## 7. Nice-to-haves that would remove real work from the office

- **A summary endpoint — the single biggest unlock.** Something like
  `GET /school/payments/summary?academicTermId=&from=&to=` returning billed,
  discounted, collected and outstanding, plus breakdowns by service category and
  payment method. Without it a finance dashboard can only be faked by paging the
  whole ledger into the browser, so the dashboard is deliberately not built yet.
- **Student statement / balance endpoint** — every term's bills, payments and
  the running balance for one student, in one call. Today the UI would have to
  fetch bills, then line items, then guess.
- **Receipt retrieval.** `PaymentResponse` returns `receiptId` and
  `receiptNumber`, but nothing fetches or renders a receipt (a PDF endpoint
  would be ideal — receipts get reprinted constantly).
- **Credit balances.** `allowOverpayment` accepts extra money, but no endpoint
  reports the credit that results.
- **School currency.** No endpoint states the school's default currency, so the
  UI falls back to `GHS` when a list is empty.
- **Bulk bill generation** — one call to open bills for an entire class or term,
  instead of one request per student.
- **Error body shape.** Only `carry-forward` documents an `ErrorResponse`; other
  400/404/409 responses have no schema, so clients guess at the message field.
  `apiRequest` already probes `message`/`error`/`detail`/`errors[0].message`.

---

## Impact summary for prioritisation

| Priority | Item | Effect once shipped |
| -------- | ---- | ------------------- |
| P0 | Numeric ids in responses (or UUIDs accepted in bodies) — §1 | Removes every raw-id input from the UI |
| P0 | Student + bill identity on line items — §1b | The overdue worklist can name who to chase |
| P0 | `GET /cash-sessions` — §2 | Replaces the `localStorage` workaround; real "open tills" view |
| P0 | Sums on filtered queries (or a summary endpoint) — §1c, §7 | Real money totals; unblocks a finance dashboard |
| P1 | `GET /payments` — §2 | Payment history, daily collections, session reconciliation |
| P1 | Filters on student bills — §3 | Per-student and per-term bursar screens |
| P1 | Student list/search — §2 | Student pickers everywhere |
| P2 | Void / reverse / update — §4 | Corrections without database access |
| P2 | Student statement + receipts — §7 | The two things parents ask for at the counter |
| P3 | Naming/enum consistency — §6 | Fewer client-side special cases |
