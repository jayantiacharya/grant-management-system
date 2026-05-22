import { Router, Request, Response } from "express";
import dbo from "../middleware/conn.js"; // Database connection
// import { readDB, writeDB } from "../db.js";

const router = Router();

router.route("/colleges").get(async (req, res) => {

  // const db = readDB();
  let db_connect = dbo.getDb();
  const colleges = await db_connect.collection("college").find().toArray();
  res.json(colleges);
});

router.route("/departments").get(async (req, res) => {
  // const db = readDB();
  let db_connect = dbo.getDb();
  const departments = await db_connect.collection("department").find().toArray();
  res.json(departments);
});

router.route("/users").get(async (req, res) => {
  // const db = readDB();
  let db_connect = dbo.getDb();
  const users = await db_connect.collection("user").find().toArray();
  res.json(users);
});

router.route("/createCollege").post(async (req, res) => {
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
    dean: dean
  };
  await db_connect.collection("college").insertOne(collegeObj);
  status = "College created successfully";

  // db.colleges.push(college);

  // writeDB(db);
  res.status(201).json({
    session: status,
  });
});

router.route("/createDepartment").post(async (req, res) => {
    let status = "";
  let db_connect = dbo.getDb();
  const { name, college } = req.body;

  if (!name || !college) {
    return res.status(400).json({
      message: "All fields required",
    });
  }

  // const db = readDB();
  let departObj = {
    name: name,
    college: college
  };

  const department = {
    id:
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
    name,
    college,
  };

  await db_connect.collection("department").insertOne(departObj);
  status = "Department created successfully";

  // writeDB(db);

  res.status(201).json({
    session: status,
  });
});
export default router;
