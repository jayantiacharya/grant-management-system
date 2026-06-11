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

```mermaid
stateDiagram-v2
    [*] --> Draft : proposer saves
    Draft --> Draft : edit, budget worksheet
    Draft --> Submitted : Submit (confirm dialog, locks)
    Submitted --> Pending : reviewStatus pending
    Pending --> Approved : ARCC approves
    Pending --> Denied : ARCC denies

    note right of Draft
        proposer only
        editable, invisible to reviewers
    end note
    note right of Pending
        visible in /review queue
        owner currently sees only "Submitted"
    end note
```

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

Planned changes: ARCC membership moves into AuthContext so the header can show the Review button on every page (admins included); proposer dashboard shows pending/approved/denied per grant; admins open grants read-only through the review detail page, with approve/deny gated by actual committee membership.

```mermaid
flowchart TD
    subgraph header [DashHeader on every page]
        H1[brand: role-aware home]
        H2[My Grants]
        H3[Review, shown to any ARCC member]
        H4[Admin, shown to admins]
        H5[email: profile]
        H6[Sign out]
    end

    subgraph proposer [Proposer world]
        D[/dashboard/] --> N[/grants/new/]
        D --> E[/grants/edit/:id/]
        N <--> B[/budget-worksheet/]
        E <--> B
        D --- BADGE[per-grant badge:<br/>draft / pending / approved / denied]
    end

    subgraph review [Review world]
        R[/review/] --> RD[/review/:id/]
        RD --> ACT{caller ARCC?}
        ACT -->|yes| APPROVE[Approve / Deny]
        ACT -->|no, admin read-only| VIEW[view only]
    end

    subgraph admin [Admin world]
        A[/admin/] --> MGMT[college / department / committee / criteria]
        A --> GL[Grant Applications]
        GL -->|row click| RD
    end

    H3 --> R
    H4 --> A
    H2 --> D
```
