import express from 'express';
import { MongoClient } from "mongodb";
import 'dotenv/config'

const app = express();  
const PORT = process.env.PORT || 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("booknook");
const bookCollection = db.collection("books");

app.get('/', (req, res) => {
  res.send('BookNook server is running');
});

app.get('/books', async(req, res) => {
    const result = await bookCollection.find().toArray()
    res.send(result)
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});