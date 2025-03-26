const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Define a simple schema
const ItemSchema = new mongoose.Schema({ name: String });
const Item = mongoose.model("Item", ItemSchema);

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello from Railway & MongoDB Atlas!" });
});

app.post("/add", async (req, res) => {
  const { name } = req.body;
  const newItem = new Item({ name });

  try {
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
