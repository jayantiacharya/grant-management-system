import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readDB, writeDB } from "../db.js";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password || !confirmPassword) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ message: "Passwords do not match" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }
  const db = readDB();
  const existing = db.users.find((u) => u.email === email.toLowerCase());
  if (existing) {
    res.status(409).json({ message: "Email already in use" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    password: passwordHash,
    role: "user" as const,
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDB(db);
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" },
  );
  res.status(201).json({
    token,
    user: { id: newUser.id, email: newUser.email, role: newUser.role },
  });
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }
  const db = readDB();
  const user = db.users.find((u) => u.email === email.toLowerCase());
  if (!user) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" },
  );
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

export default router;
