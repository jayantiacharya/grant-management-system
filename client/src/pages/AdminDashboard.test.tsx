import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
import AdminDashboard from "./AdminDashboard";

const adminUser = { id: "a1", email: "admin@wsu.edu", role: "admin" };

// Scope queries to a specific form by its submit button, so the two forms'
// controls can't be confused by position (e.g. if a new dropdown is added).
function formFor(buttonName: RegExp) {
  const form = screen.getByRole("button", { name: buttonName }).closest("form");
  if (!form) throw new Error(`No form found for ${buttonName}`);
  return within(form as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: adminUser, logout: mockLogout });
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

describe("AdminDashboard", () => {
  it("fetches users, colleges, and departments on mount", async () => {
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/users",
      );
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/colleges",
      );
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/departments",
      );
    });
  });

  it("populates the dean dropdown from fetched users", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.endsWith("/users")) {
        return Promise.resolve({
          data: [{ id: "u1", email: "dean@wsu.edu" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    render(<AdminDashboard />);
    expect(
      await screen.findByRole("option", { name: "dean@wsu.edu" }),
    ).toBeInTheDocument();
  });

  it("creates a college and shows a success message", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.endsWith("/users")) {
        return Promise.resolve({
          data: [{ id: "u1", email: "dean@wsu.edu" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    render(<AdminDashboard />);

    await user.type(
      await screen.findByPlaceholderText(/enter college name/i),
      "College of Science",
    );
    await user.selectOptions(
      formFor(/create college/i).getByRole("combobox"),
      "dean@wsu.edu",
    );
    await user.click(screen.getByRole("button", { name: /create college/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/createCollege",
        { name: "College of Science", dean: "dean@wsu.edu" },
      );
    });
    expect(
      await screen.findByText(/college created successfully/i),
    ).toBeInTheDocument();
  });

  it("shows a failure message when college creation throws", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.endsWith("/users")) {
        return Promise.resolve({
          data: [{ id: "u1", email: "dean@wsu.edu" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    vi.mocked(axios.post).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<AdminDashboard />);

    await user.type(
      await screen.findByPlaceholderText(/enter college name/i),
      "College of Science",
    );
    await user.selectOptions(
      formFor(/create college/i).getByRole("combobox"),
      "dean@wsu.edu",
    );
    await user.click(screen.getByRole("button", { name: /create college/i }));

    expect(
      await screen.findByText(/failed to create college/i),
    ).toBeInTheDocument();
  });

  it("creates a department and shows a success message", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.endsWith("/colleges")) {
        return Promise.resolve({
          data: [{ id: "c1", name: "College of Science" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    const user = userEvent.setup();
    render(<AdminDashboard />);

    await user.type(
      await screen.findByPlaceholderText(/enter department name/i),
      "Chemistry",
    );
    await user.selectOptions(
      formFor(/create department/i).getByRole("combobox"),
      "College of Science",
    );
    await user.click(
      screen.getByRole("button", { name: /create department/i }),
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/createDepartment",
        { name: "Chemistry", college: "College of Science" },
      );
    });
    expect(
      await screen.findByText(/department created successfully/i),
    ).toBeInTheDocument();
  });

  it("logs out and navigates to /login", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
