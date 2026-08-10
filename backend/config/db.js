const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

const connectDB = async () => {
    try {
        await mongoose.connect(env.mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });
        logger.info("MongoDB Connected");
    } catch (err) {
        logger.error({ err }, "MongoDB connection failed");
        process.exit(1);
    }
};

module.exports = connectDB;