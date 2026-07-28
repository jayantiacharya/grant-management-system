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

  // Trim and validate first name
  const firstNameT = typeof firstName === "string" ? firstName.trim() : "";
  const lastNameT = typeof lastName === "string" ? lastName.trim() : "";

  // Validate required fields
  if (
    !email ||
    !password ||
    !confirmPassword ||
    !firstNameT ||
    !lastNameT ||
    !birthday
  ) {
    res.status(400).json({ message: "All required fields must be completed" });
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

  // Validate birthday format and range
  const dob = new Date(birthday);
  const now = new Date();
  if (
    Number.isNaN(dob.getTime()) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
    dob > now ||
    dob < new Date("1900-01-01")
  ) {
    res.status(400).json({ message: "Invalid birthday" });
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
    firstName: firstNameT,
    lastName: lastNameT,
    birthday: new Date(birthday), // Store as Date object
    department: department || "",
    college: college || "",
    role: "user" as const,
    createdAt: new Date().toISOString(),
  };

  await db_connect.collection("user").insertOne(newUser);

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" },
  );

  // Include all user fields in the response
  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      birthday: newUser.birthday,
      college: newUser.college,
      department: newUser.department,
    },
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

  // Check if this user is a college dean
  const deanCollege = await db_connect
    .collection("college")
    .findOne({ dean: user.email });

  // Include all user fields in login response too for consistency
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      birthday: user.birthday,
      college: user.college,
      department: user.department,
      accountNumber: user.accountNumber,
      isDean: !!deanCollege,
    },
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

    // Return birthday as ISO string for consistent formatting
    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        college: user.college,
        accountNumber: user.accountNumber,
        birthday:
          user.birthday instanceof Date
            ? user.birthday.toISOString().split("T")[0]
            : user.birthday,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

router.route("/update-user").post(async (req: Request, res: Response) => {
  const {
    userId,
    firstName,
    lastName,
    email,
    password,
    department,
    college,
    accountNumber,
  } = req.body;

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

  // Trim names when updating
  if (firstName) {
    const firstNameT = typeof firstName === "string" ? firstName.trim() : "";
    if (firstNameT) updateData.firstName = firstNameT;
  }
  if (lastName) {
    const lastNameT = typeof lastName === "string" ? lastName.trim() : "";
    if (lastNameT) updateData.lastName = lastNameT;
  }
  if (email) updateData.email = email.toLowerCase();
  if (department) updateData.department = department;
  if (college) updateData.college = college;
  if (accountNumber) updateData.accountNumber = accountNumber.trim();
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
