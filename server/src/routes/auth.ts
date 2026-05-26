import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dbo from "../middleware/conn.js"; // Database connection

const router = Router();

router.route("/register").post(async (req: Request, res: Response) => {
  const {
    email,
    password,
    confirmPassword,
    firstName,
    lastName,
    birthday,
    department,
    college,
  } = req.body;

  if (
    !email ||
    !password ||
    !confirmPassword ||
    !firstName ||
    !lastName ||
    !birthday ||
    !department ||
    !college
  ) {
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

  let db_connect = dbo.getDb();
  const existing = await db_connect
    .collection("user")
    .findOne({ email: email.toLowerCase() });

  if (existing) {
    res.status(409).json({ message: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    password: passwordHash,
    firstName,
    lastName,
    birthday,
    department,
    college,
    role: "user" as const,
    createdAt: new Date().toISOString(),
  };

  await db_connect.collection("user").insertOne(newUser);

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

router.route("/login").post(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  let db_connect = dbo.getDb();
  const user = await db_connect
    .collection("user")
    .findOne({ email: email.toLowerCase() });

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

router.route("/get-user/:userId").get(async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    let db_connect = dbo.getDb();
    const user = await db_connect.collection("user").findOne({ id: userId });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        college: user.college,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

router.route("/update-user").post(async (req: Request, res: Response) => {
  const { userId, firstName, lastName, email, password, department, college } =
    req.body;

  if (!userId) {
    res.status(400).json({ message: "User ID is required" });
    return;
  }

  let db_connect = dbo.getDb();
  const user = await db_connect.collection("user").findOne({ id: userId });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const updateData: any = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (email) updateData.email = email.toLowerCase();
  if (department) updateData.department = department;
  if (college) updateData.college = college;

  if (password) {
    if (password.length < 6) {
      res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
      return;
    }
    updateData.password = await bcrypt.hash(password, 12);
  }

  await db_connect
    .collection("user")
    .updateOne({ id: userId }, { $set: updateData });

  res.json({ message: "User updated successfully" });
});

export default router;
