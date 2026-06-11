import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, type AuthRequest } from "./auth.js";
import type { Response } from "express";

function mockRes() {
  const res = {} as Response & {
    statusCode?: number;
    body?: unknown;
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response["status"];
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  }) as unknown as Response["json"];
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyToken", () => {
  it("401 when no Authorization header", () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 when header does not start with Bearer", () => {
    const req = {
      headers: { authorization: "Token abc" },
    } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 when token is invalid", () => {
    const req = {
      headers: { authorization: "Bearer garbage" },
    } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and attaches decoded user on valid token", () => {
    const token = jwt.sign(
      { userId: "u1", email: "alice@wsu.edu", role: "user" },
      process.env.JWT_SECRET!,
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({
      userId: "u1",
      email: "alice@wsu.edu",
      role: "user",
    });
  });
});
