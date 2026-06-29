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

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

import axios from "axios";
import Dashboard from "./Dashboard";

const fakeUser = { id: "u1", email: "alice@wsu.edu", role: "user" };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: fakeUser,
    token: "tok123",
    logout: mockLogout,
    updateUserArccStatus: vi.fn(),
  });
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
});

describe("Dashboard", () => {
  it("greets the user and fetches their grants by email", async () => {
    render(<Dashboard />);
    expect(screen.getByText(/welcome, alice@wsu.edu/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/user-grants/alice@wsu.edu",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
  });

  it("renders grant submissions with edit buttons", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { _id: "g1", title: "Grant One" },
        { _id: "g2", title: "Grant Two" },
      ],
    });
    render(<Dashboard />);
    expect(await screen.findByText("Grant One")).toBeInTheDocument();
    expect(screen.getByText("Grant Two")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(2);
  });

  it("navigates to edit page when an edit button is clicked", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [{ _id: "g1", title: "Grant One" }],
    });
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(await screen.findByRole("button", { name: /edit/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/grants/edit/g1");
  });

  it("does not render the submissions section when there are no grants", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(
      screen.queryByText(/your grant submissions/i),
    ).not.toBeInTheDocument();
  });

  it("does not crash and shows no submissions when the API returns a non-array", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { message: "oops" } });
    render(<Dashboard />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(
      screen.queryByText(/your grant submissions/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/welcome, alice@wsu.edu/i)).toBeInTheDocument();
  });

  it("navigates to new grant page from the submit button", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(
      screen.getByRole("button", { name: /submit a new grant proposal/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/grants/new");
  });

  it("logs out and navigates to /login", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("navigates to profile when the email button is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByRole("button", { name: "alice@wsu.edu" }));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });
});
