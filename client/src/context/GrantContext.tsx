import { createContext, useContext, useState, type ReactNode } from "react";

export type YesNo = "" | "yes" | "no";

export type GrantFormData = {
  title: string;
  description: string;
  projectDirectorId: string;
  accountNumber: string;
  studentsImpacted: string;
  affectsMultipleDepartments: YesNo;
  departmentCount: string;
  usesSubjects: YesNo;
  irbApproved: YesNo;
  timeline: string;
  hasMatchingFunds: boolean;
  matchingFundsTotal: string;
  acknowledgement1: boolean;
  acknowledgement2: boolean;
  acknowledgement3: boolean;
  acknowledgement4: boolean;
  signature: string;
};

export type BudgetItem = {
  itemDescription: string;
  category: string;
  amountRequested: string;
  amountFromARCC: string;
  amountFromCollege: string;
  collegeId: string;
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
  accountNumber: "",
  studentsImpacted: "",
  affectsMultipleDepartments: "",
  departmentCount: "",
  usesSubjects: "",
  irbApproved: "",
  timeline: "",
  hasMatchingFunds: false,
  matchingFundsTotal: "",
  acknowledgement1: false,
  acknowledgement2: false,
  acknowledgement3: false,
  acknowledgement4: false,
  signature: "",
};

export const emptyBudgetItem: BudgetItem = {
  itemDescription: "",
  category: "",
  amountRequested: "",
  amountFromARCC: "",
  amountFromCollege: "",
  collegeId: "",
  amountFromDepartment: "",
  amountFromOtherSources: "",
};

const GrantContext = createContext<GrantContextType | null>(null);

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
  const [formData, setFormDataState] = useState<GrantFormData>(() => ({
    ...emptyFormData,
    ...readStoredJson<Partial<GrantFormData>>("grantFormData", {}),
  }));

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
