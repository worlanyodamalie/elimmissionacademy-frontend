# URL reference

This file is the single human-readable index of every URL the dashboard depends
on. It mirrors the constants in `src/lib/endpoints.ts` (the runtime source of
truth) so reviewers don't need to grep.

> **Tip:** if you change an endpoint, update both `endpoints.ts` and this file.

## Configuration

| Variable                            | Scope   | Purpose                                                                                                  | Example                                                            |
| ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_BACKEND_API_BASE_URL`  | browser | Base URL the browser uses for API calls. **Required.** Trailing slash trimmed at runtime.                | `https://school-management-system-application.onrender.com/api/v1` |
| `NEXT_PUBLIC_APP_NAME`              | browser | Optional human-readable app name.                                                                        | `Elim Mission Academy`                                             |

Local development reads these from `.env.local` (gitignored). Copy
`.env.example` to get started.

The browser calls the backend directly, so the backend must include the
deployed origin (and `http://localhost:3000` for local dev) in its
`Access-Control-Allow-Origin` allowlist.

## App routes (frontend)

These are the Next.js routes a user can visit in the browser.

| Route                              | Purpose                                                       | Auth                |
| ---------------------------------- | ------------------------------------------------------------- | ------------------- |
| `/`                                | Splash; redirects to `/login` or `/dashboard`.                | none                |
| `/login`                           | Sign in to an existing school account.                        | none                |
| `/register-school`                 | Self-serve registration of a new school + primary admin.      | none                |
| `/admin-setup?token=...&schoolCode=...` | Primary admin sets a password using the token from email. | token in URL        |
| `/forgot-password`                 | Request a password reset email.                               | none                |
| `/reset-password?token=...&schoolCode=...` | Set a new password using the reset token from email.   | token in URL        |
| `/setup-password?token=...&schoolCode=...` | First-time password setup for invited users.           | token in URL        |
| `/dashboard`                       | Authenticated overview, quick actions, getting-started.       | authenticated       |
| `/dashboard/students`              | Students hub + resend onboarding tool.                        | authenticated admin |
| `/dashboard/students/new`          | Enroll a student with one or more parents/guardians.          | authenticated admin |
| `/dashboard/teachers`              | Teachers hub + resend onboarding tool.                        | authenticated admin |
| `/dashboard/teachers/new`          | Add a teacher.                                                | authenticated admin |
| `/dashboard/head-teachers`         | Head teachers hub + resend onboarding tool.                   | authenticated admin |
| `/dashboard/head-teachers/new`     | Add a head teacher.                                           | authenticated admin |
| `/dashboard/admins`                | Administrators hub + resend onboarding tool.                  | authenticated admin |
| `/dashboard/admins/new`            | Add another administrator.                                    | authenticated admin |
| `/dashboard/directory`             | Search every user in the school; resend onboarding links.     | authenticated admin |
| `/dashboard/directory/role-change` | Transfer someone to another role, or add a second one.        | authenticated admin |
| `/dashboard/school`                | School profile: registration details and subscription.        | authenticated admin |
| `/dashboard/academics`             | Manage academic years and terms.                              | authenticated admin |
| `/dashboard/billing`               | Student bills hub: open a bill, carry arrears forward.        | authenticated admin |
| `/dashboard/billing/bills/[publicId]` | One bill: charges, add a charge, record a payment.         | authenticated admin |
| `/dashboard/billing/service-costs` | The price list — what each service costs.                     | authenticated admin |
| `/dashboard/billing/overdue`       | Overdue charges, oldest first — the fee-chasing worklist.      | authenticated admin |
| `/dashboard/billing/charges`       | All bill line items, filterable by status/category/due date.  | authenticated admin |
| `/dashboard/billing/discounts`     | Create discounts and the rules that award them.               | authenticated admin |
| `/dashboard/collections`           | Cash sessions (open/close/approve) and recording payments.    | authenticated admin |

## API endpoints (backend)

All paths are relative to `NEXT_PUBLIC_BACKEND_API_BASE_URL`. Headers:

- `X-School-Code: <code>` — required for every multi-tenant call.
- `Authorization: Bearer <jwt>` — required for protected calls (handled by `apiRequest`).

### Auth

| Constant              | Method | Path                          | Body / params                                                               | Notes                                       |
| --------------------- | ------ | ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `AUTH.registerSchool`     | POST   | `/auth/school/register`       | `{ school: {...}, admin: {...}, subscription: {...} }`                      | Creates school, primary admin and subscription. |
| `AUTH.adminAccountSetup`  | POST   | `/auth/school/admin/setup`    | Body `{ password }`; query `?token`                                         | Activates the primary admin account.        |
| `AUTH.login`              | POST   | `/auth/users/login`           | `{ login, password }`                                                       | Returns JWT and (where present) user info.  |
| `AUTH.systemAdminLogin`   | POST   | `/auth/system-admin/login`    | `{ login, password }`                                                       | Platform operators, not school staff. Not used by the dashboard yet. |
| `AUTH.forgotPassword`     | POST   | `/auth/forgot-password`       | `{ email }`                                                                 | Sends a reset email.                        |
| `AUTH.resetPassword`      | POST   | `/auth/reset-password`        | Body `{ newPassword }`; query `?token`                                      | Completes a password reset.                 |
| `AUTH.schoolProfile(id)`  | GET    | `/auth/school/{schoolId}/profile` | Path param (school UUID).                                               | School details, address, currency and subscriptions. |

