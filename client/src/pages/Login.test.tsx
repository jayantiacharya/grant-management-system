import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

import axios from "axios";
import Login from "./Login";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ login: mockLogin });
});

describe("Login", () => {
  it("renders email and password fields", () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("logs in a normal user and navigates to /dashboard", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        token: "tok",
        user: { id: "u1", email: "a@b.c", role: "user" },
      },
    });
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email/i), "a@b.c");
    await user.type(screen.getByLabelText(/password/i), "secret1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/login",
        { email: "a@b.c", password: "secret1" },
      );
    });
    expect(mockLogin).toHaveBeenCalledWith(
      { id: "u1", email: "a@b.c", role: "user" },
      "tok",
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to /admin when role is admin", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        token: "tok",
        user: { id: "u1", email: "admin@b.c", role: "admin" },
      },
    });
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email/i), "admin@b.c");
    await user.type(screen.getByLabelText(/password/i), "secret1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/admin"));
  });

  it("shows server error message on failed login", async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { data: { message: "Invalid email or password" } },
    });
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email/i), "a@b.c");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to generic message when error has no response body", async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email/i), "a@b.c");
    await user.type(screen.getByLabelText(/password/i), "secret1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});
