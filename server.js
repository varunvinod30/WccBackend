const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createServer } = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db.js");
const Team = require('./models/Team.js')
const authRoutes = require('./routes/users.js')
const Message = require("./models/Message.js");
const imageRoutes = require("./routes/images.js");

dotenv.config();
connectDB();

const job = require('./cron.js');
job.start();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/image", imageRoutes);
const messageRoutes = require("./routes/messages")(io);
app.use("/api/messages", messageRoutes);

// Handle socket.io connections
io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

app.get("/api/teams", async (req, res) => {
  try {
      let teams = await Team.find({ teamId: { $in: ["team1", "team2"] } });

      // Create default objects if teams don't exist in DB
      const defaultTeams = {
          team1: { teamId: "team1", teamName: "", captain: "", coreTeam: [] },
          team2: { teamId: "team2", teamName: "", captain: "", coreTeam: [] }
      };

      teams.forEach(team => {
          defaultTeams[team.teamId] = team;
      });

      res.json(defaultTeams);
  } catch (error) {
      res.status(500).json({ error: "Server error" });
  }
});


app.post("/api/team", async (req, res) => {
  const { teamId, teamName, captain, coreTeam } = req.body;

  try {
      await Team.findOneAndReplace(
          { teamId }, 
          { teamId, teamName, captain, coreTeam }, 
          { upsert: true, new: true }  // Upsert ensures if no data exists, it creates a new entry
      );

      return res.json({ message: `Team ${teamId} updated successfully!` });
  } catch (error) {
      res.status(500).json({ error: "Database error" });
  }
});


app.put('/api/team/update-points', async (req, res) => {
  try {
      const { winnerId } = req.body;
      const loserId = winnerId === 'team1' ? 'team2' : 'team1';

      const winner = await Team.findOne({ teamId: winnerId });
      const loser = await Team.findOne({ teamId: loserId });

      if (!winner || !loser) {
          return res.status(404).json({ message: "Teams not found" });
      }

      // Update points
      winner.points += 1;

      // Maintain FIFO structure (Max 15)
      winner.score.push("W");
      loser.score.push("L");
      if (winner.score.length > 15) winner.score.shift();
      if (loser.score.length > 15) loser.score.shift();

      await winner.save();
      await loser.save();

      res.json({ winner, loser });
  } catch (error) {
      res.status(500).json({ message: "Internal server error", error });
  }
});

app.put('/api/team/revert', async (req, res) => {
  try {
      const { lastWinnerId } = req.body;
      const lastLoserId = lastWinnerId === 'team1' ? 'team2' : 'team1';

      const lastWinner = await Team.findOne({ teamId: lastWinnerId });
      const lastLoser = await Team.findOne({ teamId: lastLoserId });

      if (!lastWinner || !lastLoser || lastWinner.score.length === 0 || lastLoser.score.length === 0) {
          return res.status(400).json({ message: "No history to revert" });
      }

      // Remove last update
      lastWinner.points -= 1;
      lastWinner.score.pop();
      lastLoser.score.pop();

      await lastWinner.save();
      await lastLoser.save();

      res.json({ lastWinner, lastLoser });
  } catch (error) {
      res.status(500).json({ message: "Internal server error", error });
  }
});

app.post("/api/team/end-series", async (req, res) => {
  try {
      const teams = await Team.find({ teamId: { $in: ["team1", "team2"] } });

      if (teams.length !== 2) {
          return res.status(400).json({ error: "Both teams must exist in the database." });
      }

      // Determine the team with the highest points
      const [team1, team2] = teams;
      let winningCaptain = "";
      let winningTeamName = "";

      if (team1.points > team2.points) {
          winningCaptain = team1.captain;
          winningTeamName = team1.teamName;
      } else if (team2.points > team1.points) {
          winningCaptain = team2.captain;
          winningTeamName = team2.teamName;
      } else {
          winningCaptain = "Draw"; // Handle case where both teams have the same points
          winningTeamName = "Draw";
      }

      // Reset points & score, and store both the winning captain and team name in `prevSeries`
      await Promise.all([
          Team.findOneAndUpdate(
              { teamId: "team1" },
              {
                  points: 0,
                  score: Array(15).fill("-"),
                  prevSeries: winningCaptain !== "Draw" ? [winningCaptain, winningTeamName] : team1.prevSeries
              },
              { new: true }
          ),
          Team.findOneAndUpdate(
              { teamId: "team2" },
              {
                  points: 0,
                  score: Array(15).fill("-"),
                  prevSeries: winningCaptain !== "Draw" ? [winningCaptain, winningTeamName] : team2.prevSeries
              },
              { new: true }
          )
      ]);

      return res.json({
          message: "Series ended successfully!",
          winner: { captain: winningCaptain, team: winningTeamName }
      });

  } catch (error) {
      console.error("Error ending series:", error);
      res.status(500).json({ error: "Database error" });
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


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
