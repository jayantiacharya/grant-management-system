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
  useParams: () => ({ grantId: "g1" }),
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
    default: { get: vi.fn(), put: vi.fn(), isAxiosError, isCancel },
    isAxiosError,
    isCancel,
  };
});

import axios from "axios";
import EditGrant from "./EditGrant";

const fakeUser = { id: "u1", email: "alice@wsu.edu", role: "user" };

const existingGrant = {
  title: "Original Title",
  description: "Original description",
  projectDirectorId: "u1",
  studentsImpacted: 10,
  affectsMultipleDepartments: "no",
  departmentCount: "",
  usesSubjects: "no",
  irbApproved: "",
};

function mockGet() {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url.includes("/user-options")) {
      return Promise.resolve({ data: [{ id: "u1", email: "alice@wsu.edu" }] });
    }
    if (url.includes("/get-grant/")) {
      return Promise.resolve({ data: existingGrant });
    }
    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: fakeUser,
    token: "tok123",
    logout: mockLogout,
  });
  mockGet();
  vi.mocked(axios.put).mockResolvedValue({ data: {} });
});

describe("EditGrant", () => {
  it("fetches the grant and user-options with bearer token on mount", async () => {
    render(<EditGrant />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/get-grant/g1",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/user-options",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
  });

  it("pre-fills the form with the fetched grant data", async () => {
    render(<EditGrant />);
    await waitFor(() => {
      expect(
        (screen.getByLabelText(/grant title/i) as HTMLInputElement).value,
      ).toBe("Original Title");
    });
    expect(
      (screen.getByLabelText(/description/i) as HTMLTextAreaElement).value,
    ).toBe("Original description");
    expect(
      (screen.getByLabelText(/students impacted/i) as HTMLInputElement).value,
    ).toBe("10");
  });

  it("preserves a studentsImpacted value of 0 when prefilling", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes("/user-options")) {
        return Promise.resolve({
          data: [{ id: "u1", email: "alice@wsu.edu" }],
        });
      }
      if (url.includes("/get-grant/")) {
        return Promise.resolve({
          data: { ...existingGrant, studentsImpacted: 0 },
        });
      }
      return Promise.resolve({ data: [] });
    });
    render(<EditGrant />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/students impacted/i) as HTMLInputElement).value,
      ).toBe("0"),
    );
  });

  it("submits an edited JSON payload via PUT", async () => {
    const user = userEvent.setup();
    render(<EditGrant />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/grant title/i) as HTMLInputElement).value,
      ).toBe("Original Title"),
    );

    const title = screen.getByLabelText(/grant title/i);
    await user.clear(title);
    await user.type(title, "Updated Title");
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/edit/g1",
        expect.objectContaining({
          title: "Updated Title",
          description: "Original description",
          projectDirectorId: "u1",
          studentsImpacted: 10,
        }),
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
    expect(
      await screen.findByText(/submitted successfully/i),
    ).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when required fields are cleared", async () => {
    const user = userEvent.setup();
    render(<EditGrant />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/grant title/i) as HTMLInputElement).value,
      ).toBe("Original Title"),
    );

    const title = screen.getByLabelText(/grant title/i);
    title.removeAttribute("required");
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("surfaces a server error message on submit failure", async () => {
    vi.mocked(axios.put).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: "Edit rejected" } },
    });
    const user = userEvent.setup();
    render(<EditGrant />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/grant title/i) as HTMLInputElement).value,
      ).toBe("Original Title"),
    );
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(await screen.findByText("Edit rejected")).toBeInTheDocument();
  });

  it("shows a load error when fetching the grant fails", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes("/get-grant/")) {
        return Promise.reject(new Error("not found"));
      }
      return Promise.resolve({ data: [] });
    });
    render(<EditGrant />);
    expect(
      await screen.findByText(/failed to load grant data/i),
    ).toBeInTheDocument();
  });
});
