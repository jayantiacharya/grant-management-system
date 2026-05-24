import { Router, Response } from "express";
import dbo from "../middleware/conn.js"; // Database connection
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/submit", verifyToken, async (req: AuthRequest, res: Response) => {
  const { email, userId } = req.user!;
  const { title, description, projectDirectorId, studentsImpacted } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      message: "title and description are required",
    });
  }

  const parsedStudents = Number(studentsImpacted);
  if (!Number.isInteger(parsedStudents) || parsedStudents < 0) {
    return res.status(400).json({
      message: "studentsImpacted must be a non-negative integer",
    });
  }

  const db_connect = dbo.getDb();

  const resolvedDirectorId = projectDirectorId || userId;
  const directorExists = await db_connect
    .collection("user")
    .findOne({ id: resolvedDirectorId }, { projection: { _id: 1 } });
  if (!directorExists) {
    return res.status(400).json({
      message: "projectDirectorId does not match a known user",
    });
  }

  const newGrant = {
    title,
    description,
    submittedEmail: email,
    projectDirectorId: resolvedDirectorId,
    studentsImpacted: parsedStudents,
  };

  try {
    await db_connect.collection("grant").insertOne(newGrant);
    return res.status(201).json(newGrant);
  } catch (err) {
    console.error("Failed to insert grant:", err);
    return res.status(500).json({ message: "Failed to submit grant" });
  }
});

export default router;
