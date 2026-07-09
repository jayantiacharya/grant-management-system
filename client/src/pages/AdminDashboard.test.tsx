import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const { mockUseAuth, mockNavigate, mockLogout } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/admin" }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import AdminDashboard from "./AdminDashboard";

const adminUser = { id: "a1", email: "admin@wsu.edu", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: adminUser, logout: mockLogout });
});

describe("AdminDashboard", () => {
  it("renders the admin nav links", () => {
    render(<AdminDashboard />);
    expect(
      screen.getByRole("link", { name: /college management/i }),
    ).toHaveAttribute("href", "/admin/college");
    expect(
      screen.getByRole("link", { name: /department management/i }),
    ).toHaveAttribute("href", "/admin/department");
    expect(
      screen.getByRole("link", { name: /arcc committee/i }),
    ).toHaveAttribute("href", "/admin/arcc");
  });

  it("shows the signed-in admin's email", () => {
    render(<AdminDashboard />);
    expect(screen.getByText("admin@wsu.edu")).toBeInTheDocument();
  });

  it("does not redirect an admin user", () => {
    render(<AdminDashboard />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects non-admin users to /dashboard", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "user@wsu.edu", role: "user" },
      logout: mockLogout,
    });
    render(<AdminDashboard />);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("redirects to /dashboard when no user is set", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: mockLogout });
    render(<AdminDashboard />);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("logs out and navigates to /login", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
