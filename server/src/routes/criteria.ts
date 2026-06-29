import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";
import { verifyToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Only admins can manage criteria." });
    return false;
  }
  return true;
}

// Get all criteria
router.get("/", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const db = dbo.getDb();
    const criteria = await db.collection("criteria").find({}).toArray();
    res.json(criteria);
  } catch (error) {
    console.error("Failed to fetch criteria:", error);
    res.status(500).json({ message: "Failed to fetch criteria" });
  }
});

// Create new criteria (admin only)
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { name, description, maxScore, ratingSuggestions } = req.body;

    if (!name || !description || !maxScore) {
      res
        .status(400)
        .json({ message: "Name, description, and maxScore are required" });
      return;
    }

    if (maxScore <= 0) {
      res.status(400).json({ message: "Max score must be greater than 0" });
      return;
    }

    // Each individual rating suggestion score must not exceed maxScore
    if (ratingSuggestions && Array.isArray(ratingSuggestions)) {
      for (const suggestion of ratingSuggestions) {
        if (suggestion.score > parseInt(maxScore)) {
          res.status(400).json({
            message: `Rating suggestion score (${suggestion.score}) cannot exceed max score (${maxScore})`,
          });
          return;
        }
        if (suggestion.score < 0) {
          res
            .status(400)
            .json({ message: "Rating suggestion scores cannot be negative" });
          return;
        }
      }
    }

    const db = dbo.getDb();
    const newCriteria = {
      name: name.trim(),
      description: description.trim(),
      maxScore: parseInt(maxScore),
      ratingSuggestions: ratingSuggestions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await db.collection("criteria").insertOne(newCriteria);
    res.status(201).json({ _id: result.insertedId, ...newCriteria });
  } catch (error) {
    console.error("Failed to create criteria:", error);
    res.status(500).json({ message: "Failed to create criteria" });
  }
});

// Update criteria (admin only)
router.put("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid criteria id" });
      return;
    }

    const { name, description, maxScore, ratingSuggestions } = req.body;

    if (maxScore && ratingSuggestions && Array.isArray(ratingSuggestions)) {
      for (const suggestion of ratingSuggestions) {
        if (suggestion.score > parseInt(maxScore)) {
          res.status(400).json({
            message: `Rating suggestion score (${suggestion.score}) cannot exceed max score (${maxScore})`,
          });
          return;
        }
        if (suggestion.score < 0) {
          res
            .status(400)
            .json({ message: "Rating suggestion scores cannot be negative" });
          return;
        }
      }
    }

    const db = dbo.getDb();
    const updateData: any = { updatedAt: new Date().toISOString() };

    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (maxScore) updateData.maxScore = parseInt(maxScore);
    if (ratingSuggestions) updateData.ratingSuggestions = ratingSuggestions;

    const result = await db
      .collection("criteria")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    if (result.matchedCount === 0) {
      res.status(404).json({ message: "Criteria not found" });
      return;
    }

    res.json({ message: "Criteria updated successfully" });
  } catch (error) {
    console.error("Failed to update criteria:", error);
    res.status(500).json({ message: "Failed to update criteria" });
  }
});

// Delete criteria (admin only)
router.delete("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid criteria id" });
      return;
    }

    const db = dbo.getDb();
    const result = await db
      .collection("criteria")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: "Criteria not found" });
      return;
    }

    res.json({ message: "Criteria deleted successfully" });
  } catch (error) {
    console.error("Failed to delete criteria:", error);
    res.status(500).json({ message: "Failed to delete criteria" });
  }
});

export default router;
