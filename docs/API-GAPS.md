# API gaps

Three sections: onboarding (schools, staff, users), billing/collections, and
academic management (classes and enrolments).

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

Only `GET /auth/users/lookup`, `/auth/users/parents/lookup` and
`/auth/users/students/lookup` exist, all requiring a search term. There is no
way to list the teachers, head teachers or admins of a school, so `/dashboard/teachers` and its siblings are
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

**Re-tested 2026-10-06 against `WOR_9fe69`:** problems 2 and 3 are gone in
their old form — any number of matches now comes back as **200 with a bare
array**, and `page`/`size` are ignored (every match, every time). Problem 1
remains: no match is still 404 `USER_NOT_FOUND`. `/dashboard/directory` now
accepts the array, pages it client-side, and treats the 404 as "no results".

Note also that the row's identity field is `id` — not `userId`, not the profile
UUID — so a result still can't be linked to that person's profile (§O5).

`/auth/users/parents/lookup` behaves the same way at the boundaries (404 for a
term matching a non-parent). Re-tested 2026-10-06 against `WOR_9fe69`, which
has a parent record: matching terms (full or partial name, email) now return
**200 with a bare array** of `{id, firstName, lastName, email, mobileNumber}` —
no `Page` wrapper, despite the spec — and `page`/`size` are accepted. The
earlier 500 no longer reproduces. The parent picker had been reading `.content`
and so showed "No parents matched" for every hit; it now accepts either shape
and treats the 404 as an empty result.

**No-match codes, run 2026-10-06 against `WOR_9fe69`.** All three lookups
answer a term that matches nothing with an RFC 7807 404 whose
`properties.errorCode` names the miss; an unknown route is a plain Spring 404
with no code:

```
GET /auth/users/lookup?query=zzqxnomatch          -> 404 USER_NOT_FOUND
GET /auth/users/parents/lookup?query=zzqxnomatch  -> 404 PARENT_NOT_FOUND
GET /auth/users/students/lookup?query=zzqxnomatch -> 404 STUDENT_NOT_FOUND
GET /auth/users/no-such-route                     -> 404 {"error":"Not Found","path":...}
```

`isNoMatchError` in `src/lib/api.ts` keys on that code, so only a genuine
"nothing matched" renders as no results; any other 404 still surfaces as an
error. None of these 404s appear in `/v3/api-docs`.

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

Still true on **2026-09-28**: a fresh login returns `accessToken`,
`refreshToken` (492 chars), `tokenType: "Bearer"` and `expiresIn: 3600000`, and
there is still no endpoint to redeem the refresh token.

**What an expired token looks like on the wire** (verified 2026-09-28):

```
GET /school/academics/class_levels     (token expired at 14:22:20Z)
-> 401, EMPTY BODY
   www-authenticate: Bearer error="invalid_token",
     error_description="An error occurred while attempting to decode the Jwt:
                        Jwt expired at 2026-09-28T14:22:20Z"
```

The body is empty, so the reason is *only* in the `www-authenticate` header.
Any client that reads errors from the response body — as `apiRequest` does —
sees nothing and falls back to a generic message.

**Frontend position until then — changed 2026-09-28.** The dashboard now
detects expiry and signs the user out deliberately: `apiRequest` checks the
stored token's `exp` before sending (30s skew), treats a 401 carrying
`invalid_token` as a lapsed session, clears the session, and flags it. The
dashboard shell's existing "no session → /login?from=…" redirect does the rest,
and the login page explains why the user is there.

This replaces the previous position, which was to ignore expiry entirely on the
grounds that an hourly forced logout was the greater harm. That reasoning
didn't survive contact with the behaviour it produced: the app went on looking
signed in — sidebar, name, school code all rendering — while every request
failed 401 with an empty body, so the UI reported a generic "could not load"
and appeared to blame the server. The user got the hourly interruption either
way; they just weren't told about it, and lost their place as well. It also
ignored `refreshToken`
entirely, since storing a credential it can never redeem only widens the attack
surface.

