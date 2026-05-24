import bcrypt from "bcryptjs";
import { readDB, writeDB } from "./db.js";

const ADMIN_EMAIL = "admin@4760weber.edu";
const ADMIN_PASSWORD = "Admin1234!";

async function seed() {
  console.log("Starting seed...");
  const db = readDB();

  const existing = db.users.find((u) => u.email === ADMIN_EMAIL);
  if (existing) {
    console.log("Admin user already exists — skipping.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  db.users.push({
    id: "1",
    email: ADMIN_EMAIL,
    password: passwordHash,
    role: "admin",
    createdAt: new Date().toISOString(),
  });

  writeDB(db);
  console.log("Admin created: " + ADMIN_EMAIL);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
