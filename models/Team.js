const mongoose = require("mongoose");


const teamSchema = new mongoose.Schema({
    name: String,
    score: Number,
    victories: Number,
    losses: Number,
    bestPlayer: String,
});

module.exports = mongoose.model('Team', teamSchema);