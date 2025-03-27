const mongoose = require("mongoose");


const teamSchema = new mongoose.Schema({
    teamId: { type: String, unique: true },
    name: String,
    score: Number,
    victories: Number,
    losses: Number,
    bestPlayer: String
});

module.exports = mongoose.model('Team', teamSchema);