
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

    await client.connect(); 

    const db = client.db("adoption");
    const petsCollection = db.collection("pets");
    const requestsCollection = db.collection("requests");


    
app.get("/pets", async (req, res) => {
  try {
    const { search, species, ownerEmail } = req.query;
    let query = {};
    
    
    if (ownerEmail) {
      query.ownerEmail = ownerEmail;
    }

  
    if (search) {
      query.name = { $regex: search, $options: "i" }; // 'i' মানে case-insensitive
    }

  
    if (species) {
      query.species = { $regex: species, $options: "i" }; 
    }

   
    if (!ownerEmail) {
      query.adopted = { $ne: true }; 
    }

    const result = await petsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch pets", error: error.message });
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
      try {
        const newPet = req.body;
       
        if (!newPet.status) newPet.status = "available"; 
        
        const result = await petsCollection.insertOne(newPet);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add pet" });
      }
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
      try {
        const request = req.body;

      
        const pet = await petsCollection.findOne({ _id: new ObjectId(request.petId) });
        if (!pet) {
          return res.status(404).send({ success: false, message: "Pet not found!" });
        }
        if (pet.status === "adopted") {
          return res.status(400).send({ success: false, message: "This pet is already adopted!" });
        }

       
        if (pet.ownerEmail === request.userEmail) {
          return res.status(400).send({ 
            success: false, 
            message: "Pet owners are not allowed to submit adoption requests for their own pets!" 
          });
        }

        const result = await requestsCollection.insertOne(request);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
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
        const { status, petId } = req.body; 

     
        const result = await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } }
        );

       
        if (status === "approved" && petId) {
        
          await petsCollection.updateOne(
            { _id: new ObjectId(petId) },
            { $set: { status: "adopted" } }
          );

         
          await requestsCollection.updateMany(
            { petId: petId, _id: { $ne: new ObjectId(id) }, status: "pending" },
            { $set: { status: "rejected" } }
          );
        }

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



    
  
   app.get("/owner-stats", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send({ success: false, message: "Email is required" });
    }

   
    const totalListings = await petsCollection.countDocuments({ ownerEmail: email });
    const availablePets = await petsCollection.countDocuments({ ownerEmail: email, adopted: { $ne: true } });
    const adoptedPets = await petsCollection.countDocuments({ ownerEmail: email, adopted: true });

    res.send({
      success: true,
      stats: {
        total: totalListings,
        available: availablePets,
        adopted: adoptedPets
      }
    });
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
  res.send('Pet Adoption Server is running perfectly...')
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});