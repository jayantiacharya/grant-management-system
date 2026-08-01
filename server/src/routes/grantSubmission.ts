import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dbo from "../middleware/conn.js";
import { ObjectId } from "mongodb";
import { verifyToken, AuthRequest } from "../middleware/auth.js";
import {
  GRANT_STATUS,
  GRANT_APPROVAL_STATUS,
  parseBudgetItems,
  validateGrantPayload,
  validateAcknowledgements,
} from "./grantValidation.js";

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
  limits: { files: 4 },
}).fields([
  { name: "files", maxCount: 3 },
  { name: "irbApprovalFile", maxCount: 1 },
]);

async function isDeptChair(userEmail: string): Promise<boolean> {
  const db_connect = dbo.getDb();
  const department = await db_connect
    .collection("department")
    .findOne({ chair: userEmail });
  return !!department;
}

function hasCollegeFundingRequest(budgetItems: unknown[]): boolean {
  return budgetItems.some((item: any) => {
    const amount = parseFloat(item?.amountFromCollege) || 0;
    return amount > 0;
  });
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

type CriteriaDoc = {
  _id: ObjectId;
  maxScore: number;
  ratingSuggestions?: { score: number }[];
};

function validateReviewScores(
  scores: unknown,
  criteria: CriteriaDoc[],
): scores is Record<string, number> {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    return false;
  }

  if (!criteria.some((c) => (c.ratingSuggestions ?? []).length > 0)) {
    return false;
  }

  const scoreRecord = scores as Record<string, unknown>;

  for (const criterion of criteria) {
    const allowedScores = (criterion.ratingSuggestions ?? []).map(
      (suggestion) => suggestion.score,
    );
    if (allowedScores.length === 0) continue;

    const criteriaId = criterion._id.toString();
    const selectedScore = scoreRecord[criteriaId];

    if (selectedScore === undefined || selectedScore === null) {
      return false;
    }

    if (typeof selectedScore !== "number" || !Number.isFinite(selectedScore)) {
      return false;
    }

    if (!allowedScores.includes(selectedScore)) {
      return false;
    }
  }

  for (const key of Object.keys(scoreRecord)) {
    const criterion = criteria.find((c) => c._id.toString() === key);
    if (!criterion || (criterion.ratingSuggestions ?? []).length === 0) {
      return false;
    }
  }

  return true;
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
      timeline,
      educationalImpact,
      evaluationPlan,
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

    const parsedBudgetItems = parseBudgetItems(budgetItems);

    const validation = validateGrantPayload({
      body: req.body,
      parsedBudgetItems,
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

    let signature = "";
    const db_connect = dbo.getDb();

    if (!isDraft) {
      const userProfile = await db_connect.collection("user").findOne({
        email: email.toLowerCase(),
      });
      const hasCollege = Boolean(
        userProfile?.college && String(userProfile.college).trim(),
      );
      const hasDepartment = Boolean(
        userProfile?.department && String(userProfile.department).trim(),
      );

      if (!hasCollege || !hasDepartment) {
        return res.status(400).json({
          message:
            "You must have both a department and college assigned before submitting a grant.",
        });
      }
      const ackValidation = validateAcknowledgements(req.body);
      if (!ackValidation.ok) {
        return res
          .status(ackValidation.status)
          .json({ message: ackValidation.message });
      }
      signature = ackValidation.signature;
    }

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
      accountNumber:
        typeof req.body.accountNumber === "string"
          ? req.body.accountNumber.trim()
          : "",
      studentsImpacted: parsedStudents,
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? req.body.irbApproved : null,
      timeline: timeline ?? "",
      educationalImpact: educationalImpact ?? "",
      evaluationPlan: evaluationPlan ?? "",
      budgetItems: parsedBudgetItems,
      files: uploadedFiles,
      irbApprovalFile: irbApprovalFile,
      status: normalizedStatus,
      submittedAt: isDraft ? null : new Date(),
      departmentReviewStatus: GRANT_APPROVAL_STATUS.PENDING,
      departmentReviewedAt: null,
      collegeReviewStatus: hasCollegeFundingRequest(parsedBudgetItems)
        ? GRANT_APPROVAL_STATUS.PENDING
        : "N/A",
      collegeReviewedAt: null,
      reviewStatus: isDraft ? null : "pending",
      hasMatchingFunds:
        req.body.hasMatchingFunds === "true" ||
        req.body.hasMatchingFunds === true,
      matchingFundsTotal: req.body.matchingFundsTotal
        ? parseFloat(req.body.matchingFundsTotal)
        : 0,
      acknowledgements: {
        acknowledgement1:
          req.body.acknowledgement1 === true ||
          req.body.acknowledgement1 === "true",
        acknowledgement2:
          req.body.acknowledgement2 === true ||
          req.body.acknowledgement2 === "true",
        acknowledgement3:
          req.body.acknowledgement3 === true ||
          req.body.acknowledgement3 === "true",
        acknowledgement4:
          req.body.acknowledgement4 === true ||
          req.body.acknowledgement4 === "true",
      },
      signature: isDraft
        ? typeof req.body.signature === "string"
          ? req.body.signature.trim()
          : ""
        : signature,
      signedAt: isDraft ? null : new Date(),
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

router.get(
  "/user-grants/:email",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const { email } = req.params;

    if (req.user!.email !== email && req.user!.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

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
  },
);

router.get("/review", verifyToken, async (req: AuthRequest, res: Response) => {
  const { userId, email } = req.user!;

  try {
    if (
      !(await isArccMember(userId)) &&
      !(await isDeptChair(req.user!.email))
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const db_connect = dbo.getDb();
    const grants = await db_connect
      .collection("grant")
      .find({
        status: { $ne: GRANT_STATUS.DRAFT },
        submittedEmail: { $ne: email },
      })
      .sort({ submittedAt: -1 })
      .toArray();
    return res.json(grants);
  } catch (err) {
    console.error("Failed to fetch grants for review:", err);
    return res.status(500).json({ message: "Failed to fetch grants" });
  }
});

router.get(
  "/review/department",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userEmail = req.user!.email;

    try {
      const db_connect = dbo.getDb();

      const department = await db_connect
        .collection("department")
        .findOne({ chair: userEmail });

      if (!department) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const usersInDept = await db_connect
        .collection("user")
        .find({ department: department.name })
        .toArray();

      const userEmails = usersInDept.map((u) => u.email);

      const grants = await db_connect
        .collection("grant")
        .find({
          submittedEmail: { $in: userEmails },
          status: { $ne: GRANT_STATUS.DRAFT },
        })
        .sort({ submittedAt: -1 })
        .toArray();

      return res.json(grants);
    } catch (err) {
      console.error("Failed to fetch department grants for review:", err);
      return res.status(500).json({ message: "Failed to fetch grants" });
    }
  },
);

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
      if (
        !(await isArccMember(userId)) &&
        !(await isDeptChair(req.user!.email))
      ) {
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
      if (
        !(await isArccMember(userId)) &&
        !(await isDeptChair(req.user!.email))
      ) {
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
    const { scores, comments } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    if (typeof comments !== "string") {
      return res.status(400).json({ message: "comments must be a string" });
    }

    try {
      if (
        !(await isArccMember(userId)) &&
        !(await isDeptChair(req.user!.email))
      ) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const db_connect = dbo.getDb();
      const criteria = (await db_connect
        .collection("criteria")
        .find({})
        .toArray()) as CriteriaDoc[];

      if (!criteria.some((c) => (c.ratingSuggestions ?? []).length > 0)) {
        return res.status(400).json({
          message: "No scorable review criteria configured",
        });
      }

      if (!validateReviewScores(scores, criteria)) {
        return res.status(400).json({
          message:
            "scores must include one valid rating for each scorable criterion",
        });
      }

      const grant = await db_connect
        .collection("grant")
        .findOne({ _id: new ObjectId(id) });
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }

      const reviewEntry = {
        reviewerId: String(userId),
        scores,
        comments: comments.trim(),
        submittedAt: new Date(),
      };

      const existingReviews = Array.isArray(grant.reviews) ? grant.reviews : [];
      const existingIndex = existingReviews.findIndex(
        (review: { reviewerId?: string }) =>
          String(review.reviewerId) === String(userId),
      );

      const updatedReviews =
        existingIndex >= 0
          ? existingReviews.map((review: unknown, index: number) =>
              index === existingIndex ? reviewEntry : review,
            )
          : [...existingReviews, reviewEntry];

      const result = await db_connect
        .collection("grant")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { reviews: updatedReviews } },
        );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Grant not found" });
      }

      return res.json(reviewEntry);
    } catch (err) {
      console.error("Failed to submit grant review:", err);
      return res.status(500).json({ message: "Failed to submit grant review" });
    }
  },
);
router.put(
  "/review/approval/:id",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const { userId } = req.user!;
    const { id } = req.params;
    const { departmentReviewStatus } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    if (
      departmentReviewStatus !== "approved" &&
      departmentReviewStatus !== "denied"
    ) {
      return res.status(400).json({
        message: "departmentReviewStatus must be approved or denied",
      });
    }

    try {
      if (
        !(await isArccMember(userId)) &&
        !(await isDeptChair(req.user!.email))
      ) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const db_connect = dbo.getDb();
      const reviewedAt = new Date();
      const result = await db_connect.collection("grant").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { departmentReviewStatus, departmentReviewedAt: reviewedAt },
        },
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Grant not found" });
      }
      return res.json({
        departmentReviewStatus,
        departmentReviewedAt: reviewedAt,
      });
    } catch (err) {
      console.error("Failed to update departmentreview status:", err);
      return res
        .status(500)
        .json({ message: "Failed to update department review status" });
    }
  },
);
router.get(
  "/get-grant/:id",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
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
      if (
        grant.submittedEmail !== req.user!.email &&
        req.user!.role !== "admin"
      ) {
        return res.status(403).json({ message: "Not authorized" });
      }
      return res.json(grant);
    } catch (err) {
      console.error("Failed to fetch grant:", err);
      return res.status(500).json({ message: "Failed to fetch grant" });
    }
  },
);

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
      timeline,
      educationalImpact,
      evaluationPlan,
    } = req.body;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

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

    const parsedBudgetItems = parseBudgetItems(budgetItems);

    const validation = validateGrantPayload({
      body: req.body,
      parsedBudgetItems,
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

    let signature = "";
    if (!isDraft) {
      const ackValidation = validateAcknowledgements(req.body);
      if (!ackValidation.ok) {
        return res
          .status(ackValidation.status)
          .json({ message: ackValidation.message });
      }
      signature = ackValidation.signature;
    }

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
      accountNumber:
        typeof req.body.accountNumber === "string"
          ? req.body.accountNumber.trim()
          : "",
      studentsImpacted: parsedStudents,
      affectsMultipleDepartments: affectsMultipleDepartments ?? null,
      departmentCount: parsedDepartmentCount,
      usesSubjects: usesSubjects ?? null,
      irbApproved: usesSubjects === "yes" ? req.body.irbApproved : null,
      timeline: timeline ?? "",
      educationalImpact: educationalImpact ?? "",
      evaluationPlan: evaluationPlan ?? "",
      budgetItems: parsedBudgetItems,
      collegeReviewStatus: hasCollegeFundingRequest(parsedBudgetItems)
        ? GRANT_APPROVAL_STATUS.PENDING
        : "N/A",
      status: normalizedStatus,
      hasMatchingFunds:
        req.body.hasMatchingFunds === "true" ||
        req.body.hasMatchingFunds === true,
      matchingFundsTotal: req.body.matchingFundsTotal
        ? parseFloat(req.body.matchingFundsTotal)
        : 0,
      acknowledgements: {
        acknowledgement1:
          req.body.acknowledgement1 === true ||
          req.body.acknowledgement1 === "true",
        acknowledgement2:
          req.body.acknowledgement2 === true ||
          req.body.acknowledgement2 === "true",
        acknowledgement3:
          req.body.acknowledgement3 === true ||
          req.body.acknowledgement3 === "true",
        acknowledgement4:
          req.body.acknowledgement4 === true ||
          req.body.acknowledgement4 === "true",
      },
      signature: isDraft
        ? typeof req.body.signature === "string"
          ? req.body.signature.trim()
          : ""
        : signature,
      signedAt: isDraft ? null : new Date(),
    };
    if (!isDraft) {
      update.submittedAt = new Date();
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
