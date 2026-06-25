# Tech debt and refactor backlog

A prioritized list of non-optimal areas in the codebase, each with a rough effort
estimate (S/M/L). Current as of June 2026.

## Findings (ranked)

### 1. NewGrant / EditGrant duplication

Both form pages are large and share a big block of identical form JSX plus duplicated
logic.

- Same field JSX (title, director, subjects, files, budget) in both → extract a
  presentational `<GrantForm>`.
- Copy-pasted types/consts: `UserOption`, `GrantFormErrors`, `MAX_FILES=3` → move to
  `types/grant.ts` + a `constants.ts`.
- Same "fetch user-options" effect in both → `useUserOptions(token)` hook.
- Same submit flow (multipart-vs-JSON, validate, navigate) → `useGrantSubmit(grantId?)`.
- Bug-risk divergences to fix while unifying: the two forms have drifted on validation
  (e.g. the file-required-when-`usesSubjects=yes` check) and on whether `handleChange`
  uses a functional update or a raw spread. Reconcile these while extracting the shared
  form.

Effort: L. Highest payoff.

### 2. API base URL hardcoded ~56 times

`http://localhost:5000` is pasted into every page and test; the `Authorization: Bearer`
header is re-typed at every call site. No env var, no Vite proxy.

- Create one `client/src/api/client.ts` axios instance: `baseURL` from `VITE_API_URL`,
  a request interceptor that injects the token. New file, additive.
- Migrate every call site, including the review pages (`Review`, `ReviewDetail`,
  `DeptReview`, `CollegeGrants`) and `NewGrant` / `EditGrant`.

Effort: M. High leverage; kills ~56 URL strings and every manual auth header.

### 3. Unauthenticated admin endpoints

Most `/api/admin/*` routes have no `verifyToken`:

- `GET /users` returns all users incl. PII (email, birthday, dept).
- `POST /updateArcc` lets anyone unauthenticated rewrite ARCC committee membership
  (privilege escalation).
- `GET /arcc`, `createCollege`, `updateCollege`, `createDepartment`, `updateDepartment`
  are all open.

A real functional hole, not a hardening nit. The client even calls `/arcc` with no token
(`Dashboard.tsx:31`). Fix: add `verifyToken` + an admin check. The `checkDeptChair`
endpoint does use `verifyToken`; the older `/users`, `/updateArcc`, `/arcc`, college and
department routes do not.

Effort: M.

### 4. Server boilerplate

- try/catch + `res.status(500)` repeated ~24x → an `asyncHandler` wrapper / error
  middleware.
- Inline auth checks (`isArccMember` x4, `role !== "admin"` x3, a local `requireAdmin`
  in `criteria.ts`, plus `isDeptChair`) → real `requireAdmin` / `requireArcc` /
  `requireDeptChair` middleware.
- Collection-name string literals (`"grant"` x10, `"user"`, `"arcc"`, ...) and
  `ObjectId.isValid` x9 scattered → constants + a `validateId` middleware.

The middleware/helpers are new files (additive); apply them across `grantSubmission.ts`,
`admin.ts`, and `collegeGrants.ts`. Effort: M.

### 5. Types / shared model

- `GRANT_STATUS` defined twice (`client/src/types/grant.ts` +
  `server/.../grantValidation.ts`), a drift risk; extract a shared status module and
  re-export.
- ~13 client + 3 server `any` on fetched data (`grant: any` in nearly every `.map`). No
  shared `Grant` / `User` / `Criteria` DTOs; replace `any` everywhere, including the
  review pages and the `reviews[]` entry shape.
- `reviewStatus` / `collegeReviewStatus` literals scattered, no enum.

Effort: M.

### 6. Form-page duplication

Login, Register, Profile, CreateCollege, CreateDepartment all repeat `[form,setForm]` +
`handleChange` spread + try/catch/finally + error display. Extract a
`useForm(initial, onSubmit)` hook. Doubles as a clean template for the `<GrantForm>` work
(item 1). Effort: M.

### 7. Smaller cleanup

- `DeptReview.tsx` default export is named `Review` (copy-paste leftover; imported as
  `DepartmentReview` in `App.tsx`). Effort: S.
- Status/format helpers duplicated across `Review.tsx` (`formatReviewCount`) and
  `ReviewDetail.tsx` → `utils/format.ts`. Effort: S.
- Build script `tsc -b` is broken, and `server/` has no eslint config. Effort: S.
- Test gaps: 8 pages + 3 routes untested; `grantValidation.ts` (core submission logic)
  has zero tests. Effort: M.

### 8. Styling: migrate to CSS Modules

The client styles three different ways: seven global stylesheets (`Dashboard.css` is the
large shared one imported across most pages, plus `App.css`, `index.css`, `Auth.css`,
`Review.css`, `ArccCommittee.css`, `AllocationPage.css`), inline `style={{...}}` objects
scattered across eight components (`CriteriaForm`, `DashHeader`, `AdminDashboard`,
`Dashboard`, `EditGrant`, `NewGrant`, `Register`, `CriteriaManagement`), plus a large
inline `styles` object in `CriteriaManagement.tsx`. Global class names are not scoped, so
they leak across pages.

Adopt CSS Modules (`*.module.css`, scoped class names) as the single styling approach:
convert the global stylesheets to per-component modules and fold the inline style objects
into their component's module. Vite supports CSS Modules out of the box. Effort: L
(touches most pages); migrate incrementally, one page/stylesheet at a time.

---

## Priority order

Rough sequencing by payoff:

1. **Item 3, admin-endpoint auth** — the one real functional/security hole; do it first.
2. **Item 6, `useForm` hook** across the five form pages — sets the pattern for
   `<GrantForm>`.
3. **Item 1, GrantForm extraction** from NewGrant / EditGrant — highest-leverage DRY win.
4. **Item 2, axios client** (`api/client.ts`) applied to every call site.
5. **Item 4, server middleware** (`asyncHandler`, `requireAdmin`, `requireArcc`,
   `requireDeptChair`) across all routes.
6. **Item 5**, shared `GRANT_STATUS` / status-enum module.
7. **Item 7**, build-script fix, server eslint config, the `DeptReview` export rename, and
   tests for `grantValidation.ts` / `college.ts` / `department.ts`.
8. **Item 8, CSS Modules migration** — incremental, per page; no functional risk.
