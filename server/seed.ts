import bcrypt from 'bcryptjs';
import { readDB, writeDB } from './src/db.js';  // This is correct if seed.ts is in server root


const ADMIN_EMAIL = 'admin@4760weber.edu';
const ADMIN_PASSWORD = 'admin123';  // Changed from 'Admin1234!' to match your index.ts

async function seed() {
  const db = readDB();

  const existing = db.users.find(u => u.email === ADMIN_EMAIL);
  if (existing) {
    console.log('Admin user already exists — skipping.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);  // Changed to 10 to match auth
  db.users.push({
    id: Date.now().toString(),  // Changed from '1' to dynamic ID
    email: ADMIN_EMAIL,
    password: passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  writeDB(db);
  console.log(`✅ Admin created: ${ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  process.exit(0);
}

seed();