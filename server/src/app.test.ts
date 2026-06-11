import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("./middleware/conn.js", () => ({
  default: { getDb: () => ({ collection: () => ({}) }) },
}));

import { createApp } from "./app.js";

const app = createApp();

describe("createApp", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("parses JSON request bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "", password: "" });
    expect(res.status).toBe(400);
  });

  it("404 for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});
