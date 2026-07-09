import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";
import { GRANT_APPROVAL_STATUS } from "./grantValidation.js";

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
  limits: { files: 1 },
}).single("file");

// Allocation finalize writes allocatedAmount; amountAwarded is the legacy field
// some older grant docs still carry.
function getAwardedAmount(grant: any): number | null {
  const amount = Number(grant.allocatedAmount ?? grant.amountAwarded);
  return Number.isFinite(amount) ? amount : null;
}

function isGrantApproved(grant: any): boolean {
  const deptApproved =
    grant.departmentReviewStatus === GRANT_APPROVAL_STATUS.APPROVED;
  const collegeOk =
    grant.collegeReviewStatus === GRANT_APPROVAL_STATUS.APPROVED ||
    grant.collegeReviewStatus === "N/A";
  return deptApproved && collegeOk && (getAwardedAmount(grant) ?? 0) > 0;
}

// GET all of the current user's approved grants, with amountAwarded
// and the date of their most recently submitted report (if any)
router.get(
  "/approved",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const db_connect = dbo.getDb();
      const email = req.user!.email;

      const allGrants = await db_connect
        .collection("grant")
        .find({ submittedEmail: email })
        .sort({ submittedAt: -1 })
        .toArray();

      const approvedGrants = allGrants.filter(isGrantApproved).map((grant) => {
        const reports = Array.isArray(grant.reports) ? grant.reports : [];
        const lastReport =
          reports.length > 0 ? reports[reports.length - 1] : null;
        return {
          _id: grant._id,
          title: grant.title,
          amountAwarded: getAwardedAmount(grant),
          lastReportDate: lastReport?.submittedAt ?? null,
          reportCount: reports.length,
        };
      });

      return res.json(approvedGrants);
    } catch (err) {
      console.error("Failed to fetch approved grants:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch approved grants" });
    }
  },
);

// GET single approved grant to auto-populate the report form
router.get("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    const db_connect = dbo.getDb();
    const grant = await db_connect
      .collection("grant")
      .findOne({ _id: new ObjectId(id) });

    if (!grant) {
      return res.status(404).json({ message: "Grant not found" });
    }

    if (grant.submittedEmail !== req.user!.email) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!isGrantApproved(grant)) {
      return res.status(403).json({ message: "Grant is not approved" });
    }

    return res.json({
      _id: grant._id,
      title: grant.title,
      amountAwarded: getAwardedAmount(grant),
      reports: Array.isArray(grant.reports) ? grant.reports : [],
    });
  } catch (err) {
    console.error("Failed to fetch grant:", err);
    return res.status(500).json({ message: "Failed to fetch grant" });
  }
});

// POST a new report against an approved grant
router.post(
  "/:id/submit",
  verifyToken,
  upload,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid grant id" });
      }

      const { reportText, currentProgress, nextSteps } = req.body;

      if (
        typeof reportText !== "string" ||
        !reportText.trim() ||
        typeof currentProgress !== "string" ||
        !currentProgress.trim() ||
        typeof nextSteps !== "string" ||
        !nextSteps.trim()
      ) {
        return res.status(400).json({
          message: "reportText, currentProgress, and nextSteps are required",
        });
      }

      const db_connect = dbo.getDb();
      const grant = await db_connect
        .collection("grant")
        .findOne({ _id: new ObjectId(id) });

      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }

      if (grant.submittedEmail !== req.user!.email) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (!isGrantApproved(grant)) {
        return res
          .status(403)
          .json({ message: "Reports can only be filed for approved grants" });
      }

      const file = req.file
        ? {
            originalName: req.file.originalname,
            savedName: req.file.filename,
            path: req.file.path,
          }
        : null;

      const reportEntry = {
        reportText: reportText.trim(),
        currentProgress: currentProgress.trim(),
        nextSteps: nextSteps.trim(),
        file,
        submittedAt: new Date(),
      };

      const existingReports = Array.isArray(grant.reports) ? grant.reports : [];

      await db_connect
        .collection("grant")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { reports: [...existingReports, reportEntry] } },
        );

      return res.status(201).json(reportEntry);
    } catch (err) {
      console.error("Failed to submit report:", err);
      return res.status(500).json({ message: "Failed to submit report" });
    }
  },
);

// GET a report's uploaded file
router.get(
  "/:id/files/:savedName",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, savedName } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid grant id" });
      }

      const db_connect = dbo.getDb();
      const grant = await db_connect
        .collection("grant")
        .findOne({ _id: new ObjectId(id) });

      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }

      if (grant.submittedEmail !== req.user!.email) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const reports = Array.isArray(grant.reports) ? grant.reports : [];
      const file = reports
        .map((r: any) => r.file)
        .find((f: any) => f && f.savedName === savedName);

      if (!file || !fs.existsSync(file.path)) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.download(file.path, file.originalName);
    } catch (err) {
      console.error("Failed to download report file:", err);
      return res.status(500).json({ message: "Failed to download file" });
    }
  },
);

export default router;
