



const express = require('express');
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

app.use(cookieParser()); 
app.use(express.json());

app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    "https://b13-as9-pet-adoption-client.vercel.app",
    "http://localhost:3000" 
  ], 
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/jwks`));

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

 
   const verifyToken = async (req, res, next) => {

  const token = req.cookies['better-auth.session_token']; 

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized access! Token missing." });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload; 
    next(); 
  } catch (error) {
    return res.status(403).json({ success: false, message: "Forbidden access!" });
  }
};

  
    app.get("/pets", async (req, res) => {
      try {
        const { search, species, ownerEmail } = req.query;
        let query = {};
        
       
        if (ownerEmail && ownerEmail.trim() !== "") {
          query.ownerEmail = ownerEmail;
        }

      
        if (search && search.trim() !== "") {
          query.name = { $regex: search, $options: "i" }; 
        }

        
        if (species && species.trim() !== "") {
          const speciesArray = species.split(",")
            .map(s => s.trim())
            .filter(s => s !== ""); 
          
          if (speciesArray.length > 0) {
           
            query.species = { 
              $in: speciesArray.map(s => new RegExp(`^${s}$`, "i")) 
            };
          }
        }

       
        if (!ownerEmail) {
          query.status = { $regex: "^(?!adopted$).*", $options: "i" }; 
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

 
    app.post("/pets", verifyToken, async (req, res) => {
      try {
        const newPet = req.body;
        if (!newPet.status) newPet.status = "available"; 
        const result = await petsCollection.insertOne(newPet);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add pet" });
      }
    });

    app.put("/pets/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedPet = req.body;
       
        delete updatedPet._id;
        const result = await petsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedPet }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update pet" });
      }
    });


    app.delete('/pets/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await petsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete pet" });
      }
    });

  
    app.post("/requests", verifyToken, async (req, res) => {
      try {
        const request = req.body;
        const pet = await petsCollection.findOne({ _id: new ObjectId(request.petId) });
        
        if (!pet) {
          return res.status(404).send({ success: false, message: "Pet not found!" });
        }
        if (pet.status && pet.status.toLowerCase() === "adopted") {
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

    
    app.delete("/requests/:id",  verifyToken, async (req, res) => {
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


    app.get("/owner-stats", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ success: false, message: "Email is required" });
        }

        if (req.user.email !== email) {
          return res.status(403).send({ success: false, message: "Forbidden! Token verification failed." });
        }

        const totalListings = await petsCollection.countDocuments({ ownerEmail: email });
        const availablePets = await petsCollection.countDocuments({ ownerEmail: email, status: { $regex: "^available$", $options: "i" } });
        const adoptedPets = await petsCollection.countDocuments({ ownerEmail: email, status: { $regex: "^adopted$", $options: "i" } });

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







