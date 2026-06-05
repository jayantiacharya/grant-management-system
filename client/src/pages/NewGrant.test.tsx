import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GrantProvider } from "../context/GrantContext";

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

const renderNewGrant = () => {
  return render(
    <GrantProvider>
      <NewGrant />
    </GrantProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();

  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: fakeUser,
    token: "tok123",
    logout: mockLogout,
  });
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("NewGrant", () => {
  it("renders all form fields", async () => {
    renderNewGrant();
    expect(screen.getByLabelText(/grant title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/project director/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/students impacted/i)).toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
  });

  it("fetches user-options with bearer token on mount", async () => {
    renderNewGrant();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/admin/user-options",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
  });

  it("pre-selects current user as project director", async () => {
    renderNewGrant();
    const select = screen.getByLabelText(
      /project director/i,
    ) as HTMLSelectElement;
    expect(select.value).toBe("u1");
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
  });

  it("shows field errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    screen.getByLabelText(/grant title/i).removeAttribute("required");
    screen.getByLabelText(/description/i).removeAttribute("required");
    screen.getByLabelText(/students impacted/i).removeAttribute("required");
    screen
      .getByLabelText(/affect more than one department/i)
      .removeAttribute("required");
    screen
      .getByLabelText(/human or animal subjects/i)
      .removeAttribute("required");

    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    expect(screen.getByText(/non-negative integer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/please select an option/i).length).toBe(2);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("submits typed payload and shows success", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    await user.type(screen.getByLabelText(/grant title/i), "AI for Good");
    await user.type(screen.getByLabelText(/description/i), "Build it");
    await user.type(screen.getByLabelText(/students impacted/i), "42");
    await user.selectOptions(
      screen.getByLabelText(/affect more than one department/i),
      "no",
    );
    await user.selectOptions(
      screen.getByLabelText(/human or animal subjects/i),
      "no",
    );
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/grants/submit",
        expect.objectContaining({
          title: "AI for Good",
          description: "Build it",
          projectDirectorId: "u1",
          studentsImpacted: 42,
          affectsMultipleDepartments: "no",
          usesSubjects: "no",
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

  it("surfaces server error message on submit failure", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: "Bad request from server" } },
    });
    const user = userEvent.setup();
    renderNewGrant();

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(screen.getByLabelText(/students impacted/i), "1");
    await user.selectOptions(
      screen.getByLabelText(/affect more than one department/i),
      "no",
    );
    await user.selectOptions(
      screen.getByLabelText(/human or animal subjects/i),
      "no",
    );
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
    renderNewGrant();
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("clears field error as user types", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    const titleInput = screen.getByLabelText(
      /grant title/i,
    ) as HTMLInputElement;
    titleInput.removeAttribute("required");
    screen.getByLabelText(/description/i).removeAttribute("required");
    screen.getByLabelText(/students impacted/i).removeAttribute("required");
    screen
      .getByLabelText(/affect more than one department/i)
      .removeAttribute("required");
    screen
      .getByLabelText(/human or animal subjects/i)
      .removeAttribute("required");

    await user.click(screen.getByRole("button", { name: /submit proposal/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();

    await user.type(titleInput, "x");
    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
  });

  it("rejects negative studentsImpacted client-side", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    const num = screen.getByLabelText(/students impacted/i) as HTMLInputElement;
    num.removeAttribute("min");
    num.removeAttribute("required");

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(num, "-5");
    await user.selectOptions(
      screen.getByLabelText(/affect more than one department/i),
      "no",
    );
    await user.selectOptions(
      screen.getByLabelText(/human or animal subjects/i),
      "no",
    );
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(
      await screen.findByText(/non-negative integer/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("requires departmentCount >= 2 when affecting multiple departments", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(screen.getByLabelText(/students impacted/i), "1");
    await user.selectOptions(
      screen.getByLabelText(/affect more than one department/i),
      "yes",
    );
    const dept = screen.getByLabelText(
      /how many departments/i,
    ) as HTMLInputElement;
    dept.removeAttribute("min");
    dept.removeAttribute("required");
    await user.type(dept, "1");
    await user.selectOptions(
      screen.getByLabelText(/human or animal subjects/i),
      "no",
    );
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(
      await screen.findByText(/number of departments \(2 or more\)/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("requires IRB approval when human or animal subjects are used", async () => {
    const user = userEvent.setup();
    renderNewGrant();

    await user.type(screen.getByLabelText(/grant title/i), "x");
    await user.type(screen.getByLabelText(/description/i), "y");
    await user.type(screen.getByLabelText(/students impacted/i), "1");
    await user.selectOptions(
      screen.getByLabelText(/affect more than one department/i),
      "no",
    );
    await user.selectOptions(
      screen.getByLabelText(/human or animal subjects/i),
      "yes",
    );
    screen.getByLabelText(/upload files/i).removeAttribute("required");
    await user.selectOptions(screen.getByLabelText(/irb approval/i), "no");
    await user.click(screen.getByRole("button", { name: /submit proposal/i }));

    expect(
      await screen.findByText(/irb approval is required/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
