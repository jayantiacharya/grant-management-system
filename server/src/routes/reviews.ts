import { Router } from "express";
import { readDB, writeDB } from "../db.js";

const router = Router();

type Review = {
  id: string;
  grantId: string;
  reviewerEmail: string;
  score: number;
  role: string;
  comment: string;
};

/**
 * POST /api/reviews
 * Add a review for a grant
 */
router.post("/", (req, res) => {
  try {
    const db = readDB();
    const { grantId, reviewerEmail, score, role, comment } = req.body;

    const reviews = Array.isArray((db as any).reviews)
      ? ((db as any).reviews as Review[])
      : [];

    const newReview: Review = {
      id: Date.now().toString(),
      grantId,
      reviewerEmail,
      score,
      role: role || "student",
      comment: comment || "",
    };

    reviews.push(newReview);
    (db as any).reviews = reviews;

    writeDB(db);

    res.json(newReview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

/**
 * GET /api/reviews/:grantId
 */
router.get("/:grantId", (req, res) => {
  const db = readDB();

  const reviews = Array.isArray((db as any).reviews)
    ? ((db as any).reviews as Review[])
    : [];

  const grantReviews = reviews.filter(
    (r: Review) => r.grantId === req.params.grantId,
  );

  res.json(grantReviews);
});

export default router;
