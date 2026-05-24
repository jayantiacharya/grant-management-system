import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useAuth: () => mockUseAuth(),
}));

vi.mock("./pages/Login", () => ({
  default: () => <div>login page</div>,
}));
vi.mock("./pages/Register", () => ({ default: () => <div>register</div> }));
vi.mock("./pages/Dashboard", () => ({ default: () => <div>dashboard</div> }));
vi.mock("./pages/NewGrant", () => ({ default: () => <div>new grant</div> }));
vi.mock("./pages/AdminDashboard", () => ({ default: () => <div>admin</div> }));

import { ProtectedRoute } from "./App";

const renderWithRoute = () =>
  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProtectedRoute", () => {
  it("renders children when token and user are both present", () => {
    mockUseAuth.mockReturnValue({
      token: "tok",
      user: { id: "u1", email: "a@b.c", role: "user" },
    });
    renderWithRoute();
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("redirects to /login when token present but user is null", () => {
    mockUseAuth.mockReturnValue({ token: "tok", user: null });
    renderWithRoute();
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects to /login when no token", () => {
    mockUseAuth.mockReturnValue({ token: null, user: null });
    renderWithRoute();
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });
});