When `/auth/refresh` ships, the change is small and lands in one place: renew
in `apiRequest` when `isTokenExpired` fires instead of ending the session, and
keep the sign-out purely as the fallback for a failed renewal. The detection is
already there.

*Confirmed 2026-08-20; re-confirmed and the frontend position revised
2026-09-28.*

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
| `studentId` | `POST /payments/student-bills`, `POST /payments` | `StudentBillResponse`, `PaymentResponse` | **Yes** — `GET /auth/users/students/lookup` returns `profileId` (numeric) and `profilePublicId` (UUID) per match |
| `academicTermId` | `POST /payments/student-bills` | `AcademicYearResponse.academicTerms[]`, `StudentBillResponse` | **Yes** — the years list carries it |
| `academicYearId` | `POST /academics/terms` | `AcademicTermResponse`, `StudentBillResponse` | **No** — and this one is a hard blocker; see §8 |
| `classLevelId` | `POST /payments/service-costs` | `ServiceCostResponse.classLevelId` | **Yes** — `GET /school/academics/class_levels/lookup?query=` (blank query) returns every class with its numeric `classLevelId`; the service-cost form picks from it via `ClassLevelSelect` |
| `cashierId`, `approvedById` | `POST /cash-sessions`, `/approve` | `SessionResponse.cashierId` | **Yes** — the `id` on `GET /auth/users/lookup` rows (verified 2026-10-08); the rows carry no roles, so the picker can't narrow to cashiers or approvers |

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

**Run 2026-10-08 against `WOR_9fe69`:**

- **`schoolId`** isn't a claim in the sign-in token, but `tenantId` is, and it
  equals the school's numeric id (`2`). Every tenant list row carries
  `schoolId` too (`GET /school/academics/class_levels?size=1` → `2`). The
  payment and open-session forms now take it from the token, falling back to a
  list row, and only ask for it in a school with no classes, terms or bills.
- **`userId`** isn't a claim either (the claims are `sub`, `publicId`, `roles`,
  `schoolCode`, `tenantId`, `userType`, `iat`, `exp`), so the old "defaults to
  you" cashier and approver never filled, and `closedById` was never sent.
  All three are now a `UserLookup` (below); `closedById: 4` was accepted on
  close. `SessionResponse` has no `closedBy` field, so the closer can't be
  read back.
- **`cashierId` / `approvedById`** are the `id` on `GET /auth/users/lookup`
  rows: the admin's row (`id: 4`) opened, closed and approved a session that
  came back with the right `cashierName`, and an unknown id (`99999`) answers
  404 `USER_NOT_FOUND` on both open and approve. Searching the token's `sub`
  (the email) returns exactly that one row, so both fields are now a
  `UserLookup` that starts on the signed-in user.
- **`serviceCostId`** is recovered on the bill page by matching the price list
  against earlier charges (`src/lib/service-cost-ids.ts`). That only helps once
  a charge exists, and a fresh price returns no numeric id, so the first charge
  of any price still needs the id typed. Whether bill creation
  auto-charges mandatory prices (which would break that loop) is unverified:
  `POST /payments/student-bills {studentId: 2, academicTermId: 4}` — an
  enrolled student, in their enrolled term, with one mandatory school-wide
  price — answers a bare **500**. Terms 5 and 6 answer 404
  `ENROLMENT_NOT_FOUND`, as expected.

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
| ~~`GET` class levels~~                       | Resolved — see below. |

*Resolved 2026-08-31: `GET /auth/users/students/lookup?query=` searches the
school's active students and answers a bare array of
`{ profileId, profilePublicId, studentNumber, fullName }` — both id flavours
billing needs. Wired into every student field on the billing screens
(`src/components/student-lookup.tsx`).*

*Resolved 2026-10-08: `GET /school/academics/class_levels/lookup?query=` with a
blank query returns every class with its numeric `classLevelId`, so
`ServiceCostRequest.classLevelId` is now a dropdown (`ClassLevelSelect`).*

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

## 8. Academics — an academic year cannot be created · blocking

