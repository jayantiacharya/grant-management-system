import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const {
  allocationFindOne,
  allocationUpdateOne,
  criteriaToArray,
  grantToArray,
  grantUpdateOne,
  emptyToArray,
  emptyFindOne,
  emptyUpdateOne,
} = vi.hoisted(() => ({
  allocationFindOne: vi.fn(),
  allocationUpdateOne: vi.fn(),
  criteriaToArray: vi.fn(),
  grantToArray: vi.fn(),
  grantUpdateOne: vi.fn(),
  emptyToArray: vi.fn(),
  emptyFindOne: vi.fn(),
  emptyUpdateOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: (name: string) => {
        if (name === "allocationSettings") {
          return {
            findOne: allocationFindOne,
            updateOne: allocationUpdateOne,
          };
        }

        if (name === "criteria") {
          return {
            find: () => ({ toArray: criteriaToArray }),
          };
        }

        if (name === "grant") {
          return {
            find: () => ({ toArray: grantToArray }),
            updateOne: grantUpdateOne,
          };
        }

        return {
          find: () => ({ toArray: emptyToArray }),
          findOne: emptyFindOne,
          updateOne: emptyUpdateOne,
        };
      },
    }),
  },
}));

import { createApp } from "../app.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = createApp();

const chairToken = jwt.sign(
  { userId: "chair1", email: "arcc-chair@test.edu", role: "arcc-chair" },
  process.env.JWT_SECRET!,
);

const userToken = jwt.sign(
  { userId: "user1", email: "user@test.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const GRANT_ID = "507f1f77bcf86cd799439011";

const allocationCriteria = [
  { fromPercentage: 90, toPercentage: 100, awardPercentage: 100 },
  { fromPercentage: 80, toPercentage: 89.99, awardPercentage: 75 },
  { fromPercentage: 75, toPercentage: 79.99, awardPercentage: 50 },
];

const rubricCriteria = [
  {
    _id: new ObjectId("507f1f77bcf86cd799439021"),
    maxScore: 30,
    ratingSuggestions: [{ score: 30 }],
  },
  {
    _id: new ObjectId("507f1f77bcf86cd799439022"),
    maxScore: 40,
    ratingSuggestions: [{ score: 40 }],
  },
  {
    _id: new ObjectId("507f1f77bcf86cd799439023"),
    maxScore: 30,
    ratingSuggestions: [{ score: 30 }],
  },
];

function reviewedGrant(overrides = {}) {
  return {
    _id: new ObjectId(GRANT_ID),
    title: "G3: Submitted with Committee Reviews",
    submittedEmail: "proposer@test.edu",
    projectDirectorId: "2000000002",
    accountNumber: "ACC-003",
    arccAmountRequested: 5000,
    departmentReviewStatus: "approved",
    collegeReviewStatus: "approved",
    arccReviewStatus: "approved",
    reviews: [
      {
        reviewerId: "arcc-member@test.edu",
        scores: {
          "507f1f77bcf86cd799439021": 25,
          "507f1f77bcf86cd799439022": 35,
          "507f1f77bcf86cd799439023": 20,
        },
        comments: "Solid proposal with clear outcomes.",
      },
      {
        reviewerId: "arcc-chair@test.edu",
        scores: {
          "507f1f77bcf86cd799439021": 20,
          "507f1f77bcf86cd799439022": 30,
          "507f1f77bcf86cd799439023": 25,
        },
        comments: "Budget could be tighter but impact is strong.",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();

  allocationFindOne.mockResolvedValue({
    currentCycleAmount: 50000,
    cutoffPercentage: 75,
    criteria: allocationCriteria,
    finalized: false,
    finalizedAt: null,
  });

  allocationUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  criteriaToArray.mockResolvedValue(rubricCriteria);
  grantToArray.mockResolvedValue([reviewedGrant()]);
  grantUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  emptyToArray.mockResolvedValue([]);
  emptyFindOne.mockResolvedValue(null);
  emptyUpdateOne.mockResolvedValue({ matchedCount: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/allocation/grants", () => {
  it("403 for a non-ARCC chair user", async () => {
    const res = await request(app)
      .get("/api/allocation/grants")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it("calculates final rating using real rubric maxScore instead of hardcoded 80", async () => {
    const res = await request(app)
      .get("/api/allocation/grants")
      .set("Authorization", `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);

    const grant = res.body.grants[0];

    expect(grant.totalScore).toBe(155);
    expect(grant.totalPossibleScore).toBe(200);
    expect(grant.finalPercent).toBe(77.5);
    expect(grant.allocatedAmount).toBe(2500);
    expect(grant.status).toBe("Approved (Partial)");
  });

  it("uses cutoff percentage to block below-cutoff awards", async () => {
    allocationFindOne.mockResolvedValueOnce({
      currentCycleAmount: 50000,
      cutoffPercentage: 80,
      criteria: allocationCriteria,
      finalized: false,
      finalizedAt: null,
    });

    const res = await request(app)
      .get("/api/allocation/grants")
      .set("Authorization", `Bearer ${chairToken}`);

    expect(res.status).toBe(200);

    const grant = res.body.grants[0];

    expect(grant.finalPercent).toBe(77.5);
    expect(grant.allocatedAmount).toBe(0);
    expect(grant.status).toBe("Rejected");
  });
});

describe("POST /api/allocation/finalize", () => {
  it("sets funded grant report due date to first June 30 on or after allocation date plus one year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-20T12:00:00.000Z"));

    const res = await request(app)
      .post("/api/allocation/finalize")
      .set("Authorization", `Bearer ${chairToken}`)
      .send({
        currentCycleAmount: 50000,
        cutoffPercentage: 75,
        criteria: allocationCriteria,
        grants: [
          {
            id: GRANT_ID,
            allocatedAmount: 2500,
            status: "Approved (Partial)",
          },
        ],
        totalAllocated: 2500,
        leftoverAmount: 47500,
      });

    expect(res.status).toBe(200);
    expect(grantUpdateOne).toHaveBeenCalledTimes(1);

    const [, update] = grantUpdateOne.mock.calls[0];

    expect(update.$set.reportDueDate).toBe(
      new Date(Date.UTC(2027, 5, 30)).toISOString(),
    );
  });
});

describe("POST /api/allocation/send-to-accounting", () => {
  it("escapes CSV values that could be interpreted as formulas", async () => {
    grantToArray.mockResolvedValueOnce([
      reviewedGrant({
        title: '=HYPERLINK("http://evil.test","x")',
        submittedEmail: "+submitter@test.edu",
        projectDirectorId: "-PI",
        accountNumber: "@ACC-003",
        reviews: [
          {
            reviewerId: "arcc-member@test.edu",
            scores: {
              "507f1f77bcf86cd799439021": 30,
              "507f1f77bcf86cd799439022": 40,
              "507f1f77bcf86cd799439023": 30,
            },
          },
        ],
      }),
    ]);

    const res = await request(app)
      .post("/api/allocation/send-to-accounting")
      .set("Authorization", `Bearer ${chairToken}`)
      .send({
        criteria: allocationCriteria,
        cutoffPercentage: 75,
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");

    expect(res.text).toContain("\"'=HYPERLINK");
    expect(res.text).toContain('"\'+submitter@test.edu"');
    expect(res.text).toContain('"\'-PI"');
    expect(res.text).toContain('"\'@ACC-003"');
    expect(res.text).toContain('"Approved (Full)"');
  });
});
