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
  default: { get: vi.fn(), post: vi.fn() },
}));

import axios from "axios";
import Profile from "./Profile";

const fakeUser = { id: "u1", email: "alice@wsu.edu", role: "user" };

const userPayload = {
  user: {
    id: "u1",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@wsu.edu",
    department: "Computer Science",
    college: "College of Engineering",
  },
};

function mockGetByUrl() {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url.includes("/get-user/")) {
      return Promise.resolve({ data: userPayload });
    }
    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: fakeUser, logout: mockLogout });
  mockGetByUrl();
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

describe("Profile", () => {
  it("fetches colleges, departments, and the user's data on mount", async () => {
    render(<Profile />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/colleges",
      );
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/departments",
      );
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/get-user/u1",
      );
    });
  });

  it("renders the fetched profile information", async () => {
    render(<Profile />);
    expect(await screen.findByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText("College of Engineering")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
  });

  it("switches to edit mode and pre-fills the form", async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(
      await screen.findByRole("button", { name: /edit profile/i }),
    );
    expect(
      (screen.getByPlaceholderText("First Name") as HTMLInputElement).value,
    ).toBe("Alice");
    expect(
      (screen.getByPlaceholderText("Email") as HTMLInputElement).value,
    ).toBe("alice@wsu.edu");
  });

  it("alerts and does not submit when passwords do not match", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(
      await screen.findByRole("button", { name: /edit profile/i }),
    );

    await user.type(screen.getByPlaceholderText("Password"), "newpass1");
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "different",
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith("Passwords do not match");
    expect(axios.post).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("submits the update with userId and form data, then exits edit mode", async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(
      await screen.findByRole("button", { name: /edit profile/i }),
    );

    const firstName = screen.getByPlaceholderText("First Name");
    await user.clear(firstName);
    await user.type(firstName, "Alicia");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/update-user",
        expect.objectContaining({ userId: "u1", firstName: "Alicia" }),
      );
    });
    expect(
      await screen.findByRole("button", { name: /edit profile/i }),
    ).toBeInTheDocument();
  });

  it("cancel button returns to the profile view", async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(
      await screen.findByRole("button", { name: /edit profile/i }),
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(
      await screen.findByRole("button", { name: /edit profile/i }),
    ).toBeInTheDocument();
  });

  it("logs out and navigates to /login", async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(await screen.findByRole("button", { name: /sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("back button navigates to /dashboard", async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(await screen.findByRole("button", { name: /^back$/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
