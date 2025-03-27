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
  try {
      const { team1, team2 } = req.body;
      if (!team1 || !team2) return res.status(400).json({ message: "Both teams are required" });

      // Function to find or create/update a team
      const upsertTeam = async (teamData) => {
          let team;
          if (teamData.teamId) {
              team = await Team.findOne({ teamId: teamData.teamId });
              if (team) {
                  team.score = teamData.score;
                  team.victories = teamData.victories;
                  team.losses = teamData.losses;
                  team.bestPlayer = teamData.bestPlayer;
                  await team.save();
                  return team;
              }
          }
          team = await Team.findOne({ name: teamData.name });
          if (!team) {
              team = new Team(teamData);
          } else {
              team.score = teamData.score;
              team.victories = teamData.victories;
              team.losses = teamData.losses;
              team.bestPlayer = teamData.bestPlayer;
          }
          await team.save();
          return team;
      };

      // Process both teams
      const savedTeam1 = await upsertTeam(team1);
      const savedTeam2 = await upsertTeam(team2);

      res.json({ team1: savedTeam1, team2: savedTeam2 });
  } catch (error) {
      res.status(500).json({ message: "Internal server error", error });
  }
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