**Rewritten 2026-08-24.** The calendar API changed between 2026-08-20 and
2026-08-24, and the change is a good one — it dissolves the old §8a rather than
fixing it. What replaced it is a hard blocker one step earlier.

**What changed:** `POST /academics/terms` is gone (now **405 Method Not
Allowed**). The only write left on a term is
`PUT /academics/terms/{academicTermId}` with a body of exactly
`{startDate, endDate}`. `AcademicYearRequest.endDate` also became optional.

Taken together these say terms are no longer created by clients: the backend
generates a year's three terms when the year is created, and the client only
adjusts their dates. That removes the old complaint entirely — the numeric
`academicYearId` that no response returned was only ever needed by
`POST /academics/terms`, so nothing needs it now. **No longer requested.**

### 8a. `POST /academics/years` returns a bare 500 for every valid payload — **FIXED**

**Resolved as of 2026-09-28.** The call now succeeds against `WOR_9fe69`:

```
POST /school/academics/years
{"name":"2026/2027 Academic Year","startDate":"2026-09-01","endDate":"2027-07-31"}

-> 201 {"publicId":"4a4b1bb2-…","schoolId":2,"name":"2026/2027 Academic Year",
        "academicTerms":[{"academicTermId":4,"termNumber":"FIRST_TERM",…},…]}
```

Three terms are auto-created, as intended — though not with usable dates, which
is now §8d. This unblocks the whole calendar, and with it enrolment and billing,
both of which need a term. The original report is kept below for history.

---

Reproduced against `WOR_b8df0` on **2026-08-21** and again on **2026-08-24**:

```
POST /school/academics/years
{"name":"2039/2040","startDate":"2039-09-01","endDate":"2040-07-31"}

-> 500 {"timestamp":"2026-08-24T08:04:19.819+00:00","status":500,
        "error":"Internal Server Error","path":"/api/v1/school/academics/years"}
```

Six payload variants all 500: with and without `endDate`, `YYYY/YYYY` and
free-text names, full-year and single-term durations, and a duplicate of the
existing year (which should be a 409 — the spec documents one).

**The validation layer is fine**, which is what localises the bug. Bad input is
rejected cleanly and in RFC 7807 form:

```
{"name":"2040/2041","startDate":"2041-09-01","endDate":"2040-07-31"}
-> 400 {"title":"Invalid Academic Year Dates","status":400,
        "detail":"The academic year end date must be after the start date",
        "properties":{"errorCode":"INVALID_ACADEMIC_YEAR_DATES", ...}}

{"startDate":"2041-09-01","endDate":"2042-07-31"}          (name omitted)
-> 400 {"title":"Validation Failed","errorCode":"VALIDATION_FAILED",
        "errors":[{"field":"name","message":"Academic year name is r..."}]}
```

So the 500 happens **after** validation passes, in the creation path itself.
Given that term generation was just moved server-side, the new
auto-create-terms logic is the obvious suspect.

**Effect:** no academic year can be created, therefore no terms exist, therefore
nothing downstream that needs a term — billing, enrollment, teacher assignment —
can be exercised on a new school. Our test school still has the single
`2025/2026` year it had on 2026-08-20, with `academicTerms: []`.

**Ask:** fix the 500. Please also confirm the intended contract while you're in
there, because the frontend is built to it and can't verify it: does
`POST /years` create all three terms, and with what default dates? And should
`endDate` be omitted (the spec now says optional) so the backend derives it?

### 8b. Nothing back-fills terms for years created before the change

`2025/2026` was created on 2026-08-20 and has `academicTerms: []`. If
auto-creation only runs on new years, existing years are permanently termless
with no client-side way to fix them — `POST /terms` is 405 and `PUT` needs a
term that doesn't exist.

**Ask:** a migration, or a way to generate terms for an existing year.

### 8c. A term's two identifiers are still split across two endpoints

Unchanged, and still load-bearing — if anything more so, since the `PUT` now
needs the UUID:

| | numeric `academicTermId` | `publicId` (UUID) |
| --- | --- | --- |
| `GET /academics/years` → `academicTerms[]` | ✅ | ❌ |
| `GET /academics/terms` | ❌ | ✅ |

