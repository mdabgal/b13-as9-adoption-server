const express = require('express');
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const { auth } = require("./auth");
dotenv.config();
const app = express();
const port = process.env.PORT || 8000;


app.use(cookieParser()); 
app.use(express.json());

app.use(cors({
  origin: [
    process.env.CLIENT_URL
  ], 
  credentials: true 
}));


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
    // await client.connect(); 

    const db = client.db("adoption");
    const petsCollection = db.collection("pets");
    const requestsCollection = db.collection("requests");

    
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token; 

      if (!token) {
        return res.status(401).send({ message: "Unauthorized access! Login required." });
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access! Invalid token." });
        }
        
        req.user = decoded; 
        next(); 
      });
    };

    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body; 
        
        if (!user || !user.email) {
          return res.status(400).send({ success: false, message: "Email is required" });
        }

        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true, message: "Token stored securely!" });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.post("/logout", async (req, res) => {
      try {
        res.clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true, message: "Logged out and cookie cleared!" });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    
    app.get("/pets", async (req, res) => {
      try {
        const { search, species, ownerEmail } = req.query;
        let query = {};
        
        if (ownerEmail) {
          query.ownerEmail = ownerEmail;
        }

        if (search) {
          query.name = { $regex: search, $options: "i" }; 
        }

       if (species) {
 
  const speciesArray = species.split(",");
  query.species = { $in: speciesArray };
}

        
        if (!ownerEmail) {
          query.status = { $ne: "adopted" }; 
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
      try {
        const id = req.params.id;
        const updatedPet = req.body;
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
        const availablePets = await petsCollection.countDocuments({ ownerEmail: email, status: "available" });
        const adoptedPets = await petsCollection.countDocuments({ ownerEmail: email, status: "adopted" });

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


app.all("/api/auth/*", async (req, res) => {
    const authResponse = await auth.handler(req);
    return authResponse;
});

app.get('/', (req, res) => {
  res.send('Pet Adoption Server is running perfectly...')
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});