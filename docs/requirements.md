# Requirements

How the grant application system is expected to work. This describes the product's
behavior and use cases so anyone can reference it to understand what it does. Where the
current build differs from these expectations, the gaps are listed in
[Discrepancies](#discrepancies) at the bottom. For role-driven, end-to-end walkthroughs
see [use-cases.md](./use-cases.md).

---

## Overview

The system manages grants for Weber State's ARCC (Academic Resources and Computing
Committee), which funds hardware and software resources. Faculty and staff submit
applications; the committee reviews and scores them, department chairs and deans
approve, and the committee chair allocates funding for the cycle.

A single fixed admin account, `admin@4760weber.edu`, is seeded at the start and is never
deleted. It stands in for the university's eWeber identity system: the admin manually
sets up colleges, departments, their deans and chairs, and the ARCC committee, since the
app has no integration to pull that structure automatically.

---

## 1. Signup & accounts

At registration a user provides their email, password (entered twice to confirm), name,
and birthday. They may also select the college and department they belong to; both are
optional and can be set later from the profile page. Choosing a college filters the
department dropdown to that college's departments. The college and department dropdowns
are the same ones the admin populates, so they reflect whatever colleges and departments
exist in the system.

Passwords are stored hashed, never in plaintext.

Each user has a profile page where they can view and edit their own details (name,
email, password, college, department, account number). The saved account number
prefills the account number field on new grant applications.

---

## 2. ARCC committee management

An admin manages the ARCC committee from a page with two lists:

- **Committee members** (top): everyone currently on the committee. The list starts
  empty. Each member can be removed. Exactly one member is the committee chair;
  choosing a new chair replaces the previous one.
- **All users** (bottom): every user, each with an option to add them to the committee.

---

## 3. Grant application

A proposer fills out a grant application:

- Title and a large description text area.
- The proposer's account number (the employee index/account number every employee
  already knows). It is carried into the accounting spreadsheet at allocation time.
- Project director / principal investigator, chosen from a dropdown that defaults to
  the logged-in user.
- How many Weber State students the grant will impact.
- Whether the grant affects more than one department; if so, how many.
- Whether the project uses human or animal subjects; if so, an IRB approval file is
  required.
- A timeline, entered as free text (an end date, or a few lines of milestones such as
  "in August do X, in September do Y"; exact dates or just months are both fine). Its
  purpose is to show the project can be finished and the money spent within one year; a
  reviewer reads it to judge that feasibility.
- Whether matching funds are available from other sources. If yes, a text box captures
  how much. Its default is pulled from the budget worksheet (the total amount not
  requested from ARCC) and can be edited afterward.

### Files

The application accepts three optional general file uploads, plus a separate,
independently named upload for the IRB / human-animal subjects form (required only when
the project uses subjects). Files are stored in a local folder on disk, not the cloud.

### Acknowledgements

The form ends with an Acknowledgements & Signature section: a set of required
acknowledgement checkboxes the proposer certifies before the application can be
submitted. All must be checked for a submit to go through; saving a draft does not
require them. The label wording is still placeholder text.

### Save vs Submit

- **Save** stores the application as a draft so the proposer can continue later.
- **Submit** is permanent: once submitted, the grant can no longer be edited and enters
  review.

---

## 4. Budget worksheet

