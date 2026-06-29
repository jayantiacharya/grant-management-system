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
import Register from "./Register";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), "Jane");
  await user.type(screen.getByLabelText(/last name/i), "Doe");
  await user.type(screen.getByLabelText(/date of birth/i), "1990-05-20");
  await user.type(screen.getByLabelText(/email/i), "jane@weber.edu");
  await user.selectOptions(
    screen.getByLabelText(/college/i),
    "College of Science",
  );
  await user.selectOptions(
    screen.getByLabelText(/department/i),
    "Chemistry & Biochemistry",
  );
  await user.type(screen.getByLabelText("Password"), "secret1");
  await user.type(screen.getByLabelText(/confirm password/i), "secret1");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ login: mockLogin });
});

describe("Register", () => {
  it("renders all fields", () => {
    render(<Register />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/college/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
  });

  it("department select is disabled until a college is chosen", async () => {
    const user = userEvent.setup();
    render(<Register />);
    const dept = screen.getByLabelText(/department/i) as HTMLSelectElement;
    expect(dept).toBeDisabled();
    await user.selectOptions(
      screen.getByLabelText(/college/i),
      "College of Science",
    );
    expect(dept).not.toBeDisabled();
  });

  it("populates departments based on selected college", async () => {
    const user = userEvent.setup();
    render(<Register />);
    await user.selectOptions(
      screen.getByLabelText(/college/i),
      "College of Science",
    );
    expect(
      screen.getByRole("option", { name: "Chemistry & Biochemistry" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Nursing" }),
    ).not.toBeInTheDocument();
  });

  it("resets the chosen department when the college changes", async () => {
    const user = userEvent.setup();
    render(<Register />);
    const college = screen.getByLabelText(/college/i);
    const dept = screen.getByLabelText(/department/i) as HTMLSelectElement;

    await user.selectOptions(college, "College of Science");
    await user.selectOptions(dept, "Chemistry & Biochemistry");
    expect(dept.value).toBe("Chemistry & Biochemistry");

    await user.selectOptions(college, "College of Education");
    expect(dept.value).toBe("");
    expect(
      screen.queryByRole("option", { name: "Chemistry & Biochemistry" }),
    ).not.toBeInTheDocument();
  });

  it("blocks submit and shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<Register />);
    await fillValidForm(user);
    const confirm = screen.getByLabelText(/confirm password/i);
    await user.clear(confirm);
    await user.type(confirm, "different");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("blocks submit when password too short", async () => {
    const user = userEvent.setup();
    render(<Register />);
    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/date of birth/i), "1990-05-20");
    await user.type(screen.getByLabelText(/email/i), "jane@weber.edu");
    await user.selectOptions(
      screen.getByLabelText(/college/i),
      "College of Science",
    );
    await user.selectOptions(
      screen.getByLabelText(/department/i),
      "Chemistry & Biochemistry",
    );
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.type(screen.getByLabelText(/confirm password/i), "abc");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(
      await screen.findByText(/at least 6 characters/i),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("submits, logs in, and navigates to /dashboard on success", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        token: "tok",
        user: { id: "u1", email: "jane@weber.edu", role: "user" },
      },
    });
    const user = userEvent.setup();
    render(<Register />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/auth/register",
        expect.objectContaining({
          firstName: "Jane",
          email: "jane@weber.edu",
          college: "College of Science",
          department: "Chemistry & Biochemistry",
        }),
      );
    });
    expect(mockLogin).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("shows server error message on failed registration", async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { data: { message: "Email already in use" } },
    });
    const user = userEvent.setup();
    render(<Register />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });
});
