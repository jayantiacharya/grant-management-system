export const BUDGET_CATEGORIES = ["Hardware", "Software"] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const isValidBudgetCategory = (
  value: string | undefined,
): value is BudgetCategory => BUDGET_CATEGORIES.some((c) => c === value);

// A budget row only counts once the user has actually put something in it,
// so a freshly added (or never-touched) blank row is not treated as an error.
export const isBudgetItemStarted = (item: {
  itemDescription?: string;
  amountRequested?: string;
}): boolean =>
  Boolean(item.itemDescription?.trim()) ||
  Number(item.amountRequested || 0) > 0;

// Single source of truth for "this row should be flagged" — used by both the
// worksheet field and the submit-time check so they can't drift apart.
export const isBudgetItemInvalid = (item: {
  itemDescription?: string;
  amountRequested?: string;
  category?: string;
}): boolean =>
  isBudgetItemStarted(item) && !isValidBudgetCategory(item.category);
