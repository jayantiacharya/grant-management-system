import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

async function getDeanCollege(email: string) {
  const db = dbo.getDb();
  const college = await db.collection("college").findOne({ dean: email });
  return college ?? null;
}

function parseBudgetItems(raw: unknown): any[] {
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

// GET all grants scoped to THIS dean's college
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = dbo.getDb();
    const email = req.user!.email;

    const college = await getDeanCollege(email);
    if (!college) {
      return res
        .status(403)
        .json({ message: "Not authorized — you are not a college dean" });
    }

    const collegeId = college._id.toString();

    const allGrants = await db
      .collection("grant")
      .find({ collegeReviewStatus: { $ne: "N/A" } })
      .sort({ submittedAt: -1 })
      .toArray();

    // Show grants where amountFromCollege > 0 AND either:
    // - collegeId matches this dean's college (new grants)
    // - collegeId is missing/empty (old grants submitted before collegeId was added)
    const grants = allGrants.filter((grant) =>
      parseBudgetItems(grant.budgetItems).some(
        (item: any) =>
          parseFloat(item.amountFromCollege) > 0 &&
          (!item.collegeId || item.collegeId === collegeId),
      ),
    );

    return res.json({ grants, collegeName: college.name });
  } catch (err) {
    console.error("Failed to fetch college grants:", err);
    return res.status(500).json({ message: "Failed to fetch college grants" });
  }
});

// GET single grant by id — must belong to this dean's college
router.get("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    const email = req.user!.email;
    const college = await getDeanCollege(email);
    if (!college) {
      return res
        .status(403)
        .json({ message: "Not authorized — you are not a college dean" });
    }

    const db = dbo.getDb();
    const grant = await db
      .collection("grant")
      .findOne({ _id: new ObjectId(id) });

    if (!grant) {
      return res.status(404).json({ message: "Grant not found" });
    }

    const collegeId = college._id.toString();
    const hasCollegeFunding = parseBudgetItems(grant.budgetItems).some(
      (item: any) =>
        parseFloat(item.amountFromCollege) > 0 &&
        (!item.collegeId || item.collegeId === collegeId),
    );

    if (!hasCollegeFunding) {
      return res.status(403).json({
        message: "Not authorized — grant is not funded by your college",
      });
    }

    return res.json(grant);
  } catch (err) {
    console.error("Failed to fetch grant:", err);
    return res.status(500).json({ message: "Failed to fetch grant" });
  }
});

// PUT approve/deny — scoped to this dean's college, non-draft only
router.put("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { collegeReviewStatus } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid grant id" });
    }

    if (
      collegeReviewStatus !== "approved" &&
      collegeReviewStatus !== "denied"
    ) {
      return res.status(400).json({
        message: "collegeReviewStatus must be approved or denied",
      });
    }

    const email = req.user!.email;
    const college = await getDeanCollege(email);
    if (!college) {
      return res
        .status(403)
        .json({ message: "Not authorized — you are not a college dean" });
    }

    const db = dbo.getDb();
    const grant = await db
      .collection("grant")
      .findOne({ _id: new ObjectId(id) });

    if (!grant) {
      return res.status(404).json({ message: "Grant not found" });
    }

    // Guard 1: must not be a draft
    if (grant.status === "draft") {
      return res.status(400).json({ message: "Cannot review a draft grant" });
    }

    // Guard 2: must have college funding from THIS dean's college
    const collegeId = college._id.toString();
    const hasCollegeFunding = parseBudgetItems(grant.budgetItems).some(
      (item: any) =>
        parseFloat(item.amountFromCollege) > 0 &&
        (!item.collegeId || item.collegeId === collegeId),
    );

    if (!hasCollegeFunding) {
      return res.status(403).json({
        message: "Not authorized — grant is not funded by your college",
      });
    }

    const result = await db.collection("grant").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          collegeReviewStatus,
          collegeReviewedBy: email,
          collegeReviewedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Grant not found" });
    }

    return res.json({ collegeReviewStatus });
  } catch (err) {
    console.error("Failed to update college review status:", err);
    return res
      .status(500)
      .json({ message: "Failed to update college review status" });
  }
});

export default router;
