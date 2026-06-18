# Requirements

How the grant application system is expected to work. This describes the product's
behavior and use cases so anyone can reference it to understand what it does. Where the
current build differs from these expectations, the gaps are listed in
[Discrepancies](#discrepancies) at the bottom. For role-driven, end-to-end walkthroughs
see [use-cases.md](./use-cases.md).

---

## 1. Signup & accounts

At registration a user provides their email, password, name, and birthday. They may
also select the college and department they belong to; department is optional.

Each user has a profile page where they can view and edit their own details (name,
email, password, college, department).

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
- Project director / principal investigator, chosen from a dropdown that defaults to
  the logged-in user.
- How many Weber State students the grant will impact.
- Whether the grant affects more than one department; if so, how many.
- Whether the project uses human or animal subjects; if so, an IRB approval file is
  required.
- A timeline, entered as free text (an end date, or a few lines of milestones such as
  "in August do X, in September do Y" — the format does not matter).
- Whether matching funds are available from other sources. If yes, a text box captures
  how much. Its default is pulled from the budget worksheet (the total amount not
  requested from ARCC) and can be edited afterward.

### Files

The application accepts three optional general file uploads, plus a separate,
independently named upload for the IRB / human-animal subjects form (required only when
the project uses subjects). Files are stored in a local folder on disk, not the cloud.

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

The per-item total is calculated automatically from the four source amounts. The
worksheet view shows only the four category totals, not the individual items.

---

## 5. Rubric / review criteria

An admin defines the scoring rubric. Each criterion has a name, a description, and a
fixed set of rating options written as "number: description". The maximum score for a
criterion is 30 points. A reviewer picks a score from the preset descending list
(e.g. 30, 25, 15, 10, 5, 0) rather than typing an arbitrary number. The admin can add
as many criteria as needed.

---

## 6. Review (committee members & chair)

The chair is also a committee member. Committee members and the chair see an extra
"Review" navigation item.

The review list shows every **submitted** grant (drafts do not appear). Each row shows
the principal investigator's name, the grant title, the total requested from ARCC, and
a review button.

Opening a grant shows it read-only. Submitted files appear as clickable links that
download the file. The reviewer **rates** the application against the rubric (they do
not approve or deny it) and can leave comments.

---

## 7. Approval workflow

Approval is separate from committee review (which only rates).

When a grant is submitted, the proposer's department chair must approve it. The
department-grants view mirrors the review list, but the chair approves or rejects each
grant.

If the budget worksheet total is non-zero, the college dean must also approve, but only
for a college that money is actually being requested from.

---

## 8. Allocation

The ARCC committee chair has an allocation page (available only to them) that records
three values for a grant cycle:

1. The amount available for this cycle.
2. Any money left over from the last cycle.
3. A cutoff percentage (a positive number, generally 70%).

---

## 9. College & department administration

Colleges and departments are managed under separate tabs. Both can be created and
edited. A department can have a chair, selected from a dropdown of users.

---

## 10. Dashboard

A user's grants appear on their dashboard. Draft grants can be edited; submitted grants
are locked and shown as "Submitted" with no edit option.

---

## Discrepancies

Where the current build differs from the expectations above.

- **Signup** — Department is required in code; the plan says optional. Relax validation.
- **Budget worksheet** — Category is a free-text field; should be a hardware/software
  dropdown.
- **Rubric** — Reviewer scoring is not yet constrained to the preset descending list
  capped at 30 points.
- **Review** — Per-criterion rating and reviewer comments are not implemented; only a
  single approve/deny exists.
- **Approval workflow** — No department-chair → college-dean approval chain exists. The
  chair and dean fields are in the data model but unused by any routing.
- **Allocation** — Not implemented; no allocation page or data.
- **Matching funds** — Not implemented.
- **College & department admin** — Tabs and editing are partial; delete is missing, and
  the department-chair selection UI is incomplete (the field exists but is not exposed).
