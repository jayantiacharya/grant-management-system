import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const { findToArray, findOne, insertOne, updateOne, deleteOne } = vi.hoisted(
  () => ({
    findToArray: vi.fn(),
    findOne: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  }),
);

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        find: () => ({ toArray: findToArray }),
        findOne,
        insertOne,
        updateOne,
        deleteOne,
      }),
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const adminToken = jwt.sign(
  { userId: "a1", email: "admin@wsu.edu", role: "admin" },
  process.env.JWT_SECRET!,
);
const userToken = jwt.sign(
  { userId: "u1", email: "alice@wsu.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const OID = "507f1f77bcf86cd799439011";

const validCriteria = {
  name: "Educational Impact",
  description: "How does it help students?",
  maxScore: 35,
  ratingSuggestions: [
    { score: 35, description: "Large impact" },
    { score: 0, description: "Criteria not met" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  findToArray.mockResolvedValue([]);
  insertOne.mockResolvedValue({ insertedId: new ObjectId(OID) });
  updateOne.mockResolvedValue({ matchedCount: 1 });
  deleteOne.mockResolvedValue({ deletedCount: 1 });
});

describe("GET /api/criteria", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/criteria");
    expect(res.status).toBe(401);
  });

  it("200 returns criteria for any authenticated user", async () => {
    findToArray.mockResolvedValueOnce([{ _id: OID, name: "Impact" }]);
    const res = await request(app)
      .get("/api/criteria")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ _id: OID, name: "Impact" }]);
  });
});

describe("POST /api/criteria", () => {
  it("403 for a non-admin", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${userToken}`)
      .send(validCriteria);
    expect(res.status).toBe(403);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Impact" });
    expect(res.status).toBe(400);
  });

  it("400 when maxScore is not positive", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCriteria, maxScore: 0 });
    expect(res.status).toBe(400);
  });

  it("400 when a rating suggestion exceeds maxScore", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...validCriteria,
        ratingSuggestions: [{ score: 99, description: "too high" }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed max score/i);
  });

  it("400 when a rating suggestion score is negative", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...validCriteria,
        ratingSuggestions: [{ score: -1, description: "negative" }],
      });
    expect(res.status).toBe(400);
  });

  it("201 creates the criteria and returns the Mongo _id", async () => {
    const res = await request(app)
      .post("/api/criteria")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCriteria);
    expect(res.status).toBe(201);
    expect(res.body._id).toBe(OID);
    expect(res.body.name).toBe("Educational Impact");
    const [doc] = insertOne.mock.calls[0];
    expect(doc.maxScore).toBe(35);
    expect(doc.id).toBeUndefined();
  });
});

describe("PUT /api/criteria/:id", () => {
  it("403 for a non-admin", async () => {
    const res = await request(app)
      .put(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send(validCriteria);
    expect(res.status).toBe(403);
  });

  it("400 on a malformed id", async () => {
    const res = await request(app)
      .put("/api/criteria/not-an-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCriteria);
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("404 when no criteria matches", async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    const res = await request(app)
      .put(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCriteria);
    expect(res.status).toBe(404);
  });

  it("200 updates by Mongo _id", async () => {
    const res = await request(app)
      .put(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCriteria, name: "Renamed" });
    expect(res.status).toBe(200);
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter._id.toString()).toBe(OID);
    expect(update.$set.name).toBe("Renamed");
  });
});

describe("DELETE /api/criteria/:id", () => {
  it("403 for a non-admin", async () => {
    const res = await request(app)
      .delete(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("400 on a malformed id", async () => {
    const res = await request(app)
      .delete("/api/criteria/not-an-id")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("404 when nothing was deleted", async () => {
    deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const res = await request(app)
      .delete(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("200 deletes by Mongo _id", async () => {
    const res = await request(app)
      .delete(`/api/criteria/${OID}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const [filter] = deleteOne.mock.calls[0];
    expect(filter._id.toString()).toBe(OID);
  });
});
