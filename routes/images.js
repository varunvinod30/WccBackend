const express = require("express");
const multer = require("multer");
const Image = require("../models/Image");

const router = express.Router();

// Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload image and append new data
router.post("/upload", upload.single("image"), async (req, res) => {
    try {
        const { winner, date, position, team } = req.body;

        // Retrieve the existing document
        let existingImage = await Image.findOne();

        if (existingImage) {
            // Append new data
            existingImage.history.unshift({ winner, date, position, team });

            // Keep only the last 30 entries
            if (existingImage.history.length > 30) {
                existingImage.history.pop();
            }

            // Replace the image
            existingImage.image = req.file.buffer;
            existingImage.contentType = req.file.mimetype;

            await existingImage.save();
        } else {
            // If no image exists, create a new document
            existingImage = new Image({
                image: req.file.buffer,
                contentType: req.file.mimetype,
                history: [{ winner, date, position, team }]
            });
            await existingImage.save();
        }

        res.json({ message: "Image uploaded successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Fetch the latest image and data
router.get("/get-image", async (req, res) => {
    try {
        const imageDoc = await Image.findOne();
        if (!imageDoc) return res.status(404).json({ message: "No image found" });

        res.json({
            image: `data:${imageDoc.contentType};base64,${imageDoc.image.toString("base64")}`,
            history: imageDoc.history
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
