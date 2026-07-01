import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { findToArray, lastFindOptions } = vi.hoisted(() => ({
  findToArray: vi.fn(),
  lastFindOptions: { value: null as unknown },
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        find: (_filter: unknown, options: unknown) => {
          lastFindOptions.value = options;
          return { toArray: findToArray };
        },
      }),
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const validToken = jwt.sign(
  { userId: "u1", email: "alice@wsu.edu", role: "user" },
  process.env.JWT_SECRET!,
);
const adminToken = jwt.sign(
  { userId: "u2", email: "admin@wsu.edu", role: "admin" },
  process.env.JWT_SECRET!,
);

beforeEach(() => {
  vi.clearAllMocks();
  lastFindOptions.value = null;
});

describe("GET /api/admin/users", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    findToArray.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(403);
  });

  it("uses projection that excludes password", async () => {
    findToArray.mockResolvedValue([{ id: "u1", email: "alice@wsu.edu" }]);
    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(lastFindOptions.value).toEqual({ projection: { password: 0 } });
  });

  it("returns the rows from the db", async () => {
    findToArray.mockResolvedValue([
      { id: "u1", email: "alice@wsu.edu", role: "user" },
    ]);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "u1", email: "alice@wsu.edu", role: "user" },
    ]);
    expect(res.body[0]).not.toHaveProperty("password");
  });
});

describe("GET /api/admin/user-options", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).get("/api/admin/user-options");
    expect(res.status).toBe(401);
  });

  it("401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("uses projection that returns only id and email", async () => {
    findToArray.mockResolvedValue([]);
    await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", `Bearer ${validToken}`);
    expect(lastFindOptions.value).toEqual({
      projection: { _id: 0, id: 1, email: 1 },
    });
  });

  it("200 returns rows with auth", async () => {
    findToArray.mockResolvedValue([{ id: "u1", email: "alice@wsu.edu" }]);
    const res = await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "u1", email: "alice@wsu.edu" }]);
  });
});
