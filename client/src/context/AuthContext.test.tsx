import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

function Consumer() {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <span data-testid="token">{token ?? "none"}</span>
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

  it("useAuth throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /useAuth must be used within AuthProvider/,
    );
    spy.mockRestore();
  });
});
