// Added two lines to set the DNS servers to Cloudflare and Google to avoid DNS resolution issues when connecting to MongoDB Atlas
// I don't know if anyone else needs this but I needed these lines for it to work 
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

import { MongoClient, ServerApiVersion } from "mongodb";

let _db;

export default {
  connectToServer: function (callback) {
    const uri = process.env.ATLAS_URI;
    console.log("Attempting to connect...");
    // Create a MongoClient with a MongoClientOptions object to set the Stable API Version
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        depricationErrors: true,
      },
    });
    async function run() {
      try {
        // Connect the client to the server
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
          "Pinged your deployment. You successfully connected to MongoDB!"
        );
        _db = client.db("linkUpDatabase");
        console.log("Successfully connected to linkUpDatabase Collection");
      } finally {
      }
    }
    run().catch(console.dir);
  },

  getDb: function () {
    return _db;
  },
};
