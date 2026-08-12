# API gaps

Two sections: onboarding (schools, staff, users) and billing/collections.

---

# Onboarding — schools, admins and users

Written while building the registration, staff and directory screens against
`/api/v1/auth/**`. Same rule as below: everything listed is something the
frontend wanted and the API doesn't currently offer.

## O1. The school's UUID is never returned — blocking for the profile page

`GET /auth/school/{schoolId}/profile` is keyed by a **UUID**, but nothing hands
one to the client: registration returns a string, login returns
`accessToken`/`schoolCode`, and the profile response itself carries only a
**numeric** `schoolId`. `/dashboard/school` currently digs through the JWT for
a `schoolPublicId`/`schoolUuid`/`schoolId` claim and shows an explanatory error
when none is there.

**Ask:** return the school's public UUID in `LoginResponse` (and in
`SchoolProfileResponse`), or let the endpoint accept the school code — the one
identifier every client already has.

## O2. Registration doesn't return the school code

`POST /auth/school/register` responds with a sentence. The school code — the
thing the admin must have to sign in — only reaches them by email, so the
success screen can't display it and a bounced email means starting over.

**Ask:** return `{ schoolCode, schoolId }` (or the whole `SchoolProfileResponse`)
on 201.

## O3. No staff or student lists

Only `GET /auth/users/lookup` and `/auth/users/parents/lookup` exist, both
requiring a search term. There is no way to list the teachers, head teachers,
admins or students of a school, so `/dashboard/teachers` and its siblings are
"add" hubs rather than rosters, and nobody can answer "who works here?".

**Ask:** `GET /auth/users/teachers|head-teachers|admins|students` with
pagination and a status filter.

## O4. Lookup rows have no schema

`GET /auth/users/lookup` is documented as returning `Page`, whose `content` is
`array of object`. The UI has to guess at field names (`firstName`, `fullName`,
`roles`, `role`, …) and read every value defensively.

**Ask:** publish a `UserLookupResponse` schema — ideally including the profile
UUID so a search result can link to that person's profile.

## O5. Profile GETs can't be reached from anything

`GET /auth/users/{profileId}/profile` takes a UUID, but every profile response
exposes only numeric ids (`teacherProfileId`, `adminProfileId`, …) and no list
endpoint returns the UUID. So the profile endpoints exist but nothing in the UI
can link to them — the same UUID/numeric split as §1 below.

## O6. User records can't be corrected or retired

`PATCH /auth/users/role-change` is the only write after creation. A mistyped
email or phone number, a member of staff who leaves, a parent who should no
longer receive messages — none of these can be handled. `status` fields
(`ACTIVE|INACTIVE|SUSPENDED|…`) are settable at create time and never again.

**Ask:** `PATCH` for contact details, and a status change endpoint per profile.

## O7. Enrolling a student 500s when a parent has no address — backend bug

`NewParentRequest.address` is optional in the OpenAPI schema (`required` is
`["email","firstName","lastName","mobileNumber","relationship"]`), but
`POST /auth/users/students` answers **500 Internal Server Error** when the field
is absent. Reproduced 2026-08-12 against the Railway deployment: an otherwise
identical payload returns 201 with the address present and 500 with it removed.

Worth noting because this was first reported as "`emergencyContactOrder` is
missing from the form". It isn't the cause — that field is optional in the
schema and the form has always sent it (position in the parent list), and a
payload omitting it still returns 201.

**Ask:** null-check `newParent.address` server-side. Until then, the enrollment
form has dropped its "Not provided" address option so an address is always sent;
a missing one would otherwise be an unexplained failure at the end of a long
form.

## O8. Enrolling 500s when a new parent's email or mobile is already taken

`POST /auth/users/students` answers **500** when `newParent.email` or
`newParent.mobileNumber` already belongs to a user at the school. Either one is
enough on its own. Reproduced 2026-08-12; the payload that provoked the original
report reused the school admin's mobile (`+233242206604`, user id 14) under a
different email.

Colliding with someone who is already a *parent* is handled and returns 201.
Only a collision with a non-parent user (staff, admin) crashes — which is the
case an admin is least able to predict, since those people don't show up in the
parent lookup.

**Ask:** answer **409** with a message naming the clashing field, or link the
existing user as a parent the way a parent-to-parent collision already is.

Until then the enrollment form maps a bare 500 to a message naming this as the
likely cause. That is a guess dressed as an explanation — it should be deleted
the moment the API returns a real error.

## O9. `/auth/users/lookup` has three different response shapes

The spec says `Page`. In practice, against `WOR_b8df0` on 2026-08-12:

| Matches | Response |
| --- | --- |
| 0 | **200** with an **empty body** — not `{"content":[]}` |
| 1 | **200** with a **bare user object** — not wrapped in a page |
| 2+ | **500** |

`/dashboard/directory` types the response as `PageResponse<UserLookupResult>`
and reads `.content`, so it shows nothing for a single hit and errors outright
on a common surname.

`/auth/users/parents/lookup` is worse: it returned an empty 200 for a term with
no matches and **500 for every term that did match**, so the `ParentLookup`
component can't find anyone. This blocks the workaround suggested in §O8 —
an admin told to link an existing parent has no working way to find them.

**Ask:** always return a `Page`, empty content and all.

## O10. Smaller inconsistencies

- **`AdminRegisterRequest.mobileNumber` has no pattern**, while the school,
  teacher, head-teacher, admin-invite and new-parent mobile fields all require
  `^\+233[0-9]{9}$`. The frontend normalizes local `0244…` input to `+233…`
  everywhere for consistency.
- **`HEADTEACHER` in `RoleChangeRequest.targetRole`** versus `ROLE_HEAD_TEACHER`
  in the JWT and `head-teachers` in the path. Three spellings of one role.
- **`RoleChangeRequest.profileDetails` is required** even when `targetRole` is
  `STUDENT` or `PARENT`, which have no employment profile. The UI sends `{}`.
- **`ParentRequest.valid`** is a validation getter leaking into the schema (see
  §6 below for the same problem in billing).
- **Setup/reset endpoints take the token in the query string**, so it lands in
  server logs and proxy history. A body field would be safer.

---

# Billing & collections

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
