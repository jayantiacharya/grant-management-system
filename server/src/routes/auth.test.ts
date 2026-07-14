import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

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

const validRegister = {
  email: "Alice@WSU.edu",
  password: "secret1",
  confirmPassword: "secret1",
  firstName: "  Alice  ",
  lastName: "  Smith  ",
  birthday: "1990-05-20",
  department: "Computer Science",
  college: "College of Engineering",
  accountNumber: "123456789",
};

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue(null);
  insertOne.mockResolvedValue({ insertedId: "mongo-id" });
  updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe("POST /api/auth/register", () => {
  it.each([
    ["email", "email"],
    ["password", "password"],
    ["confirmPassword", "confirmPassword"],
    ["firstName", "firstName"],
    ["lastName", "lastName"],
    ["birthday", "birthday"],
    ["department", "department"],
    ["college", "college"],
  ])("400 when %s is missing", async (_label, field) => {
    const body = { ...validRegister, [field]: "" };
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/all fields are required/i);
  });

  it("400 when names are whitespace only (trimmed empty)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegister, firstName: "   " });
    expect(res.status).toBe(400);
  });

  it("400 when passwords do not match", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegister, confirmPassword: "different" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/passwords do not match/i);
  });

  it("400 when password shorter than 6 chars", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegister, password: "abc", confirmPassword: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 6 characters/i);
  });

  it.each([
    ["not a date", "not-a-date"],
    ["wrong format", "05/20/1990"],
    ["before 1900", "1899-12-31"],
    ["in the future", "3000-01-01"],
  ])("400 when birthday is %s", async (_label, birthday) => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegister, birthday });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid birthday/i);
  });

  it("409 when email already in use", async () => {
    findOne.mockResolvedValueOnce({ id: "existing", email: "alice@wsu.edu" });
    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegister);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already in use/i);
  });

  it("201 creates user, lowercases email, trims names, hashes password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegister);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({
      email: "alice@wsu.edu",
      firstName: "Alice",
      lastName: "Smith",
      role: "user",
    });
    expect(res.body.user).not.toHaveProperty("password");

    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.email).toBe("alice@wsu.edu");
    expect(inserted.password).not.toBe(validRegister.password);
    expect(await bcrypt.compare("secret1", inserted.password)).toBe(true);
  });
});

describe("POST /api/auth/login", () => {
  it("400 when email or password missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@wsu.edu" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("401 when user not found", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@wsu.edu", password: "secret1" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it("401 when password does not match", async () => {
    const hash = await bcrypt.hash("correct-password", 12);
    findOne.mockResolvedValueOnce({
      id: "u1",
      email: "alice@wsu.edu",
      password: hash,
      role: "user",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@wsu.edu", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("200 returns token and user on success, lowercases email lookup", async () => {
    const hash = await bcrypt.hash("secret1", 12);
    findOne.mockResolvedValueOnce({
      id: "u1",
      email: "alice@wsu.edu",
      password: hash,
      role: "user",
      firstName: "Alice",
      lastName: "Smith",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ALICE@WSU.edu", password: "secret1" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe("u1");
    expect(res.body.user).not.toHaveProperty("password");
    expect(findOne).toHaveBeenCalledWith({ email: "alice@wsu.edu" });
  });
});

describe("GET /api/auth/get-user/:userId", () => {
  it("404 when user not found", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/auth/get-user/nobody");
    expect(res.status).toBe(404);
  });

  it("200 returns user and formats Date birthday as YYYY-MM-DD", async () => {
    findOne.mockResolvedValueOnce({
      id: "u1",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@wsu.edu",
      department: "CS",
      college: "Engineering",
      birthday: new Date("1990-05-20T00:00:00.000Z"),
    });
    const res = await request(app).get("/api/auth/get-user/u1");
    expect(res.status).toBe(200);
    expect(res.body.user.birthday).toBe("1990-05-20");
    expect(res.body.user.email).toBe("alice@wsu.edu");
  });

  it("passes through a string birthday unchanged", async () => {
    findOne.mockResolvedValueOnce({
      id: "u1",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@wsu.edu",
      department: "CS",
      college: "Engineering",
      birthday: "1990-05-20",
    });
    const res = await request(app).get("/api/auth/get-user/u1");
    expect(res.body.user.birthday).toBe("1990-05-20");
  });

  it("500 when db lookup throws", async () => {
    findOne.mockRejectedValueOnce(new Error("mongo down"));
    const res = await request(app).get("/api/auth/get-user/u1");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/update-user", () => {
  it("400 when userId missing", async () => {
    const res = await request(app)
      .post("/api/auth/update-user")
      .send({ firstName: "Bob" });
    expect(res.status).toBe(400);
  });

  it("404 when user not found", async () => {
    findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/auth/update-user")
      .send({ userId: "ghost", firstName: "Bob" });
    expect(res.status).toBe(404);
  });

  it("400 when new password too short", async () => {
    findOne.mockResolvedValueOnce({ id: "u1" });
    const res = await request(app)
      .post("/api/auth/update-user")
      .send({ userId: "u1", password: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 6 characters/i);
  });

  it("200 updates trimmed/lowercased fields and hashes password", async () => {
    findOne.mockResolvedValueOnce({ id: "u1" });
    const res = await request(app).post("/api/auth/update-user").send({
      userId: "u1",
      firstName: "  Bob  ",
      lastName: "  Jones  ",
      email: "BOB@WSU.edu",
      department: "Math",
      college: "Science",
      password: "newpass1",
    });
    expect(res.status).toBe(200);
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ id: "u1" });
    expect(update.$set.firstName).toBe("Bob");
    expect(update.$set.lastName).toBe("Jones");
    expect(update.$set.email).toBe("bob@wsu.edu");
    expect(update.$set.department).toBe("Math");
    expect(update.$set.password).not.toBe("newpass1");
    expect(await bcrypt.compare("newpass1", update.$set.password)).toBe(true);
  });

  it("200 with empty body only sets userId match, no field changes", async () => {
    findOne.mockResolvedValueOnce({ id: "u1" });
    const res = await request(app)
      .post("/api/auth/update-user")
      .send({ userId: "u1" });
    expect(res.status).toBe(200);
    expect(updateOne.mock.calls[0][1]).toEqual({ $set: {} });
  });

  it("200 updates accountNumber when provided", async () => {
    findOne.mockResolvedValueOnce({ id: "u1" });
    const res = await request(app)
      .post("/api/auth/update-user")
      .send({ userId: "u1", accountNumber: "987654321" });
    expect(res.status).toBe(200);
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ id: "u1" });
    expect(update.$set.accountNumber).toBe("987654321");
  });
});
