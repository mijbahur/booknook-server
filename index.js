import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

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
const borrowCollection = db.collection("borrows");

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ msg: "Unauthorized!" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).send({ msg: "Unauthorized!" });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        next();
    } catch (error) {
        console.error("Token verification failed:", error.message);
        return res.status(401).send({ msg: "Invalid or expired token!" });
    }
};

app.get("/", (req, res) => {
    res.send("BookNook server is running");
});

app.get("/books", async (req, res) => {
    const result = await bookCollection.find().toArray();
    res.send(result);
});

app.get("/book/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }
    const result = await bookCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
        return res.status(404).json({ message: "Book not found" });
    }
    res.send(result);
});

app.post("/add-book", verifyToken, async (req, res) => {
    const data = req.body;
    const result = await bookCollection.insertOne(data);

    res.send(result);
});

app.patch("/book/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }

    const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data },
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Book not found" });
    }

    res.send(result);
});

app.delete("/book/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Book not found" });
    }

    const result = await bookCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Book not found" });
    }

    res.send({ message: "Book deleted successfully" });
});

// Borrow routes
app.get("/borrows", verifyToken, async (req, res) => {
    const result = await borrowCollection.find().toArray();
    res.send(result);
});
app.post("/borrows", verifyToken, async (req, res) => {
    const { bookId, userName, userEmail } = req.body;

    if (!ObjectId.isValid(bookId)) {
        return res.status(404).json({ message: "Book not found" });
    }

    const book = await bookCollection.findOne({ _id: new ObjectId(bookId) });

    if (!book) {
        return res.status(404).json({ message: "Book not found" });
    }

    if (book.totalCopies < 1) {
        return res.status(400).json({ message: "No copies available" });
    }

    const already = await borrowCollection.findOne({ bookId, userEmail });

    if (already) {
        return res
            .status(400)
            .json({ message: "You already borrowed this book" });
    }

    const borrowDate = new Date();
    const returnDate = new Date(
        borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000,
    );

    const borrow = {
        bookId,
        bookTitle: book.title,
        bookImage: book.image,
        userName,
        userEmail,
        borrowDate: borrowDate.toISOString(),
        returnDate: returnDate.toISOString(),
    };

    const result = await borrowCollection.insertOne(borrow);

    await bookCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { totalCopies: -1 } },
    );

    res.send({ _id: result.insertedId, ...borrow });
});

app.delete("/borrow/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Borrow not found" });
    }

    const borrow = await borrowCollection.findOne({ _id: new ObjectId(id) });

    if (!borrow) {
        return res.status(404).json({ message: "Borrow not found" });
    }

    await borrowCollection.deleteOne({ _id: new ObjectId(id) });

    await bookCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { totalCopies: 1 } },
    );

    res.send({ message: "Book returned successfully" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
