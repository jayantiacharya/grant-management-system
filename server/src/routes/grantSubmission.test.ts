import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { findOne, insertOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        findOne,
        insertOne,
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

const validBody = {
  title: "AI for Good",
  description: "Build it",
  projectDirectorId: "u1",
  studentsImpacted: 42,
};

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue({ _id: "mongo-id" });
  insertOne.mockResolvedValue({ insertedId: "grant-id" });
});

describe("POST /api/grants/submit", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app).post("/api/grants/submit").send(validBody);
    expect(res.status).toBe(401);
  });

  it("401 with malformed token", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", "Bearer not-a-real-jwt")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("400 when title missing", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, title: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/);
  });

  it("400 when description missing", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, description: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/description/);
  });

  it.each([
    ["negative", -5],
    ["float", 1.5],
    ["string non-numeric", "abc"],
  ])("400 when studentsImpacted is %s", async (_label, value) => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, studentsImpacted: value });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/non-negative integer/);
  });

  it("400 when projectDirectorId does not match a real user", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, projectDirectorId: "bogus-id" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/known user/);
  });

  it("201 on success and derives submittedEmail from token (not body)", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, submittedEmail: "spoof@evil.com" });
    expect(res.status).toBe(201);
    expect(res.body.submittedEmail).toBe("alice@wsu.edu");
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedEmail: "alice@wsu.edu",
        projectDirectorId: "u1",
        studentsImpacted: 42,
      }),
    );
  });

  it("defaults projectDirectorId to req.user.userId when omitted", async () => {
    const { projectDirectorId: _omit, ...bodyWithoutDirector } = validBody;
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send(bodyWithoutDirector);
    expect(res.status).toBe(201);
    expect(res.body.projectDirectorId).toBe("u1");
  });

  it("500 when DB insert throws", async () => {
    insertOne.mockRejectedValueOnce(new Error("mongo down"));
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(500);
  });

  it("201 draft skips required-field validation", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ status: "draft", title: "" });
    expect(res.status).toBe(201);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", submittedAt: null }),
    );
  });

  it("submitted create still enforces validation and stamps submittedAt", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "submitted" });
    expect(res.status).toBe(201);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted" }),
    );
    expect(insertOne.mock.calls[0][0].submittedAt).toBeInstanceOf(Date);
  });

  it("400 when submitted create is missing title", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "submitted", title: "" });
    expect(res.status).toBe(400);
  });
});
