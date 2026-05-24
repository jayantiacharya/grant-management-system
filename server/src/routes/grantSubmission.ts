import { Router, Request, Response } from "express";
import dbo from "../middleware/conn.js"; // Database connection
// import { readDB, writeDB } from "../db.js";

const router = Router();
router.post("/submit", async (req: Request, res: Response) => {
  let db_connect = dbo.getDb();
  const { title, description, submittedEmail } = req.body;
  const newGrant = {
    title,
    description,
    submittedEmail: submittedEmail,
  };
  await db_connect.collection("grant").insertOne(newGrant);
  res.status(201).json(newGrant);
});

export default router;
