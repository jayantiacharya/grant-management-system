# Architecture and navigation

This describes the current state of the build: how the client, server, and data fit
together, how a user navigates, and where the known gaps are. For what the system is
ultimately meant to do, see [requirements.md](./requirements.md).

Diagrams are Mermaid; GitHub renders them inline, or paste the code blocks into
[mermaid.live](https://mermaid.live).

## System context

```mermaid
flowchart LR
    User([User]) --> Client["Client<br/>React + Vite<br/>localhost:5173"]
    Client -->|"axios + JWT"| API["Server<br/>Express<br/>localhost:5000"]
    API --> DB[("MongoDB<br/>linkUpDatabase")]
```

A React single-page app talks to an Express API over axios with a JWT bearer token;
Express reads and writes a single MongoDB database through the raw Node driver.

## Client map

Pages grouped by the route guard that wraps them. `PublicRoute` redirects signed-in
users away; `ProtectedRoute` requires a token; `AdminRoute` additionally requires
`role=admin`.

```mermaid
flowchart TB
    subgraph Contexts
        AUTH["AuthContext<br/>user, token, isArcc, isDean, isDeptChair"]
        GRANT["GrantContext<br/>shared draft + budget, activeGrantId"]
    end

    subgraph Public ["Public (PublicRoute)"]
        LOGIN[Login]
        REG[Register]
    end

    subgraph Proposer ["Proposer (ProtectedRoute)"]
        DASH[Dashboard]
        NEW[NewGrant]
        EDIT[EditGrant]
        BUDGET[BudgetWorksheet]
        PROFILE[Profile]
        APPROVED[ApprovedGrants]
        REPORT[GrantReport]
    end

    subgraph Review ["Review & approval (ProtectedRoute)"]
        REV[Review]
        REVDET[ReviewDetail]
        DEPTREV[DeptReview]
        CG[CollegeGrants]
    end

    subgraph Admin ["Admin (ProtectedRoute; Criteria + Allocation are AdminRoute)"]
        ADASH[AdminDashboard]
        COLLEGE[CreateCollege]
        DEPT[CreateDepartment]
        ARCCPG[ArccCommittee]
        CRIT[CriteriaManagement]
        ALLOC[AllocationPage]
    end
```

Two contexts back these pages, both persisted to `localStorage`: `AuthContext` holds the
session (`user`, `token`, and the role flags: `isDean` resolved at login, `isArcc` and
`isDeptChair` fetched once by the provider after login), and
`GrantContext` holds the shared grant draft and budget items across `NewGrant`,
`EditGrant`, and `BudgetWorksheet`. A shared `DashHeader` (brand/home, role-based nav
links with the current page's link disabled, optional back link, profile, sign out)
renders on every page, and `CriteriaForm` backs criteria management. Page-to-page
navigation is in [Navigation](#navigation).

## Server and data map

```mermaid
flowchart LR
    APP["app.ts"]

    subgraph Middleware
        VERIFY["verifyToken (JWT)"]
        MULTER["multer<br/>uploads/ (3 files + IRB doc)"]
        VALID["grantValidation<br/>draft vs submitted rules"]
        CONN["Mongo conn<br/>(connects before listen)"]
    end

    subgraph Routes
        AUTHR["/api/auth"]
        GRANTR["/api/grants"]
        ADMINR["/api/admin"]
        CRITR["/api/criteria"]
        CGR["/api/college-grants"]
        ALLOCR["/api/allocation"]
        GRPTR["/api/grant-reports"]
    end

    subgraph Collections ["MongoDB (linkUpDatabase)"]
        CUSER[("user")]
        CGRANT[("grant")]
        CARCC[("arcc")]
        CCRIT[("criteria")]
        CCOLL[("college / department")]
        CALLOC[("allocationSettings")]
    end

    APP --> AUTHR & GRANTR & ADMINR & CRITR & CGR & ALLOCR & GRPTR
    GRANTR -.- VERIFY & VALID & MULTER
    ADMINR -.- VERIFY
    CRITR -.- VERIFY
    CGR -.- VERIFY
    ALLOCR -.- VERIFY
    GRPTR -.- VERIFY & MULTER

    AUTHR --> CUSER
    GRANTR --> CGRANT & CARCC & CUSER
    ADMINR --> CCOLL & CARCC & CUSER
    CRITR --> CCRIT
    CGR --> CGRANT & CCOLL
    ALLOCR --> CGRANT & CCRIT & CALLOC
    GRPTR --> CGRANT & CARCC
```

What each route group handles:

- **`/api/auth`** — register, login, get / update user.
- **`/api/grants`** — submit, edit, get-grant, user-grants, all (admin), and `review*`.
- **`/api/admin`** — list colleges / departments / users / user-options; create and
  update colleges and departments; read and update the ARCC committee; checkDeptChair.
- **`/api/criteria`** — CRUD (writes admin-only).
- **`/api/college-grants`** — dean list / get / approve-reject.
- **`/api/allocation`** — the allocation cycle, gated to admin (the chair): list grants
  with server-computed final ratings (scores from `grant.reviews[]` over the live rubric
  total, cutoff applied), read / save cycle settings, finalize (writes awards and report
  due dates onto grants), and the send-to-accounting CSV export.
- **`/api/grant-reports`** — post-award reporting: the proposer's approved grants, report
  detail, submit a report (multipart upload, appends to `grant.reports[]`, owner-only),
  and report file download.

`review*` covers `GET /review`, `GET /review/:id`, `GET /review/:id/files/:savedName`,
`GET /review/department`, `PUT /review/:id` (stores a reviewer's per-criterion scores and
comments), and `PUT /review/approval/:id` (sets approve/deny). The GET review endpoints
and both PUTs are open to ARCC members and department chairs (`isArccMember || isDeptChair`).

## Grant lifecycle

A grant carries several independent fields (`server/src/routes/grantSubmission.ts`,
`server/src/routes/collegeGrants.ts`). `status` (`draft` / `submitted`) controls
editability. Reviewing is split across three concurrent tracks that all live on the
grant document, with no separate Review entity:

- **`reviews[]`** — an embedded array, one entry per committee member, each holding
  per-criterion `scores` and `comments`, upserted on re-submit. The field is created on
  the first score, not at submit.
- **`reviewStatus`** (`null` for a draft / `pending` once submitted / `approved` /
  `denied`) — the approve/deny outcome, written by a department chair or ARCC member
  through the approval route. A freshly submitted grant has `reviewStatus: "pending"` and
  no `reviews` field yet.
- **`collegeReviewStatus`** (`approved` / `rejected` / unset) — the college dean's
  decision, written only for a grant that requests money from that dean's college; unset
  reads as pending.

Editing track (`status`):

```mermaid
stateDiagram-v2
    [*] --> Draft : proposer saves
    [*] --> Submitted : submit directly
    Draft --> Draft : edit, budget worksheet
    Draft --> Submitted : Submit (confirm dialog, locks)
    Submitted --> [*] : locked, 403 on edit

    note right of Draft
        proposer only
        editable, invisible to reviewers
    end note
```

Review tracks (run once submitted, concurrently):

```mermaid
stateDiagram-v2
    [*] --> Submitted : grant submitted (reviewStatus: pending, no reviews field)

    state "Committee scoring" as Scoring
    Submitted --> Scoring : each member upserts a review into reviews[]
    Scoring --> Scoring : re-score (upsert)

    Submitted --> Approved : dept chair / ARCC approves (reviewStatus)
    Submitted --> Denied : dept chair / ARCC denies (reviewStatus)

    Submitted --> CollegeApproved : dean approves (collegeReviewStatus)
    Submitted --> CollegeRejected : dean rejects (collegeReviewStatus)

    note right of Submitted
        scoring, approve/deny, and dean review
        are independent; a member may score
        before any approval lands
    end note
```

| status            | field written                                          | Trigger                  | Actor                | Route                                 |
| ----------------- | ------------------------------------------------------ | ------------------------ | -------------------- | ------------------------------------- |
| (new) → draft     | none                                                   | save as draft            | owner                | `POST /api/grants/submit`             |
| (new) → submitted | `reviewStatus: pending`                                | submit directly          | owner                | `POST /api/grants/submit`             |
| draft → draft     | none                                                   | edit, save draft         | owner                | `PUT /api/grants/edit/:id`            |
| draft → submitted | `reviewStatus: pending`                                | submit                   | owner                | `PUT /api/grants/edit/:id`            |
| submitted         | `reviews[]` upsert                                     | score the rubric         | ARCC member or chair | `PUT /api/grants/review/:id`          |
| submitted         | `reviewStatus`                                         | approve / deny           | dept chair or ARCC   | `PUT /api/grants/review/approval/:id` |
| submitted         | `collegeReviewStatus`                                  | approve / reject         | college dean         | `PUT /api/college-grants/:id`         |
| submitted         | `allocatedAmount`, `allocationStatus`, `reportDueDate` | Finish Allocation        | admin (chair)        | `POST /api/allocation/finalize`       |
| submitted, funded | `reports[]` append                                     | submit post-award report | owner                | `POST /api/grant-reports/:id/submit`  |

## Navigation

```mermaid
flowchart TD
    subgraph proposer [Any user]
        D[/dashboard/] -->|Submit new| N[/grants/new/]
        D -->|Edit| E[/grants/edit/:id/]
        N <-->|Budget Worksheet| B[/budget-worksheet/]
        E <-->|Budget Worksheet| B
        D -->|email btn| P[/profile/]
        D -->|Approved Grants| AG[/approved-grants/]
        AG -->|Submit / Update Report| GR[/"grant-reports/:grantId"/]
    end

    subgraph review [ARCC + dept chair]
        D -->|header nav, if ARCC| R[/review/]
        R -->|View| RD[/"review/:id<br/>scoring or approve/deny"/]
        D -->|header nav, if dept chair| DR[/department-review/]
        DR -->|View| RD
    end

    subgraph dean [College dean]
        CG[/"college-grants<br/>approve / reject"/]
    end
    D -.->|auto-redirect if dean| CG
    P -->|header nav, if dean| CG

    subgraph admin [Admin]
        A[/admin/] --> AC[/admin/college/]
        A --> AD2[/admin/department/]
        A --> AA[/admin/arcc/]
        A --> CR[/admin/criteria/]
        A -->|header nav: Dashboard| D
        A --> GL[Grant Applications list]
        A -->|Allocation card| AL[/admin/allocation/]
    end
```

`ReviewDetail` (`/review/:id`) gates its controls on how it was reached: navigations pass
`state.fromApprovalView`, so the same page shows the rubric-scoring form when an ARCC
reviewer opens it and the approve/deny controls when a department chair opens it from
`/department-review`.

## Review surfaces

Review rights are not a single flag. A user can be a proposer plus any of: **ARCC
reviewer** (committee membership, `isArccMember`), **department chair**
(`GET /api/admin/checkDeptChair`), **college dean** (email matches a college's `dean`),
or **admin** (`role=admin`). Each role has its own surface:

- **ARCC** `/review` → `/review/:id`: score the grant against the rubric criteria and
  leave comments. Each member upserts one review; the rubric renders inline.
- **Department chair** `/department-review` → `/review/:id`: grants in the chair's
  department; reached from the header nav.
- **College dean** `/college-grants`: only grants with positive funding from the dean's
  college; approve / reject inline (`collegeReviewStatus`), with no separate detail page.
  Reached by an automatic redirect on login.
- **Admin** `/admin`: management pages plus the all-grants list.

Role detection lives in `AuthContext`: `isDean` is resolved at login, and the provider
fetches `isArcc` and `isDeptChair` once after login (`GET /api/admin/arcc` and
`checkDeptChair`), persisting all three flags with the stored user until logout.
`DashHeader` renders nav links from the flags (Dashboard, Review, Dept Review, College
Grants, and Admin for `role=admin`), disabling the link for the page currently shown.
Dean-only users (dean and nothing else) get no Dashboard link; their dashboard
redirects to `/college-grants` (`isDeanOnly` in `client/src/utils/roles.ts`).

## Known gaps

- **Admin all-grants list** — the "Grant Applications" rows are plain text with no
  click-through to a read-only `/review/:id`.
- **Two "approved" predicates** — the grant-reports routes treat a grant as approved
  when department + college approval landed and the award is positive; the dashboard
  only checks for a positive award. A grant funded despite a missing department or
  college approval would show as approved on the dashboard but be rejected by the
  report routes.

## Roles and permissions

Only two roles live on `user.role` (`user` or `admin`). The review rights are not roles,
they are data-driven and checked per request:

- **ARCC member** — membership in the singleton ARCC committee document, `isArccMember()`.
- **Department chair** — a `department` doc whose `chair` equals the user's email,
  `isDeptChair()` / `GET /api/admin/checkDeptChair`.
- **College dean** — a `college` doc whose `dean` equals the user's email, resolved
  server-side in `collegeGrants.ts`.

A single user can hold several of these at once.

| Capability                                           | user | ARCC | dept chair | dean | admin |
| ---------------------------------------------------- | :--: | :--: | :--------: | :--: | :---: |
| Register, log in, edit own profile                   | yes  | yes  |    yes     | yes  |  yes  |
| Create / edit / submit own grants                    | yes  | yes  |    yes     | yes  |  yes  |
| Score submitted grants vs rubric                     |  no  | yes  |    yes     |  no  |  no   |
| Approve / deny (`reviewStatus`)                      |  no  | yes  |    yes     |  no  |  no   |
| Approve / reject own college (`collegeReviewStatus`) |  no  |  no  |     no     | yes  |  no   |
| Download grant files                                 | own  | yes  |    yes     | own  |  yes  |
| View all grants                                      |  no  |  no  |     no     |  no  |  yes  |
| Manage colleges / departments                        |  no  |  no  |     no     |  no  |  yes  |
| Manage ARCC committee membership                     |  no  |  no  |     no     |  no  |  yes  |
| Manage review criteria                               |  no  |  no  |     no     |  no  |  yes  |
| Run the allocation cycle (settings, finalize, CSV)   |  no  |  no  |     no     |  no  |  yes  |
| Submit post-award reports                            | own  | own  |    own     | own  |  own  |

A department chair sees only grants from their own department; a dean sees only grants
that request funding from their college.

## Core sequences

Submit a proposal:

```mermaid
sequenceDiagram
    actor Owner
    participant Client
    participant API as Express /api/grants
    participant DB as MongoDB
    Owner->>Client: fill form, click Submit
    Client->>API: POST /submit (JWT)
    API->>API: validate, set status, reviewStatus: pending
    API->>DB: insert grant
    DB-->>API: ok
    API-->>Client: 201
    Client-->>Owner: redirect to /dashboard
```

Score a proposal (ARCC reviewer):

```mermaid
sequenceDiagram
    actor Reviewer as ARCC member
    participant Client
    participant API as Express /api/grants
    participant DB as MongoDB
    Reviewer->>Client: open /review/:grantId
    Client->>API: GET /api/criteria (render rubric)
    Reviewer->>Client: pick a score per criterion, add comments
    Client->>API: PUT /review/:id (JWT, {scores, comments})
    API->>API: isArccMember || isDeptChair?
    alt not authorized
        API-->>Client: 403
    else authorized
        API->>API: validate scores against criteria
        API->>DB: upsert reviewer entry into grant.reviews[]
        DB-->>API: ok
        API-->>Client: 200 (review entry)
    end
```

Approval is a separate call: a department chair (or ARCC member) sets approve/deny via
`PUT /api/grants/review/approval/:id` (`reviewStatus`), and a college dean approves /
rejects via `PUT /api/college-grants/:id` (`collegeReviewStatus`).
