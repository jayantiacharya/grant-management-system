import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dbo from "../middleware/conn.js"; // Database connection
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
  limits: { files: 4 }, // 4 regular files + 1 IRB approval file
}).fields([
  { name: "files", maxCount: 3 },
  { name: "irbApprovalFile", maxCount: 1 },
]);

router.post(
  "/submit",
  verifyToken,
  upload,
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

    const filesRecord = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const uploadedFiles = (filesRecord?.files ?? []).map((file) => ({
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
    }));

    const irbApprovalFile = filesRecord?.irbApprovalFile?.[0]
      ? {
          originalName: filesRecord.irbApprovalFile[0].originalname,
          savedName: filesRecord.irbApprovalFile[0].filename,
          path: filesRecord.irbApprovalFile[0].path,
        }
      : null;

    if (usesSubjects === "yes" && uploadedFiles.length === 0) {
      return res.status(400).json({
        message: "file upload is required when usesSubjects is yes",
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
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? irbApproved : null,
      files: uploadedFiles,
      irbApprovalFile: irbApprovalFile,
      submittedAt: new Date(),
    };

    try {
      await db_connect.collection("grant").insertOne(newGrant);
      return res.status(201).json(newGrant);
    } catch (err) {
      console.error("Failed to insert grant:", err);
      return res.status(500).json({ message: "Failed to submit grant" });
    }
  },
);
router.get("/user-grants/:email", async (req: AuthRequest, res: Response) => {
  const { email } = req.params;
  const db_connect = dbo.getDb();
  try {
    const grants = await db_connect
      .collection("grant")
      .find({ submittedEmail: email })
      .toArray();
    return res.json(grants);
  } catch (err) {
    console.error("Failed to fetch grants:", err);
    return res.status(500).json({ message: "Failed to fetch grants" });
  }
});
router.get("/get-grant/:id", async (req, res) => {
  const { id } = req.params;
  const db_connect = dbo.getDb();
  const grant = await db_connect
    .collection("grant")
    .findOne({ _id: new ObjectId(id) });
  if (!grant) {
    return res.status(404).json({ message: "Grant not found" });
  }
  return res.json(grant);
});
router.put(
  "/edit/:id",
  verifyToken,
  upload,
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

    const filesRecord = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const uploadedFiles = (filesRecord?.files ?? []).map((file) => ({
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
    }));

    const irbApprovalFile = filesRecord?.irbApprovalFile?.[0]
      ? {
          originalName: filesRecord.irbApprovalFile[0].originalname,
          savedName: filesRecord.irbApprovalFile[0].filename,
          path: filesRecord.irbApprovalFile[0].path,
        }
      : null;

    if (usesSubjects === "yes" && uploadedFiles.length === 0) {
      return res.status(400).json({
        message: "file upload is required when usesSubjects is yes",
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

    const editedGrant = {
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
      irbApprovalFile: irbApprovalFile,
      submittedAt: new Date(),
    };

    try {
      await db_connect
        .collection("grant")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: editedGrant });
      return res.status(201).json(editedGrant);
    } catch (err) {
      console.error("Failed to update grant:", err);
      return res.status(500).json({ message: "Failed to edit grant" });
    }
  },
);

export default router;
