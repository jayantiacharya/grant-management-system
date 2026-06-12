import { Router, Request, Response } from "express";
import dbo from "../middleware/conn.js";

const router = Router();

// Get all budget items for a grant
router.route("/:grantId").get(async (req: Request, res: Response) => {
  try {
    const { grantId } = req.params;
    const db = dbo.getDb();
    const items = await db.collection("budget").find({ grantId }).toArray();
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch budget items:", error);
    res.status(500).json({ message: "Failed to fetch budget items" });
  }
});

// Create a new budget item
router.route("/").post(async (req: Request, res: Response) => {
  try {
    const {
      grantId,
      itemDescription,
      amountRequested,
      amountFromARCC,
      amountFromCollege,
      amountFromDepartment,
      amountFromOther,
      category,
    } = req.body;

    if (!grantId || !itemDescription || amountRequested === undefined) {
      res.status(400).json({
        message: "grantId, itemDescription, and amountRequested are required",
      });
      return;
    }

    if (amountRequested < 0) {
      res.status(400).json({ message: "amountRequested cannot be negative" });
      return;
    }

    const db = dbo.getDb();
    const newItem = {
      id: Date.now().toString(),
      grantId,
      itemDescription: itemDescription.trim(),
      amountRequested: parseFloat(amountRequested) || 0,
      amountFromARCC: parseFloat(amountFromARCC) || 0,
      amountFromCollege: parseFloat(amountFromCollege) || 0,
      amountFromDepartment: parseFloat(amountFromDepartment) || 0,
      amountFromOther: parseFloat(amountFromOther) || 0,
      category: category || "Other",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("budget").insertOne(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Failed to create budget item:", error);
    res.status(500).json({ message: "Failed to create budget item" });
  }
});

// Update a budget item
router.route("/:id").put(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      itemDescription,
      amountRequested,
      amountFromARCC,
      amountFromCollege,
      amountFromDepartment,
      amountFromOther,
      category,
    } = req.body;

    const db = dbo.getDb();
    const updateData: any = { updatedAt: new Date().toISOString() };

    if (itemDescription) updateData.itemDescription = itemDescription.trim();
    if (amountRequested !== undefined)
      updateData.amountRequested = parseFloat(amountRequested) || 0;
    if (amountFromARCC !== undefined)
      updateData.amountFromARCC = parseFloat(amountFromARCC) || 0;
    if (amountFromCollege !== undefined)
      updateData.amountFromCollege = parseFloat(amountFromCollege) || 0;
    if (amountFromDepartment !== undefined)
      updateData.amountFromDepartment = parseFloat(amountFromDepartment) || 0;
    if (amountFromOther !== undefined)
      updateData.amountFromOther = parseFloat(amountFromOther) || 0;
    if (category) updateData.category = category;

    const result = await db
      .collection("budget")
      .updateOne({ id }, { $set: updateData });

    if (result.matchedCount === 0) {
      res.status(404).json({ message: "Budget item not found" });
      return;
    }

    res.json({ message: "Budget item updated successfully" });
  } catch (error) {
    console.error("Failed to update budget item:", error);
    res.status(500).json({ message: "Failed to update budget item" });
  }
});

// Delete a budget item
router.route("/:id").delete(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = dbo.getDb();

    const result = await db.collection("budget").deleteOne({ id });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: "Budget item not found" });
      return;
    }

    res.json({ message: "Budget item deleted successfully" });
  } catch (error) {
    console.error("Failed to delete budget item:", error);
    res.status(500).json({ message: "Failed to delete budget item" });
  }
});

export default router;
