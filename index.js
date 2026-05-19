const express = require('express')
const dotenv = require("dotenv")

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

dotenv.config();
const app = express()

app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8000



const uri = "mongodb+srv://adoption:RrDDZF8JzBXnmLPc@cluster0.rox204t.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("adoption");
    const petsCollection = db.collection("pets")

  

   app.get("/pets", async (req, res) => {
      
      const result = await petsCollection.find().toArray();

      res.send(result);

    });



app.get("/pets/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const pet = await petsCollection.findOne({
      _id: new ObjectId(id),
    });

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
    {
      $set: updatedPet,
    }
  );

  res.send(result);

});

app.post("/requests", async (req, res) => {
  const request = req.body;
  const result = await db.collection("requests").insertOne(request);
  res.send(result);
});


app.get("/requests", async (req, res) => {
  const result = await db.collection("requests").find().toArray();
  res.send(result);
});



app.patch("/requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status;

    const result = await db.collection("requests").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send({
      success: true,
      result,
    });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});



app.delete("/pets/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await petsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 1) {
      res.send({ success: true, message: "Pet deleted" });
    } else {
      res.status(404).send({ success: false, message: "Pet not found" });
    }
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});





    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})



