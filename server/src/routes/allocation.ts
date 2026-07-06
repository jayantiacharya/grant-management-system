import { Router } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

type AllocationCriterion = {
  fromPercentage: number;
  toPercentage: number;
  awardPercentage: number;
};

type ReviewSummary = {
  totalScore: number;
  totalPossibleScore: number;
};

const DEFAULT_CURRENT_CYCLE_AMOUNT = 50000;
const DEFAULT_CUTOFF_PERCENTAGE = 75;

const DEFAULT_CRITERIA: AllocationCriterion[] = [
  { fromPercentage: 90, toPercentage: 100, awardPercentage: 100 },
  { fromPercentage: 80, toPercentage: 89.99, awardPercentage: 75 },
  { fromPercentage: 75, toPercentage: 79.99, awardPercentage: 50 },
];

router.use(verifyToken as any);

function isARCCChair(req: AuthRequest) {
  const role = req.user?.role?.toLowerCase();

  return (
    role === "admin" ||
    role === "arcc" ||
    role === "arccchair" ||
    role === "arcc-chair" ||
    role === "arcc_chair" ||
    role === "committeechair"
  );
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function numberValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getGrantId(grant: any) {
  return grant._id?.toString() ?? grant.id?.toString() ?? "";
}

function getBudgetItems(grant: any) {
  return Array.isArray(grant.budgetItems) ? grant.budgetItems : [];
}

function sumBudgetField(grant: any, keys: string[]) {
  return getBudgetItems(grant).reduce((sum: number, item: any) => {
    for (const key of keys) {
      if (item?.[key] !== undefined && item?.[key] !== "") {
        return sum + numberValue(item[key]);
      }
    }

    return sum;
  }, 0);
}

function getArccRequested(grant: any) {
  const directAmount = numberValue(
    grant.arccAmountRequested ??
      grant.amountFromARCC ??
      grant.amountRequestedFromARCC,
  );

  if (directAmount > 0) return directAmount;

  return sumBudgetField(grant, ["arcc", "amountFromARCC", "arccAmount"]);
}

function getOtherSourcesAmount(grant: any) {
  const directAmount = numberValue(
    grant.otherSourcesAmount ??
      grant.otherSources ??
      grant.amountFromOtherSources,
  );

  if (directAmount > 0) return directAmount;

  return sumBudgetField(grant, ["other", "amountFromOtherSources"]);
}

function getEmbeddedReviews(grant: any) {
  if (Array.isArray(grant.reviews)) return grant.reviews;
  if (Array.isArray(grant.reviewScores)) return grant.reviewScores;
  if (Array.isArray(grant.committeeReviews)) return grant.committeeReviews;
  return [];
}

function getReviewScore(review: any) {
  if (!review || typeof review !== "object") return 0;

  if (review.score !== undefined) return numberValue(review.score);
  if (review.totalScore !== undefined) return numberValue(review.totalScore);
  if (review.pointsReceived !== undefined) {
    return numberValue(review.pointsReceived);
  }

  if (review.scores && typeof review.scores === "object") {
    return Object.values(review.scores).reduce(
      (sum: number, score: any) => sum + numberValue(score),
      0,
    );
  }

  if (Array.isArray(review.criteriaScores)) {
    return review.criteriaScores.reduce(
      (sum: number, item: any) =>
        sum + numberValue(item.score ?? item.points ?? item.value),
      0,
    );
  }

  return 0;
}

function getReviewPossible(review: any, score: number) {
  if (!review || typeof review !== "object") return score > 0 ? score : 0;

  if (review.totalPossible !== undefined) {
    return numberValue(review.totalPossible);
  }

  if (review.totalPossiblePoints !== undefined) {
    return numberValue(review.totalPossiblePoints);
  }

  if (review.maxScore !== undefined) return numberValue(review.maxScore);

  if (review.scores && typeof review.scores === "object") {
    const values = Object.values(review.scores).map(numberValue);
    const total = values.reduce((sum, value) => sum + value, 0);

    return total > 0 ? 80 : 0;
  }

  if (Array.isArray(review.criteriaScores)) {
    const possible = review.criteriaScores.reduce(
      (sum: number, item: any) =>
        sum + numberValue(item.maxScore ?? item.maximumScore ?? item.possible),
      0,
    );

    if (possible > 0) return possible;
  }

  return score > 0 ? score : 0;
}

function calculateReviewSummary(grant: any) {
  const reviews: any[] = getEmbeddedReviews(grant);

  const summary = reviews.reduce(
    (acc: ReviewSummary, review: any) => {
      const score = getReviewScore(review);
      const possible = getReviewPossible(review, score);

      acc.totalScore += score;
      acc.totalPossibleScore += possible;

      return acc;
    },
    {
      totalScore: 0,
      totalPossibleScore: 0,
    },
  );

  const savedPercent = numberValue(
    grant.finalPercent ??
      grant.finalRatingPercentage ??
      grant.finalRating ??
      grant.ratingPercentage,
  );

  const finalPercent =
    summary.totalPossibleScore > 0
      ? Math.round((summary.totalScore / summary.totalPossibleScore) * 1000) /
        10
      : savedPercent;

  return {
    reviewCount: reviews.length,
    totalScore: summary.totalScore,
    totalPossibleScore: summary.totalPossibleScore,
    finalPercent,
  };
}

function normalizeStatus(status: unknown) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isRejectedStatus(status: unknown) {
  const value = normalizeStatus(status);

  return (
    value === "denied" ||
    value === "rejected" ||
    value === "declined" ||
    value === "not approved"
  );
}

function isPendingStatus(status: unknown) {
  const value = normalizeStatus(status);

  return (
    value === "" ||
    value === "pending" ||
    value === "submitted" ||
    value === "in progress" ||
    value === "draft"
  );
}

function getAllocationStatus(
  grant: any,
  reviewCount: number,
  allocatedAmount: number,
  arccAmountRequested: number,
) {
  if (
    isRejectedStatus(grant.departmentReviewStatus) ||
    isRejectedStatus(grant.collegeReviewStatus) ||
    isRejectedStatus(grant.arccReviewStatus) ||
    isRejectedStatus(grant.reviewStatus) ||
    isRejectedStatus(grant.approvalStatus)
  ) {
    return "Rejected";
  }

  if (
    isPendingStatus(grant.departmentReviewStatus) ||
    isPendingStatus(grant.collegeReviewStatus) ||
    isPendingStatus(grant.arccReviewStatus) ||
    reviewCount === 0
  ) {
    return "Pending Review";
  }

  if (allocatedAmount > 0) {
    return allocatedAmount >= arccAmountRequested
      ? "Approved (Full)"
      : "Approved (Partial)";
  }

  return "Rejected";
}

function getAwardPercentage(
  finalPercent: number,
  criteria: AllocationCriterion[],
) {
  const match = criteria.find(
    (rule) =>
      finalPercent >= Number(rule.fromPercentage) &&
      finalPercent <= Number(rule.toPercentage),
  );

  return match ? numberValue(match.awardPercentage) : 0;
}

function buildGrantAllocation(grant: any, criteria: AllocationCriterion[]) {
  const reviewSummary = calculateReviewSummary(grant);
  const arccAmountRequested = getArccRequested(grant);
  const otherSourcesAmount = getOtherSourcesAmount(grant);
  const awardPercentage = getAwardPercentage(
    reviewSummary.finalPercent,
    criteria,
  );

  const allocatedAmount = Math.round(
    arccAmountRequested * (awardPercentage / 100),
  );

  return {
    id: getGrantId(grant),
    title: grant.title ?? grant.grantTitle ?? "Untitled Grant",
    submittedBy: grant.submittedEmail ?? grant.submittedBy ?? "Not listed",
    principalInvestigator:
      grant.projectDirectorId ??
      grant.projectDirector ??
      grant.principalInvestigator ??
      "N/A",
    accountNumber: grant.accountNumber ?? "N/A",
    arccAmountRequested,
    otherSourcesAmount,
    finalPercent: reviewSummary.finalPercent,
    allocatedAmount,
    status: getAllocationStatus(
      grant,
      reviewSummary.reviewCount,
      allocatedAmount,
      arccAmountRequested,
    ),
    reviewCount: reviewSummary.reviewCount,
    totalScore: reviewSummary.totalScore,
    totalPossibleScore: reviewSummary.totalPossibleScore,
  };
}

async function getAllocationSettings(db: any) {
  const saved = await db
    .collection("allocationSettings")
    .findOne({ key: "current" });

  return {
    currentCycleAmount:
      saved?.currentCycleAmount ?? DEFAULT_CURRENT_CYCLE_AMOUNT,
    cutoffPercentage: saved?.cutoffPercentage ?? DEFAULT_CUTOFF_PERCENTAGE,
    criteria: Array.isArray(saved?.criteria)
      ? saved.criteria
      : DEFAULT_CRITERIA,
    finalized: Boolean(saved?.finalized),
    finalizedAt: saved?.finalizedAt ?? null,
  };
}

function calculateSummary(grants: any[], currentCycleAmount: number) {
  const totalAllocated = grants.reduce(
    (sum, grant) => sum + numberValue(grant.allocatedAmount),
    0,
  );

  const totalRequested = grants.reduce(
    (sum, grant) => sum + numberValue(grant.arccAmountRequested),
    0,
  );

  const leftoverAmount = currentCycleAmount - totalAllocated;
  const overAllocated = totalAllocated > currentCycleAmount;
  const shouldDistributeMostFunds = totalRequested >= currentCycleAmount;
  const minimumDistribution = currentCycleAmount * 0.95;
  const underDistributed =
    shouldDistributeMostFunds && totalAllocated < minimumDistribution;

  return {
    totalAllocated,
    totalRequested,
    leftoverAmount,
    overAllocated,
    underDistributed,
    minimumDistribution,
  };
}

function getNextReportDueDate() {
  const now = new Date();
  const nextYear = now.getFullYear() + 1;

  return new Date(Date.UTC(nextYear, 5, 30)).toISOString();
}

function getGrantFilter(id: string) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
}

