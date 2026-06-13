import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "fs";

const { findOne, insertOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
}));

vi.mock("../middleware/conn.js", () => ({
  default: {
    getDb: () => ({
      collection: () => ({ findOne, insertOne }),
    }),
  },
}));

import { createApp } from "../app.js";

const app = createApp();

const validToken = jwt.sign(
  { userId: "u1", email: "alice@wsu.edu", role: "user" },
  process.env.JWT_SECRET!,
);

// Files multer writes to disk during a request; remove them after each test.
const createdPaths: string[] = [];
function trackForCleanup(body: any) {
  for (const f of body?.files ?? []) if (f?.path) createdPaths.push(f.path);
  if (body?.irbApprovalFile?.path) createdPaths.push(body.irbApprovalFile.path);
}

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue({ _id: "mongo-id" });
  insertOne.mockResolvedValue({ insertedId: "grant-id" });
});

afterEach(() => {
  for (const p of createdPaths) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* already gone */
    }
  }
  createdPaths.length = 0;
});

describe("POST /api/grants/submit - validation parity (JSON)", () => {
  const base = {
    title: "AI for Good",
    description: "Build it",
    projectDirectorId: "u1",
    studentsImpacted: 1,
  };

  it("400 when affectsMultipleDepartments=yes but departmentCount < 2", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...base, affectsMultipleDepartments: "yes", departmentCount: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/departmentCount/);
  });

  it("201 and stores departmentCount when affectsMultipleDepartments=yes and count >= 2", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...base, affectsMultipleDepartments: "yes", departmentCount: 3 });
    expect(res.status).toBe(201);
    expect(res.body.departmentCount).toBe(3);
  });

  it("400 when usesSubjects=yes but irbApproved is not yes", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...base, usesSubjects: "yes", irbApproved: "no" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/irbApproved/);
  });

  it("nulls departmentCount/irbApproved when their gating answer is no", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ ...base, affectsMultipleDepartments: "no", usesSubjects: "no" });
    expect(res.status).toBe(201);
    expect(res.body.departmentCount).toBeNull();
    expect(res.body.irbApproved).toBeNull();
  });
});

describe("POST /api/grants/submit - file uploads (multipart)", () => {
  it("maps uploaded files into the stored grant", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .field("title", "AI for Good")
      .field("description", "Build it")
      .field("projectDirectorId", "u1")
      .field("studentsImpacted", "1")
      .field("affectsMultipleDepartments", "no")
      .field("usesSubjects", "no")
      .attach("files", Buffer.from("hello"), "proposal.pdf");
    trackForCleanup(res.body);

    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].originalName).toBe("proposal.pdf");
    expect(res.body.files[0].savedName).toMatch(/proposal\.pdf$/);
    expect(typeof res.body.files[0].path).toBe("string");
    // savedName/path must not be spoofable from the client; only originalName echoes.
    const inserted = insertOne.mock.calls[0][0];
    expect(inserted.files[0].originalName).toBe("proposal.pdf");
  });

  it("maps the IRB approval file separately from regular files", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .field("title", "AI for Good")
      .field("description", "Build it")
      .field("projectDirectorId", "u1")
      .field("studentsImpacted", "1")
      .field("affectsMultipleDepartments", "no")
      .field("usesSubjects", "yes")
      .field("irbApproved", "yes")
      .attach("files", Buffer.from("body"), "proposal.pdf")
      .attach("irbApprovalFile", Buffer.from("irb"), "irb.pdf");
    trackForCleanup(res.body);

    expect(res.status).toBe(201);
    expect(res.body.irbApprovalFile.originalName).toBe("irb.pdf");
    expect(res.body.files).toHaveLength(1);
    expect(res.body.irbApproved).toBe("yes");
  });

  it("400 when usesSubjects=yes but no files are attached", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .field("title", "AI for Good")
      .field("description", "Build it")
      .field("projectDirectorId", "u1")
      .field("studentsImpacted", "1")
      .field("affectsMultipleDepartments", "no")
      .field("usesSubjects", "yes")
      .field("irbApproved", "yes");
    trackForCleanup(res.body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/file upload is required/i);
  });

  it("defaults files to an empty array when none are sent", async () => {
    const res = await request(app)
      .post("/api/grants/submit")
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        title: "AI for Good",
        description: "Build it",
        projectDirectorId: "u1",
        studentsImpacted: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.files).toEqual([]);
    expect(res.body.irbApprovalFile).toBeNull();
  });
});
