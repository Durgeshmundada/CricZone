const mongoose = require("mongoose");

let listenersBound = false;

const bindConnectionListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not defined");
  }

  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4
    });

    bindConnectionListeners();
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    const message = error?.message || "Unknown database error";
    throw new Error(`Database connection failed: ${message}`);
  }
};

module.exports = connectDB;
