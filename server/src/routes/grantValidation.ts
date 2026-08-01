// Shared grant payload validation for the create (POST /submit) and edit
// (PUT /edit/:id) routes. Drafts persist whatever is present; submitted grants
// must pass the full set of rules. Keeping this in one place stops the two
// routes from drifting (e.g. the file-required rule that was enforced on create
// but silently dropped on edit).

export const GRANT_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
} as const;
export const GRANT_APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
} as const;

export type GrantStatus = (typeof GRANT_STATUS)[keyof typeof GRANT_STATUS];
export type GrantApprovalStatus =
  (typeof GRANT_APPROVAL_STATUS)[keyof typeof GRANT_APPROVAL_STATUS];

export type GrantFileMeta = {
  originalName: string;
  savedName: string;
  path: string;
};

// Budget item categories are a fixed list. Mirrors client/src/constants/budget.ts;
// the two need to stay in sync if a category is ever added or removed.
export const BUDGET_CATEGORIES = ["Hardware", "Software"] as const;

const BUDGET_FUNDING_FIELDS = [
  "amountRequested",
  "amountFromARCC",
  "amountFromCollege",
  "amountFromDepartment",
  "amountFromOtherSources",
] as const;

// budgetItems arrives as an array on JSON requests and as a JSON string on
// multipart ones, so both routes normalise through here.
export function parseBudgetItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Mirrors the client: a row only counts once it has a name or any money in it,
// so the blank row the form always starts with does not block submission.
function isBudgetItemStarted(item: any): boolean {
  const hasName =
    typeof item?.itemDescription === "string" &&
    item.itemDescription.trim() !== "";
  const hasMoney = BUDGET_FUNDING_FIELDS.some(
    (field) => (parseFloat(item?.[field]) || 0) > 0,
  );
  return hasName || hasMoney;
}

function hasInvalidBudgetCategory(budgetItems: unknown[]): boolean {
  return budgetItems
    .filter((item) => isBudgetItemStarted(item))
    .some(
      (item: any) =>
        typeof item?.category !== "string" ||
        !(BUDGET_CATEGORIES as readonly string[]).includes(
          item.category.trim(),
        ),
    );
}

type ValidateArgs = {
  body: Record<string, any>;
  parsedBudgetItems: unknown[];
  uploadedFiles: GrantFileMeta[];
  irbApprovalFile: GrantFileMeta | null;
  // For edits: files already attached to the grant. A submit-via-edit should
  // not force a re-upload when the draft already carried the required files.
  existingFiles?: GrantFileMeta[];
  existingIrbApprovalFile?: GrantFileMeta | null;
};

type ValidateError = { ok: false; status: number; message: string };
type ValidateOk = {
  ok: true;
  isDraft: boolean;
  normalizedStatus: GrantStatus;
  parsedStudents: number | null;
  parsedDepartmentCount: number | null;
};

export function validateGrantPayload(
  args: ValidateArgs,
): ValidateError | ValidateOk {
  const {
    body,
    parsedBudgetItems,
    uploadedFiles,
    irbApprovalFile,
    existingFiles = [],
    existingIrbApprovalFile = null,
  } = args;
  const {
    title,
    description,
    accountNumber,
    studentsImpacted,
    affectsMultipleDepartments,
    departmentCount,
    usesSubjects,
    irbApproved,
    educationalImpact,
    evaluationPlan,
    status,
  } = body;

  const isDraft = status === GRANT_STATUS.DRAFT;
  const normalizedStatus: GrantStatus = isDraft
    ? GRANT_STATUS.DRAFT
    : GRANT_STATUS.SUBMITTED;

  // studentsImpacted: a blank/absent value parses to null (not 0) so a partial
  // draft round-trips as empty rather than a misleading zero.
  const hasStudents = studentsImpacted !== "" && studentsImpacted != null;
  const rawStudents = Number(studentsImpacted);
  const studentsValid =
    hasStudents && Number.isInteger(rawStudents) && rawStudents >= 0;
  const parsedStudents = studentsValid ? rawStudents : null;

  // departmentCount only matters when the grant spans multiple departments. A
  // non-numeric draft value stores null rather than NaN.
  const wantsMultiDept = affectsMultipleDepartments === "yes";
  const hasDept = departmentCount !== "" && departmentCount != null;
  const rawDept = Number(departmentCount);
  const deptValid =
    wantsMultiDept && hasDept && Number.isInteger(rawDept) && rawDept >= 2;
  const parsedDepartmentCount =
    wantsMultiDept && hasDept && Number.isFinite(rawDept) ? rawDept : null;

  if (!isDraft) {
    if (!title || !description) {
      return {
        ok: false,
        status: 400,
        message: "title and description are required",
      };
    }
    const normalizedAccountNumber =
      typeof accountNumber === "string" ? accountNumber.trim() : "";
    if (!normalizedAccountNumber) {
      return {
        ok: false,
        status: 400,
        message: "accountNumber is required",
      };
    }
    if (!studentsValid) {
      return {
        ok: false,
        status: 400,
        message: "studentsImpacted must be a non-negative integer",
      };
    }
    if (wantsMultiDept && !deptValid) {
      return {
        ok: false,
        status: 400,
        message:
          "departmentCount must be an integer >= 2 when affectsMultipleDepartments is yes",
      };
    }
    if (usesSubjects === "yes" && irbApproved !== "yes") {
      return {
        ok: false,
        status: 400,
        message: "irbApproved must be yes when usesSubjects is yes",
      };
    }
    if (
      usesSubjects === "yes" &&
      uploadedFiles.length === 0 &&
      existingFiles.length === 0
    ) {
      return {
        ok: false,
        status: 400,
        message: "file upload is required when usesSubjects is yes",
      };
    }
    if (irbApproved === "yes" && !irbApprovalFile && !existingIrbApprovalFile) {
      return {
        ok: false,
        status: 400,
        message: "IRB approval document is required when irbApproved is yes",
      };
    }
    const normalizedEducationalImpact =
      typeof educationalImpact === "string" ? educationalImpact.trim() : "";
    if (!normalizedEducationalImpact) {
      return {
        ok: false,
        status: 400,
        message: "educationalImpact is required",
      };
    }
    const normalizedEvaluationPlan =
      typeof evaluationPlan === "string" ? evaluationPlan.trim() : "";
    if (!normalizedEvaluationPlan) {
      return {
        ok: false,
        status: 400,
        message: "evaluationPlan is required",
      };
    }
    if (hasInvalidBudgetCategory(parsedBudgetItems)) {
      return {
        ok: false,
        status: 400,
        message: `each budget item must have a category of ${BUDGET_CATEGORIES.join(
          " or ",
        )}`,
      };
    }
  }

  return {
    ok: true,
    isDraft,
    normalizedStatus,
    parsedStudents,
    parsedDepartmentCount,
  };
}

function parseAcknowledgementBool(value: unknown): boolean {
  return value === true || value === "true";
}

export function validateAcknowledgements(
  body: Record<string, unknown>,
): ValidateError | { ok: true; signature: string } {
  const ackKeys = [
    "acknowledgement1",
    "acknowledgement2",
    "acknowledgement3",
    "acknowledgement4",
  ] as const;

  for (const key of ackKeys) {
    if (!parseAcknowledgementBool(body[key])) {
      return {
        ok: false,
        status: 400,
        message: "all acknowledgements must be accepted",
      };
    }
  }

  const signature =
    typeof body.signature === "string" ? body.signature.trim() : "";
  if (!signature) {
    return { ok: false, status: 400, message: "signature is required" };
  }

  return { ok: true, signature };
}
