import { createContext, useContext, useState, type ReactNode } from "react";

export type YesNo = "" | "yes" | "no";

export type GrantFormData = {
  title: string;
  description: string;
  projectDirectorId: string;
  studentsImpacted: string;
  affectsMultipleDepartments: YesNo;
  departmentCount: string;
  usesSubjects: YesNo;
  irbApproved: YesNo;
  timeline: string;
  matchingFundsAvailable: boolean;
  matchingFundsAmount: string;
};

export type BudgetItem = {
  itemDescription: string;
  category: string;
  amountRequested: string;
  amountFromARCC: string;
  amountFromCollege: string;
  amountFromDepartment: string;
  amountFromOtherSources: string;
};

type GrantContextType = {
  formData: GrantFormData;
  setFormData: React.Dispatch<React.SetStateAction<GrantFormData>>;
  budgetItems: BudgetItem[];
  setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  activeGrantId: string | null;
  beginEditingGrant: (
    grantId: string,
    form: GrantFormData,
    items: BudgetItem[],
  ) => void;
  clearGrantDraft: () => void;
};

const emptyFormData: GrantFormData = {
  title: "",
  description: "",
  projectDirectorId: "",
  studentsImpacted: "",
  affectsMultipleDepartments: "",
  departmentCount: "",
  usesSubjects: "",
  irbApproved: "",
  timeline: "",
  matchingFundsAvailable: false,
  matchingFundsAmount: "",
};

export const emptyBudgetItem: BudgetItem = {
  itemDescription: "",
  category: "",
  amountRequested: "",
  amountFromARCC: "",
  amountFromCollege: "",
  amountFromDepartment: "",
  amountFromOtherSources: "",
};

// Sum of every budget source that is NOT ARCC (College + Department + Other),
// used to seed the matching-funds amount via the "Pull from budget" button.
// Non-numeric / blank cells count as 0. Returned as a string to match the
// text-input value type.
export function sumMatchingFromBudget(items: BudgetItem[]): string {
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const total = items.reduce(
    (acc, item) =>
      acc +
      num(item.amountFromCollege) +
      num(item.amountFromDepartment) +
      num(item.amountFromOtherSources),
    0,
  );
  return String(total);
}

const GrantContext = createContext<GrantContextType | null>(null);

// Corrupt localStorage (manual edits, devtools) must not crash the initial
// render; fall back to a clean draft and drop the bad value.
function readStoredJson<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function GrantProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] = useState<GrantFormData>(() =>
    readStoredJson("grantFormData", emptyFormData),
  );

  const [budgetItems, setBudgetItemsState] = useState<BudgetItem[]>(() =>
    readStoredJson("budgetItems", [{ ...emptyBudgetItem }]),
  );

  const [activeGrantId, setActiveGrantIdState] = useState<string | null>(() =>
    localStorage.getItem("activeGrantId"),
  );

  const setFormData: React.Dispatch<React.SetStateAction<GrantFormData>> = (
    value,
  ) => {
    setFormDataState((current) => {
      const updated = typeof value === "function" ? value(current) : value;
      localStorage.setItem("grantFormData", JSON.stringify(updated));
      return updated;
    });
  };

  const setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>> = (
    value,
  ) => {
    setBudgetItemsState((current) => {
      const updated = typeof value === "function" ? value(current) : value;
      localStorage.setItem("budgetItems", JSON.stringify(updated));
      return updated;
    });
  };

  // Seed the draft from a fetched grant when starting to edit it. If the
  // same grant is already loaded (e.g. returning from the budget worksheet),
  // keep the in-progress edits instead of overwriting them with server state.
  const beginEditingGrant = (
    grantId: string,
    form: GrantFormData,
    items: BudgetItem[],
  ) => {
    if (activeGrantId === grantId) return;
    setActiveGrantIdState(grantId);
    localStorage.setItem("activeGrantId", grantId);
    setFormData(form);
    setBudgetItems(items.length > 0 ? items : [{ ...emptyBudgetItem }]);
  };

  const clearGrantDraft = () => {
    setFormDataState(emptyFormData);
    setBudgetItemsState([{ ...emptyBudgetItem }]);
    setActiveGrantIdState(null);
    localStorage.removeItem("grantFormData");
    localStorage.removeItem("budgetItems");
    localStorage.removeItem("activeGrantId");
  };

  return (
    <GrantContext.Provider
      value={{
        formData,
        setFormData,
        budgetItems,
        setBudgetItems,
        activeGrantId,
        beginEditingGrant,
        clearGrantDraft,
      }}
    >
      {children}
    </GrantContext.Provider>
  );
}

export const useGrant = () => {
  const ctx = useContext(GrantContext);
  if (!ctx) throw new Error("useGrant must be used within GrantProvider");
  return ctx;
};
