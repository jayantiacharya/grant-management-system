import { Router } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js";

const router = Router();

// GET all departments (optionally filter by collegeId)
// Example: GET /api/departments?collegeId=abc123
router.get("/", async (req, res) => {
  try {
    const db = dbo.getDb();
    const filter: Record<string, unknown> = {};

    if (req.query.collegeId) {
      filter.collegeId = new ObjectId(req.query.collegeId as string);
    }

    const departments = await db
      .collection("department")
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    res.json(departments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch departments" });
  }
});

// GET single department by ID
router.get("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const dept = await db
      .collection("department")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!dept) return res.status(404).json({ message: "Department not found" });
    res.json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch department" });
  }
});

// POST create a new department
router.post("/", async (req, res) => {
  try {
    const db = dbo.getDb();
    const { name, collegeId } = req.body;

    if (!name)
      return res.status(400).json({ message: "Department name is required" });
    if (!collegeId)
      return res.status(400).json({ message: "collegeId is required" });

    // Look up the college name for denormalized storage
    const college = await db
      .collection("college")
      .findOne({ _id: new ObjectId(collegeId) });

    if (!college) return res.status(404).json({ message: "College not found" });

    const result = await db.collection("department").insertOne({
      name,
      collegeId: new ObjectId(collegeId),
      collegeName: college.name,
      createdAt: new Date(),
    });

    res
      .status(201)
      .json({ message: "Department created", id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create department" });
  }
});

// PUT update a department
router.put("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const { name, collegeId } = req.body;

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (name) updateFields.name = name;

    if (collegeId) {
      const college = await db
        .collection("college")
        .findOne({ _id: new ObjectId(collegeId) });

      if (!college)
        return res.status(404).json({ message: "College not found" });
      updateFields.collegeId = new ObjectId(collegeId);
      updateFields.collegeName = college.name;
    }

    const result = await db
      .collection("department")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateFields });

    if (result.matchedCount === 0)
      return res.status(404).json({ message: "Department not found" });

    res.json({ message: "Department updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update department" });
  }
});

// DELETE a department
router.delete("/:id", async (req, res) => {
  try {
    const db = dbo.getDb();
    const result = await db
      .collection("department")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Department not found" });

    res.json({ message: "Department deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete department" });
  }
});

export default router;
