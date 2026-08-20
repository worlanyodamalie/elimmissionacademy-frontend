# API gaps

Two sections: onboarding (schools, staff, users) and billing/collections.

Every claim below is checked against the backend's own `/v3/api-docs` and, where
a request could be made without creating data, against the deployment itself.

| | |
| --- | --- |
| Deployment | `https://schoolmanagementsystem-production-14ab.up.railway.app/api/v1` |
| Test school | `WOR_b8df0` (schoolId 18) |
| Last full audit | **2026-08-20** |

Items carry the date they were last confirmed. Anything whose only reproduction
needs a write (student enrollment, term creation on a real year) is marked as
such and still carries its original date.

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

Confirmed live 2026-08-20. The JWT's `publicId` claim is the **user's** UUID,
not the school's, and the profile endpoint rejects it:

```
GET /auth/school/1fc99369-335f-44aa-b218-927f0b2230be/profile   -> 404
{"title":"School not found","status":404,
 "detail":"The requested school cannot be found",
 "properties":{"errorCode":"SCHOOL_NOT_FOUND",...}}
```

So `/dashboard/school` cannot work for any user, however the JWT is read.

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

`/auth/users/teachers`, `/head-teachers`, `/admins` and `/students` exist as
**POST only** — the frontend's `USERS.*` constants of the same name are create
targets, not lists. The one list-shaped addition since this was written is
`GET /auth/users/{parentProfileId}/students/profile` (a parent's children),
which doesn't help any of the screens above.

**Ask:** `GET /auth/users/teachers|head-teachers|admins|students` with
pagination and a status filter.

*Confirmed 2026-08-20.*

## O4. Lookup rows have no schema

`GET /auth/users/lookup` is documented as returning `Page`, whose `content` is
`array of object`. The UI has to guess at field names (`firstName`, `fullName`,
`roles`, `role`, …) and read every value defensively.

The real shape, captured 2026-08-20 (see §O9 for the full transcript), is
`{id, firstName, lastName, otherNames, email, mobileNumber, gender, country,
region, city, street, digitalAddress}` — flat, no roles, no status, no profile
UUID, and the id field is `id` rather than `userId`. The directory therefore
can't show what role a match holds, which is the first thing an admin looks for.

**Ask:** publish a `UserLookupResponse` schema — including roles, status and the
profile UUID so a search result can link to that person's profile.

## O5. Profile GETs can't be reached from anything

`GET /auth/users/{profileId}/profile` takes a UUID, but every profile response
exposes only numeric ids (`teacherProfileId`, `adminProfileId`, …) and no list
endpoint returns the UUID. So the profile endpoints exist but nothing in the UI
can link to them — the same UUID/numeric split as §1 below.

The spec now documents this one route four times over, once per role, each with
a differently named path param (`{adminProfileId}`, `{headTeacherProfileId}`,
`{parentProfileId}`, `{teacherProfileId}`). They are the same path.

*Confirmed 2026-08-20.*

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
missing from the form". It isn't the cause — that field lives on
`ParentRelationshipRequest` (`minimum: 1`, `maximum: 5`), nested under
`relationship`, not on `NewParentRequest`; the form has always sent it
(position in the parent list), and a payload omitting it still returns 201.

**Ask:** null-check `newParent.address` server-side. Until then, the enrollment
form has dropped its "Not provided" address option so an address is always sent;
a missing one would otherwise be an unexplained failure at the end of a long
form.

*Reproduced 2026-08-12. Not re-tested since — reproducing it enrolls a student.
`NewParentRequest.address` is still optional in the schema as of 2026-08-20.*

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

*Reproduced 2026-08-12. Not re-tested since — reproducing it enrolls a student.*

## O9. `/auth/users/lookup` never returns the `Page` it documents

The spec says `Page`. It has never returned one, and the failure modes changed
between the two audits:

| Matches | 2026-08-12 | **2026-08-20** |
| --- | --- | --- |
| 0 | 200 with an **empty body** | **404** — RFC 7807 problem detail, `errorCode: USER_NOT_FOUND` |
| 1 | 200 with a **bare user object** | unchanged — 200, bare object |
| 2+ | **500** | unchanged — **500**, bare Spring error map |

Verbatim, today, against `WOR_b8df0`:

```
GET /auth/users/lookup?query=Damalie   -> 200
{"id":14,"firstName":"Worlanyo","lastName":"Damalie","otherNames":null,
 "email":"worladamalie+1@gmail.com","mobileNumber":"+233242206604",
 "gender":null,"country":null,"region":null,"city":null,"street":null,
 "digitalAddress":null}

GET /auth/users/lookup?query=a         -> 500  (2 or more matches)
GET /auth/users/lookup?query=zzzznomatch -> 404
```

Three problems in one endpoint:

1. **A search that finds nothing is not an error.** 404 is worse than the old
   empty 200 for a lookup — "no results" is a normal outcome.
2. **A single match isn't wrapped.** `/dashboard/directory` types the response
   as `PageResponse<UserLookupResult>` and reads `.content`, so a single hit
   renders as "no results".
3. **Two or more matches 500.** Any common surname breaks the page.

Note also that the row's identity field is `id` — not `userId`, not the profile
UUID — so a result still can't be linked to that person's profile (§O5).

`/auth/users/parents/lookup` behaves the same way at the boundaries (404 for a
term matching a non-parent). The 2026-08-12 report of **500 on every matching
term** could not be re-tested: `WOR_b8df0` has no parent records, so there is
nothing for it to match.

**Ask:** always return a `Page` — empty `content` for no matches, one-element
`content` for one — and include the profile UUID in each row.

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

*All four confirmed against the spec 2026-08-20.*

## O11. `GET /package-plans` 500s for a school user

```
GET /api/v1/package-plans        (valid school-admin JWT, X-School-Code set)
-> 500 {"timestamp":"2026-08-20T20:46:15.687+00:00","status":500,
        "error":"Internal Server Error","path":"/api/v1/package-plans"}
```

The plan catalogue and its pricing are therefore unreadable, so the registration
form hardcodes the `BASIC | PREMIUM | ENTERPRISE` enum from `SubscriptionRequest`
and can't show an admin what any plan costs before they pick one.

**Ask:** fix the 500, or say if this endpoint is deliberately system-admin only —
in which case schools need some readable equivalent.

*Reproduced 2026-08-20.*

## O12. A `refreshToken` is issued but nothing can redeem it

`LoginResponse` returns `accessToken`, **`refreshToken`**, `tokenType` and
`expiresIn`. Decoded from a live login on 2026-08-20:

| Token | `iat` → `exp` | Lifetime |
| --- | --- | --- |
| access | 2026-08-20 20:28:55 → 21:28:55 | **1 hour** (`expiresIn: 3600000`) |
| refresh | 2026-08-20 20:28:55 → 2026-08-27 20:28:55 | **7 days**, `"type":"refresh"` |

There is no endpoint that accepts the refresh token — no `/auth/refresh`, and no
path in the spec matching "refresh" or "token". The access token cannot be
renewed, so after an hour the session is simply dead and the only recovery is
signing in again. One hour is a perfectly normal access-token lifetime; it is
only a problem because the second half of the pattern is missing.

**Ask:** ship `POST /auth/refresh` taking the refresh token and returning a new
access token (and ideally a rotated refresh token). The frontend can then renew
in the background and the hourly logout disappears.

**Frontend position until then:** the dashboard does **not** act on expiry at
all. It doesn't read `exp`, doesn't run a logout timer, and doesn't clear the
session on a 401. That is a deliberate decision, not an oversight — without a
renewal endpoint, honouring expiry means signing every user out once an hour,
mid-task, with no way to get back except retyping their credentials. Leaving the
session in place is the lesser harm while §O12 is open.

The cost of that choice, so it's visible: once the hour is up, every request
fails with a 401 whose body the UI surfaces as a generic error, and the user has
to sign out and back in manually to recover. It also ignores `refreshToken`
entirely, since storing a credential it can never redeem only widens the attack
surface.

Expiry handling lands in one place (`src/lib/auth-context.tsx`) the moment
`/auth/refresh` exists — renew shortly before `exp`, and fall back to signing
out only when the renewal itself fails.

*Confirmed 2026-08-20.*

---

# Billing & collections

Written while building the billing and collections UI against
`/api/v1/school/payments`, `/api/v1/school/cash-sessions` and
`/api/v1/school/discounts`. Everything below is something the frontend wanted
and the API doesn't currently offer. Ordered by how much it costs the UI.

Source of truth for the current surface: the backend's own
`/v3/api-docs`. Frontend wrappers: `src/lib/billing.ts`, `src/lib/academics.ts`.

---

## 1. Numeric ids are required in requests but a resource never returns its own — blocking

Every response identifies a resource by a UUID (`publicId`, `billLineItemId`),
but request bodies reference other resources by **numeric** id.

This is narrower than first written. Most of these numeric ids *are* returned
somewhere — just never on the resource they belong to. They appear on *other*
resources that already reference it, so you can only learn a thing's numeric id
after creating something that points at it. For a fresh school, where nothing
has been created yet, that is a closed loop.

| Request field | Endpoint | Numeric id appears on | Reachable from a list? |
| --- | --- | --- | --- |
| `serviceCostId` | `POST /payments/bill-line-items/service-cost` | `BillLineItemResponse.serviceCostId` | **No** — `ServiceCostResponse` (the price list) has only `publicId`, so you must already have charged it |
| `studentBillId` | `POST /payments/bill-line-items/*`, `POST /payments` | `BillLineItemResponse`, `PaymentResponse` | **No** — `StudentBillResponse` has only `publicId`; a bill with no charges exposes nothing |
| `discountId` | `POST /discounts/rules` | `DiscountRuleResponse.discountId` | **No** — `DiscountResponse` has only `publicId`, and there is no `GET /discounts` (§2) |
| `cashCollectionSessionId` | `POST /payments` | `PaymentResponse.cashCollectionSessionId` | **No** — `SessionResponse` has only `publicId`; needed *before* the first payment can be taken |
| `studentId` | `POST /payments/student-bills`, `POST /payments` | `StudentBillResponse`, `PaymentResponse` | **No** — no student list endpoint at all (§2) |
| `academicTermId` | `POST /payments/student-bills` | `AcademicYearResponse.academicTerms[]`, `StudentBillResponse` | **Yes** — the years list carries it |
| `academicYearId` | `POST /academics/terms` | `AcademicTermResponse`, `StudentBillResponse` | **No** — and this one is a hard blocker; see §8 |
| `classLevelId` | `POST /payments/service-costs` | `ServiceCostResponse.classLevelId` | **No** — no class-level endpoint, so only levels already priced are discoverable |
| `cashierId`, `approvedById` | `POST /cash-sessions`, `/approve` | `SessionResponse.cashierId` | **No** — no staff list (§O3) |

The pattern is consistent: **the create endpoint needs an id that only a
downstream read can supply.** So several forms can't be built as pickers and
ask the user to type a raw database id.

**Ask:** include a resource's own numeric id in its own response
(`serviceCostId` on `ServiceCostResponse`, `studentBillId` on
`StudentBillResponse`, `discountId` on `DiscountResponse`, `cashSessionId` on
`SessionResponse`, `academicYearId` on `AcademicYearResponse`), or accept the
public UUID in request bodies. Either one removes every "type the numeric id"
field in the UI.

*Table re-derived from the spec 2026-08-20.*

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

*Still true 2026-08-20: the response carries `billLineItemId`, `studentBillId`,
`serviceCostId`, `serviceName`, `schoolName` — and no student identity of any
kind.*

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

*Confirmed 2026-08-20.*

## 2. Missing list endpoints

Creating works; finding what was created often doesn't.

| Missing                                     | What the UI can't do today |
| ------------------------------------------- | -------------------------- |
| `GET /cash-sessions` (filter by status, cashier, date) | Show which tills are open. `GET /cash-sessions/{cashSessionId}` exists, so a session can be read *if* you already hold its UUID — which is exactly what nothing hands you. The page remembers UUIDs in `localStorage` (`src/lib/cash-session-store.ts`), a per-device workaround that loses sessions opened elsewhere. |
| `GET /payments` (filter by student, bill, session, date range) | No payment history, no daily collections report, no receipt reprint, no "payments in this session" list for close-of-day reconciliation. |
| `GET /discounts` and `GET /discounts/rules`  | The discounts page can only list what the current visit created. |
| A student list/search (`GET /auth/users/students`) | No student picker anywhere — bills, payments and charge filters all need a typed id. Parents have `parentsLookup`; students have nothing equivalent. |
| `GET` class levels                           | `ServiceCostRequest.classLevelId` can't be a dropdown. |

*Confirmed 2026-08-20: the whole `/school/**` surface is 6 GETs — service
costs (list + one), student bills (list + one), bill line items (list + one),
academics (years/terms, list + one each) and `cash-sessions/{id}`. Everything
else is POST.*

## 3. No filters on `GET /payments/student-bills`

Only `pageable`. There's no way to fetch one student's bills, a term's bills, or
just the unpaid ones — which is exactly what a bursar's screen needs. Bill line
items already have a good filter object (`BillLineItemFilterRequest`:
`studentBillId`, `studentId`, `paymentStatus`, `serviceCategory`, `source`,
`dueDateFrom`, `dueDateTo`); student bills want the same treatment
(`studentId`, `academicTermId`, `paymentStatus`, `billNumber`).

*Confirmed 2026-08-20: `GET /payments/student-bills` still takes `pageable` and
nothing else.*

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

*Confirmed 2026-08-20: there is no `PUT`, `PATCH` or `DELETE` anywhere under
`/school/**`. The only non-POST writes in the entire API are on the
system-admin subscription endpoints.*

## 5. Cash session details

- `SessionResponse.status` is typed as a plain `string`. The UI needs the enum
  documented (the frontend currently assumes
  `OPEN | CLOSED | PENDING_APPROVAL | APPROVED`). Please confirm or correct.
- Close returns totals but there's no breakdown of the payments that make up
  `expectedCashAmount`, so the close-of-day screen can't show the cashier what
  they're counting against.
- No endpoint to reopen or amend a session closed with a wrong count.

*Confirmed 2026-08-20: `SessionResponse.status` is still `{"type":"string"}`.*

## 6. Inconsistencies worth fixing while you're in there

- **UUID vs numeric in the same feature:**
  `POST /payments/student-bills/arrears/carry-forward` takes
  `studentId`/`previousTermId`/`newTermId` as **UUIDs**, while
  `POST /payments/student-bills` takes `studentId`/`academicTermId` as
  **numbers**. Same nouns, two id types, on adjacent endpoints.
- **`multiSiblingCount` in, `minSiblingCount` out** — `DiscountRuleRequest`
  accepts one name, `DiscountRuleResponse` returns the other.
- **`createdByName` is two different types.** It is a `FullName` object on
  `AcademicYearResponse`, `BillLineItemResponse` and `MessageTemplateResponse`,
  but a plain `string` on `ServiceCostResponse` and `StudentBillResponse`.
  Verified live 2026-08-20:
  `"createdByName":{"firstName":"Worlanyo","lastName":"Damalie","otherNames":null}`
  on a year. Any client rendering the field has to special-case it per
  endpoint. `PaymentResponse` adds a third spelling, `createdByFullName`
  (a string).
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
- **Error body shape — two incompatible formats in one API.** Handled errors
  return an RFC 7807 problem detail; unhandled ones fall through to Spring's
  default map. Both observed live on 2026-08-20:

  ```
  404 {"type":"about:blank","title":"User Not Found","status":404,
       "detail":"The requested user account could not be found",
       "instance":"/api/v1/auth/users/lookup",
       "properties":{"errorCode":"USER_NOT_FOUND","timestamp":"..."}}

  500 {"timestamp":"...","status":500,"error":"Internal Server Error",
       "path":"/api/v1/school/academics/terms"}
  ```

  The message is under `detail` in the first and absent entirely in the second.
  Only `carry-forward` documents an `ErrorResponse` in the spec, and that schema
  (`body`, `headers`, `statusCode`, `detailMessageArguments`, …) is a serialized
  `ErrorResponseException`, not either of the shapes actually sent. `apiRequest`
  probes `message`/`error`/`detail`/`errors[0].message` to cope.

  **Ask:** the problem-detail shape everywhere, including for unhandled
  exceptions, and a spec schema that matches it.

---

## 8. Academics — the first term of a year cannot be created · blocking

Three findings, all reproduced against `WOR_b8df0` on **2026-08-20**. Together
they mean the academics feature cannot be used at all on a new school.

### 8a. `POST /academics/terms` needs a numeric id that no response returns

`AcademicTermRequest` requires `academicYearId` as an **integer**. The year's
own responses don't carry one:

```
GET /school/academics/years?page=0&size=50   -> 200
{"content":[{"publicId":"86bbd90d-1dd2-41fb-b1e1-2217f1a04f2d","schoolId":18,
  "schoolName":"WorlasSchool","name":"2025/2026","startDate":"2025-08-11",
  "endDate":"2026-08-20","academicTerms":[],"createdById":14,
  "createdByName":{...},"createdAt":"..."}], ...}
```

No `academicYearId`. `GET /school/academics/years/{publicId}` returns the same
object, so the single-resource read doesn't help either. The only place that
number appears anywhere in the API is `AcademicTermResponse.academicYearId` —
on a term that already exists.

**So the first term of any academic year is uncreatable by any client.** Our
test school is in exactly that state: one year (`2025/2026`), zero terms, and
no route from the year to the number needed to give it one.

**Ask:** add `academicYearId` to `AcademicYearResponse`, or accept the year's
`publicId` in `AcademicTermRequest`.

### 8b. A bad `academicYearId` returns a bare 500

```
POST /school/academics/terms
{"academicYearId":999999,"termNumber":"FIRST_TERM",
 "startDate":"2026-01-10","endDate":"2026-01-01"}

-> 500 {"timestamp":"2026-08-20T20:29:36.540+00:00","status":500,
        "error":"Internal Server Error","path":"/api/v1/school/academics/terms"}
```

Should be a 404 (or 400) naming the missing year. Two things follow from this:

- Combined with 8a, guessing the id is the only available strategy, and a wrong
  guess gives no usable feedback while a correct one silently creates a term —
  with no `DELETE` to undo it (§4).
- Note that payload also has `endDate` **before** `startDate` and that wasn't
  rejected either. Worth confirming the term's date range is validated at all,
  that it must fall inside its academic year, and — importantly — that the year
  lookup is **scoped to the caller's tenant**. If it isn't, a guessed id could
  attach a term to another school's academic year.

### 8c. A term's two identifiers are split across two endpoints

Neither list response is complete, and both ids are needed:

| | numeric `academicTermId` | `publicId` (UUID) |
| --- | --- | --- |
| `GET /academics/years` → `academicTerms[]` | ✅ | ❌ |
| `GET /academics/terms` | ❌ | ✅ |

`POST /payments/student-bills` takes the **numeric** `academicTermId`;
`POST /payments/student-bills/arrears/carry-forward` takes the term **UUID**.
Adjacent endpoints, same noun, two id types — so every screen with a term
picker must fetch both lists and join them on year name + term number.
`src/lib/academics.ts` (`loadAcademics`) does exactly that.

**Ask:** put both ids on both responses, or settle on one id type across the
request bodies.

### Frontend status

`src/lib/academics.ts` wraps all six academic endpoints and does the join;
`/dashboard/academics` and `/dashboard/billing` both consume it. The billing
term pickers only offer terms that actually carry the id kind that form needs,
so they cannot submit an id the endpoint will reject. The one workaround still
in the UI is on the academics page: for a year with no terms yet, it asks the
admin to type the numeric year id, because nothing in the API can supply it.
That input disappears the moment 8a is fixed.

---

## Impact summary for prioritisation

| Priority | Item | Effect once shipped |
| -------- | ---- | ------------------- |
| P0 | `academicYearId` on the year response — §8a | Unblocks academic terms entirely; today a new school cannot create its first term |
| P0 | The school's own UUID in login/profile — §O1 | `/dashboard/school` works at all |
| P0 | Numeric ids on their own resources (or UUIDs accepted in bodies) — §1 | Removes every raw-id input from the UI |
| P0 | Student + bill identity on line items — §1b | The overdue worklist can name who to chase |
| P0 | `GET /cash-sessions` — §2 | Replaces the `localStorage` workaround; real "open tills" view |
| P0 | Sums on filtered queries (or a summary endpoint) — §1c, §7 | Real money totals; unblocks a finance dashboard |
| P1 | `Page` from `/auth/users/lookup` — §O9 | The directory finds single matches and stops 500ing on common surnames |
| P1 | 404 instead of 500 on a bad `academicYearId` — §8b | Guessing stops being the only strategy, and stops being dangerous |
| P1 | `GET /payments` — §2 | Payment history, daily collections, session reconciliation |
| P1 | Filters on student bills — §3 | Per-student and per-term bursar screens |
| P1 | Student list/search — §2 | Student pickers everywhere |
| P1 | `POST /auth/refresh` — §O12 | Ends the hourly forced sign-out; the refresh token already exists |
| P2 | `GET /package-plans` stops 500ing — §O11 | Registration can show real plans and prices instead of a hardcoded enum |
| P2 | Void / reverse / update — §4 | Corrections without database access |
| P2 | Student statement + receipts — §7 | The two things parents ask for at the counter |
| P2 | One error-body shape — §7 | Clients stop guessing at the message field |
| P2 | Consistent `createdByName` — §6 | One rendering path instead of one per endpoint |
| P3 | Naming/enum consistency — §6 | Fewer client-side special cases |
