import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const reportUploadDir = path.join(
  process.cwd(),
  "server",
  "uploads",
  "reports",
);

if (!fs.existsSync(reportUploadDir)) {
  fs.mkdirSync(reportUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, reportUploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 1,
  },
});

router.use(verifyToken as any);

function getJune30NextYear() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear() + 1, 5, 30)).toISOString();
}

router.get("/:grantId", async (req: AuthRequest, res) => {
  try {
    const db = dbo.getDb();
    const grant = await db.collection("grant").findOne({
      _id: new ObjectId(req.params.grantId),
    });

    if (!grant) {
      return res.status(404).json({ error: "Grant not found" });
    }

    if (
      grant.submittedEmail !== req.user?.email &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      grantId: grant._id?.toString(),
      grantTitle: grant.title,
      principalInvestigator: grant.projectDirectorId ?? "N/A",
      reportDueDate: grant.reportDueDate ?? getJune30NextYear(),
      awardedAmount: grant.allocatedAmount ?? 0,
      existingReport: grant.report ?? null,
    });
  } catch (err) {
    console.error("Report fetch error:", err);
    return res.status(500).json({ error: "Failed to load report data" });
  }
});

router.post(
  "/:grantId",
  upload.single("receiptFile"),
  async (req: AuthRequest, res) => {
    try {
      const db = dbo.getDb();

      const grant = await db.collection("grant").findOne({
        _id: new ObjectId(req.params.grantId),
      });

      if (!grant) {
        return res.status(404).json({ error: "Grant not found" });
      }

      if (
        grant.submittedEmail !== req.user?.email &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { projectSummary, currentProgress, nextSteps, budgetInformation } =
        req.body;

      if (
        !projectSummary ||
        !currentProgress ||
        !nextSteps ||
        !budgetInformation
      ) {
        return res.status(400).json({
          error: "All report text fields are required.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "One receipt PDF file is required.",
        });
      }

      const report = {
        projectSummary,
        currentProgress,
        nextSteps,
        budgetInformation,
        receiptFile: {
          originalName: req.file.originalname,
          savedName: req.file.filename,
          path: req.file.path,
        },
        submittedBy: req.user?.email,
        submittedAt: new Date().toISOString(),
      };

      await db.collection("grant").updateOne(
        { _id: new ObjectId(req.params.grantId) },
        {
          $set: {
            report,
            reportSubmitted: true,
          },
        },
      );

      return res.json({ message: "Report submitted successfully." });
    } catch (err) {
      console.error("Report submit error:", err);
      return res.status(500).json({ error: "Failed to submit report" });
    }
  },
);

export default router;
