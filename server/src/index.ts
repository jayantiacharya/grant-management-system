import dotenv from "dotenv";
dotenv.config();
import { createApp } from "./app.js";
import dbo from "./middleware/conn.js";

const PORT = process.env.PORT;
const app = createApp();

// Connect to Mongo before accepting requests: a request served mid-connect
// would hit getDb() while _db is still null, and the throw inside an async
// route handler becomes an unhandled rejection that kills the process.
dbo.connectToServer(function (err?: Error) {
  if (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
