import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { findOne, updateOne, findToArray } = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  findToArray: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        findOne,
        updateOne,
        find: () => ({ toArray: findToArray }),
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

const OID = "507f1f77bcf86cd799439011";

const validBody = {
  title: "AI for Good",
  description: "Build it",
  projectDirectorId: "u1",
  studentsImpacted: 42,
  accountNumber: "ACC-001",
  acknowledgement1: true,
  acknowledgement2: true,
  acknowledgement3: true,
  acknowledgement4: true,
  signature: "Jane Director",
};

beforeEach(() => {
  vi.clearAllMocks();
  // The edit route loads the grant first (ownership + lock check), then the
  // director user; a draft owned by the token email satisfies both lookups.
  findOne.mockResolvedValue({
    _id: "mongo-id",
    submittedEmail: "alice@wsu.edu",
    status: "draft",
  });
  updateOne.mockResolvedValue({ matchedCount: 1 });
  findToArray.mockResolvedValue([]);
});

describe("GET /api/grants/user-grants/:email", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app).get("/api/grants/user-grants/alice@wsu.edu");
    expect(res.status).toBe(401);
  });

  it("403 when requesting another user's grants", async () => {
    const res = await request(app)
      .get("/api/grants/user-grants/bob@wsu.edu")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(403);
  });

  it("200 returns grants for the caller's own email", async () => {
    findToArray.mockResolvedValueOnce([{ _id: "g1", title: "Grant" }]);
    const res = await request(app)
      .get("/api/grants/user-grants/alice@wsu.edu")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ _id: "g1", title: "Grant" }]);
  });

  it("500 when db read throws", async () => {
    findToArray.mockRejectedValueOnce(new Error("mongo down"));
    const res = await request(app)
      .get("/api/grants/user-grants/alice@wsu.edu")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/grants/get-grant/:id", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app).get(`/api/grants/get-grant/${OID}`);
    expect(res.status).toBe(401);
  });

  it("404 when grant not found", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .get(`/api/grants/get-grant/${OID}`)
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(404);
  });

  it("200 returns the caller's own grant", async () => {
    findOne.mockResolvedValueOnce({
      _id: OID,
      title: "Grant",
      submittedEmail: "alice@wsu.edu",
    });
    const res = await request(app)
      .get(`/api/grants/get-grant/${OID}`)
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Grant");
  });

  it("403 when the grant belongs to someone else", async () => {
    findOne.mockResolvedValueOnce({
      _id: OID,
      title: "Grant",
      submittedEmail: "bob@wsu.edu",
    });
    const res = await request(app)
      .get(`/api/grants/get-grant/${OID}`)
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(403);
  });

  it("400 on a malformed grant id instead of crashing", async () => {
    const res = await request(app)
      .get("/api/grants/get-grant/not-a-real-id")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid grant id/i);
    expect(findOne).not.toHaveBeenCalled();
  });
});

describe("PUT /api/grants/edit/:id", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("400 on a malformed grant id instead of crashing", async () => {
    const res = await request(app)
      .put("/api/grants/edit/not-a-real-id")
      .set("Authorization", `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid grant id/i);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("400 when title missing", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, title: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/);
  });

  it("400 when studentsImpacted is negative", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, studentsImpacted: -3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/non-negative integer/);
  });

  it("400 when affectsMultipleDepartments yes but departmentCount < 2", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        ...validBody,
        affectsMultipleDepartments: "yes",
        departmentCount: 1,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/departmentCount/);
  });

  it("400 when usesSubjects yes but irbApproved not yes", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, usesSubjects: "yes", irbApproved: "no" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/irbApproved/);
  });

  it("400 when projectDirectorId does not match a known user", async () => {
    // First findOne returns the grant; the second (user lookup) misses.
    findOne
      .mockResolvedValueOnce({
        _id: "mongo-id",
        submittedEmail: "alice@wsu.edu",
        status: "draft",
      })
      .mockResolvedValueOnce(null);
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, projectDirectorId: "bogus" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/known user/);
  });

  it("201 updates the grant by id", async () => {
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "AI for Good",
      projectDirectorId: "u1",
      studentsImpacted: 42,
    });
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter._id.toString()).toBe(OID);
    expect(update.$set.title).toBe("AI for Good");
  });

  it("defaults projectDirectorId to token userId when omitted", async () => {
    const { projectDirectorId: _omit, ...body } = validBody;
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.projectDirectorId).toBe("u1");
  });

  it("500 when db update throws", async () => {
    updateOne.mockRejectedValueOnce(new Error("mongo down"));
    const res = await request(app)
      .put(`/api/grants/edit/${OID}`)
      .set("Authorization", `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(500);
  });
});
