// Added two lines to set the DNS servers to Cloudflare and Google to avoid DNS resolution issues when connecting to MongoDB Atlas
// I don't know if anyone else needs this but I needed these lines for it to work
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

import { MongoClient, ServerApiVersion, type Db } from "mongodb";

type ConnectCallback = (err?: Error) => void;

let _db: Db | null = null;

export default {
  connectToServer: function (callback: ConnectCallback) {
    const uri = process.env.ATLAS_URI;
    if (!uri) {
      callback(new Error("ATLAS_URI is not set"));
      return;
    }
    console.log("Attempting to connect...");
    // Create a MongoClient with a MongoClientOptions object to set the Stable API Version
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    async function run() {
      try {
        // Connect the client to the server
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
          "Pinged your deployment. You successfully connected to MongoDB!",
        );
        _db = client.db("linkUpDatabase");
        console.log("Successfully connected to linkUpDatabase Collection");
        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    }
    run();
  },

  getDb: function (): Db {
    if (!_db) throw new Error("Database not initialized");
    return _db;
  },
};
