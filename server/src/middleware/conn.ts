import { MongoClient, ServerApiVersion } from "mongodb";
const uri = "mongodb+srv://tchau435897:<L5xp9tBji7KpTBkK>@cluster0.y2ohydj.mongodb.net/?appName=Cluster0"; // process.env.ATLAS_URI

console.log("ATLAS_URI:", uri); // Debug: verify env var is loaded

let _db;

export default {
  connectToServer: function (callback) {
    if (!uri) {
      console.error("ERROR: ATLAS_URI environment variable is not set");
      return callback(new Error("ATLAS_URI is undefined"));
    }
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
