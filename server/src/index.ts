import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app.js";
import dbo from "./middleware/conn.js";

const PORT = process.env.PORT;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
  dbo.connectToServer(function (err?: Error) {
    if (err) {
      console.error(err);
    }
  });
  console.log(`Server is running on port ${PORT}`);
});
