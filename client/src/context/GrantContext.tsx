import { createContext, useContext, useState, type ReactNode } from "react";

export type GrantFormData = {
  title: string;
  description: string;
  projectDirectorId: string;
  studentsImpacted: string;
  affectsMultipleDepartments: string;
  departmentCount: string;
  usesSubjects: string;
  irbApproved: string;
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
};

const emptyBudgetItem: BudgetItem = {
  itemDescription: "",
  category: "",
  amountRequested: "",
  amountFromARCC: "",
  amountFromCollege: "",
  amountFromDepartment: "",
  amountFromOtherSources: "",
};

const GrantContext = createContext<GrantContextType | null>(null);

export function GrantProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] = useState<GrantFormData>(() => {
    const saved = localStorage.getItem("grantFormData");
    return saved ? JSON.parse(saved) : emptyFormData;
  });

  const [budgetItems, setBudgetItemsState] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem("budgetItems");
    return saved ? JSON.parse(saved) : [{ ...emptyBudgetItem }];
  });

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

  const clearGrantDraft = () => {
    setFormDataState(emptyFormData);
    setBudgetItemsState([{ ...emptyBudgetItem }]);
    localStorage.removeItem("grantFormData");
    localStorage.removeItem("budgetItems");
  };

  return (
    <GrantContext.Provider
      value={{
        formData,
        setFormData,
        budgetItems,
        setBudgetItems,
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
