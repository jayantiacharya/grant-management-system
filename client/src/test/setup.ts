import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not always expose a global localStorage; provide an in-memory one.
if (typeof globalThis.localStorage === "undefined") {
  let store: Record<string, string> = {};
  const memoryStorage: Storage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  globalThis.localStorage = memoryStorage;
}

afterEach(() => {
  cleanup();
});
