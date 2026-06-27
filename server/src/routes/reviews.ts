import { Router } from "express";
import { readDB, writeDB } from "../db.js";

const router = Router();

/**
 * POST /api/reviews
 * Add a review for a grant
 */
router.post("/", (req, res) => {
  try {
    const db = readDB();
    const { grantId, reviewerEmail, score, role, comment } = req.body;

    const newReview = {
      id: Date.now().toString(),
      grantId,
      reviewerEmail,
      score,
      role: role || "student",
      comment: comment || "",
    };

    db.reviews.push(newReview);
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

  const reviews = db.reviews.filter((r) => r.grantId === req.params.grantId);

  res.json(reviews);
});

export default router;
