# Tech debt and refactor backlog

A prioritized list of non-optimal areas found in a full read-only sweep of the
codebase (June 2026). Each item notes rough effort (S/M/L) and whether starting it
now would conflict with an open PR.

## Conflict map: cleared

The feature work on the grant-form, review/scoring, department and dean approval,
timeline, matching-funds, and allocation surfaces is all in. The files the feature work touched
(`NewGrant.tsx`, `EditGrant.tsx`, `GrantContext.tsx`, `App.tsx`, `Review.tsx`,
`ReviewDetail.tsx`, `Review.css`, `DeptReview.tsx`, `CollegeGrants.tsx`,
`AllocationPage.tsx`, `grantSubmission.ts`, `admin.ts`, `app.ts`) have settled, so the
tree is cold and every refactor below is safe to start.

---

## Findings (ranked)

### 1. NewGrant / EditGrant duplication — SAFE NOW

527 + 555 lines, ~220 lines of identical form JSX plus duplicated logic.

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

Effort: L. Highest payoff. The feature work on these files has settled, so the
duplication is frozen, making this a clean extraction target.

### 2. API base URL hardcoded ~56 times — SAFE NOW

`http://localhost:5000` is pasted into every page and test; the `Authorization: Bearer`
header is re-typed at every call site. No env var, no Vite proxy.

- Create one `client/src/api/client.ts` axios instance: `baseURL` from `VITE_API_URL`,
  a request interceptor that injects the token. New file, additive.
- All pages are now cold, so migrate every call site, including the review pages
  (`Review`, `ReviewDetail`, `DeptReview`, `CollegeGrants`) and `NewGrant` / `EditGrant`.

Effort: M. High leverage; kills ~56 URL strings and every manual auth header.

### 3. Unauthenticated admin endpoints — SAFE NOW

Most `/api/admin/*` routes have no `verifyToken`:

- `GET /users` returns all users incl. PII (email, birthday, dept).
- `POST /updateArcc` lets anyone unauthenticated rewrite ARCC committee membership
  (privilege escalation).
- `GET /arcc`, `createCollege`, `updateCollege`, `createDepartment`, `updateDepartment`
  all open.

A real functional hole, not a hardening nit. The client even calls `/arcc` with no
token today (`Dashboard.tsx:31`). Fix: add `verifyToken` + an admin check. Note: when
nav work lifts `isArcc` into `AuthContext`, point it at the secured endpoint. The newer
`checkDeptChair` endpoint does use `verifyToken`; the older `/users`,
`/updateArcc`, `/arcc`, college and department routes still do not.

Effort: M. `admin.ts` is cold, so this is safe to start.

### 4. Server boilerplate — SAFE NOW

- try/catch + `res.status(500)` repeated ~24x → an `asyncHandler` wrapper / error
  middleware.
- Inline auth checks (`isArccMember` x4, `role !== "admin"` x3, a local `requireAdmin`
  in `criteria.ts`) → real `requireAdmin` / `requireArcc` middleware.
- Collection-name string literals (`"grant"` x10, `"user"`, `"arcc"`, ...) and
  `ObjectId.isValid` x9 scattered → constants + a `validateId` middleware.

The middleware/helpers are new files (additive). All routes are cold now, so apply them
across the board, including `grantSubmission.ts`, `admin.ts`, and the new
`collegeGrants.ts`. Note `isDeptChair` is a fourth inline auth helper to
fold into shared middleware. Effort: M.

### 5. Types / shared model — SAFE NOW

- `GRANT_STATUS` defined twice (`client/src/types/grant.ts` + `server/.../grantValidation.ts`),
  drift risk. Both files are cold; extract a shared status module and re-export.
- ~13 client + 3 server `any` on fetched data (`grant: any` in nearly every `.map`). No
  shared `Grant` / `User` / `Criteria` DTOs. All pages are cold now, so replace `any`
  everywhere, including the review pages and the new `reviews[]` entry shape.
- `reviewStatus` / `collegeReviewStatus` literals scattered, no enum.

Effort: M.

### 6. Form-page duplication — SAFE NOW

Login, Register, Profile, CreateCollege, CreateDepartment all repeat `[form,setForm]` +
`handleChange` spread + try/catch/finally + error display. Extract a
`useForm(initial, onSubmit)` hook. All five pages are cold. Doubles as a clean template
for the later `<GrantForm>` work. Effort: M.

### 7. Smaller cleanup

- `DeptReview.tsx` default export is named `Review` (copy-paste leftover; imported as
  `DepartmentReview` in `App.tsx`). Now merged and cold, SAFE. Effort: S.
- Status/format helpers duplicated across `Review.tsx` (`formatReviewCount`) and
  `ReviewDetail.tsx` → `utils/format.ts`. Both cold now, SAFE. Effort: S.
- Build script `tsc -b` broken (known) and `server/` has no eslint config. Cold, SAFE.
  Effort: S.
- Test gaps: 8 pages + 3 routes untested; `grantValidation.ts` (core submission logic)
  has zero tests. `grantValidation.ts`, `college.ts`, `department.ts` are cold → write
  those tests now. Effort: M.

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

With the feature work settled the whole tree is cold, so nothing is blocked.
Rough sequencing by payoff:

1. **#3 admin-endpoint auth** — the one real functional/security hole; do it first.
2. **#6 `useForm` hook** across the five form pages — sets the pattern for `<GrantForm>`.
3. **#1 GrantForm extraction** from NewGrant / EditGrant — highest-leverage DRY win now
   that both files are frozen.
4. **#2 axios client** (`api/client.ts`) applied to every call site.
5. **#4 server middleware** (`asyncHandler`, `requireAdmin`, `requireArcc`,
   `requireDeptChair`) across all routes.
6. **#5** shared `GRANT_STATUS` / status-enum module.
7. **#7** build-script fix, server eslint config, the `DeptReview` export rename, and
   tests for `grantValidation.ts` / `college.ts` / `department.ts`.
8. **#8 CSS Modules migration** — incremental, per page; no functional risk.
