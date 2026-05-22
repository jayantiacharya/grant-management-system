import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import grantRoutes from "./routes/grantSubmission.js";
import adminRoutes from "./routes/admin.js";
import MongoStore from 'connect-mongo';
import session from 'express-session';

const app = express();

app.use(cors());

app.use(express.json());

app.use(
  session({
    secret: "keyboard cat",
    saveUninitialized: false, // don't create sessions until something is stored
    resave: false, // don't save session if unmodified
    store: MongoStore.create({
      mongoUrl: process.env.ATLAS_URI,
    }),
  })
);

// const dbo = require("./db/conn");
import dbo from "./middleware/conn.js";

app.use('/api/auth', authRoutes);
app.use("/api/grants", grantRoutes);
app.use("/api/admin", adminRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT;

// app.listen(PORT, () => console.log("Server running on port " + PORT));
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
  dbo.connectToServer(function (err) {
    if (err) {
      console.error(err);
    }
  });
  console.log(`Server is running on port ${PORT}`);
});
