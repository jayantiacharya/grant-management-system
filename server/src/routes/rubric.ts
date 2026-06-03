import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

// ── GET rubric (the single global rubric) ─────────────────────────────────────
router.get("/", verifyToken, async (_req, res: Response) => {
  try {
    const db = dbo.getDb();
    const rubric = await db.collection("rubric").findOne({});
    res.json(rubric || { criteria: [] });
  } catch {
    res.status(500).json({ message: "Failed to fetch rubric." });
  }
});

// ── POST create/replace the rubric (admin/chair only) ─────────────────────────
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ message: "Only admins can create a rubric." });
      return;
    }

    const { criteria } = req.body;

    if (!Array.isArray(criteria) || criteria.length === 0) {
      res
        .status(400)
        .json({ message: "Rubric must have at least one criterion." });
      return;
    }

    // Validate each criterion
    for (const c of criteria) {
      if (
        !c.name ||
        !c.description ||
        !c.maxScore ||
        !Array.isArray(c.scoreOptions) ||
        c.scoreOptions.length === 0
      ) {
        res.status(400).json({
          message:
            "Each criterion must have name, description, maxScore, and scoreOptions.",
        });
        return;
      }
    }

    const db = dbo.getDb();

    // Replace the existing rubric or create a new one
    await db.collection("rubric").deleteMany({});
    const result = await db.collection("rubric").insertOne({
      criteria,
      createdBy: req.user.email,
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Rubric created.", id: result.insertedId });
  } catch {
    res.status(500).json({ message: "Failed to create rubric." });
  }
});

// ── PUT add a criterion to existing rubric ────────────────────────────────────
router.put(
  "/criteria",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== "admin") {
        res.status(403).json({ message: "Only admins can update a rubric." });
        return;
      }

      const { name, description, maxScore, scoreOptions } = req.body;

      if (
        !name ||
        !description ||
        !maxScore ||
        !Array.isArray(scoreOptions) ||
        scoreOptions.length === 0
      ) {
        res.status(400).json({
          message:
            "Criterion must have name, description, maxScore, and scoreOptions.",
        });
        return;
      }

      const db = dbo.getDb();

      // If no rubric exists yet, create one
      const existing = await db.collection("rubric").findOne({});
      if (!existing) {
        await db.collection("rubric").insertOne({
          criteria: [{ name, description, maxScore, scoreOptions }],
          createdBy: req.user.email,
          createdAt: new Date(),
        });
      } else {
        await db.collection("rubric").updateOne(
          { _id: existing._id },
          {
            $push: {
              criteria: { name, description, maxScore, scoreOptions },
            },
          },
        );
      }

      res.json({ message: "Criterion added." });
    } catch {
      res.status(500).json({ message: "Failed to add criterion." });
    }
  },
);

// ── DELETE a criterion by index ───────────────────────────────────────────────
router.delete(
  "/criteria/:index",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== "admin") {
        res.status(403).json({ message: "Only admins can delete criteria." });
        return;
      }

      const index = parseInt(req.params.index);
      const db = dbo.getDb();
      const rubric = await db.collection("rubric").findOne({});

      if (!rubric) {
        res.status(404).json({ message: "Rubric not found." });
        return;
      }

      const criteria = rubric.criteria as any[];
      if (index < 0 || index >= criteria.length) {
        res.status(400).json({ message: "Invalid criterion index." });
        return;
      }

      criteria.splice(index, 1);
      await db
        .collection("rubric")
        .updateOne({ _id: rubric._id }, { $set: { criteria } });

      res.json({ message: "Criterion deleted." });
    } catch {
      res.status(500).json({ message: "Failed to delete criterion." });
    }
  },
);

export default router;
