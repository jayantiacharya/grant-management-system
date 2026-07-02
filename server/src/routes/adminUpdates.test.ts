import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const { updateOne, findOne } = vi.hoisted(() => ({
  updateOne: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        updateOne,
        findOne,
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
  updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  findOne.mockResolvedValue(null);
});

describe("POST /api/admin/updateCollege", () => {
  const id = new ObjectId().toHexString();

  it("401 without Authorization", async () => {
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .send({ id, name: "Engineering", dean: "dean@wsu.edu" });
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ id, name: "Engineering", dean: "dean@wsu.edu" });
    expect(res.status).toBe(403);
  });

  it("400 when a field is missing", async () => {
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, name: "Engineering" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("400 when id is not a valid ObjectId", async () => {
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "not-an-id", name: "Engineering", dean: "dean@wsu.edu" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid id/i);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("201 updates name and dean by _id", async () => {
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, name: "Engineering", dean: "dean@wsu.edu" });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatch(/college updated/i);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id) },
      { $set: { name: "Engineering", dean: "dean@wsu.edu" } },
    );
  });

  it("500 when the db update throws", async () => {
    updateOne.mockRejectedValueOnce(new Error("db down"));
    const res = await request(app)
      .post("/api/admin/updateCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, name: "Engineering", dean: "dean@wsu.edu" });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to update college/i);
  });
});

describe("POST /api/admin/updateDepartment", () => {
  const id = new ObjectId().toHexString();

  it("401 without Authorization", async () => {
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .send({ id, name: "CS", college: "Engineering" });
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ id, name: "CS", college: "Engineering" });
    expect(res.status).toBe(403);
  });

  it("400 when a required field is missing", async () => {
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, college: "Engineering" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("400 when id is not a valid ObjectId", async () => {
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "garbage", name: "CS", college: "Engineering" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid id/i);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("201 updates name, college and chair by _id", async () => {
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, name: "CS", college: "Engineering", chair: "Dr. Smith" });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatch(/department updated/i);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id) },
      { $set: { name: "CS", college: "Engineering", chair: "Dr. Smith" } },
    );
  });

  it("500 when the db update throws", async () => {
    updateOne.mockRejectedValueOnce(new Error("db down"));
    const res = await request(app)
      .post("/api/admin/updateDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id, name: "CS", college: "Engineering", chair: "Dr. Smith" });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to update department/i);
  });
});

describe("GET /api/admin/arcc", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).get("/api/admin/arcc");
    expect(res.status).toBe(401);
  });

  it("200 for any authenticated user (Dashboard membership check)", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/api/admin/arcc")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
  });

  it("returns defaults when no committee doc exists", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/api/admin/arcc")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ chairId: null, memberIds: [] });
  });

  it("returns the stored committee", async () => {
    findOne.mockResolvedValueOnce({
      key: "committee",
      chairId: "u1",
      memberIds: ["u2", "u3"],
    });
    const res = await request(app)
      .get("/api/admin/arcc")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ chairId: "u1", memberIds: ["u2", "u3"] });
  });
});

describe("POST /api/admin/updateArcc", () => {
  it("401 without Authorization", async () => {
    const res = await request(app)
      .post("/api/admin/updateArcc")
      .send({ chairId: "u1", memberIds: ["u2"] });
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    const res = await request(app)
      .post("/api/admin/updateArcc")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ chairId: "u1", memberIds: ["u2"] });
    expect(res.status).toBe(403);
  });

  it("400 when memberIds is not an array", async () => {
    const res = await request(app)
      .post("/api/admin/updateArcc")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ chairId: "u1", memberIds: "u2" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/memberids must be an array/i);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("201 upserts the committee doc", async () => {
    const res = await request(app)
      .post("/api/admin/updateArcc")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ chairId: "u1", memberIds: ["u2", "u3"] });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatch(/arcc committee updated/i);
    expect(updateOne).toHaveBeenCalledWith(
      { key: "committee" },
      { $set: { chairId: "u1", memberIds: ["u2", "u3"] } },
      { upsert: true },
    );
  });

  it("stores chairId as null when omitted", async () => {
    const res = await request(app)
      .post("/api/admin/updateArcc")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ memberIds: [] });
    expect(res.status).toBe(201);
    expect(updateOne).toHaveBeenCalledWith(
      { key: "committee" },
      { $set: { chairId: null, memberIds: [] } },
      { upsert: true },
    );
  });
});
