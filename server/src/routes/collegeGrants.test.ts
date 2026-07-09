import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const { collegeFind, grantFindOne, grantFind, updateOne } = vi.hoisted(() => ({
  collegeFind: vi.fn(),
  grantFindOne: vi.fn(),
  grantFind: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: (name: string) => {
        if (name === "college") {
          return {
            findOne: collegeFind,
          };
        }
        if (name === "grant") {
          return {
            findOne: grantFindOne,
            find: (filter: unknown) => ({
              sort: () => ({
                toArray: async () => grantFind(filter),
              }),
            }),
            updateOne,
          };
        }
        return { findOne: vi.fn(), find: vi.fn(), updateOne };
      },
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const deanToken = jwt.sign(
  { userId: "dean", email: "dean@tester.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const userToken = jwt.sign(
  { userId: "user", email: "user@tester.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const collegeId = new ObjectId().toString();
const grantId = new ObjectId().toString();

const mockCollege = {
  _id: new ObjectId(collegeId),
  name: "College of Testing",
  dean: "dean@tester.edu",
};

const mockGrant = {
  _id: new ObjectId(grantId),
  title: "Test Grant",
  description: "Test College Grant",
  status: "submitted",
  collegeReviewStatus: "pending",
  submittedAt: new Date("2024-01-15"),
  budgetItems: [
    {
      category: "Hardware",
      amountFromCollege: "5000",
      collegeId: collegeId,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  collegeFind.mockResolvedValue(mockCollege);
  grantFindOne.mockResolvedValue(mockGrant);
  grantFind.mockResolvedValue([mockGrant]);
  updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
});

describe("GET /api/college-grants/", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app).get("/api/college-grants/");
    expect(res.status).toBe(401);
  });

  it("403 if user is not a college dean", async () => {
    collegeFind.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(
      "Not authorized — you are not a college dean",
    );
  });

  it("200 returns grants for the dean's college with amountFromCollege > 0", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFind.mockResolvedValueOnce([mockGrant]);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.collegeName).toBe("College of Testing");
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].title).toBe("Test Grant");
  });

  it("filters out grants with amountFromCollege = 0", async () => {
    const grantNoFunding = {
      ...mockGrant,
      budgetItems: [
        {
          category: "Hardware",
          amountFromCollege: "0",
          collegeId: collegeId,
        },
      ],
    };
    grantFind.mockResolvedValueOnce([mockGrant, grantNoFunding]);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].title).toBe("Test Grant");
  });

  it("includes grants with matching collegeId", async () => {
    const grants = [
      {
        ...mockGrant,
        budgetItems: [
          {
            category: "Hardware",
            amountFromCollege: "5000",
            collegeId: collegeId,
          },
        ],
      },
    ];
    grantFind.mockResolvedValueOnce(grants);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
  });

  it("filters out grants from other colleges", async () => {
    const otherCollegeId = new ObjectId().toString();
    const grantOtherCollege = {
      ...mockGrant,
      budgetItems: [
        {
          category: "Hardware",
          amountFromCollege: "5000",
          collegeId: otherCollegeId,
        },
      ],
    };
    grantFind.mockResolvedValueOnce([mockGrant, grantOtherCollege]);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].budgetItems[0].collegeId).toBe(collegeId);
  });

  it("handles budgetItems as string (JSON parsing)", async () => {
    const grantStringBudget = {
      ...mockGrant,
      budgetItems: JSON.stringify([
        {
          category: "Hardware",
          amountFromCollege: "3000",
          collegeId: collegeId,
        },
      ]),
    };
    grantFind.mockResolvedValueOnce([grantStringBudget]);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
  });

  it("returns empty array when no grants match", async () => {
    grantFind.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(0);
  });

  it("500 on database error", async () => {
    grantFind.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .get("/api/college-grants/")
      .set("Authorization", `Bearer ${deanToken}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to fetch college grants/);
  });
});

describe("GET /api/college-grants/:id", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app).get(`/api/college-grants/${grantId}`);
    expect(res.status).toBe(401);
  });

  it("400 with invalid ObjectId", async () => {
    const res = await request(app)
      .get("/api/college-grants/not-an-id")
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid grant id/);
  });

  it("403 if user is not a college dean", async () => {
    collegeFind.mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(
      "Not authorized — you are not a college dean",
    );
  });

  it("404 if grant not found", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Grant not found/);
  });

  it("403 if grant has no funding from this dean's college", async () => {
    const otherCollegeId = new ObjectId().toString();
    const grantOtherCollege = {
      ...mockGrant,
      budgetItems: [
        {
          category: "Hardware",
          amountFromCollege: "5000",
          collegeId: otherCollegeId,
        },
      ],
    };
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(grantOtherCollege);

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(
      "Not authorized — grant is not funded by your college",
    );
  });

  it("200 returns grant with matching collegeId", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test Grant");
  });

  it("403 if amountFromCollege is 0", async () => {
    const grantNoFunding = {
      ...mockGrant,
      budgetItems: [
        {
          category: "Hardware",
          amountFromCollege: "0",
          collegeId: collegeId,
        },
      ],
    };
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(grantNoFunding);

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(
      "Not authorized — grant is not funded by your college",
    );
  });

  it("500 on database error", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .get(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`);
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to fetch grant/);
  });
});

