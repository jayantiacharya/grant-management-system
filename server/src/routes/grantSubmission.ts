import { Router, Request, Response } from "express";
import dbo from "../middleware/conn.js"; // Database connection

const router = Router();
router.post("/submit", async (req: Request, res: Response) => {
  const db_connect = dbo.getDb();
  const {
    title,
    description,
    submittedEmail,
    projectDirectorId,
    studentsImpacted,
  } = req.body;

  if (!title || !description || !projectDirectorId) {
    return res.status(400).json({
      message: "title, description, and projectDirectorId are required",
    });
  }

  const newGrant = {
    title,
    description,
    submittedEmail: submittedEmail,
    projectDirectorId,
    studentsImpacted: Number(studentsImpacted) || 0,
  };
  await db_connect.collection("grant").insertOne(newGrant);
  res.status(201).json(newGrant);
});

export default router;
