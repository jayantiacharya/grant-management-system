import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import dbo from "../middleware/conn.js"; // Database connection
import { verifyToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required." });
    return false;
  }
  return true;
}

router.route("/colleges").get(async (req, res) => {
  // const db = readDB();
  let db_connect = dbo.getDb();
  const colleges = await db_connect.collection("college").find().toArray();
  res.json(
    colleges.map((college) => ({
      ...college,
      id: college._id.toString(),
    })),
  );
});

router.route("/departments").get(async (req, res) => {
  // const db = readDB();
  let db_connect = dbo.getDb();
  const departments = await db_connect
    .collection("department")
    .find()
    .toArray();
  res.json(
    departments.map((department) => ({
      ...department,
      id: department._id.toString(),
    })),
  );
});

router.route("/users").get(verifyToken, async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  let db_connect = dbo.getDb();
  const users = await db_connect
    .collection("user")
    .find({}, { projection: { password: 0 } })
    .toArray();
  res.json(users);
});

router.get("/user-options", verifyToken, async (_req, res) => {
  const db_connect = dbo.getDb();
  const users = await db_connect
    .collection("user")
    .find({}, { projection: { _id: 0, id: 1, email: 1 } })
    .toArray();
  res.json(users);
});

router
  .route("/createCollege")
  .post(verifyToken, async (req: AuthRequest, res) => {
    if (!requireAdmin(req, res)) return;
    let status = "";
    let db_connect = dbo.getDb();
    const { name, dean } = req.body;

    if (!name || !dean) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    // const db = readDB();
    let collegeObj = {
      name: name,
      dean: dean,
    };
    await db_connect.collection("college").insertOne(collegeObj);
    status = "College created successfully";

    // db.colleges.push(college);

    // writeDB(db);
    res.status(201).json({
      session: status,
    });
  });

router
  .route("/updateCollege")
  .post(verifyToken, async (req: AuthRequest, res) => {
    if (!requireAdmin(req, res)) return;
    let status = "";
    let db_connect = dbo.getDb();
    const { id, name, dean } = req.body;

    if (!id || !name || !dean) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    try {
      await db_connect
        .collection("college")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { name: name, dean: dean } },
        );
    } catch (err) {
      console.error("updateCollege failed:", err);
      return res.status(500).json({ message: "Failed to update college" });
    }
    status = "College updated successfully";

    res.status(201).json({
      session: status,
    });
  });

router
  .route("/createDepartment")
  .post(verifyToken, async (req: AuthRequest, res) => {
    if (!requireAdmin(req, res)) return;
    let status = "";
    let db_connect = dbo.getDb();
    const { name, college, chair } = req.body;

    if (!name || !college) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    let departObj = {
      name: name,
      college: college,
      chair: chair,
    };

    await db_connect.collection("department").insertOne(departObj);
    status = "Department created successfully";

    res.status(201).json({
      session: status,
    });
  });

router
  .route("/updateDepartment")
  .post(verifyToken, async (req: AuthRequest, res) => {
    if (!requireAdmin(req, res)) return;
    let status = "";
    let db_connect = dbo.getDb();
    const { id, name, college, chair } = req.body;

    if (!id || !name || !college) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    try {
      await db_connect
        .collection("department")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { name: name, college: college, chair: chair } },
        );
    } catch (err) {
      console.error("updateDepartment failed:", err);
      return res.status(500).json({ message: "Failed to update department" });
    }
    status = "Department updated successfully";

    res.status(201).json({
      session: status,
    });
  });

// Readable by any authenticated user: the dashboard uses this to determine
// whether the current user is on the committee. Writes (/updateArcc) stay
// admin-only.
router.route("/arcc").get(verifyToken, async (_req: AuthRequest, res) => {
  let db_connect = dbo.getDb();
  const doc = await db_connect.collection("arcc").findOne({ key: "committee" });
  res.json({
    chairId: doc?.chairId ?? null,
    memberIds: doc?.memberIds ?? [],
  });
});

router.route("/updateArcc").post(verifyToken, async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  let status = "";
  let db_connect = dbo.getDb();
  const { chairId, memberIds } = req.body;

  if (!Array.isArray(memberIds)) {
    return res.status(400).json({
      message: "memberIds must be an array",
    });
  }

  await db_connect
    .collection("arcc")
    .updateOne(
      { key: "committee" },
      { $set: { chairId: chairId ?? null, memberIds: memberIds } },
      { upsert: true },
    );
  status = "ARCC committee updated successfully";

  res.status(201).json({
    session: status,
  });
});

router.get(
  "/checkDeptChair/",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userEmail = req.user!.email;
    let db_connect = dbo.getDb();
    const department = await db_connect
      .collection("department")
      .findOne({ chair: userEmail });

    res.json({ isChair: !!department });
  },
);

export default router;
