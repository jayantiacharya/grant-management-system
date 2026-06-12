import express, { type Express } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import grantRoutes from "./routes/grantSubmission.js";
import adminRoutes from "./routes/admin.js";
import criteriaRoutes from "./routes/criteria.js";
import budgetRoutes from "./routes/budget.js";
import MongoStore from "connect-mongo";
import session from "express-session";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  if (process.env.ATLAS_URI) {
    app.use(
      session({
        secret: "keyboard cat",
        saveUninitialized: false,
        resave: false,
        store: MongoStore.create({
          mongoUrl: process.env.ATLAS_URI,
        }),
      }),
    );
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/grants", grantRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/criteria", criteriaRoutes);
  app.use("/api/budget", budgetRoutes);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  return app;
}
