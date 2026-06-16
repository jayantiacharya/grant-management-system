import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  GrantProvider,
  useGrant,
  emptyBudgetItem,
  sumMatchingFromBudget,
  type GrantFormData,
} from "./GrantContext";

const wrapper = GrantProvider;

const sampleForm: GrantFormData = {
  title: "Grant A",
  description: "desc",
  projectDirectorId: "u1",
  studentsImpacted: "10",
  affectsMultipleDepartments: "no",
  departmentCount: "",
  usesSubjects: "no",
  irbApproved: "",
  timeline: "",
  matchingFundsAvailable: false,
  matchingFundsAmount: "",
};

const sampleBudget = [
  { ...emptyBudgetItem, itemDescription: "Laptop", amountRequested: "500.00" },
];

beforeEach(() => {
  localStorage.clear();
});

describe("GrantContext", () => {
  it("starts with an empty draft and one blank budget row", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    expect(result.current.formData.title).toBe("");
    expect(result.current.budgetItems).toEqual([emptyBudgetItem]);
    expect(result.current.activeGrantId).toBeNull();
  });

  it("hydrates from localStorage", () => {
    localStorage.setItem("grantFormData", JSON.stringify(sampleForm));
    localStorage.setItem("budgetItems", JSON.stringify(sampleBudget));
    const { result } = renderHook(() => useGrant(), { wrapper });
    expect(result.current.formData.title).toBe("Grant A");
    expect(result.current.budgetItems[0].itemDescription).toBe("Laptop");
  });

  it("falls back to a clean draft when localStorage holds corrupt JSON", () => {
    localStorage.setItem("grantFormData", "{not json");
    localStorage.setItem("budgetItems", "[broken");
    const { result } = renderHook(() => useGrant(), { wrapper });
    expect(result.current.formData.title).toBe("");
    expect(result.current.budgetItems).toEqual([emptyBudgetItem]);
    expect(localStorage.getItem("grantFormData")).toBeNull();
    expect(localStorage.getItem("budgetItems")).toBeNull();
  });

  it("persists form and budget changes to localStorage", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    act(() => {
      result.current.setFormData(sampleForm);
      result.current.setBudgetItems(sampleBudget);
    });
    expect(JSON.parse(localStorage.getItem("grantFormData")!).title).toBe(
      "Grant A",
    );
    expect(
      JSON.parse(localStorage.getItem("budgetItems")!)[0].itemDescription,
    ).toBe("Laptop");
  });

  it("beginEditingGrant seeds the draft for a new grant id", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    act(() => {
      result.current.beginEditingGrant("g1", sampleForm, sampleBudget);
    });
    expect(result.current.activeGrantId).toBe("g1");
    expect(result.current.formData.title).toBe("Grant A");
    expect(result.current.budgetItems[0].itemDescription).toBe("Laptop");
  });

  it("beginEditingGrant keeps in-progress edits when the same grant reloads", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    act(() => {
      result.current.beginEditingGrant("g1", sampleForm, sampleBudget);
    });
    act(() => {
      result.current.setFormData({ ...sampleForm, title: "Edited locally" });
    });
    // Returning from the budget worksheet refetches and reseeds; the edit
    // must survive because the same grant is already loaded.
    act(() => {
      result.current.beginEditingGrant("g1", sampleForm, sampleBudget);
    });
    expect(result.current.formData.title).toBe("Edited locally");
  });

  it("beginEditingGrant replaces the draft when a different grant loads", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    act(() => {
      result.current.beginEditingGrant("g1", sampleForm, sampleBudget);
    });
    act(() => {
      result.current.beginEditingGrant(
        "g2",
        { ...sampleForm, title: "Grant B" },
        [],
      );
    });
    expect(result.current.activeGrantId).toBe("g2");
    expect(result.current.formData.title).toBe("Grant B");
    // No stored budget on the new grant: one blank row, not grant A's items.
    expect(result.current.budgetItems).toEqual([emptyBudgetItem]);
  });

  it("clearGrantDraft resets state and storage", () => {
    const { result } = renderHook(() => useGrant(), { wrapper });
    act(() => {
      result.current.beginEditingGrant("g1", sampleForm, sampleBudget);
    });
    act(() => {
      result.current.clearGrantDraft();
    });
    expect(result.current.activeGrantId).toBeNull();
    expect(result.current.formData.title).toBe("");
    expect(result.current.budgetItems).toEqual([emptyBudgetItem]);
    expect(localStorage.getItem("grantFormData")).toBeNull();
    expect(localStorage.getItem("budgetItems")).toBeNull();
    expect(localStorage.getItem("activeGrantId")).toBeNull();
  });
});

describe("sumMatchingFromBudget", () => {
  it("returns '0' for a single empty item", () => {
    expect(sumMatchingFromBudget([{ ...emptyBudgetItem }])).toBe("0");
  });

  it("sums college + department + other across items, ignoring ARCC and requested", () => {
    const items = [
      {
        ...emptyBudgetItem,
        amountRequested: "1000",
        amountFromARCC: "400",
        amountFromCollege: "200",
        amountFromDepartment: "300",
        amountFromOtherSources: "100",
      },
      {
        ...emptyBudgetItem,
        amountFromCollege: "50",
        amountFromOtherSources: "25",
      },
    ];
    expect(sumMatchingFromBudget(items)).toBe("675");
  });

  it("treats blank and non-numeric values as 0", () => {
    const items = [
      {
        ...emptyBudgetItem,
        amountFromCollege: "",
        amountFromDepartment: "abc",
      },
    ];
    expect(sumMatchingFromBudget(items)).toBe("0");
  });
});
