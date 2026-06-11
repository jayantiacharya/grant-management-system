import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dbo from "../middleware/conn.js"; // Database connection
import { ObjectId } from "mongodb";
import { verifyToken, AuthRequest } from "../middleware/auth.js";
import { GRANT_STATUS, validateGrantPayload } from "./grantValidation.js";

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

// budgetItems arrives as an array in JSON requests but as a JSON string in
// multipart (file upload) requests; normalize to an array either way.
function parseBudgetItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function isArccMember(userId: string): Promise<boolean> {
  const db_connect = dbo.getDb();
  const arcc = await db_connect
    .collection("arcc")
    .findOne({ key: "committee" });
  const memberIds = Array.isArray(arcc?.memberIds)
    ? arcc.memberIds.map(String)
    : [];
  return memberIds.includes(String(userId));
}

router.post(
  "/submit",
  verifyToken,
  upload,
  async (req: AuthRequest, res: Response) => {
    const { email, userId } = req.user!;
    const {
      projectDirectorId,
      affectsMultipleDepartments,
      usesSubjects,
      budgetItems,
    } = req.body;

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

    const validation = validateGrantPayload({
      body: req.body,
      uploadedFiles,
      irbApprovalFile,
    });
    if (!validation.ok) {
      return res
        .status(validation.status)
        .json({ message: validation.message });
    }
    const { isDraft, normalizedStatus, parsedStudents, parsedDepartmentCount } =
      validation;

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
      title: req.body.title ?? "",
      description: req.body.description ?? "",
      submittedEmail: email,
      projectDirectorId: resolvedDirectorId,
      studentsImpacted: parsedStudents,
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? req.body.irbApproved : null,
      budgetItems: parseBudgetItems(budgetItems),
      files: uploadedFiles,
      irbApprovalFile: irbApprovalFile,
      status: normalizedStatus,
      submittedAt: isDraft ? null : new Date(),
      reviewStatus: isDraft ? null : "pending",
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
router.get("/review", verifyToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;

  try {
    if (!(await isArccMember(userId))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const db_connect = dbo.getDb();
    const grants = await db_connect
      .collection("grant")
      .find({ status: { $ne: GRANT_STATUS.DRAFT } })
      .sort({ submittedAt: -1 })
      .toArray();
    return res.json(grants);
  } catch (err) {
    console.error("Failed to fetch grants for review:", err);
    return res.status(500).json({ message: "Failed to fetch grants" });
  }
});

router.get(
  "/review/:id/files/:savedName",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const { userId } = req.user!;
    const { id, savedName } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    try {
      if (!(await isArccMember(userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const db_connect = dbo.getDb();
      const grant = await db_connect
        .collection("grant")
        .findOne({ _id: new ObjectId(id) });
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }

      const allFiles = [
        ...(Array.isArray(grant.files) ? grant.files : []),
        ...(grant.irbApprovalFile ? [grant.irbApprovalFile] : []),
      ];
      const file = allFiles.find((f) => f.savedName === savedName);
      if (!file || !fs.existsSync(file.path)) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.download(file.path, file.originalName);
    } catch (err) {
      console.error("Failed to download grant file:", err);
      return res.status(500).json({ message: "Failed to download file" });
    }
  },
);

router.get(
  "/review/:id",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const { userId } = req.user!;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    try {
      if (!(await isArccMember(userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const db_connect = dbo.getDb();
      const grant = await db_connect
        .collection("grant")
        .findOne({ _id: new ObjectId(id) });
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }
      return res.json(grant);
    } catch (err) {
      console.error("Failed to fetch grant for review:", err);
      return res.status(500).json({ message: "Failed to fetch grant" });
    }
  },
);

router.put(
  "/review/:id",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const { userId } = req.user!;
    const { id } = req.params;
    const { reviewStatus } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    if (reviewStatus !== "approved" && reviewStatus !== "denied") {
      return res.status(400).json({
        message: "reviewStatus must be approved or denied",
      });
    }

    try {
      if (!(await isArccMember(userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const db_connect = dbo.getDb();
      const result = await db_connect
        .collection("grant")
        .updateOne({ _id: new ObjectId(id) }, { $set: { reviewStatus } });
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Grant not found" });
      }
      return res.json({ reviewStatus });
    } catch (err) {
      console.error("Failed to update review status:", err);
      return res
        .status(500)
        .json({ message: "Failed to update review status" });
    }
  },
);

router.get("/get-grant/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid grant id" });
  }
  const db_connect = dbo.getDb();
  try {
    const grant = await db_connect
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

router.put(
  "/edit/:id",
  verifyToken,
  upload,
  async (req: AuthRequest, res: Response) => {
    const { email, userId } = req.user!;
    const {
      projectDirectorId,
      affectsMultipleDepartments,
      usesSubjects,
      budgetItems,
    } = req.body;

    const db_connect = dbo.getDb();

    const existing = await db_connect
      .collection("grant")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) {
      return res.status(404).json({ message: "Grant not found" });
    }
    if (existing.submittedEmail !== email) {
      return res.status(403).json({
        message: "You do not have permission to edit this proposal.",
      });
    }
    if (existing.status === GRANT_STATUS.SUBMITTED) {
      return res.status(403).json({
        message:
          "This proposal has been submitted and can no longer be edited.",
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

    const validation = validateGrantPayload({
      body: req.body,
      uploadedFiles,
      irbApprovalFile,
      existingFiles: existing.files ?? [],
      existingIrbApprovalFile: existing.irbApprovalFile ?? null,
    });
    if (!validation.ok) {
      return res
        .status(validation.status)
        .json({ message: validation.message });
    }
    const { isDraft, normalizedStatus, parsedStudents, parsedDepartmentCount } =
      validation;

    const resolvedDirectorId = projectDirectorId || userId;

    const directorExists = await db_connect
      .collection("user")
      .findOne({ id: resolvedDirectorId }, { projection: { _id: 1 } });

    if (!directorExists) {
      return res.status(400).json({
        message: "projectDirectorId does not match a known user",
      });
    }

    const update: Record<string, any> = {
      title: req.body.title ?? "",
      description: req.body.description ?? "",
      projectDirectorId: resolvedDirectorId,
      studentsImpacted: parsedStudents,
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? req.body.irbApproved : null,
      budgetItems: parseBudgetItems(budgetItems),
      status: normalizedStatus,
    };
    if (!isDraft) {
      update.submittedAt = new Date();
      update.reviewStatus = "pending";
    }
    if (uploadedFiles.length > 0) {
      update.files = uploadedFiles;
    }

    if (irbApprovalFile) {
      update.irbApprovalFile = irbApprovalFile;
    }

    try {
      await db_connect
        .collection("grant")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

      return res.status(201).json(update);
    } catch (err) {
      console.error("Failed to update grant:", err);
      return res.status(500).json({ message: "Failed to edit grant" });
    }
  },
);

// Get all grants (admin)
router.get("/all", verifyToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Not authorized" });
  }
  const db_connect = dbo.getDb();
  try {
    const grants = await db_connect.collection("grant").find({}).toArray();
    return res.json(grants);
  } catch (err) {
    console.error("Failed to fetch all grants:", err);
    return res.status(500).json({ message: "Failed to fetch grants" });
  }
});

export default router;
