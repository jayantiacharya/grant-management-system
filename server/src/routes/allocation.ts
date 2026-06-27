import { Router } from "express";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

/**
 * =========================
 * HELPERS
 * =========================
 */

// average score safely
function average(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// convert score (1–5) → percentage
function toPercent(score: number, max = 5) {
  return Math.round((score / max) * 100);
}

// strict role check (ONLY valid roles in system)
function isARCCChair(req: AuthRequest) {
  return req.user?.role === "admin";
}

// CSV RFC 4180 safe escape
function csvEscape(value: any) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * =========================
 * AUTH APPLIED TO ALL ROUTES
 * =========================
 */
router.use(verifyToken as any);

/**
 * =========================
 * GET /api/allocation/grants
 * =========================
 * Uses MongoDB (NOT db.json)
 */
router.get("/grants", async (_req: AuthRequest, res) => {
  try {
    const db = dbo.getDb();

    const grants = await db.collection("grants").find({}).toArray();
    const reviews = await db.collection("reviews").find({}).toArray();

    const enriched = grants.map((grant: any) => {
      const relatedReviews = reviews.filter(
        (r: any) =>
          r.grantId === grant._id?.toString() || r.grantId === grant.id,
      );

      const scores = relatedReviews.map((r: any) => Number(r.score || 0));

      const avgRating = average(scores);
      const finalPercent = toPercent(avgRating);
      const totalScore = scores.reduce((a, b) => a + b, 0);

      return {
        id: grant._id?.toString() ?? grant.id,
        title: grant.title,
        submittedBy: grant.submittedEmail,
        principalInvestigator: grant.projectDirectorId ?? "N/A",

        studentsImpacted: grant.studentsImpacted ?? 0,

        arccAmountRequested: grant.arccAmountRequested ?? 0,
        otherSourcesAmount: grant.otherSourcesAmount ?? 0,

        avgRating,
        finalPercent,
        totalScore,
        reviewCount: scores.length,

        currentCycleAmount: grant.currentCycleAmount ?? 0,
        leftoverAmount: grant.leftoverAmount ?? 0,
        cutoffPercentage: grant.cutoffPercentage ?? 0,
      };
    });

    enriched.sort((a, b) => b.finalPercent - a.finalPercent);

    res.json(enriched);
  } catch (err) {
    console.error("Allocation error:", err);
    res.status(500).json({ error: "Allocation fetch failed" });
  }
});

/**
 * =========================
 * POST /api/allocation/send-to-accounting
 * =========================
 * Secure + recomputed from DB
 */
router.post("/send-to-accounting", async (req: AuthRequest, res) => {
  try {
    // chair-only access
    if (!isARCCChair(req)) {
      return res.status(403).json({ error: "Admin access only" });
    }

    const db = dbo.getDb();

    // DO NOT trust client payload → recompute from DB
    const grants = await db.collection("grants").find({}).toArray();
    const reviews = await db.collection("reviews").find({}).toArray();

    const header = [
      "Grant Title",
      "Submitted By",
      "Principal Investigator",
      "ARCC Requested",
      "Other Sources",
      "Final Rating %",
    ]
      .map(csvEscape)
      .join(",");

    const rows = grants.map((g: any) => {
      const relatedReviews = reviews.filter(
        (r: any) => r.grantId === g._id?.toString() || r.grantId === g.id,
      );

      const scores = relatedReviews.map((r: any) => Number(r.score || 0));
      const finalPercent = toPercent(average(scores));

      return [
        csvEscape(g.title),
        csvEscape(g.submittedEmail),
        csvEscape(g.projectDirectorId ?? "N/A"),
        csvEscape(g.arccAmountRequested ?? 0),
        csvEscape(g.otherSourcesAmount ?? 0),
        csvEscape(finalPercent),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="arcc-allocation.csv"',
    );

    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