/**
 * GET /api/allocation/grants
 */
router.get("/grants", async (req: AuthRequest, res) => {
  try {
    if (!isARCCChair(req)) {
      return res.status(403).json({ error: "ARCC chair access only" });
    }

    const db = dbo.getDb();
    const settings = await getAllocationSettings(db);

    const rawGrants = await db.collection("grant").find({}).toArray();

    const grants = rawGrants
      .map((grant: any) => buildGrantAllocation(grant, settings.criteria))
      .sort((a, b) => b.finalPercent - a.finalPercent);

    const summary = calculateSummary(grants, settings.currentCycleAmount);

    return res.json({
      grants,
      currentCycleAmount: settings.currentCycleAmount,
      cutoffPercentage: settings.cutoffPercentage,
      criteria: settings.criteria,
      finalized: settings.finalized,
      finalizedAt: settings.finalizedAt,
      ...summary,
    });
  } catch (err) {
    console.error("Allocation error:", err);
    return res.status(500).json({ error: "Allocation fetch failed" });
  }
});

/**
 * POST /api/allocation/finalize
 */
router.post("/finalize", async (req: AuthRequest, res) => {
  try {
    if (!isARCCChair(req)) {
      return res.status(403).json({ error: "ARCC chair access only" });
    }

    const {
      currentCycleAmount,
      cutoffPercentage,
      criteria,
      grants,
      totalAllocated,
      leftoverAmount,
    } = req.body;

    const db = dbo.getDb();
    const safeGrants = Array.isArray(grants) ? grants : [];
    const reportDueDate = getNextReportDueDate();

    await db.collection("allocationSettings").updateOne(
      { key: "current" },
      {
        $set: {
          key: "current",
          currentCycleAmount: numberValue(currentCycleAmount),
          cutoffPercentage: numberValue(cutoffPercentage),
          criteria: Array.isArray(criteria) ? criteria : DEFAULT_CRITERIA,
          finalized: true,
          finalizedAt: new Date().toISOString(),
          totalAllocated: numberValue(totalAllocated),
          leftoverAmount: numberValue(leftoverAmount),
          grants: safeGrants,
        },
      },
      { upsert: true },
    );

    for (const grant of safeGrants) {
      const grantId = String(grant.id ?? "");

      if (!grantId) continue;

      await db.collection("grant").updateOne(getGrantFilter(grantId), {
        $set: {
          allocatedAmount: numberValue(grant.allocatedAmount),
          allocationStatus: grant.status,
          reportDueDate:
            numberValue(grant.allocatedAmount) > 0 ? reportDueDate : null,
        },
      });
    }

    return res.json({ message: "Allocation finalized successfully." });
  } catch (err) {
    console.error("Finalize allocation error:", err);
    return res.status(500).json({ error: "Failed to finalize allocation" });
  }
});

