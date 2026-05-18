import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

interface User {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface DB {
  users: User[];
}

export function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const initial: DB = { users: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

export function writeDB(data: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export type { User, DB };