# Tech debt and refactor backlog

A prioritized list of non-optimal areas in the codebase, each with a rough effort
estimate (S/M/L). Current as of July 2026.

## Findings (ranked)

### 1. API base URL hardcoded ~76 times

`http://localhost:5000` is pasted into every page and test; the `Authorization: Bearer`
header is re-typed at every call site. No env var, no Vite proxy.

- Create one `client/src/api/client.ts` axios instance: `baseURL` from `VITE_API_URL`,
  a request interceptor that injects the token. New file, additive.
- Migrate every call site, including the review pages (`Review`, `ReviewDetail`,
  `DeptReview`, `CollegeGrants`) and `GrantForm`.

Effort: M. High leverage; kills ~76 URL strings and every manual auth header.

### 2. Server boilerplate

- try/catch + `res.status(500)` repeated ~29x → an `asyncHandler` wrapper / error
  middleware.
- Inline auth checks (`isArccMember` x5, `role !== "admin"` x3, a local `requireAdmin`
  duplicated in both `criteria.ts` and `admin.ts`, plus `isDeptChair`) → real
  `requireAdmin` / `requireArcc` / `requireDeptChair` middleware.
- Collection-name string literals (`"grant"` x26, `"user"`, `"arcc"`, ...) and
  `ObjectId.isValid` x16 scattered → constants + a `validateId` middleware.

The middleware/helpers are new files (additive); apply them across `grantSubmission.ts`,
`admin.ts`, and `collegeGrants.ts`. Effort: M.

### 3. Types / shared model

- `GRANT_STATUS` defined twice (`client/src/types/grant.ts` +
  `server/.../grantValidation.ts`), a drift risk; extract a shared status module and
  re-export.
- ~24 client + 3 server `any` on fetched data (`grant: any` in nearly every `.map`). No
  shared `Grant` / `User` / `Criteria` DTOs; replace `any` everywhere, including the
  review pages and the `reviews[]` entry shape.
- `reviewStatus` / `collegeReviewStatus` literals scattered, no enum.
- Legacy `amountAwarded` field: grant-reports responses read
  `allocatedAmount ?? amountAwarded`; once no grant docs carry the legacy field, drop
  the fallback. The dashboard's "approved" predicate (positive award only) is also
  slightly looser than grant-reports' (dept + college approval plus positive award).
  Effort: S.

Effort: M.

### 4. Form-page duplication

Login, Register, Profile, CreateCollege, CreateDepartment all repeat `[form,setForm]` +
`handleChange` spread + try/catch/finally + error display. Extract a
`useForm(initial, onSubmit)` hook. Effort: M.

### 5. Smaller cleanup

- `DeptReview.tsx` default export is named `Review` (copy-paste leftover; imported as
  `DepartmentReview` in `App.tsx`). Effort: S.
- Build script `tsc -b` is broken, and `server/` has no eslint config. Effort: S.
- Test gaps: 11 pages + 2 routes untested; `grantValidation.ts` (core submission logic)
  has zero tests. Effort: M.

### 6. Styling: migrate to CSS Modules

All client styles live in per-page/per-component stylesheets under `client/src/styles/`
(17 files: `Dashboard.css`, `GrantForm.css`, `PageLayout.css`, `Profile.css`, etc.), and
the former inline `style={{...}}` objects have been folded into them. Class names are
still global, so styles can leak between pages that import overlapping sheets.

Remaining work: rename the sheets to CSS Modules (`*.module.css`, scoped class names) and
switch components to scoped imports. Vite supports CSS Modules out of the box. Effort: M
(mechanical); migrate incrementally, one page/stylesheet at a time.

---

## Priority order

Rough sequencing by payoff:

1. **Item 4, `useForm` hook** across the five form pages.
2. **Item 1, axios client** (`api/client.ts`) applied to every call site.
3. **Item 2, server middleware** (`asyncHandler`, `requireAdmin`, `requireArcc`,
   `requireDeptChair`) across all routes.
4. **Item 3**, shared `GRANT_STATUS` / status-enum module.
5. **Item 5**, build-script fix, server eslint config, the `DeptReview` export rename, and
   tests for `grantValidation.ts` / `donorReport.ts`.
6. **Item 6, CSS Modules migration** — incremental, per page; no functional risk.