describe("PUT /api/college-grants/:id", () => {
  it("401 without Authorization header", async () => {
    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(401);
  });

  it("400 with invalid ObjectId", async () => {
    const res = await request(app)
      .put("/api/college-grants/invalid-id")
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid grant id/);
  });

  it("400 with invalid collegeReviewStatus", async () => {
    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "invalid" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must be approved or denied/);
  });

  it("403 if user is not a college dean", async () => {
    collegeFind.mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(
      "Not authorized — you are not a college dean",
    );
  });

  it("404 if grant not found", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Grant not found/);
  });

  it("400 if grant is a draft", async () => {
    const draftGrant = {
      ...mockGrant,
      status: "draft",
    };
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(draftGrant);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cannot review a draft grant/);
  });

  it("403 if grant has no funding from this dean's college", async () => {
    const otherCollegeId = new ObjectId().toString();
    const grantOtherCollege = {
      ...mockGrant,
      budgetItems: [
        {
          category: "Hardware",
          amountFromCollege: "5000",
          collegeId: otherCollegeId,
        },
      ],
    };
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(grantOtherCollege);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not funded by your college/);
  });

  it("200 approves grant successfully", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.collegeReviewStatus).toBe("approved");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      {
        $set: {
          collegeReviewStatus: "approved",
          collegeReviewedBy: "dean@tester.edu",
          collegeReviewedAt: expect.any(Date),
        },
      },
    );
  });

  it("200 denies grant successfully", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "denied" });

    expect(res.status).toBe(200);
    expect(res.body.collegeReviewStatus).toBe("denied");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      {
        $set: {
          collegeReviewStatus: "denied",
          collegeReviewedBy: "dean@tester.edu",
          collegeReviewedAt: expect.any(Date),
        },
      },
    );
  });

  it("stamps collegeReviewedAt with current timestamp", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);

    const beforeUpdate = new Date();
    await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    const afterUpdate = new Date();

    const updateCall = updateOne.mock.calls[0][1];
    const reviewedAt = updateCall.$set.collegeReviewedAt;
    expect(reviewedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(reviewedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
  });

  it("500 on database error", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);
    updateOne.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to update college review status/);
  });

  it("404 if update returns no matched count", async () => {
    collegeFind.mockResolvedValueOnce(mockCollege);
    grantFindOne.mockResolvedValueOnce(mockGrant);
    updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const res = await request(app)
      .put(`/api/college-grants/${grantId}`)
      .set("Authorization", `Bearer ${deanToken}`)
      .send({ collegeReviewStatus: "approved" });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Grant not found/);
  });
});
