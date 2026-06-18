# Data Model

Storage is **MongoDB** accessed through the raw Node driver (no ORM). Collections are
defined implicitly by the insert/update shapes in `server/src/routes/`. The model is
denormalized in places (it copies names alongside ids) which is normal for MongoDB.

```mermaid
erDiagram
    User ||--o{ Grant : "submits (projectDirectorId)"
    College ||--o{ Department : "has (collegeId)"
    ARCC }o--o{ User : "members + chair (ids)"

    User {
        string id PK
        string email
        string password "bcrypt hash"
        string firstName
        string lastName
        date birthday
        string department
        string college
        string role "admin | user"
        string createdAt
    }

    Grant {
        objectId _id PK
        string title
        string description
        string submittedEmail "owner email"
        string projectDirectorId FK "User.id"
        number studentsImpacted
        string affectsMultipleDepartments "yes|no"
        number departmentCount
        string usesSubjects "yes|no"
        string irbApproved "yes|no"
        string timeline
        array budgetItems
        array files
        object irbApprovalFile
        string status "draft | submitted"
        string reviewStatus "pending|approved|denied|null"
        date submittedAt
    }

    College {
        objectId _id PK
        string name
        string abbreviation
        date createdAt
        date updatedAt
    }

    Department {
        objectId _id PK
        string name
        objectId collegeId FK "College._id"
        string collegeName "denormalized"
        date createdAt
        date updatedAt
    }

    Criteria {
        objectId _id PK
        string name
        string description
        number maxScore
        array ratingSuggestions
        string createdAt
        string updatedAt
    }

    ARCC {
        string key PK "singleton: committee"
        string chairId FK "User.id"
        array memberIds FK "User.id[]"
    }
```

## Relationships

- **User 1--\* Grant** — via `Grant.projectDirectorId` (and `submittedEmail` for ownership).
- **College 1--\* Department** — via `Department.collegeId`.
- **ARCC _--_ User** — the singleton committee doc references a `chairId` and a `memberIds`
  array, both pointing at `User.id`. ARCC membership is what grants review rights.
- **Criteria** stands alone, used to score grants during review.

## Sources

| Entity     | Defined in                                 |
| ---------- | ------------------------------------------ |
| User       | `server/src/routes/auth.ts:73`             |
| Grant      | `server/src/routes/grantSubmission.ts:120` |
| College    | `server/src/routes/college.ts:48`          |
| Department | `server/src/routes/department.ts:65`       |
| Criteria   | `server/src/routes/criteria.ts:66`         |
| ARCC       | `server/src/routes/admin.ts:180`           |
