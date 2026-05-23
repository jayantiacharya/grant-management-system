import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import grantRoutes from "./routes/grantSubmission.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/grants", grantRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT;

app.listen(PORT, () => console.log("Server running on port " + PORT));
