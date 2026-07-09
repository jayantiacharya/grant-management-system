import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const { grantFindOne, grantFind, grantUpdateOne, arccFindOne } = vi.hoisted(
  () => ({
    grantFindOne: vi.fn(),
    grantFind: vi.fn(),
    grantUpdateOne: vi.fn(),
    arccFindOne: vi.fn(),
  }),
);

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: (name: string) => {
        if (name === "grant") {
          return {
            findOne: grantFindOne,
            find: () => ({
              sort: () => ({ toArray: grantFind }),
            }),
            updateOne: grantUpdateOne,
          };
        }
        if (name === "arcc") {
          return { findOne: arccFindOne };
        }
        return { findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn() };
      },
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const ownerToken = jwt.sign(
  { userId: "owner", email: "owner@test.edu", role: "user" },
  process.env.JWT_SECRET!,
);

const grantId = new ObjectId().toString();

function fundedGrant(overrides = {}) {
  return {
    _id: new ObjectId(grantId),
    title: "Funded Grant",
    submittedEmail: "owner@test.edu",
    departmentReviewStatus: "approved",
    collegeReviewStatus: "approved",
    allocatedAmount: 2500,
    allocationStatus: "Approved (Partial)",
    reports: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  grantFindOne.mockResolvedValue(fundedGrant());
  grantFind.mockResolvedValue([fundedGrant()]);
  grantUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  arccFindOne.mockResolvedValue(null);
});

describe("GET /api/grant-reports/approved", () => {
  it("returns the award from allocatedAmount", async () => {
    const res = await request(app)
      .get("/api/grant-reports/approved")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amountAwarded).toBe(2500);
  });

  it("falls back to the legacy amountAwarded field", async () => {
    grantFind.mockResolvedValueOnce([
      fundedGrant({ allocatedAmount: undefined, amountAwarded: 4000 }),
    ]);

    const res = await request(app)
      .get("/api/grant-reports/approved")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amountAwarded).toBe(4000);
  });

  it("excludes grants without a positive award", async () => {
    grantFind.mockResolvedValueOnce([
      fundedGrant({ allocatedAmount: undefined, title: "Not yet allocated" }),
      fundedGrant({ allocatedAmount: 0, title: "Allocated zero" }),
      fundedGrant(),
    ]);

    const res = await request(app)
      .get("/api/grant-reports/approved")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Funded Grant");
  });
});

describe("GET /api/grant-reports/:id", () => {
  it("returns the award from allocatedAmount", async () => {
    const res = await request(app)
      .get(`/api/grant-reports/${grantId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.amountAwarded).toBe(2500);
  });

  it("403 for a grant without a positive award", async () => {
    grantFindOne.mockResolvedValueOnce(
      fundedGrant({ allocatedAmount: undefined }),
    );

    const res = await request(app)
      .get(`/api/grant-reports/${grantId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/grant-reports/:id/submit", () => {
  it("403 for a grant without a positive award", async () => {
    grantFindOne.mockResolvedValueOnce(
      fundedGrant({ allocatedAmount: undefined }),
    );

    const res = await request(app)
      .post(`/api/grant-reports/${grantId}/submit`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .field("reportText", "Progress report")
      .field("currentProgress", "Halfway")
      .field("nextSteps", "Finish");

    expect(res.status).toBe(403);
  });

  it("201 appends a report for a funded grant", async () => {
    const res = await request(app)
      .post(`/api/grant-reports/${grantId}/submit`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .field("reportText", "Progress report")
      .field("currentProgress", "Halfway")
      .field("nextSteps", "Finish");

    expect(res.status).toBe(201);
    expect(grantUpdateOne).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/grant-reports/:id/allocate", () => {
  it("is removed", async () => {
    const res = await request(app)
      .put(`/api/grant-reports/${grantId}/allocate`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ amountAwarded: 1000 });

    expect(res.status).toBe(404);
  });
});
