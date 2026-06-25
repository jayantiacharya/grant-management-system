# Use cases

End-to-end walkthroughs of how each role uses the system. These describe expected
behavior; for the per-feature reference see [requirements.md](./requirements.md), and
for known gaps between expectations and the current build see its
[Discrepancies](./requirements.md#discrepancies) section.

## Roles

- **Proposer** — any user. Creates and submits grant applications.
- **Committee member** — an ARCC committee member. Rates submitted grants.
- **Committee chair** — a committee member who also manages the grant-cycle allocation.
- **Department chair** — approves or rejects grants from their department.
- **College dean** — approves grants that request money from their college.
- **Admin** — manages users, the committee, colleges/departments, and the rubric.

A user can hold more than one role (the chair is also a committee member; a department
chair is also a proposer).

---

## Proposer

### Register and set up a profile

1. The proposer registers with email, password, name, and birthday, and may select
   their college and department.
2. From their profile page they can later update any of these details.

### Draft and submit a grant

1. The proposer opens a new grant application and enters the title, description, their
   account number, project director (defaulting to themselves), number of students
   impacted, and whether more than one department is affected.
2. If the project uses human or animal subjects, they attach the required IRB approval
   file.
3. They attach up to three optional supporting files.
4. They build the budget worksheet: one entry per item, each with a description, a
   hardware/software category, and amounts from ARCC, college, department, and other
   sources. Per-item totals compute automatically.
5. If matching funds are available, they check the box; the amount defaults to the
   non-ARCC total from the worksheet and can be edited.
6. They enter a timeline as free text.
7. They check the required acknowledgements in the Acknowledgements & Signature section,
   which the form requires before a submit is accepted.
8. They **save** at any point to keep working later, or **submit** when ready.
9. After submitting, the grant is locked and enters review; it can no longer be edited.

### Track grants

1. The proposer's dashboard lists their grants with status. A submitted grant can hold
   several statuses at once (committee review, department-chair review, dean review),
   and the proposer sees each as pending, approved, or rejected, so they can chase an
   approver who has not yet acted.
2. Draft grants offer an edit option; submitted grants are read-only.

---

## Committee member

### Rate a submitted grant

1. The committee member opens the Review navigation item.
2. The review list shows every submitted grant with the principal investigator's name,
   the title, and the total requested from ARCC. A member does not review their own
   submitted grant.
3. They open a grant to view it read-only and download any submitted files via links.
4. They rate the application against each rubric criterion, choosing one option per
   criterion from its dropdown, and may add a note. The system computes a final rating
   from 0 to 100 (points awarded over criteria maximums, times 100) and stores it with
   the per-criterion ratings. Submitting again updates the same reviewer's review rather
   than adding another. Rating does not approve or deny the grant.

---

## Committee chair

The chair does everything a committee member does, plus:

### Set the cycle allocation

1. On the allocation page (available only to the chair), the chair records the amount
   available for the current cycle, any leftover from the last cycle, and the cutoff
   percentage, and decides how much each grant is awarded.
2. A Send to Accounting button exports a spreadsheet (PI name, grant title, account
   number, amount requested from ARCC) for the accounting office to disburse.

---

## Department chair

### Approve or reject a department grant

1. When a grant is submitted, it is routed to the proposer's department chair for
   approval.
2. The chair sees a department-grants list shaped like the review list.
3. The chair approves or rejects each grant, verifying it relates to the proposer's job
   duties.

---

## College dean

### Approve grants that draw on the college

1. When a submitted grant requests more than $0 from the dean's college, the grant is
   routed to that dean. If no college funds are requested, the dean is not involved.
2. The dean approves or rejects the grant for their college's portion.

---

## Admin

### Manage the ARCC committee

1. The admin opens the committee page showing two lists: current members and all users.
2. They add users to the committee from the all-users list, or remove existing members.
3. They designate one member as chair; choosing a new chair replaces the previous one.

### Manage colleges and departments

1. Under separate tabs, the admin creates and edits colleges and departments.
2. For a college, the admin selects its dean from a dropdown of users; for a department,
   its chair from a dropdown of users. Editing also fills in a dean or chair skipped at
   creation, or moves a department to a different college.

### Manage the rubric

1. The admin defines scoring criteria, each with a name, a description, its own maximum
   score, and a set of rating options ("number: description"). The top option equals
   that criterion's maximum and the bottom option is always 0; in-between options are
   the admin's choice.
2. They add as many criteria as the rubric needs.

---

## Key scenarios

Given/When/Then for the flows worth pinning down precisely. These map to the behavior
the role walkthroughs above describe.

```gherkin
Feature: Submit a grant

  Scenario: Proposer submits a complete grant
    Given a logged-in proposer with a draft that has all required fields
    And the account number and acknowledgements are filled in
    When they click Submit and confirm
    Then the grant status becomes "submitted"
    And the grant is locked against further edits
    And it enters committee and department-chair review

  Scenario: Submit is blocked until acknowledgements are checked
    Given a logged-in proposer with an otherwise complete grant
    And at least one required acknowledgement is unchecked
    When they click Submit
    Then submission is rejected with a validation error
    And the grant remains an editable draft
```

```gherkin
Feature: Score a submitted grant

  Scenario: ARCC member scores against the rubric
    Given an ARCC committee member viewing a submitted grant they did not submit
    When they pick one option per rubric criterion and add a note
    And they submit the rating
    Then the review is saved in the grant's reviews[]
    And a final rating from 0 to 100 is computed and stored
    And re-submitting updates that reviewer's review rather than adding another
```

```gherkin
Feature: Department chair approval

  Scenario: Chair approves a grant from their department
    Given a department chair viewing a submitted grant from their department
    When they approve it
    Then the grant's reviewStatus becomes "approved"

  Scenario: Chair rejects a grant
    Given a department chair viewing a submitted grant from their department
    When they reject it
    Then the grant's reviewStatus becomes "denied"
```

```gherkin
Feature: College dean approval

  Scenario: Dean approves a grant that requests college funds
    Given a submitted grant with a budget item requesting more than $0 from the dean's college
    When the dean opens college-grants and approves it
    Then the grant's collegeReviewStatus becomes "approved"

  Scenario: A grant that requests no college funds skips dean approval
    Given a submitted grant that requests $0 from every college
    Then it does not appear in any dean's college-grants list
    And no dean approval is required
```
