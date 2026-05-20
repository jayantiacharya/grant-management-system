import { Router, Request, Response } from "express";
import { readDB, writeDB } from "../db.js";

const router = Router();

router.get("/colleges", (req, res) => {
  const db = readDB();

  res.json(db.colleges);
});

router.get("/departments", (req, res) => {
  const db = readDB();

  res.json(db.departments);
});

router.get("/users", (req, res) => {
  const db = readDB();

  res.json(db.users);
});

router.post("/createCollege", (req, res) => {
  const { name, dean } = req.body;

  if (!name || !dean) {
    return res.status(400).json({
      message: "All fields required",
    });
  }

  const db = readDB();

  const college = {
    id:
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
    name,
    dean,
  };

  db.colleges.push(college);

  writeDB(db);

  res.status(201).json(college);
});

router.post("/createDepartment", (req, res) => {
  const { name, college } = req.body;

  if (!name || !college) {
    return res.status(400).json({
      message: "All fields required",
    });
  }

  const db = readDB();

  const department = {
    id:
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
    name,
    college,
  };

  db.departments.push(department);

  writeDB(db);

  res.status(201).json(department);
});
export default router;
