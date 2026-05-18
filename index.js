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



// RrDDZF8JzBXnmLPc
// adoption