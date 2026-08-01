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

  findOne.mockImplementation((query: any) => {
    if (query?.key === "committee") {
      return Promise.resolve(committee);
    }

    if (query?.chair) {
      return Promise.resolve(null);
    }

    return Promise.resolve(null);
  });

  updateOne.mockResolvedValue({ matchedCount: 1 });
  findToArray.mockResolvedValue([]);
});

describe("GET /api/grants/review", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/grants/review");
    expect(res.status).toBe(401);
  });

  it("403 when the caller is not an ARCC member", async () => {
    findOne
      .mockResolvedValueOnce({ key: "committee", memberIds: ["other"] })
      .mockResolvedValueOnce(null);
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
    const firstCall = findMock.mock.calls[0] as any[];
    const [filter] = firstCall;
    expect(filter).toEqual({
      status: { $ne: "draft" },
      submittedEmail: { $ne: "reviewer@wsu.edu" },
    });
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
    findOne
      .mockResolvedValueOnce({ key: "committee", memberIds: [] })
      .mockResolvedValueOnce(null);
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
  // One criterion accepting scores of 10 or 0; validateReviewScores keys off
  // criterion._id.toString(), so a string id is fine for the mock.
  const criteria = [
    {
      _id: "crit1",
      maxScore: 10,
      ratingSuggestions: [{ score: 10 }, { score: 0 }],
    },
  ];

  it("400 when comments is missing", async () => {
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 } });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("403 when the caller is not an ARCC member", async () => {
    findOne
      .mockResolvedValueOnce({ key: "committee", memberIds: [] })
      .mockResolvedValueOnce(null);
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 }, comments: "ok" });
    expect(res.status).toBe(403);
  });

  it("400 when no review criteria are configured", async () => {
    findToArray.mockResolvedValueOnce([]);
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 }, comments: "ok" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("400 when a criterion has no score", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: {}, comments: "ok" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("400 when a score is not an allowed rating", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 7 }, comments: "ok" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("400 when scores include an unknown criterion", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10, bogus: 5 }, comments: "ok" });
    expect(res.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("404 when the grant is missing", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    findOne
      .mockResolvedValueOnce(committee) // ARCC membership lookup
      .mockResolvedValueOnce(null); // grant lookup
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 }, comments: "ok" });
    expect(res.status).toBe(404);
  });

  it("200 stores the reviewer's review", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    findOne
      .mockResolvedValueOnce(committee) // ARCC membership lookup
      .mockResolvedValueOnce({ _id: OID, reviews: [] }); // grant lookup
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 }, comments: "  solid  " });
    expect(res.status).toBe(200);
    expect(res.body.reviewerId).toBe("arcc1");
    expect(res.body.scores).toEqual({ crit1: 10 });
    expect(res.body.comments).toBe("solid"); // trimmed
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter._id.toString()).toBe(OID);
    expect(update.$set.reviews).toHaveLength(1);
    expect(update.$set.reviews[0].reviewerId).toBe("arcc1");
  });

  it("replaces this reviewer's existing review instead of adding a second", async () => {
    findToArray.mockResolvedValueOnce(criteria);
    findOne.mockResolvedValueOnce(committee).mockResolvedValueOnce({
      _id: OID,
      reviews: [
        { reviewerId: "arcc1", scores: { crit1: 0 }, comments: "old" },
        { reviewerId: "other", scores: { crit1: 10 }, comments: "keep" },
      ],
    });
    const res = await request(app)
      .put(`/api/grants/review/${OID}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ scores: { crit1: 10 }, comments: "updated" });
    expect(res.status).toBe(200);
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set.reviews).toHaveLength(2);
    const mine = update.$set.reviews.find(
      (r: { reviewerId: string }) => r.reviewerId === "arcc1",
    );
    expect(mine.comments).toBe("updated");
  });
});
