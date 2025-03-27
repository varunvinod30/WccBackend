const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createServer } = require("http");
const { Server } = require("socket.io");
const messageRoutes = require("./routes/messages.js");
const connectDB = require("./config/db.js");
const Team = require('./models/Team.js')

dotenv.config();
connectDB();

const job = require('./cron.js');
job.start();

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use("/api/messages", messageRoutes);

app.post('/team', async (req, res) => {
  const { name, score, victories, losses, bestPlayer } = req.body;
  const team = await Team.findOneAndUpdate(
      { name },
      { score, victories, losses, bestPlayer },
      { upsert: true, new: true }
  );
  res.json(team);
});

app.get('/team/:name', async (req, res) => {
  const team = await Team.findOne({ name: req.params.name });
  if (!team) return res.status(404).json({ message: 'Team not found' });
  res.json(team);
});

app.put('/team/:name', async (req, res) => {
  const { score, victories, losses, bestPlayer } = req.body;
  const team = await Team.findOneAndUpdate(
      { name: req.params.name },
      { score, victories, losses, bestPlayer },
      { new: true }
  );
  if (!team) return res.status(404).json({ message: 'Team not found' });
  res.json(team);
});

// 📌 Ensure `public/img/` directory exists
const uploadDir = "public/img/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 📌 Multer Storage Setup (Always Overwrites Previous Image)
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, "picture-of-the-day.jpg"); // Overwrites previous file
  },
});

const upload = multer({ storage });

// 📌 Serve Static Files from `public/`
app.use(express.static("public"));

// 📌 API Endpoint: Upload Image
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  res.status(200).send("Image uploaded successfully.");
});

// 📌 WebSockets (Retained from Original Code)
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("sendMessage", async (msg) => {
    io.emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
