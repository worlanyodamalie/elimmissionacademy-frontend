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

## API endpoints (backend)

All paths are relative to `NEXT_PUBLIC_BACKEND_API_BASE_URL`. Headers:

- `X-School-Code: <code>` — required for every multi-tenant call.
- `Authorization: Bearer <jwt>` — required for protected calls (handled by `apiRequest`).

### Auth

| Constant              | Method | Path                          | Body / params                                                               | Notes                                       |
| --------------------- | ------ | ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `AUTH.registerSchool`     | POST   | `/auth/school/register`       | `{ school: {...}, admin: {...} }`                                           | Creates school and primary admin.           |
| `AUTH.adminAccountSetup`  | POST   | `/auth/school/admin/setup`    | Body `{ token, password }`; query `?token&schoolCode`                       | Activates the primary admin account.        |
| `AUTH.login`              | POST   | `/auth/login`                 | `{ login, password }`                                                       | Returns JWT and (where present) user info.  |
| `AUTH.forgotPassword`     | POST   | `/auth/forgot-password`       | `{ email }`                                                                 | Sends a reset email.                        |
| `AUTH.resetPassword`      | POST   | `/auth/reset-password`        | Body `{ token, newPassword }`; query `?token`                               | Completes a password reset.                 |

### Users (admin only)

| Constant                   | Method | Path                                | Body / params                                                                                        | Notes                                       |
| -------------------------- | ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `USERS.students`           | POST   | `/auth/users/students`              | `{ student: {...}, parents: [...] }`                                                                 | Enrolls a student and links parents.        |
| `USERS.teachers`           | POST   | `/auth/users/teachers`              | Staff payload                                                                                        | Adds a classroom teacher.                   |
| `USERS.headTeachers`       | POST   | `/auth/users/head-teachers`         | Staff payload                                                                                        | Adds a head teacher.                        |
| `USERS.admins`             | POST   | `/auth/users/admins`                | Staff payload                                                                                        | Adds another admin.                         |
| `USERS.setupPassword`      | POST   | `/auth/users/setup-password`        | `{ token, newPassword }`                                                                             | Invited users set their initial password.   |
| `USERS.resendOnboarding`   | POST   | `/auth/users/resend-onboarding?email=...` | Query string only.                                                                              | Re-issues an onboarding link.               |

### Payload shapes

Canonical TypeScript types live in `src/lib/types.ts`. Keep this brief; do not
duplicate every field here.

- `SchoolRegistrationPayload` — `{ school, admin }`
- `LoginPayload` — `{ login, password }`
- `StaffPayload` — admin / teacher / head-teacher creation body
- `StudentPayload` — `{ student, parents: ParentPayload[] }`
- `ParentPayload` — relation, contact, address, pickup permission

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
