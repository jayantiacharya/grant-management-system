# Tech debt and refactor backlog

A prioritized list of non-optimal areas found in a full read-only sweep of the
codebase (June 2026). Each item notes rough effort (S/M/L) and whether starting it
now would conflict with an open PR.

## Conflict map: files currently "hot" (touched by open PRs)

Refactors that edit these files will collide with in-flight work. Avoid until the
relevant PRs merge.

| File                                   | Touched by                       |
| -------------------------------------- | -------------------------------- |
| `client/src/pages/NewGrant.tsx`        | #21 matching-funds, #26 timeline |
| `client/src/pages/EditGrant.tsx`       | #21, #26                         |
| `client/src/context/GrantContext.tsx`  | #21, #26                         |
| `client/src/App.tsx`                   | #22 dean, #23 dept, #28          |
| `client/src/pages/Review.tsx`          | #23, #27 rating, #28             |
| `client/src/pages/ReviewDetail.tsx`    | #23, #27, #28                    |
| `client/src/pages/Review.css`          | #27, #28                         |
| `client/src/pages/DeptReview.tsx`      | #23, #28 (new file)              |
| `client/src/pages/CollegeGrants.tsx`   | #22 (new file)                   |
| `server/src/routes/grantSubmission.ts` | #23, #26, #27, #28               |
| `server/src/routes/admin.ts`           | #23, #28                         |
| `server/src/app.ts`                    | #22                              |

Everything else is "cold" and safe to refactor now: the auth/Create*/Profile/Login/
Register/ArccCommittee/AdminDashboard/Dashboard/CriteriaManagement pages,
`AuthContext`, `DashHeader`, `CriteriaForm`, all `types/*`, and the
`auth/college/department/criteria/grantValidation` server routes plus middleware.

---

## Findings (ranked)

### 1. NewGrant / EditGrant duplication — BLOCKED by #21, #26

527 + 555 lines, ~220 lines of identical form JSX plus duplicated logic.

- Same field JSX (title, director, subjects, files, budget) in both → extract a
  presentational `<GrantForm>`.
- Copy-pasted types/consts: `UserOption`, `GrantFormErrors`, `MAX_FILES=3` → move to
  `types/grant.ts` + a `constants.ts`.
- Same "fetch user-options" effect in both → `useUserOptions(token)` hook.
- Same submit flow (multipart-vs-JSON, validate, navigate) → `useGrantSubmit(grantId?)`.
- Bug-risk divergences to fix while unifying: EditGrant dropped the "file required when
  `usesSubjects=yes`" check that NewGrant has (`NewGrant.tsx:136` vs `EditGrant.tsx:152`);
  `handleChange` uses a functional update in one, a raw spread in the other.

Effort: L. Highest payoff, but wait for #21 and #26 to merge first (both add fields to
all three files).

### 2. API base URL hardcoded ~56 times — PARTIALLY SAFE

`http://localhost:5000` is pasted into every page and test; the `Authorization: Bearer`
header is re-typed at every call site. No env var, no Vite proxy.

- Create one `client/src/api/client.ts` axios instance: `baseURL` from `VITE_API_URL`,
  a request interceptor that injects the token. New file, additive.
- Migrate cold pages now (Login, Register, Profile, Create\*, ArccCommittee,
  AdminDashboard, Dashboard, CriteriaManagement). Leave the hot pages (NewGrant,
  EditGrant, Review, ReviewDetail) for after their PRs land.

Effort: M. High leverage; kills ~56 URL strings and every manual auth header.

### 3. Unauthenticated admin endpoints — BLOCKED (admin.ts is hot)

Most `/api/admin/*` routes have no `verifyToken`:

- `GET /users` returns all users incl. PII (email, birthday, dept).
- `POST /updateArcc` lets anyone unauthenticated rewrite ARCC committee membership
  (privilege escalation).
- `GET /arcc`, `createCollege`, `updateCollege`, `createDepartment`, `updateDepartment`
  all open.

A real functional hole, not a hardening nit. The client even calls `/arcc` with no
token today (`Dashboard.tsx:31`). Fix: add `verifyToken` + an admin check. Note: when
nav work lifts `isArcc` into `AuthContext`, point it at the secured endpoint.

Effort: M. `admin.ts` is touched by #23/#28, so coordinate or wait.

### 4. Server boilerplate — PARTIALLY SAFE

- try/catch + `res.status(500)` repeated ~24x → an `asyncHandler` wrapper / error
  middleware.
- Inline auth checks (`isArccMember` x4, `role !== "admin"` x3, a local `requireAdmin`
  in `criteria.ts`) → real `requireAdmin` / `requireArcc` middleware.
- Collection-name string literals (`"grant"` x10, `"user"`, `"arcc"`, ...) and
  `ObjectId.isValid` x9 scattered → constants + a `validateId` middleware.

The middleware/helpers are new files (additive). Apply them to cold routes now
(`auth.ts`, `college.ts`, `department.ts`, `criteria.ts`); defer `grantSubmission.ts`
and `admin.ts` (hot). Effort: M.

### 5. Types / shared model — PARTIALLY SAFE

- `GRANT_STATUS` defined twice (`client/src/types/grant.ts` + `server/.../grantValidation.ts`),
  drift risk. Both files are cold; extract a shared status module and re-export.
- ~13 client + 3 server `any` on fetched data (`grant: any` in nearly every `.map`). No
  shared `Grant` / `User` / `Criteria` DTOs. Replacing `any` in cold pages is safe;
  hot pages (Review\*, NewGrant, EditGrant) wait.
- `reviewStatus` / `collegeReviewStatus` literals scattered, no enum.

Effort: M.

### 6. Form-page duplication — SAFE NOW

Login, Register, Profile, CreateCollege, CreateDepartment all repeat `[form,setForm]` +
`handleChange` spread + try/catch/finally + error display. Extract a
`useForm(initial, onSubmit)` hook. All five pages are cold. Doubles as a clean template
for the later `<GrantForm>` work. Effort: M.

### 7. Smaller cleanup

- `CriteriaManagement.tsx` has a 241-line inline `styles` object → move to a CSS file.
  Cold, SAFE. Effort: S–M.
- `DeptReview.tsx` default export is named `Review` (copy-paste leftover). Hot (#23/#28),
  fix in that PR. Effort: S.
- `formatStatus` copy-pasted in `Review.tsx` + `ReviewDetail.tsx` → `utils/format.ts`.
  Both consumers are hot; defer. Effort: S.
- Build script `tsc -b` broken (known) and `server/` has no eslint config. Cold, SAFE.
  Effort: S.
- Test gaps: 8 pages + 3 routes untested; `grantValidation.ts` (core submission logic)
  has zero tests. `grantValidation.ts`, `college.ts`, `department.ts` are cold → write
  those tests now. Effort: M.

---

## Safe to start now (no PR conflicts)

1. **#6 `useForm` hook** across the five cold form pages — clean DRY win, sets the
   pattern for the eventual `<GrantForm>`.
2. **#2 axios client** (`api/client.ts`) applied to cold pages only.
3. **#4 server middleware** (`asyncHandler`, `requireAdmin`) applied to cold routes.
4. **#7** CriteriaManagement CSS extraction, build-script fix, server eslint config,
   and tests for `grantValidation.ts` / `college.ts` / `department.ts`.
5. **#5** shared `GRANT_STATUS` / status-enum module (both definition sites are cold).

## Blocked until PRs merge

- **#1** GrantForm extraction — after #21 and #26.
- **#3** admin-endpoint auth, and any Review/ReviewDetail/grantSubmission refactor —
  after #22/#23/#27/#28.
