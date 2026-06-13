import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";

const { findToArray, insertOne } = vi.hoisted(() => ({
  findToArray: vi.fn(),
  insertOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({
        find: () => ({ toArray: findToArray }),
        insertOne,
      }),
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  findToArray.mockResolvedValue([]);
  insertOne.mockResolvedValue({ insertedId: "id" });
});

describe("GET /api/admin/colleges", () => {
  it("200 returns colleges from db with a string id", async () => {
    const _id = new ObjectId();
    findToArray.mockResolvedValueOnce([
      { _id, name: "Engineering", dean: "x" },
    ]);
    const res = await request(app).get("/api/admin/colleges");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        _id: _id.toHexString(),
        name: "Engineering",
        dean: "x",
        id: _id.toHexString(),
      },
    ]);
  });
});

describe("GET /api/admin/departments", () => {
  it("200 returns departments from db with a string id", async () => {
    const _id = new ObjectId();
    findToArray.mockResolvedValueOnce([
      { _id, name: "CS", college: "Engineering" },
    ]);
    const res = await request(app).get("/api/admin/departments");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        _id: _id.toHexString(),
        name: "CS",
        college: "Engineering",
        id: _id.toHexString(),
      },
    ]);
  });
});

describe("POST /api/admin/createCollege", () => {
  it("400 when name missing", async () => {
    const res = await request(app)
      .post("/api/admin/createCollege")
      .send({ dean: "alice@wsu.edu" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/all fields required/i);
  });

  it("400 when dean missing", async () => {
    const res = await request(app)
      .post("/api/admin/createCollege")
      .send({ name: "Engineering" });
    expect(res.status).toBe(400);
  });

  it("201 inserts college and returns status", async () => {
    const res = await request(app)
      .post("/api/admin/createCollege")
      .send({ name: "Engineering", dean: "alice@wsu.edu" });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatch(/college created/i);
    expect(insertOne).toHaveBeenCalledWith({
      name: "Engineering",
      dean: "alice@wsu.edu",
    });
  });
});

describe("POST /api/admin/createDepartment", () => {
  it("400 when name missing", async () => {
    const res = await request(app)
      .post("/api/admin/createDepartment")
      .send({ college: "Engineering" });
    expect(res.status).toBe(400);
  });

  it("400 when college missing", async () => {
    const res = await request(app)
      .post("/api/admin/createDepartment")
      .send({ name: "CS" });
    expect(res.status).toBe(400);
  });

  it("201 inserts department with name, college and chair", async () => {
    const res = await request(app)
      .post("/api/admin/createDepartment")
      .send({ name: "CS", college: "Engineering", chair: "Dr. Smith" });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatch(/department created/i);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "CS",
        college: "Engineering",
        chair: "Dr. Smith",
      }),
    );
  });
});
