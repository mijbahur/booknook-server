import express from 'express';
import { MongoClient, ObjectId } from "mongodb";
import 'dotenv/config'
import cors from "cors"

const app = express();  
const PORT = process.env.PORT || 8000;

app.use(cors())
app.use(express.json())

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

app.get('/book/:id', async (req, res) => {
    const {id} = req.params
    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }
    const result = await bookCollection.findOne({_id: new ObjectId(id)})
    res.send(result);
})

app.post('/add-book', async (req, res) => {
    const data = req.body
    const result = await bookCollection.insertOne(data)

    res.send(result)
})

app.patch('/book/:id', async (req, res) => {
    const {id} = req.params
    const data = req.body

    console.log(data);

    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }

    const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Book not found" });
    }

    res.send(result);
});

app.delete('/book/:id', async (req, res) => {
    const {id} = req.params

    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }

    const result = await bookCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Book not found" });
    }

    res.send({ message: "Book deleted successfully" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});