### Users (admin only)

| Constant                   | Method | Path                                | Body / params                                                                                        | Notes                                       |
| -------------------------- | ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `USERS.students`           | POST   | `/auth/users/students`              | `{ student: {...}, parents: [...] }`                                                                 | Enrolls a student and links parents.        |
| `USERS.parentsLookup`      | GET    | `/auth/users/parents/lookup`        | Query `?query=&page=&size=`                                                                          | Searches existing parents (paginated).      |
| `USERS.lookup`             | GET    | `/auth/users/lookup`                | Query `?query=&page=&size=`                                                                          | Searches every user in the school (paginated). Rows are untyped objects. |
| `USERS.teachers`           | POST   | `/auth/users/teachers`              | `StaffPayload` (teacher profile)                                                                     | Adds a classroom teacher.                   |
| `USERS.headTeachers`       | POST   | `/auth/users/head-teachers`         | `StaffPayload` (head-teacher profile)                                                                | Adds a head teacher.                        |
| `USERS.admins`             | POST   | `/auth/users/admins`                | `StaffPayload` (admin profile)                                                                       | Adds another admin.                         |
| `USERS.roleChange`         | PATCH  | `/auth/users/role-change`           | `RoleChangePayload` (`email`, `mobileNumber`, `targetRole`, `changeType`, `profileDetails`)          | Transfers a user to another role, or adds one alongside. |
| `USERS.setupPassword`      | POST   | `/auth/users/setup-password`        | Body `{ newPassword }`; query `?token`                                                               | Invited users set their initial password.   |
| `USERS.resendOnboarding`   | POST   | `/auth/users/resend-onboarding?email=...` | Query string only.                                                                              | Re-issues an onboarding link.               |
| `USERS.profile(id)`        | GET    | `/auth/users/{profileId}/profile`   | Path param only.                                                                                     | Role-specific profile (student/parent/teacher/head-teacher/admin). |

### Academics (admin only)

| Constant                   | Method | Path                                | Body / params                                                                                        | Notes                                       |
| -------------------------- | ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `ACADEMICS.years`          | POST   | `/school/academics/years`           | `AcademicYearRequest`                                                                                | Creates an academic year.                   |
| `ACADEMICS.years`          | GET    | `/school/academics/years`           | Query `?page=&size=&sort=`                                                                           | Paginated years (default sort: startDate).  |
| `ACADEMICS.year(publicId)` | GET    | `/school/academics/years/{publicId}` | Path param only.                                                                                    | Single academic year.                       |
| `ACADEMICS.terms`          | POST   | `/school/academics/terms`           | `AcademicTermRequest` (needs numeric `academicYearId`)                                               | Creates a term under a year.                |
| `ACADEMICS.terms`          | GET    | `/school/academics/terms`           | Query `?page=&size=&sort=`                                                                           | Paginated terms.                            |
| `ACADEMICS.term(publicId)` | GET    | `/school/academics/terms/{publicId}` | Path param only.                                                                                    | Single term.                                |

### Billing (admin only)

Typed wrappers for everything below live in `src/lib/billing.ts` — prefer those
over calling `apiRequest` directly.

| Constant                                | Method | Path                                                | Body / params                                                     | Notes                                                        |
| --------------------------------------- | ------ | --------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `BILLING.serviceCosts`                  | GET    | `/school/payments/service-costs`                    | Query `?page=&size=&sort=`                                        | Paginated price list.                                        |
| `BILLING.serviceCosts`                  | POST   | `/school/payments/service-costs`                    | `ServiceCostRequest`                                              | Prices a service; 409 on duplicate.                          |
| `BILLING.serviceCost(publicId)`         | GET    | `/school/payments/service-costs/{publicId}`         | Path param only.                                                  | Single service cost.                                         |
| `BILLING.studentBills`                  | GET    | `/school/payments/student-bills`                    | Query `?page=&size=&sort=`                                        | Paginated student bills.                                     |
| `BILLING.studentBills`                  | POST   | `/school/payments/student-bills`                    | `StudentBillRequest` (numeric `studentId`, `academicTermId`)       | Opens a bill for a student in a term; 409 if one exists.      |
| `BILLING.studentBill(publicId)`         | GET    | `/school/payments/student-bills/{publicId}`         | Path param only.                                                  | Bill with its line items.                                    |
| `BILLING.carryForwardArrears`           | POST   | `/school/payments/student-bills/arrears/carry-forward` | Query `?studentId&previousTermId&newTermId` (UUIDs)             | Moves an unpaid balance onto the new term. Returns no body.   |
| `BILLING.billLineItems`                 | GET    | `/school/payments/bill-line-items`                  | Query: `BillLineItemFilter` fields + `?page=&size=&sort=`          | Filter by bill, student, status, category, source, due date.  |
| `BILLING.billLineItem(publicId)`        | GET    | `/school/payments/bill-line-items/{publicId}`       | Path param only.                                                  | Single line item.                                            |
| `BILLING.billLineItemFromServiceCost`   | POST   | `/school/payments/bill-line-items/service-cost`     | `AutomaticBillLineItemRequest`                                    | Charge priced from the service-cost list.                    |
| `BILLING.manualBillLineItem`            | POST   | `/school/payments/bill-line-items/manual`           | `ManualBillLineItemRequest`                                       | Ad-hoc charge; `manualReason` required for the audit trail.   |

