# Architecture and navigation

Diagrams are Mermaid; GitHub renders them inline, or paste the code blocks into [mermaid.live](https://mermaid.live).

## Project overview

```mermaid
flowchart LR
    subgraph Browser ["Client (React + Vite, localhost:5173)"]
        direction TB

        subgraph Routing ["App.tsx routing guards"]
            PUB["PublicRoute<br/>(redirects signed-in users)"]
            PROT["ProtectedRoute<br/>(requires token)"]
            ADM["AdminRoute<br/>(requires role=admin)"]
        end

        subgraph Contexts
            AUTHCTX["AuthContext<br/>user + token + isArcc<br/>(localStorage)"]
            GRANTCTX["GrantContext<br/>shared grant draft + budget items<br/>activeGrantId (localStorage)"]
        end

        subgraph Shared ["Shared components"]
            HEADER["DashHeader<br/>home / back / profile / sign out"]
            CRITFORM["CriteriaForm"]
        end

        subgraph PublicPages ["Public pages"]
            LOGIN["Login"]
            REG["Register"]
        end

        subgraph UserPages ["Proposer pages"]
            DASH["Dashboard<br/>my grants + status"]
            NEW["NewGrant<br/>save draft / submit"]
            EDIT["EditGrant<br/>locked after submit"]
            BUDGET["BudgetWorksheet<br/>auto-totaled items"]
            PROFILE["Profile"]
        end

        subgraph ReviewPages ["ARCC reviewer pages"]
            REV["Review<br/>submitted grants queue"]
            REVDET["ReviewDetail<br/>files + approve/deny"]
        end

        subgraph AdminPages ["Admin pages"]
            ADASH["AdminDashboard<br/>all grants + mgmt links"]
            COLLEGE["CreateCollege"]
            DEPT["CreateDepartment"]
            ARCCPG["ArccCommittee"]
            CRIT["CriteriaManagement"]
        end
    end

    subgraph Server ["Server (Express, localhost:5000)"]
        direction TB
        APP["app.ts"]
        VERIFY["middleware/auth.ts<br/>verifyToken (JWT)"]
        CONN["middleware/conn.ts<br/>Mongo client<br/>(connects before listen)"]
        VALID["grantValidation.ts<br/>draft vs submitted rules"]
        MULTER["multer<br/>uploads/ (3 files + IRB doc)"]

        AUTHR["routes/auth.ts<br/>/api/auth<br/>register, login, get/update-user"]
        GRANTR["routes/grantSubmission.ts<br/>/api/grants<br/>submit, edit, get-grant, user-grants,<br/>all (admin), review* (ARCC)"]
        ADMINR["routes/admin.ts<br/>/api/admin<br/>colleges, departments, arcc,<br/>user-options"]
        CRITR["routes/criteria.ts<br/>/api/criteria<br/>CRUD (writes admin-only)"]
    end

    subgraph Mongo ["MongoDB (linkUpDatabase)"]
        CUSER[("user")]
        CGRANT[("grant<br/>status, reviewStatus,<br/>budgetItems, files")]
        CARCC[("arcc<br/>committee memberIds")]
        CCRIT[("criteria")]
        CCOLL[("college / department")]
    end

    %% client wiring
    PUB --- LOGIN & REG
    PROT --- DASH & NEW & EDIT & BUDGET & PROFILE & REV & REVDET & ADASH & COLLEGE & DEPT & ARCCPG
    ADM --- CRIT
    AUTHCTX --- HEADER
    GRANTCTX --- NEW & EDIT & BUDGET
    CRITFORM --- CRIT

    %% page navigation (main flows)
    DASH -->|"new / edit"| NEW & EDIT
    NEW <-->|"budget round-trip"| BUDGET
    EDIT <-->|"budget round-trip"| BUDGET
    DASH -->|"ARCC members"| REV
    REV --> REVDET
    ADASH --> COLLEGE & DEPT & ARCCPG & CRIT

    %% API calls
    LOGIN & REG & PROFILE -->|"axios"| AUTHR
    DASH & NEW & EDIT -->|"axios + Bearer"| GRANTR
    REV & REVDET -->|"axios + Bearer"| GRANTR
    ADASH -->|"grants/all (admin)"| GRANTR
    COLLEGE & DEPT & ARCCPG -->|"axios + Bearer"| ADMINR
    NEW & EDIT -->|"user-options"| ADMINR
    CRIT -->|"axios + Bearer"| CRITR

    %% server wiring
    APP --> AUTHR & GRANTR & ADMINR & CRITR
    GRANTR --- VERIFY & VALID & MULTER
    CRITR --- VERIFY
    ADMINR --- VERIFY

    %% persistence
    AUTHR --> CUSER
    GRANTR --> CGRANT & CARCC & CUSER
    ADMINR --> CCOLL & CARCC & CUSER
    CRITR --> CCRIT
    CONN --- Mongo
```

`review*` covers `/review`, `/review/:id`, `/review/:id/files/:savedName` (GET) and `/review/:id` (PUT).

## Grant lifecycle

A grant carries two independent fields (`server/src/routes/grantSubmission.ts`): `status`
(`draft` / `submitted`) controls editability, and `reviewStatus`
(`null` / `pending` / `approved` / `denied`) holds the ARCC outcome. There is no separate
Review entity; the outcome lives on the grant. `reviewStatus` flips to `pending` the moment
the grant is submitted.

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

Review track (`reviewStatus`, runs once submitted):

```mermaid
stateDiagram-v2
    [*] --> Pending : grant submitted
    Pending --> Approved : ARCC approves
    Pending --> Denied : ARCC denies

    note right of Pending
        visible in /review queue
        owner currently sees only "Submitted"
    end note
```

| status            | reviewStatus       | Trigger          | Actor       | Route                        |
| ----------------- | ------------------ | ---------------- | ----------- | ---------------------------- |
| (new) → draft     | null               | save as draft    | owner       | `POST /api/grants/submit`    |
| (new) → submitted | pending            | submit directly  | owner       | `POST /api/grants/submit`    |
| draft → draft     | null               | edit, save draft | owner       | `PUT /api/grants/edit/:id`   |
| draft → submitted | pending            | submit           | owner       | `PUT /api/grants/edit/:id`   |
| submitted         | pending → approved | approve          | ARCC member | `PUT /api/grants/review/:id` |
| submitted         | pending → denied   | deny             | ARCC member | `PUT /api/grants/review/:id` |

## Navigation today (dead ends marked)

```mermaid
flowchart TD
    subgraph proposer [Any user]
        D[/dashboard/] -->|Submit new| N[/grants/new/]
        D -->|Edit| E[/grants/edit/:id/]
        N <-->|Open Budget Worksheet| B[/budget-worksheet/]
        E <-->|Open Budget Worksheet| B
        D -->|email btn| P[/profile/]
    end

    subgraph arcc [ARCC member only]
        D -->|Review btn, ONLY on dashboard| R[/review/]
        R --> RD[/review/:id/]
    end

    subgraph admin [Admin]
        A[/admin/] --> AC[/admin/college/]
        A --> AD2[/admin/department/]
        A --> AA[/admin/arcc/]
        A --> CR[/admin/criteria/]
        A -->|My Grants| D
        A -.-> GL[Grant Applications list]
    end

    GL -. "titles only, nothing clickable" .-x DEAD1[no grant detail]
    A -. "admin on committee never sees Review btn" .-x DEAD2[review unreachable from /admin]
    RD -. "no link to rubric" .-x DEAD3[criteria invisible to reviewers]

    style DEAD1 fill:#fdd,stroke:#c00
    style DEAD2 fill:#fdd,stroke:#c00
    style DEAD3 fill:#fdd,stroke:#c00
```

## Proposed navigation

> Reflects the in-flight review overhaul (open PRs adding rubric scoring, department
> chair review, and college-dean review). It supersedes the earlier single-ARCC
> approve/deny plan: there is no longer one "Review" surface but several role-specific
> ones, and ARCC "approve/deny" is being replaced by per-criterion **scoring +
> comments** (a grant collects many reviews in `grant.reviews[]`). Not yet merged to
> `main`, so the "Navigation today" diagram above still describes the running code.

Review rights are no longer a single flag. A user can be a proposer plus any of:
**ARCC reviewer** (committee membership, `isArccMember`), **department chair**
(`GET /api/admin/checkDeptChair`), **college dean** (email matches a college's `dean`),
or **admin** (`role=admin`). Each role has its own review surface; the header should
surface whichever entry points apply, on every page.

- **ARCC** `/review` → `/review/:id`: score the grant against the rubric criteria and
  leave comments. Multiple reviewers each submit a review; the rubric renders inline
  (resolves the old "criteria invisible to reviewers" dead end).
- **Department chair** `/department-review` → `/review/:id`: grants in the chair's
  department; reached from a button on `/review`.
- **College dean** `/college-grants`: only grants with college funding in the budget;
  approve / reject inline (`collegeReviewStatus`), no separate detail page.
- **Admin** `/admin`: management pages plus the all-grants list, which should become
  clickable through to a read-only detail (still an open dead end, below).

`/review/:id` (ReviewDetail) gates its action controls on how it was reached:
navigations pass `state.fromApprovalView`, so the same page renders read-only when
opened to view and editable when opened to act.

```mermaid
flowchart TD
    subgraph header [DashHeader on every page]
        H1[brand: role-aware home]
        H2[My Grants]
        H3[Review, if ARCC member]
        H4[Department Review, if dept chair]
        H5[College Grants, if college dean]
        H6[Admin, if admin]
        H7[email: profile / Sign out]
    end

    subgraph proposer [Proposer world]
        D[/dashboard/] --> N[/grants/new/]
        D --> E[/grants/edit/:id/]
        N <--> B[/budget-worksheet/]
        E <--> B
        D --- BADGE[per-grant badge:<br/>draft / submitted / review state]
    end

    subgraph arcc [ARCC + department review]
        R[/review/] -->|View| RD[/review/:id/<br/>score vs rubric + comments]
        R -->|if dept chair| DR[/department-review/]
        DR -->|View, fromApprovalView| RD
    end

    subgraph dean [College dean]
        CG[/college-grants/<br/>approve / reject inline]
    end

    subgraph admin [Admin world]
        A[/admin/] --> MGMT[college / department / committee / criteria]
        A --> GL[Grant Applications]
        GL -->|row click, read-only| RD
    end

    H3 --> R
    H4 --> DR
    H5 --> CG
    H6 --> A
    H2 --> D
```

### Still open after the review overhaul

- **DEAD1** Admin "Grant Applications" rows are still plain text; they need
  click-through to a read-only `/review/:id`. No open PR touches `AdminDashboard.tsx`.
- **DEAD2** Review entry points are still not lifted into the header / `AuthContext`,
  so each reviewer can only reach their queue from a specific page. Each role's entry
  (ARCC / dept chair / dean / admin) should live in `DashHeader`, driven by role flags
  resolved once in `AuthContext` rather than re-checked per page.
- **Resolved** The rubric is now visible to reviewers inline on `/review/:id`.

## Roles and permissions

Two roles live on `user.role` (`user` or `admin`). ARCC review rights are not a role: they
come from membership in the singleton ARCC committee document, checked by `isArccMember()`
(`grantSubmission.ts:179`).

| Capability                             | user | ARCC member | admin |
| -------------------------------------- | :--: | :---------: | :---: |
| Register, log in, edit own profile     | yes  |     yes     |  yes  |
| Create / edit / submit own grants      | yes  |     yes     |  yes  |
| Review (approve/deny) submitted grants |  no  |     yes     |  no   |
| Download grant files                   | own  |     yes     |  yes  |
| View all grants                        |  no  |     no      |  yes  |
| Manage colleges / departments          |  no  |     no      |  yes  |
| Manage ARCC committee membership       |  no  |     no      |  yes  |
| Manage review criteria                 |  no  |     no      |  yes  |

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
    API->>API: validate, set status, reviewStatus=pending
    API->>DB: insert grant
    DB-->>API: ok
    API-->>Client: 201
    Client-->>Owner: redirect to /dashboard
```

Review a proposal:

```mermaid
sequenceDiagram
    actor Reviewer as ARCC member
    participant Client
    participant API as Express /api/grants
    participant DB as MongoDB
    Reviewer->>Client: open /review/:grantId
    Client->>API: PUT /review/:id (JWT, approved|denied)
    API->>API: isArccMember(userId)?
    alt not ARCC
        API-->>Client: 403
    else ARCC
        API->>DB: update reviewStatus
        DB-->>API: ok
        API-->>Client: 200
    end
```
