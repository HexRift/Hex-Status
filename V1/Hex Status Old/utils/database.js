const mongoose = require('mongoose');
const colors = require('colors');

async function connectDatabase(config) {
    try {
        await mongoose.connect(config.MongoDB.uri);
        console.log("[Database]".green, "Connected to MongoDB");
    } catch (error) {
        console.error("[Database]".red, "MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

module.exports = { connectDatabase };
