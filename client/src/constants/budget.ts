export const BUDGET_CATEGORIES = ["Hardware", "Software"] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const isValidBudgetCategory = (value: string | undefined): boolean =>
  (BUDGET_CATEGORIES as readonly string[]).includes(value ?? "");

// A budget row only counts once the user has actually put something in it,
// so a freshly added (or never-touched) blank row is not treated as an error.
export const isBudgetItemStarted = (item: {
  itemDescription?: string;
  amountRequested?: string;
}): boolean =>
  Boolean(item.itemDescription?.trim()) ||
  Number(item.amountRequested || 0) > 0;
