import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

import axios from "axios";
import { AuthProvider, useAuth } from "./AuthContext";

function Consumer() {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <span data-testid="flags">
        {String(user?.isArcc)}/{String(user?.isDeptChair)}
      </span>
      <button
        onClick={() => login({ id: "u1", email: "a@b.c", role: "user" }, "tok")}
      >
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: {} });
});

describe("AuthContext", () => {
  it("starts with no user/token when localStorage empty", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("token").textContent).toBe("none");
  });

  it("hydrates user and token from localStorage on init", () => {
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u1", email: "saved@b.c", role: "user" }),
    );
    localStorage.setItem("token", "saved-tok");
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user").textContent).toBe("saved@b.c");
    expect(screen.getByTestId("token").textContent).toBe("saved-tok");
  });

  it("login sets state and persists to localStorage", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    act(() => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("user").textContent).toBe("a@b.c");
    expect(screen.getByTestId("token").textContent).toBe("tok");
    expect(localStorage.getItem("token")).toBe("tok");
    expect(JSON.parse(localStorage.getItem("user")!).email).toBe("a@b.c");
  });

  it("logout clears state and localStorage", () => {
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u1", email: "saved@b.c", role: "user" }),
    );
    localStorage.setItem("token", "saved-tok");
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    act(() => {
      screen.getByText("logout").click();
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("token").textContent).toBe("none");
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("starts logged out and clears storage when saved user JSON is corrupt", () => {
    localStorage.setItem("user", "{not valid json");
    localStorage.setItem("token", "saved-tok");
    expect(() =>
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      ),
    ).not.toThrow();
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("token").textContent).toBe("none");
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("resolves isArcc and isDeptChair once a user and token exist", async () => {
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u1", email: "saved@b.c", role: "user" }),
    );
    localStorage.setItem("token", "saved-tok");
    vi.mocked(axios.get).mockImplementation((url: string) =>
      url.includes("checkDeptChair")
        ? Promise.resolve({ data: { isChair: true } })
        : Promise.resolve({ data: { memberIds: ["u1", "u2"] } }),
    );
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("flags").textContent).toBe("true/true"),
    );
    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:5000/api/admin/arcc",
      expect.objectContaining({
        headers: { Authorization: "Bearer saved-tok" },
      }),
    );
    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:5000/api/admin/checkDeptChair/",
      expect.objectContaining({
        headers: { Authorization: "Bearer saved-tok" },
      }),
    );
    const saved = JSON.parse(localStorage.getItem("user")!);
    expect(saved.isArcc).toBe(true);
    expect(saved.isDeptChair).toBe(true);
  });

  it("marks flags false when the user is neither ARCC nor chair", async () => {
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u9", email: "plain@b.c", role: "user" }),
    );
    localStorage.setItem("token", "saved-tok");
    vi.mocked(axios.get).mockImplementation((url: string) =>
      url.includes("checkDeptChair")
        ? Promise.resolve({ data: { isChair: false } })
        : Promise.resolve({ data: { memberIds: ["u1"] } }),
    );
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("flags").textContent).toBe("false/false"),
    );
  });

  it("does not re-fetch when both flags are already stored", async () => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        email: "saved@b.c",
        role: "user",
        isArcc: false,
        isArccChair: false,
        isDeptChair: false,
      }),
    );
    localStorage.setItem("token", "saved-tok");
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("keeps the user logged in when role lookups fail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u1", email: "saved@b.c", role: "user" }),
    );
    localStorage.setItem("token", "saved-tok");
    vi.mocked(axios.get).mockRejectedValue(new Error("network down"));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("user").textContent).toBe("saved@b.c");
    expect(screen.getByTestId("flags").textContent).toBe("undefined/undefined");
    spy.mockRestore();
  });

  it("useAuth throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /useAuth must be used within AuthProvider/,
    );
    spy.mockRestore();
  });
});