/**
 * POST /api/allocation/send-to-accounting
 */
router.post("/send-to-accounting", async (req: AuthRequest, res) => {
  try {
    if (!isARCCChair(req)) {
      return res.status(403).json({ error: "ARCC chair access only" });
    }

    const db = dbo.getDb();

    const criteria = Array.isArray(req.body.criteria)
      ? req.body.criteria
      : (await getAllocationSettings(db)).criteria;

    const rawGrants = await db.collection("grant").find({}).toArray();

    const grants = rawGrants
      .map((grant: any) => buildGrantAllocation(grant, criteria))
      .filter((grant) => grant.allocatedAmount > 0);

    const header = [
      "Principal Investigator",
      "Grant Name",
      "Accounting Number",
      "Submitted By",
      "ARCC Requested",
      "Other Sources",
      "Final Rating %",
      "Allocated Amount",
      "Status",
    ]
      .map(csvEscape)
      .join(",");

    const rows = grants.map((grant) =>
      [
        csvEscape(grant.principalInvestigator),
        csvEscape(grant.title),
        csvEscape(grant.accountNumber),
        csvEscape(grant.submittedBy),
        csvEscape(grant.arccAmountRequested),
        csvEscape(grant.otherSourcesAmount),
        csvEscape(grant.finalPercent),
        csvEscape(grant.allocatedAmount),
        csvEscape(grant.status),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="arcc-allocation.csv"',
    );

    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    return res.status(500).json({ error: "Export failed" });
  }
});

export default router;
