import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dbo from "../middleware/conn.js";
import { ObjectId } from "mongodb";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const uploadFolder = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 3 },
});

// =========================
// CREATE GRANT
// =========================
router.post(
  "/submit",
  verifyToken,
  upload.array("files", 3),
  async (req: AuthRequest, res: Response) => {
    const { email, userId } = req.user!;

    const {
      title,
      description,
      projectDirectorId,
      studentsImpacted,
      affectsMultipleDepartments,
      departmentCount,
      usesSubjects,
      irbApproved,
    } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "title and description are required" });
    }

    const parsedStudents = Number(studentsImpacted);
    if (!Number.isInteger(parsedStudents) || parsedStudents < 0) {
      return res
        .status(400)
        .json({ message: "studentsImpacted must be a non-negative integer" });
    }

    let parsedDepartmentCount: number | null = null;

    if (affectsMultipleDepartments === "yes") {
      parsedDepartmentCount = Number(departmentCount);

      if (
        !Number.isInteger(parsedDepartmentCount) ||
        parsedDepartmentCount < 2
      ) {
        return res.status(400).json({
          message:
            "departmentCount must be an integer >= 2 when affectsMultipleDepartments is yes",
        });
      }
    }

    if (usesSubjects === "yes" && irbApproved !== "yes") {
      return res.status(400).json({
        message: "irbApproved must be yes when usesSubjects is yes",
      });
    }

    const uploadedFiles = (
      (req.files as Express.Multer.File[] | undefined) ?? []
    ).map((file) => ({
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
    }));

    if (usesSubjects === "yes" && uploadedFiles.length === 0) {
      return res.status(400).json({
        message: "file upload is required when usesSubjects is yes",
      });
    }

    const db = dbo.getDb();
    const resolvedDirectorId = projectDirectorId || userId;

    const directorExists = await db
      .collection("user")
      .findOne({ id: resolvedDirectorId });

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
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? irbApproved : null,
      files: uploadedFiles,
      submittedAt: new Date(),
    };

    try {
      await db.collection("grant").insertOne(newGrant);
      return res.status(201).json(newGrant);
    } catch (err) {
      console.error("Failed to insert grant:", err);
      return res.status(500).json({ message: "Failed to submit grant" });
    }
  },
);

// =========================
// GET USER GRANTS
// =========================
router.get("/user-grants/:email", async (req: AuthRequest, res: Response) => {
  const { email } = req.params;

  try {
    const db = dbo.getDb();

    const grants = await db
      .collection("grant")
      .find({ submittedEmail: email })
      .toArray();

    return res.json(grants);
  } catch (err) {
    console.error("Failed to fetch grants:", err);
    return res.status(500).json({ message: "Failed to fetch grants" });
  }
});

// =========================
// GET SINGLE GRANT
// =========================
router.get("/get-grant/:id", async (req, res) => {
  const db = dbo.getDb();
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid grant id" });
  }

  try {
    const grant = await db
      .collection("grant")
      .findOne({ _id: new ObjectId(id) });

    if (!grant) {
      return res.status(404).json({ message: "Grant not found" });
    }

    return res.json(grant);
  } catch (err) {
    console.error("Failed to fetch grant:", err);
    return res.status(500).json({ message: "Failed to fetch grant" });
  }
});

// =========================
// EDIT GRANT (FIXED)
// =========================
router.put(
  "/edit/:id",
  verifyToken,
  upload.array("files", 3),
  async (req: AuthRequest, res: Response) => {
    const { email, userId } = req.user!;

    const {
      title,
      description,
      projectDirectorId,
      studentsImpacted,
      affectsMultipleDepartments,
      departmentCount,
      usesSubjects,
      irbApproved,
    } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "title and description are required" });
    }

    const parsedStudents = Number(studentsImpacted);
    if (!Number.isInteger(parsedStudents) || parsedStudents < 0) {
      return res
        .status(400)
        .json({ message: "studentsImpacted must be a non-negative integer" });
    }

    let parsedDepartmentCount: number | null = null;

    if (affectsMultipleDepartments === "yes") {
      parsedDepartmentCount = Number(departmentCount);

      if (
        !Number.isInteger(parsedDepartmentCount) ||
        parsedDepartmentCount < 2
      ) {
        return res.status(400).json({
          message:
            "departmentCount must be an integer >= 2 when affectsMultipleDepartments is yes",
        });
      }
    }

    if (usesSubjects === "yes" && irbApproved !== "yes") {
      return res.status(400).json({
        message: "irbApproved must be yes when usesSubjects is yes",
      });
    }

    const uploadedFiles = (
      (req.files as Express.Multer.File[] | undefined) ?? []
    ).map((file) => ({
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
    }));

    const db = dbo.getDb();
    const resolvedDirectorId = projectDirectorId || userId;

    const directorExists = await db
      .collection("user")
      .findOne({ id: resolvedDirectorId });

    if (!directorExists) {
      return res.status(400).json({
        message: "projectDirectorId does not match a known user",
      });
    }

    // ✅ FIX: build update object safely
    const editedGrant: Record<string, unknown> = {
      title,
      description,
      submittedEmail: email,
      projectDirectorId: resolvedDirectorId,
      studentsImpacted: parsedStudents,
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? irbApproved : null,
      updatedAt: new Date(),
    };

    // ✅ ONLY overwrite files if new ones are uploaded
    if (uploadedFiles && uploadedFiles.length > 0) {
      editedGrant.files = uploadedFiles;
    }

    try {
      await db
        .collection("grant")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: editedGrant });

      return res.status(200).json(editedGrant);
    } catch (err) {
      console.error("Failed to update grant:", err);
      return res.status(500).json({ message: "Failed to edit grant" });
    }
  },
);

export default router;
