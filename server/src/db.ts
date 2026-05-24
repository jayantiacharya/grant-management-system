import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "db.json");

interface User {
  id: string;
  email: string;
  password: string;
  role: "admin" | "user";
  createdAt: string;
}

interface Grant {
  id: string;
  title: string;
  description: string;
  submittedEmail: string;
}
interface College {
  id: string;
  name: string;
  dean: string;
}
interface Department {
  id: string;
  name: string;
  college: string;
}

interface DB {
  users: User[];
  grants: Grant[];
  colleges: College[];
  departments: Department[];
}

export function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const initial: DB = {
      users: [],
      grants: [],
      colleges: [],
      departments: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export function writeDB(data: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export type { User, DB };
