import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../db.json');

export interface User {
  id: string;
  email: string;
  password: string;
  full_name?: string;  // Add this line
  role: 'admin' | 'user';
  createdAt: string;
}

export interface College {
  id: string;
  name: string;
  deanId: string | null;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  collegeId: string;
  chairId: string | null;
  createdAt: string;
}

export interface Grant {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  createdAt: string;
}

export interface DB {
  users: User[];
  colleges: College[];
  departments: Department[];
  grants: Grant[];
}

export function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const initial: DB = { 
      users: [], 
      colleges: [], 
      departments: [], 
      grants: [] 
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

export function writeDB(data: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}