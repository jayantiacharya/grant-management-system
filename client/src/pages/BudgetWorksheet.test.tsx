import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockLogout, mockLocation } = vi.hoisted(
  () => ({
    mockUseAuth: vi.fn(),
    mockNavigate: vi.fn(),
    mockLogout: vi.fn(),
    mockLocation: { state: { returnTo: "/grants/edit/g1" } } as {
      state: { returnTo: string } | null;
    },
  }),
);

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import BudgetWorksheet from "./BudgetWorksheet";
import { GrantProvider } from "../context/GrantContext";

function renderWorksheet() {
  return render(<BudgetWorksheet />, { wrapper: GrantProvider });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockLocation.state = { returnTo: "/grants/edit/g1" };
  mockUseAuth.mockReturnValue({
    user: { id: "u1", email: "alice@wsu.edu", role: "user" },
    token: "tok123",
    logout: mockLogout,
  });
});

describe("BudgetWorksheet", () => {
  it("renders one blank budget item to start", () => {
    renderWorksheet();
    expect(screen.getByText("Budget Item 1")).toBeInTheDocument();
    expect(screen.queryByText("Budget Item 2")).not.toBeInTheDocument();
  });

  it("recomputes the per-item total from the funding source fields", async () => {
    const user = userEvent.setup();
    renderWorksheet();

    await user.type(screen.getByLabelText(/amount from arcc/i), "100");
    await user.type(screen.getByLabelText(/amount from college/i), "50.5");

    const total = screen.getByLabelText(
      /total amount requested/i,
    ) as HTMLInputElement;
    expect(total.value).toBe("150.50");
    expect(total.readOnly).toBe(true);
  });

  it("shows the grand total across all items", async () => {
    const user = userEvent.setup();
    renderWorksheet();

    await user.type(screen.getByLabelText(/amount from arcc/i), "100");
    await user.click(screen.getByRole("button", { name: /add budget item/i }));
    await user.type(
      screen.getAllByLabelText(/amount from department/i)[1],
      "25",
    );

    expect(screen.getByText(/total requested: \$125\.00/i)).toBeInTheDocument();
  });

  it("adds and removes budget items", async () => {
    const user = userEvent.setup();
    renderWorksheet();

    await user.click(screen.getByRole("button", { name: /add budget item/i }));
    expect(screen.getByText("Budget Item 2")).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: /remove budget item/i })[0],
    );
    expect(screen.queryByText("Budget Item 2")).not.toBeInTheDocument();
  });

  it("does not show a remove button for the only item", () => {
    renderWorksheet();
    expect(
      screen.queryByRole("button", { name: /remove budget item/i }),
    ).not.toBeInTheDocument();
  });

  it("returns to the grant form it was opened from", async () => {
    const user = userEvent.setup();
    renderWorksheet();
    await user.click(
      screen.getByRole("button", { name: /back to grant form/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/grants/edit/g1");
  });

  it("falls back to the new grant form without navigation state", async () => {
    mockLocation.state = null;
    const user = userEvent.setup();
    renderWorksheet();
    await user.click(
      screen.getByRole("button", { name: /back to grant form/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/grants/new");
  });

  it("persists items into the shared draft context", async () => {
    const user = userEvent.setup();
    renderWorksheet();

    await user.type(screen.getByLabelText(/budget item name/i), "Laptop");

    const stored = JSON.parse(localStorage.getItem("budgetItems")!);
    expect(stored[0].itemDescription).toBe("Laptop");
  });
});
