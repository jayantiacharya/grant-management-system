import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { findOne, insertOne, updateOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        findOne,
        insertOne,
        updateOne,
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
  accountNumber: "ACC-001",
  acknowledgement1: true,
  acknowledgement2: true,
  acknowledgement3: true,
  acknowledgement4: true,
  signature: "Jane Director",
  educationalImpact: "Gives students hands-on AI experience.",
  evaluationPlan: "Pre/post surveys and completion rates.",
};

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue({ _id: "mongo-id" });
  insertOne.mockResolvedValue({ insertedId: "grant-id" });
  updateOne.mockResolvedValue({ matchedCount: 1 });
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

  it("defaults an omitted status to submitted (full validation applies)", async () => {
    // Backward-compat: a request with no status is treated as a submission, so
    // the full validation runs. A valid body persists as submitted...
    const ok = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send(validBody);
    expect(ok.status).toBe(201);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted" }),
    );

    // ...and an incomplete body is rejected rather than silently saved.
    const bad = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, title: "" });
    expect(bad.status).toBe(400);
  });

  it("persists the timeline", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, timeline: "Aug then Sept" });
    expect(res.status).toBe(201);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ timeline: "Aug then Sept" }),
    );
  });
});

describe("PUT /api/grants/edit/:id", () => {
  it("403 when the grant is already submitted", async () => {
    findOne.mockResolvedValueOnce({
      _id: "g1",
      status: "submitted",
      submittedEmail: "alice@wsu.edu",
    });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "draft" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/no longer be edited/);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("403 when the grant belongs to another user", async () => {
    findOne.mockResolvedValueOnce({
      _id: "g1",
      status: "draft",
      submittedEmail: "someone-else@wsu.edu",
    });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "draft" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permission/);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("404 when the grant does not exist", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "draft" });
    expect(res.status).toBe(404);
  });

  it("updates a draft and can transition it to submitted", async () => {
    findOne
      .mockResolvedValueOnce({
        _id: "g1",
        status: "draft",
        submittedEmail: "alice@wsu.edu",
      })
      .mockResolvedValueOnce({ _id: "mongo-id" });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "submitted" });
    expect(res.status).toBe(201);
    expect(updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ status: "submitted" }),
      }),
    );
  });

  it("400 when submitting via edit without all acknowledgements", async () => {
    findOne.mockResolvedValueOnce({
      _id: "g1",
      status: "draft",
      submittedEmail: "alice@wsu.edu",
    });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, acknowledgement3: false, status: "submitted" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/acknowledgements/);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("persists acknowledgements and signature when submitting via edit", async () => {
    findOne
      .mockResolvedValueOnce({
        _id: "g1",
        status: "draft",
        submittedEmail: "alice@wsu.edu",
      })
      .mockResolvedValueOnce({ _id: "mongo-id" });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, status: "submitted" });
    expect(res.status).toBe(201);
    const setArg = updateOne.mock.calls[0][1].$set;
    expect(setArg.acknowledgements).toEqual({
      acknowledgement1: true,
      acknowledgement2: true,
      acknowledgement3: true,
      acknowledgement4: true,
    });
    expect(setArg.signature).toBe("Jane Director");
    expect(setArg.signedAt).toBeInstanceOf(Date);
  });

  it("does not require acknowledgements when saving an edit as draft", async () => {
    findOne
      .mockResolvedValueOnce({
        _id: "g1",
        status: "draft",
        submittedEmail: "alice@wsu.edu",
      })
      .mockResolvedValueOnce({ _id: "mongo-id" });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, acknowledgement1: false, status: "draft" });
    expect(res.status).toBe(201);
    expect(updateOne.mock.calls[0][1].$set.signedAt).toBeNull();
  });

  it("400 when submitting via edit with subjects but no IRB file on the grant", async () => {
    findOne.mockResolvedValueOnce({
      _id: "g1",
      status: "draft",
      submittedEmail: "alice@wsu.edu",
      files: [],
      irbApprovalFile: null,
    });
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        ...validBody,
        status: "submitted",
        usesSubjects: "yes",
        irbApproved: "yes",
      });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("persists the timeline on edit", async () => {
    findOne.mockResolvedValueOnce({
      _id: "mongo-id",
      submittedEmail: "alice@wsu.edu",
      status: "draft",
      files: [],
      irbApprovalFile: null,
    });
    findOne.mockResolvedValueOnce({ _id: "u1" }); // director lookup
    const res = await request(app)
      .put("/api/grants/edit/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...validBody, timeline: "Edited timeline" });
    expect(res.status).toBe(201);
    expect(updateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({ timeline: "Edited timeline" }),
    });
  });
});
