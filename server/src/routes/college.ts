import { Router } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";

const router = Router();

// GET all colleges
router.get("/", async (_req, res) => {
  try {
    const db = dbo.getDb();
    const colleges = await db
      .collection("college")
      .find({})
      .sort({ name: 1 })
      .toArray();
    res.json(colleges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch colleges" });
  }
});

// GET single college by ID
router.get("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const college = await db
      .collection("college")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!college) return res.status(404).json({ message: "College not found" });
    res.json(college);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch college" });
  }
});

// POST create a new college
router.post("/", async (req, res) => {
  try {
    const db = dbo.getDb();
    const { name, abbreviation } = req.body;

    if (!name)
      return res.status(400).json({ message: "College name is required" });

    const result = await db.collection("college").insertOne({
      name,
      abbreviation: abbreviation || "",
      createdAt: new Date(),
    });

    res.status(201).json({ message: "College created", id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create college" });
  }
});

// PUT update a college
router.put("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const { name, abbreviation } = req.body;

    const result = await db
      .collection("college")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { name, abbreviation, updatedAt: new Date() } },
      );

    if (result.matchedCount === 0)
      return res.status(404).json({ message: "College not found" });

    res.json({ message: "College updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update college" });
  }
});

// DELETE a college
router.delete("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const result = await db
      .collection("college")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0)
      return res.status(404).json({ message: "College not found" });

    res.json({ message: "College deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete college" });
  }
});

export default router;