The budget worksheet justifies the funding request (e.g. "teaching a course, need 10
processors"). It is built on its own page and is a set of budget items. Each item has:

- A description.
- A category, chosen from a dropdown: hardware or software.
- An amount split across four funding sources: ARCC, college, department, and other.

The per-item total is calculated automatically from the four source amounts, and the
worksheet's overall total is likewise computed, never entered by hand. The worksheet
view shows only the four category totals, not the individual items.

The worksheet is its own page, reachable both from the grant application and by a button
on the grant itself.

---

## 5. Rubric / review criteria

An admin defines the scoring rubric. The rubric is a list of criteria; the admin can
add as many as needed. Each criterion has:

- A name.
- A description (the basis reviewers grade against).
- A maximum score, set per criterion. It is not fixed: different criteria carry
  different maximums (e.g. 20, 25, 35, 40).
- A set of rating options, each written as "number: description" (the number is the
  awarded points, the description is what the grant must meet to earn it). The highest
  option equals the criterion's maximum; the lowest option is always 0, meaning none of
  the criteria is met. Any in-between options are the rubric author's choice, so the
  number of options varies per criterion (e.g. 35 / 20 / 5 / 0, or 25 / 15 / 10 / 5 / 0).

When reviewing, a reviewer picks one option per criterion from a dropdown rather than
typing an arbitrary number.

The rubric is owned by the admin for now; it is meant to move to the ARCC committee
chair once committee management is in place.

---

## 6. Review (committee members & chair)

The chair is also a committee member. Committee members and the chair see an extra
"Review" navigation item.

The review list shows every **submitted** grant (drafts do not appear). Each row shows
the principal investigator's name, the grant title, the total requested from ARCC, and
a review button. A committee member must not review their own submitted grant.

Opening a grant shows it read-only. Submitted files appear as clickable links that
download the file. The reviewer **rates** the application against the rubric (they do
not approve or deny it): they pick one option per criterion from its dropdown, and may
add a note in a single notes text box. The action is **Submit rating**.

From the per-criterion picks the system computes a single **final rating** for that
reviewer, a number from 0 to 100: the sum of the points the reviewer awarded divided by
the sum of the criteria maximums, times 100. Submitting stores both the final rating and
the individual per-criterion ratings. Each reviewer has one review per grant;
re-submitting updates that reviewer's review rather than adding a second one.

Every committee member reviews each submitted grant, so a grant collects many reviews.
These are consolidated and normalized into one grant-level final rating (again 0 to
100); that consolidated number is what the allocation step keys off.

---

## 7. Approval workflow

Approval is separate from committee review (which only rates).

When a grant is submitted, the proposer's department chair must always approve it. The
chair's job is to verify the grant relates to the proposer's job duties, then approve or
reject. The department-grants view mirrors the review list, but the chair approves or
rejects each grant. The chair sees only grants from their own department.

The college dean must also approve, but only when the budget requests more than $0 from
a college. The grant is routed to the dean of each college money is requested from; if
no college funds are requested, no dean approval is needed. The college-grants view
(`/college-grants`) mirrors the review list, and the dean approves or rejects grants
scoped to their own college. On login the system detects dean status and automatically
redirects the dean to this view; the grant submission form is not available to dean
accounts.

Money is released only after the required approvals are in.

---

## 8. Allocation

The ARCC committee chair has an allocation page (available only to them).

### 8a. Cycle inputs

At the top of the page the chair enters three values for the current cycle using editable
text boxes. These numbers change every cycle and must not be hardcoded:

1. **Current cycle amount** — funds available from donors this cycle (e.g. $50,000).
2. **Leftover amount** — unspent money carried over from the prior cycle (e.g. $37,000).
3. **Cutoff percentage** — the floor for funding, generally 70% but changeable at any
   point in the process. The chair may adjust it several times while reviewing the
   grant table to try to accommodate more applicants.

### 8b. Grant table and cutoff

The table displays all submitted grants with each grant's real average final rating
(the consolidated 0-to-100 score computed from committee reviews, not placeholder data).

When the chair sets a cutoff and clicks **Apply Cutoff**, the table splits into two:

- **Eligible grants** (rated at or above the cutoff) — remain in the main table.
- **Rejected Grants** — a separate table below, containing every grant whose average
  rating fell below the cutoff. These grants receive no money.

The chair can adjust the cutoff and re-apply as many times as needed before finalizing.

### 8c. Allocation tiers (criteria)

For grants above the cutoff, the chair configures how much each grant is awarded using
dynamic tier criteria. Each criterion specifies:

- A **rating range** (e.g. 80%–90%).
- A **percentage of the requested amount** to award (e.g. 75%).

The chair can add as many tiers as needed. There is also a single **full-funding
threshold**: grants rated above this number (e.g. 90%) receive 100% of what they
requested. Together, the tiers and the full-funding threshold cover the range from the
cutoff to 100%.

An **Allocated Amount** column in the eligible table shows the computed award for each
grant based on whichever tier or threshold applies to its rating.

Example: grant requesting $8,000 with an 88% average rating, tiers set to 90%+ → 100%
and 80–90% → 75%, receives $6,000 (75% of $8,000).

### 8d. Finish Allocation

When the chair is satisfied with the tier configuration, they click **Finish Allocation**.
This action:

- Locks the entire allocation — no further changes are possible.
- Sets each grant's final status:
  - Grants in the Rejected Grants table → **Rejected**.
  - Grants that received any allocated amount → **Accepted**.
- Records a **report due date** on each accepted grant (see 8e).

### 8e. Report due date

When a grant is accepted, the system calculates its report due date:

1. Find the first June 30 that falls at or after the allocation date (the university's
   fiscal-year end).
2. Add one year.

The result is the date by which the PI must submit their final report. Examples:

- Grant accepted October 20, 2025 → next June 30 is June 30, 2026 → report date is
  June 30, 2027.
- Grant accepted June 23, 2026 → next June 30 is June 30, 2026 → report date is
  June 30, 2027.

### 8f. Send to Accounting

A **Send to Accounting** button exports a spreadsheet the chair downloads and emails to
the accounting office. The accounting office performs the actual disbursement; the app
does not move money. Current spreadsheet columns per row (one row per grant):

- Principal investigator name
- Grant name
- Accounting number
- Submitted by
- Amount requested from ARCC
- Other sources amount
- Final rating %
- Allocated amount
- Status

Spreadsheet generation must use free tooling only (the export is a plain CSV).

---

## 9. College & department administration

Colleges and departments are managed under separate tabs, each listing what exists with
an edit option per row.

A college has a name and a dean, the dean selected from a dropdown of users. A department
has a name, the college it belongs to, and a chair selected from a dropdown of users.
Editing is the way to fill in a dean or chair that was skipped at creation; editing a
department can also change its name, move it to a different college, or change its chair.

---

## 10. Dashboard

A user's grants appear on their dashboard organized into sections:

- **Approved grants** — grants that received an allocated amount after Finish Allocation.
- **Rejected grants** — grants that were below the cutoff or received no money after
  allocation. Shown so the proposer has a record of past rejections.
- **Active / pending grants** — drafts and submitted grants still in review or awaiting
  approval.

Draft grants can be edited; submitted grants are locked with no edit option. Each grant
shows its current status (see below) so the proposer can see where it sits, for example
chasing a department chair who has not yet approved.

The dashboard also shows a **report due-date reminder** banner: one line per approved
grant whose report has not been filed and whose due date (see 8e) is within 90 days
ahead or up to a year past, saying the report is due in N days, due today, or overdue by
N days, with a link to file the report.

---

## 11. Grant status

Unlike a typical grant system where a grant holds a single status that moves through one
linear chain, an ARCC grant can hold **several statuses at once**. The committee can
review a grant before the department chair or dean has approved it; approvals only gate
the release of money, not the start of review.

A grant moves through these states:

- **Working** while the proposer is still drafting it.
- On submit it enters **Under Committee Review** and **Department Chair Review** at the
  same time.
- When the department chair approves, it becomes **Department Chair Approved** while
  still under committee review. A dean approval (when college funds are requested)
  tracks the same way.
- Once Finish Allocation runs, the grant reaches a terminal state:
  - **Accepted** if it received any allocated amount (even $1).
  - **Rejected** if it fell below the cutoff or received $0.

The proposer sees all current statuses on their dashboard, organized into the approved,
rejected, and active sections described in section 10.

---

## Future / out of scope

Raised by the client but deferred ("if time permits") or set aside in later meetings.
Listed so the boundary of the current scope is explicit:

- **Post-award final report** — after funding, the PI reports on spending with receipts
  and a breakdown of what was bought.
- **Reporting and analytics** — historic trend charts (money per department per year)
  and financial reports for auditing.
- **Notifications / reminders** — e.g. nudging an approver who has not acted. (The
  dashboard's report due-date reminder banner is in scope, see section 10; email or
  other push notifications are not.)
- **Automated money distribution** — paying funds into PI accounts directly. The system
  instead exports the accounting spreadsheet (see Allocation) and the accounting office
  disburses.
- **Extra approval steps** — university-IT sign-off on policy and a full IRB approval
  workflow were discussed early, then reduced to capturing the IRB approval file only.
- **Applicant eligibility** — whether only faculty, or faculty and staff, may apply was
  left unresolved by the client.

---

## Discrepancies

Where the current build differs from the expectations above.

- **Signup** — Department is required in code; the plan says optional. Relax validation.
  The college/department dropdowns are a hardcoded list in `Register.tsx` rather than the
  admin-managed colleges/departments.
- **Budget worksheet** — Category is a free-text field; should be a hardware/software
  dropdown.
- **Acknowledgements** — The submit form gates on the required acknowledgement checkboxes
  and a free-text signature, but the acknowledgement labels are still placeholders
  ("Acknowledgement 1", etc.) and the final certification wording is not settled.
- **Rubric** — Code rejects only rating options whose score exceeds the max; it does not
  force the top option to equal the max or the bottom to be 0, in line with the client's
  "trust the user" stance.
- **Review consolidation** — Per-reviewer scoring, the notes box, and one review per
  reviewer all work. The 0-to-100 rating is only computed client-side for display, not
  stored, and there is no cross-reviewer consolidated/normalized grant-level rating for
  allocation to key off.
- **Grant status** — The dashboard now shows department-chair and college review status
  per grant (PR #35), but the full named composite states ("Under Committee Review",
  "Department Chair Approved", "Grant Approved") are not yet surfaced as discrete
  labeled badges. The allocation-driven terminal states (Accepted / Rejected) do not
  exist yet.
- **Allocation** — Fully implemented: editable cycle inputs (amount available, leftover,
  cutoff percentage), the two-table cutoff split, dynamic tier criteria, the allocated
  amount column, Finish Allocation (locks the cycle and stamps allocated amount, status,
  and report due date onto each funded grant), and the Send to Accounting CSV export.
  Before finalizing, the page warns when the tiers over-allocate the available amount or
  leave more than 5% of it unused.
- **College & department admin** — The college dean approval workflow is fully
  implemented: dean detection on login, auto-redirect to `/college-grants`, and
  approve/reject with college-scoped filtering (PR #29). Remaining gaps: delete is
  missing from both tabs, and the department-chair field is not exposed in the admin
  department UI (the field exists in the data model but has no write route).
