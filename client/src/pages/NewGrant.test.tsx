import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockLogout } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("axios", () => {
  const isAxiosError = vi.fn(
    (e: unknown) => typeof e === "object" && e !== null && "isAxiosError" in e,
  );
  const isCancel = vi.fn(() => false);
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      isAxiosError,
      isCancel,
    },
    isAxiosError,
    isCancel,
  };
});

import axios from "axios";
import NewGrant from "./NewGrant";

const fakeUser = { id: "u1", email: "alice@wsu.edu", role: "user" };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: fakeUser,
    token: "tok123",
    logout: mockLogout,
  });
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

describe("NewGrant", () => {
  it("renders all form fields", () => {
    render(<NewGrant />);
    expect(screen.getByLabelText(/grant title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/project director/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/students impacted/i)).toBeInTheDocument();
  });

  it("fetches user-options with bearer token on mount", async () => {
    render(<NewGrant />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/user-options",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
  });

  it("pre-selects current user as project director", () => {
    render(<NewGrant />);
    const select = screen.getByLabelText(
      /project director/i,
    ) as HTMLSelectElement;
    expect(select.value).toBe("u1");
  });

  it("shows field errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    render(<NewGrant />);

    screen.getByLabelText(/grant title/i).removeAttribute("required");
    screen.getByLabelText(/description/i).removeAttribute("required");
    screen.getByLabelText(/students impacted/i).removeAttribute("required");

    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    expect(screen.getByText(/non-negative integer/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("submits typed payload and shows success", async () => {
    const user = userEvent.setup();
    render(<NewGrant />);

    await user.type(screen.getByLabelText(/grant title/i), "AI for Good");
    await user.type(screen.getByLabelText(/description/i), "Build it");
    await user.type(screen.getByLabelText(/students impacted/i), "42");
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/submit",
        {
          title: "AI for Good",
          description: "Build it",
          projectDirectorId: "u1",
          studentsImpacted: 42,
        },
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
    expect(
      await screen.findByText(/submitted successfully/i),
    ).toBeInTheDocument();
  });

  it("surfaces server error message on submit failure", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: "Bad request from server" } },
    });
    const user = userEvent.setup();
    render(<NewGrant />);

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(screen.getByLabelText(/students impacted/i), "1");
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(
      await screen.findByText("Bad request from server"),
    ).toBeInTheDocument();
  });

  it("surfaces user-options load error", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: "Forbidden" } },
    });
    render(<NewGrant />);
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("clears field error as user types", async () => {
    const user = userEvent.setup();
    render(<NewGrant />);

    const titleInput = screen.getByLabelText(
      /grant title/i,
    ) as HTMLInputElement;
    titleInput.removeAttribute("required");
    screen.getByLabelText(/description/i).removeAttribute("required");
    screen.getByLabelText(/students impacted/i).removeAttribute("required");

    await user.click(screen.getByRole("button", { name: /submit proposal/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();

    await user.type(titleInput, "x");
    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
  });

  it("rejects negative studentsImpacted client-side", async () => {
    const user = userEvent.setup();
    render(<NewGrant />);

    const num = screen.getByLabelText(/students impacted/i) as HTMLInputElement;
    num.removeAttribute("min");
    num.removeAttribute("required");

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(num, "-5");
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(
      await screen.findByText(/non-negative integer/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
