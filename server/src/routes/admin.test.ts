import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const {
  findToArray,
  lastFindOptions,
  collegeFindOne,
  collegeDeleteOne,
  departmentFindOne,
  departmentDeleteOne,
  departmentCountDocuments,
  userUpdateMany,
} = vi.hoisted(() => ({
  findToArray: vi.fn(),
  lastFindOptions: { value: null as unknown },
  collegeFindOne: vi.fn(),
  collegeDeleteOne: vi.fn(),
  departmentFindOne: vi.fn(),
  departmentDeleteOne: vi.fn(),
  departmentCountDocuments: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: (name: string) => {
        if (name === "college") {
          return {
            findOne: collegeFindOne,
            deleteOne: collegeDeleteOne,
          };
        }

        if (name === "department") {
          return {
            findOne: departmentFindOne,
            deleteOne: departmentDeleteOne,
            countDocuments: departmentCountDocuments,
          };
        }

        return {
          find: (_filter: unknown, options: unknown) => {
            lastFindOptions.value = options;
            return { toArray: findToArray };
          },
          updateMany: userUpdateMany,
        };
      },
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
  lastFindOptions.value = null;
});

describe("GET /api/admin/users", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    findToArray.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(403);
  });

  it("uses projection that excludes password", async () => {
    findToArray.mockResolvedValue([{ id: "u1", email: "alice@wsu.edu" }]);
    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(lastFindOptions.value).toEqual({ projection: { password: 0 } });
  });

  it("returns the rows from the db", async () => {
    findToArray.mockResolvedValue([
      { id: "u1", email: "alice@wsu.edu", role: "user" },
    ]);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "u1", email: "alice@wsu.edu", role: "user" },
    ]);
    expect(res.body[0]).not.toHaveProperty("password");
  });
});

describe("GET /api/admin/user-options", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).get("/api/admin/user-options");
    expect(res.status).toBe(401);
  });

  it("401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("uses projection that returns only id and email", async () => {
    findToArray.mockResolvedValue([]);
    await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", `Bearer ${validToken}`);
    expect(lastFindOptions.value).toEqual({
      projection: { _id: 0, id: 1, email: 1 },
    });
  });

  it("200 returns rows with auth", async () => {
    findToArray.mockResolvedValue([{ id: "u1", email: "alice@wsu.edu" }]);
    const res = await request(app)
      .get("/api/admin/user-options")
      .set("Authorization", `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "u1", email: "alice@wsu.edu" }]);
  });
});

describe("POST /api/admin/deleteCollege", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).post("/api/admin/deleteCollege").send({
      id: "507f1f77bcf86cd799439011",
    });
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });
    expect(res.status).toBe(403);
  });

  it("400 when id is missing", async () => {
    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("400 when id is not a valid ObjectId", async () => {
    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "not-a-valid-id" });
    expect(res.status).toBe(400);
  });

  it("404 when the college does not exist", async () => {
    collegeFindOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });
    expect(res.status).toBe(404);
  });

  it("409 blocks deletion when departments still reference the college", async () => {
    collegeFindOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "College of Science",
    });
    departmentCountDocuments.mockResolvedValue(2);

    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/2 department/i);
    expect(collegeDeleteOne).not.toHaveBeenCalled();
  });

  it("deletes the college and clears the college field on affected users when unreferenced", async () => {
    collegeFindOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "College of Science",
    });
    departmentCountDocuments.mockResolvedValue(0);
    collegeDeleteOne.mockResolvedValue({ deletedCount: 1 });
    userUpdateMany.mockResolvedValue({ modifiedCount: 3 });

    const res = await request(app)
      .post("/api/admin/deleteCollege")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });

    expect(res.status).toBe(200);
    expect(res.body.usersUpdated).toBe(3);
    expect(userUpdateMany).toHaveBeenCalledWith(
      { college: "College of Science" },
      { $set: { college: "" } },
    );
  });
});

describe("POST /api/admin/deleteDepartment", () => {
  it("401 without Authorization", async () => {
    const res = await request(app).post("/api/admin/deleteDepartment").send({
      id: "507f1f77bcf86cd799439011",
    });
    expect(res.status).toBe(401);
  });

  it("403 with non-admin token", async () => {
    const res = await request(app)
      .post("/api/admin/deleteDepartment")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });
    expect(res.status).toBe(403);
  });

  it("404 when the department does not exist", async () => {
    departmentFindOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/admin/deleteDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });
    expect(res.status).toBe(404);
  });

  it("deletes the department and clears the department field on affected users", async () => {
    departmentFindOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Computer Science",
    });
    departmentDeleteOne.mockResolvedValue({ deletedCount: 1 });
    userUpdateMany.mockResolvedValue({ modifiedCount: 5 });

    const res = await request(app)
      .post("/api/admin/deleteDepartment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "507f1f77bcf86cd799439011" });

    expect(res.status).toBe(200);
    expect(res.body.usersUpdated).toBe(5);
    expect(userUpdateMany).toHaveBeenCalledWith(
      { department: "Computer Science" },
      { $set: { department: "" } },
    );
  });
});
