


const express = require('express');
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8000;

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // MongoDB কানেকশন
    // await client.connect(); // Vercel-এ ডেপ্লয় করলে এটি আন-কমেন্ট করা লাগতে পারে

    const db = client.db("adoption");
    const petsCollection = db.collection("pets");
    const requestsCollection = db.collection("requests");

  

    app.get("/pets", async (req, res) => {
      try {
        const result = await petsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch pets" });
      }
    });

    app.get("/pets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
        res.send(pet);
      } catch (error) {
        res.status(500).send({ message: "Failed to get pet" });
      }
    });

    
    app.post("/pets", async (req, res) => {
      const newPet = req.body;
      const result = await petsCollection.insertOne(newPet);
      res.send(result);
    });

   
    app.put("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const updatedPet = req.body;
      const result = await petsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedPet }
      );
      res.send(result);
    });

   
    app.delete('/pets/:id', async (req, res) => {
      const id = req.params.id;
      const result = await petsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

   

  
    app.post("/requests", async (req, res) => {
      const request = req.body;
      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });

    
    app.get("/requests", async (req, res) => {
      try {
        const email = req.query.userEmail;
        if (!email) {
          return res.status(400).send({ success: false, message: "userEmail query required" });
        }
        const result = await requestsCollection.find({ userEmail: email }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    
    app.get('/owner-requests', async (req, res) => {
      try {
        const ownerEmail = req.query.email;
        if (!ownerEmail) {
          return res.status(400).send({ success: false, message: "Owner email required" });
        }
        const result = await requestsCollection.find({ ownerEmail: ownerEmail }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    
    app.patch("/requests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const status = req.body.status;
        const result = await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } }
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    
    app.delete("/requests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await requestsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    console.log("Database connected successfully!");
  } catch (error) {
    console.error("DB Connection Error:", error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Pet Adoption Server is running...')
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});