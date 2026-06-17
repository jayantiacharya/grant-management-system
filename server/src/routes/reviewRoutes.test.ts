import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { findOne, updateOne, findToArray, findMock } = vi.hoisted(() => {
  const findToArray = vi.fn();
  return {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    findToArray,
    findMock: vi.fn(() => ({
      sort: () => ({ toArray: findToArray }),
      toArray: findToArray,
    })),
  };
});

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        findOne,
        updateOne,
        find: findMock,
      }),
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const memberToken = jwt.sign(
  { userId: "arcc1", email: "reviewer@wsu.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const OID = "507f1f77bcf86cd799439011";

// First findOne call in every review route is the ARCC committee lookup.
const committee = { key: "committee", memberIds: ["arcc1"] };

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue(committee);
  updateOne.mockResolvedValue({ matchedCount: 1 });
  findToArray.mockResolvedValue([]);
});

describe("GET /api/grants/review", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/grants/review");
    expect(res.status).toBe(401);
  });

  it("403 when the caller is not an ARCC member", async () => {
    findOne.mockResolvedValueOnce({ key: "committee", memberIds: ["other"] });
    const res = await request(app)
      .get("/api/grants/review")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("200 returns grants and excludes drafts from the query", async () => {
    findToArray.mockResolvedValueOnce([{ _id: OID, title: "Submitted one" }]);
    const res = await request(app)
      .get("/api/grants/review")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ _id: OID, title: "Submitted one" }]);
    const [filter] = findMock.mock.calls[0];
    expect(filter).toEqual({ status: { $ne: "draft" } });
  });
});

describe("GET /api/grants/review/:id", () => {
  it("400 on a malformed grant id", async () => {
    const res = await request(app)
      .get("/api/grants/review/not-an-id")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(400);
  });

  it("403 when the caller is not an ARCC member", async () => {
    findOne.mockResolvedValueOnce({ key: "committee", memberIds: [] });
    const res = await request(app)
      .get(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("404 when the grant is missing", async () => {
    findOne
      .mockResolvedValueOnce(committee) // ARCC membership lookup
      .mockResolvedValueOnce(null); // grant lookup
    const res = await request(app)
      .get(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(404);
  });

  it("200 returns the grant for a member", async () => {
    findOne
      .mockResolvedValueOnce(committee)
      .mockResolvedValueOnce({ _id: OID, title: "Grant", status: "submitted" });
    const res = await request(app)
      .get(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Grant");
  });
});

describe("PUT /api/grants/review/:id", () => {
  it("400 when reviewStatus is not approved or denied", async () => {
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ reviewStatus: "pending" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("403 when the caller is not an ARCC member", async () => {
    findOne.mockResolvedValueOnce({ key: "committee", memberIds: [] });
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ reviewStatus: "approved" });
    expect(res.status).toBe(403);
  });

  it("404 when the grant is missing", async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ reviewStatus: "denied" });
    expect(res.status).toBe(404);
  });

  it("200 stores the new review status", async () => {
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ reviewStatus: "approved" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reviewStatus: "approved" });
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter._id.toString()).toBe(OID);
    expect(update.$set.reviewStatus).toBe("approved");
  });
});