### Collections (admin / cashier)

| Constant                                | Method | Path                                        | Body / params             | Notes                                                                     |
| --------------------------------------- | ------ | ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `COLLECTIONS.payments`                  | POST   | `/school/payments`                          | `PaymentRequest`          | Records money received and allocates it across line items.                |
| `COLLECTIONS.cashSessions`              | POST   | `/school/cash-sessions`                     | `OpenSessionRequest`      | Opens a cashier's till; 409 if that cashier already has an open session.   |
| `COLLECTIONS.cashSession(publicId)`     | GET    | `/school/cash-sessions/{publicId}`          | Path param only.          | Session totals, variance and payment count.                               |
| `COLLECTIONS.closeCashSession(publicId)`| POST   | `/school/cash-sessions/{publicId}/close`    | `CloseSessionRequest`     | Closes against a physical count; backend computes the variance.            |
| `COLLECTIONS.approveCashSession(publicId)` | POST | `/school/cash-sessions/{publicId}/approve` | `ApproveSessionRequest`   | Supervisor sign-off; 403 if the approver lacks the role.                   |

Cash taken at the counter should carry the open session's numeric
`cashCollectionSessionId` on the payment, otherwise the till won't reconcile
when it's closed.

### Discounts (admin only)

| Constant              | Method | Path                       | Body / params          | Notes                                                     |
| --------------------- | ------ | -------------------------- | ---------------------- | --------------------------------------------------------- |
| `DISCOUNTS.discounts` | POST   | `/school/discounts`        | `DiscountRequest`      | Fixed or percentage discount; 409 on duplicate name.      |
| `DISCOUNTS.rules`     | POST   | `/school/discounts/rules`  | `DiscountRuleRequest`  | Eligibility criteria so a discount applies automatically. |

### Payload shapes

Canonical TypeScript types live in `src/lib/types.ts`. Keep this brief; do not
duplicate every field here.

- `SchoolRegistrationPayload` — `{ school, admin }`
- `LoginPayload` — `{ login, password }`
- `StaffPayload` — `{ email, mobileNumber, isExistingUser, personalDetails?, profileDetails }`;
  `profileDetails` is role-specific (`TeacherProfileDetails` /
  `HeadTeacherProfileDetails` / `AdminProfileDetails`)
- `StudentPayload` — `{ student, parents: StudentParentEntry[] }`
- `StudentParentEntry` — `{ existingParent, newParent }` (exactly one set)
- `ParentRelationship` — relation type, custody, contact preferences, permissions
- `ParentSummary` / `PageResponse<T>` — parent lookup result row and page wrapper
- `ServiceCostRequest` / `StudentBillRequest` — price-list entry and per-term bill
- `AutomaticBillLineItemRequest` / `ManualBillLineItemRequest` — the two ways to
  add a charge to a bill (from the price list, or ad-hoc)
- `PaymentRequest` — `cashAmount` plus optional bill, session and payee details
- `OpenSessionRequest` / `CloseSessionRequest` / `ApproveSessionRequest` — the
  cash-session lifecycle
- `DiscountRequest` / `DiscountRuleRequest` — a discount and its eligibility rule

Enums worth noting: currency spells the euro `EURO` (not `EUR`); bills and line
items use `BillPaymentStatus` (`PAID`/`UNPAID`/`PARTIALLY_PAID`/`VOID`) while
payments use a different `PaymentStatus`
(`PENDING`/`CONFIRMED`/`SUCCESSFUL`/`FAILED`/`REVERSED`).

## Cross-cutting concerns

- **Authorization**: protected routes use `Authorization: Bearer <jwt>`. The
  token is decoded client-side only to read claims (`schoolCode`, `roles`,
  `userId`); it is **not** verified in the browser — the API is the trust
  boundary.
- **Tenant scoping**: every API call sends `X-School-Code`. The header value
  comes from the JWT's `schoolCode` claim once a user is logged in, or from a
  form field on public pages.
- **Tokens in URLs**: `admin-setup`, `reset-password`, and `setup-password`
  accept `?token=` and `?schoolCode=`. They are single-use and tied to a
  specific email address by the backend.
