export const BUDGET_CATEGORIES = ["Hardware", "Software"] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const isValidBudgetCategory = (
  value: string | undefined,
): value is BudgetCategory => BUDGET_CATEGORIES.some((c) => c === value);

const BUDGET_FUNDING_FIELDS = [
  "amountRequested",
  "amountFromARCC",
  "amountFromCollege",
  "amountFromDepartment",
  "amountFromOtherSources",
] as const;

type BudgetAmounts = Partial<
  Record<(typeof BUDGET_FUNDING_FIELDS)[number], string>
>;

// A budget row only counts once the user has actually put something in it,
// so a freshly added (or never-touched) blank row is not treated as an error.
// Checks every funding field, matching the server predicate in
// server/src/routes/grantValidation.ts — the two must stay in step or a row
// can pass here and be rejected with a 400.
export const isBudgetItemStarted = (
  item: { itemDescription?: string } & BudgetAmounts,
): boolean =>
  Boolean(item.itemDescription?.trim()) ||
  BUDGET_FUNDING_FIELDS.some((field) => Number(item[field] || 0) > 0);

// Single source of truth for "this row should be flagged" — used by both the
// worksheet field and the submit-time check so they can't drift apart.
export const isBudgetItemInvalid = (
  item: { itemDescription?: string; category?: string } & BudgetAmounts,
): boolean =>
  isBudgetItemStarted(item) && !isValidBudgetCategory(item.category);
