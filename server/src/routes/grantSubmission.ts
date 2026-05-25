import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dbo from "../middleware/conn.js"; // Database connection
// import { readDB, writeDB } from "../db.js";

const router = Router();

const uploadFolder = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 3,
  },
});

router.post("/submit", upload.array("files", 3), async (req: Request, res: Response) => {
  try {
    let db_connect = dbo.getDb();

    const {
      title,
      description,
      submittedEmail,
      affectsMultipleDepartments,
      departmentCount,
      usesSubjects,
      irbApproved,
    } = req.body;

    const uploadedFiles =
      (req.files as Express.Multer.File[] | undefined)?.map((file) => ({
        originalName: file.originalname,
        savedName: file.filename,
        path: file.path,
      })) || [];

    const newGrant = {
      title,
      description,
      submittedEmail: submittedEmail,
      affectsMultipleDepartments,
      departmentCount,
      usesSubjects,
      irbApproved,
      files: uploadedFiles,
      submittedAt: new Date(),
    };

    await db_connect.collection("grant").insertOne(newGrant);

    res.status(201).json(newGrant);
  } catch (error) {
    res.status(500).json({ message: "Failed to submit grant proposal." });
  }
});

export default router;
