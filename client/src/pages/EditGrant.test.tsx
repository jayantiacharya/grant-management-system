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

const draftGrant = {
  title: "Draft One",
  description: "wip",
  projectDirectorId: "u1",
  studentsImpacted: 3,
  affectsMultipleDepartments: "no",
  usesSubjects: "no",
  status: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mockUseAuth.mockReturnValue({
    user: { id: "u1", email: "alice@wsu.edu", role: "user" },
    token: "tok123",
    logout: mockLogout,
  });
  vi.mocked(axios.get).mockImplementation((url: string) =>
    url.includes("get-grant")
      ? Promise.resolve({ data: draftGrant })
      : Promise.resolve({ data: [] }),
  );
  vi.mocked(axios.put).mockResolvedValue({ data: {} });
});

describe("EditGrant", () => {
  it("Save sends a draft via PUT", async () => {
    const user = userEvent.setup();
    render(<EditGrant />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/grant title/i) as HTMLInputElement).value,
      ).toBe("Draft One"),
    );

    await user.click(
      screen.getByRole("button", { name: /save grant proposal/i }),
    );

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/edit/g1",
        expect.objectContaining({ status: "draft" }),
        expect.anything(),
      );
    });
  });

  it("blocks editing a submitted grant", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) =>
      url.includes("get-grant")
        ? Promise.resolve({ data: { ...draftGrant, status: "submitted" } })
        : Promise.resolve({ data: [] }),
    );
    render(<EditGrant />);

    expect(await screen.findByText(/has been submitted/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save grant proposal/i }),
    ).not.toBeInTheDocument();
  });
});
