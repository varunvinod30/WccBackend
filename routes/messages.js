const express = require("express");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

const router = express.Router();

module.exports = (io) => {
    const authMiddleware = (req, res, next) => {
        const token = req.header("Authorization");
        if (!token) return res.status(401).json({ message: "Access denied" });

        try {
            const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
            req.user = verified;
            next();
        } catch (err) {
            res.status(400).json({ message: "Invalid token" });
        }
    };

    // Get Messages (Protected)
    router.get("/", authMiddleware, async (req, res) => {
        try {
            const messages = await Message.find().sort({ timestamp: 1 });
            res.json(messages);
        } catch (err) {
            res.status(500).json({ message: "Error fetching messages" });
        }
    });

    // Send Message (Protected)
    router.post("/", authMiddleware, async (req, res) => {
        try {
            const { username, message } = req.body;
            const newMessage = new Message({ username, message });

            await newMessage.save();

            // Emit message to all connected clients
            io.emit("receiveMessage", newMessage);

            res.status(201).json(newMessage);
        } catch (err) {
            res.status(500).json({ message: "Error sending message" });
        }
    });

    return router;
};
