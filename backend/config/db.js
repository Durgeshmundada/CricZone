const mongoose = require("mongoose");
const logger = require("../utils/logger");

let listenersBound = false;

const bindConnectionListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not defined");
  }

  try {
    logger.info("connecting to MongoDB");
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4
    });

    bindConnectionListeners();
    logger.info({ host: conn.connection.host, database: conn.connection.name }, "MongoDB connected");
    return conn;
  } catch (error) {
    const message = error?.message || "Unknown database error";
    throw new Error(`Database connection failed: ${message}`);
  }
};

module.exports = connectDB;
