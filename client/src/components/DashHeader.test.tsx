import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockLocation } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLocation: { pathname: "/dashboard" },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import DashHeader from "./DashHeader";

const baseUser = { id: "u1", email: "alice@wsu.edu", role: "user" };

function setUser(user: object | null, pathname = "/dashboard") {
  mockLocation.pathname = pathname;
  mockUseAuth.mockReturnValue({ user, token: "tok", logout: vi.fn() });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashHeader nav", () => {
  it("shows only a disabled Dashboard link for a plain user on their dashboard", () => {
    setUser(baseUser);
    render(<DashHeader />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dept Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "College Grants" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Admin" }),
    ).not.toBeInTheDocument();
  });

  it("navigates home from the Dashboard link on other pages", async () => {
    setUser(baseUser, "/profile");
    const user = userEvent.setup();
    render(<DashHeader />);
    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("gives admins both Dashboard and Admin links with distinct targets", async () => {
    setUser({ ...baseUser, role: "admin" }, "/admin/allocation");
    const user = userEvent.setup();
    render(<DashHeader />);
    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    await user.click(screen.getByRole("button", { name: "Admin" }));
    expect(mockNavigate).toHaveBeenCalledWith("/admin");
  });

  it("disables only the current page's link", () => {
    setUser({ ...baseUser, role: "admin" }, "/admin");
    render(<DashHeader />);
    expect(screen.getByRole("button", { name: "Admin" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).not.toBeDisabled();
  });

  it("shows Review for ARCC members, disabled on /review", () => {
    setUser({ ...baseUser, isArcc: true }, "/profile");
    const { unmount } = render(<DashHeader />);
    expect(screen.getByRole("button", { name: "Review" })).not.toBeDisabled();
    unmount();

    setUser({ ...baseUser, isArcc: true }, "/review");
    render(<DashHeader />);
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("shows Dept Review for department chairs", async () => {
    setUser({ ...baseUser, isDeptChair: true });
    const user = userEvent.setup();
    render(<DashHeader />);
    await user.click(screen.getByRole("button", { name: "Dept Review" }));
    expect(mockNavigate).toHaveBeenCalledWith("/department-review");
  });

  it("shows College Grants but no Dashboard link for deans", () => {
    setUser({ ...baseUser, isDean: true }, "/profile");
    render(<DashHeader />);
    expect(
      screen.getByRole("button", { name: "College Grants" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("shows every link for a user holding all roles", () => {
    setUser(
      {
        ...baseUser,
        role: "admin",
        isArcc: true,
        isDeptChair: true,
        isDean: true,
      },
      "/profile",
    );
    render(<DashHeader />);
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dept Review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "College Grants" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
  });

  it("still renders the back button alongside nav", async () => {
    setUser(baseUser, "/grant-reports/g1");
    const user = userEvent.setup();
    render(
      <DashHeader
        back={{ label: "Back to approved grants", to: "/approved-grants" }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Back to approved grants" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/approved-grants");
  });
});