`POST /payments/student-bills` takes the **numeric** `academicTermId`;
`PUT /academics/terms/{...}` and
`POST /payments/student-bills/arrears/carry-forward` take the term **UUID**.
So every screen with a term picker must fetch both lists and join them on year
name + term number. `src/lib/academics.ts` (`loadAcademics`) does exactly that.

Note the `PUT` path param is named `academicTermId` in Swagger but is documented
as — and behaves as — the term's `publicId`. Passing the numeric id 404s. Worth
renaming to avoid the next person losing an hour to it.

**Ask:** put both ids on both responses, or settle on one id type across the
request bodies.

### 8d. Auto-created terms have no usable dates

Creating a year stamps only the year's own bounds onto the outer two terms and
leaves everything else null (2026-09-28):

| term | startDate | endDate |
| --- | --- | --- |
| FIRST_TERM | `2026-09-01` (the year's start) | `null` |
| SECOND_TERM | `null` | `null` |
| THIRD_TERM | `null` | `2027-07-31` (the year's end) |

Consequences for any client:

- **Nothing is ever the "current" term** on a fresh year, because no term has
  both bounds. Term pickers can't preselect, and the academics page shows no
  current-term badge until an admin edits all three by hand.
- `AcademicTermResponse.startDate` / `.endDate` are **nullable**, which the
  spec types as plain `string`. `src/lib/types.ts` marks them
  `string | null` and `loadAcademics` normalises to `""`.

Related: **`academicTerms` comes back in a different order each call.** The
same year returned `FIRST, SECOND, THIRD` at 13:29 and `SECOND, FIRST, THIRD`
at 15:04 on 2026-09-28 — the field is declared `uniqueItems: true`, so it is a
Set server-side and has no order to rely on. `loadAcademics` is unaffected
because it keys terms by year name plus term number rather than by position,
but anything reading `academicTerms[0]` would be wrong intermittently.

An admin must open each term and set its dates via the `PUT` before the
calendar is usable. That is three edits per year, every year, to supply dates
the backend could divide itself.

**Ask:** either split the year evenly across three terms on creation, or
document the dates as required admin setup and surface a warning until they're
filled in.

### Frontend status

`src/lib/academics.ts` wraps the five surviving academic endpoints and does the
join. `/dashboard/academics` lists each year with its terms and lets an admin
edit any term's dates inline via the `PUT`; `/dashboard/billing` consumes the
same records for its term pickers, which only offer terms carrying the id kind
that form needs.

The old workaround — asking the admin to type a numeric year id — is **gone**,
along with the create-term form, since neither has an endpoint behind it any
more.

**Untested against real data.** No term has ever existed on the test school, so
the `PUT` path has only been exercised against a fabricated UUID (a correct
404). It stays unverified until 8a is fixed.

---

# Academic management — classes and enrolments

Written while building `/dashboard/academics/classes` and
`/dashboard/academics/enrolments` against the **Academic Management** tag
(`/api/v1/school/academics/class_levels**` and `**/enrolments**`). Read off
`/v3/api-docs` on 2026-09-26.

**Verified against the deployment on 2026-09-28** on test school `WOR_9fe69`
(schoolId 2), by creating an academic year, a class level with two streams, a
student with a parent, and an enrolment, then reading everything back. Every
response matched the types in `src/lib/types.ts` except the term dates (§8d).

The seven endpoints are otherwise in good shape — this is the one part of the
API where creating the resource, listing it and reading one back all exist.

## A1. `ClassLevelResponse` has no `publicId`, but its own paths are keyed by one

The class level's detail and roster endpoints take a **UUID**:

```
GET /school/academics/class_levels/{classLevelId}            (format: uuid)
GET /school/academics/class_levels/{classLevelId}/students   (format: uuid)
```

The responses that produce a class level:

| | numeric `classLevelId` | `classLevelPublicId` (UUID) | |
| --- | --- | --- | --- |
| `POST /class_levels` → `ClassLevelResponse` | ✅ | ❌ | documented |
| `GET /class_levels` → **generic `Page`** | ? | ? | **undocumented — see below** |
| `GET /class_levels/lookup` → `ClassLevelLookUpResponse` | ✅ | ✅ | documented |

So a class just created **cannot be opened from its own create response** —
that much is certain from the schema. Only the lookup is documented as carrying
both ids, and it takes a **required** `query` param, so there is no call that is
guaranteed to return every class with its UUID.

**Settled 2026-09-28.** `GET /class_levels` rows really are
`ClassLevelResponse` and carry no UUID under any spelling — so the list cannot
link to the pages that read from it. (The 200 is still declared as the bare
`Page` schema, `content: array of object`, the same untyped-`Page` hole as §O4;
a `PageClassLevelResponse` would make this answerable from the contract.)

**But a blank query is the list-all call.** `?query=` returns every class with
both ids, 200:

```
GET /class_levels/lookup?query=      -> 200 [ {classLevelId, classLevelPublicId, …} ]
GET /class_levels/lookup             -> 400 (the param is required)
```

The two are not the same: omitting the param is a validation error, sending it
empty is a match-all. So recovering the UUIDs costs **one** request, not one
per class, and `loadClassLevels` now issues the list and one blank lookup in
parallel and joins them on the numeric id. The list is still needed only
because the lookup response omits `streams`.

Anything that merely has to *name* a class skips the list entirely and calls
the lookup alone — `ClassLevelSelect` does this.

**Ask:** add `classLevelPublicId` to `ClassLevelResponse` — it is the same field
`ClassLevelLookUpResponse` already has — and give the list a typed
`PageClassLevelResponse` so this is answerable from the contract. That would
drop the second request altogether. Lower priority now that the blank-query
workaround is one call rather than thirteen.

## A2. `AcademicYearResponse` has no numeric id, but enrolment requires one

`StudentEnrolmentRequest.academicYearId` is a numeric `int64`, and
`AcademicYearResponse` — from both `GET /academics/years` and
`GET /academics/years/{publicId}` — returns only `publicId` and `schoolId`.

This is §1 and §8c again, one level up: the id an enrolment needs is not on the
year. It is recoverable, but only sideways, from `AcademicTermResponse`
(`GET /academics/terms`), which does carry `academicYearId`. So the enrolment
form loads the **terms** in order to populate a **year** picker
(`academicYearOptions` in `src/lib/academics.ts`). A year whose terms failed to
load, or which has none, cannot be offered at all — there is no id to send.

That makes §8b (years created before term auto-creation shipped have no terms)
worse than it looked: such a year is not merely termless, it is un-enrollable.

**Confirmed 2026-09-28.** The year came back as
`{publicId: "4a4b…", schoolId: 2, …}` with no numeric id of its own, while each
of its terms carried `academicYearId: 2`. The enrolment POST was accepted with
that 2, so the sideways route works — it just shouldn't be necessary.

**Ask:** put `academicYearId` on `AcademicYearResponse`, or accept the year's
UUID in `StudentEnrolmentRequest`.

## A3. `POST /auth/users/students` returns a string, so onboarding can't hand the student to enrolment

**Confirmed 2026-09-28.** Creating a student answers `201` with a plain
sentence and nothing else:

```
"Student and parent(s) created successfully. Onboarding email sent to parent"
```

No id, no UUID, no body. Enrolment is the step that must follow — a student with
no class has no roster entry and no term bill — but the client has nothing to
enrol. Every identifier has to be re-discovered through
`GET /auth/users/students/lookup`.

`/dashboard/students/new` therefore hands the new student's **name** to
`/dashboard/academics/enrolments?student=<name>`, which re-runs the lookup and
selects the student when exactly one row comes back. Two students with the same
name, or a lookup that hasn't caught up with the write, and the admin picks from
the list by hand.

**Ask:** return the created `StudentResponse` (or at minimum `profileId` and
`profilePublicId`) from `POST /auth/users/students`. This is the same shape of
problem as §1, and the fix unblocks a genuinely automatic onboarding →
enrolment flow.

## A4. Smaller notes

- **`ClassLevelRequest.classStreams` vs the description.** The endpoint's own
  description says multiple streams *"requires `streamNames` array"* and shows
  `["A", "B", "C"]`. The schema has no `streamNames`: it has `classStreams`, an
  array of `{ classStreamName, priority, classStreamCapacity }`. The schema is
  what the frontend sends. Worth correcting the prose.
- **`ClassType` gained two values.** It is now `NURSERY`, `KINDERGARTEN`,
  `LOWER_PRIMARY`, `UPPER_PRIMARY`, `JUNIOR_HIGH_SCHOOL` — the old single
  `PRIMARY` is split in two. `src/lib/types.ts` matches the live spec.
- **No stream endpoints.** The tag's description advertises "stream
  allocations", but streams can only be created as part of a class level. There
  is no way to add a stream to an existing class, rename one, change its
  capacity, or move a student between streams. A school that outgrows one
  stream has no route forward.
- **No way to end or change an enrolment.** `EnrolmentStatus` has six values but
  only `ACTIVE` is reachable: there is no PATCH/PUT to withdraw, transfer,
  suspend or graduate. `PromotionStatus` exists in the enum catalogue with no
  endpoint behind it, so end-of-year promotion has to be done as a fresh
  `NEW_ADMISSION`-shaped POST, which loses the distinction.
- **Enrolment history is invisible.** `GET /enrolments/student/{id}/enrolment`
  returns the *active* enrolment only. There is no list, so "which class was
  this child in last year" cannot be answered.
- **No roster paging.** `GET /class_levels/{id}/students` returns every student
  in every stream in one response. Fine at 30 a stream; worth watching.

### Frontend status

`src/lib/classes.ts` wraps all seven endpoints. `/dashboard/academics/classes`
lists the class levels with their streams and creates new ones;
`/dashboard/academics/classes/[classLevelId]` shows the roster grouped by
stream; `/dashboard/academics/enrolments` places a student, warning first if
they already have an active enrolment (which would 409).

**Untested against real data.** Reproduced from the contract only — the test
school has no academic year (§8a), and without one no enrolment can be created
to exercise the read paths against.

---

## Impact summary for prioritisation

| Priority | Item | Effect once shipped |
| -------- | ---- | ------------------- |
| ~~P0~~ | ~~`POST /academics/years` stops 500ing — §8a~~ | **Shipped.** Verified 2026-09-28; the calendar, enrolment and billing are unblocked |
| P1 | Terms created with real dates — §8d | Removes three manual edits per year, and lets any term picker preselect the current term |
| P0 | The school's own UUID in login/profile — §O1 | `/dashboard/school` works at all |
| P0 | Numeric ids on their own resources (or UUIDs accepted in bodies) — §1 | Removes every raw-id input from the UI |
| P0 | Student + bill identity on line items — §1b | The overdue worklist can name who to chase |
| P0 | `GET /cash-sessions` — §2 | Replaces the `localStorage` workaround; real "open tills" view |
| P0 | Sums on filtered queries (or a summary endpoint) — §1c, §7 | Real money totals; unblocks a finance dashboard |
| P1 | `Page` from `/auth/users/lookup` — §O9 | The directory finds single matches and stops 500ing on common surnames |
| P1 | Back-fill terms for pre-existing years — §8b | Years created before auto-creation shipped are otherwise permanently termless — and un-enrollable (§A2) |
| P1 | `classLevelPublicId` on `ClassLevelResponse` — §A1 | Removes up to 13 lookup round-trips per page load; a class can be opened from the create response that produced it (list-row half unverified) |
| P1 | `academicYearId` on `AcademicYearResponse` — §A2 | The enrolment form stops loading terms to populate a year picker |
| P1 | The created student's ids from `POST /auth/users/students` — §A3 | Onboarding hands straight to enrolment instead of re-searching by name |
| P2 | Stream and enrolment mutations — §A4 | Withdraw, transfer, promote, and grow a class past its first streams |
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
