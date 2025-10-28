// ===============================
// 🌐 CricZone Backend Server
// ===============================

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

// ✅ Load environment variables
dotenv.config();

// ✅ Connect to MongoDB
const connectDB = require("./config/db");
connectDB();

// ✅ Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// ⚙️ Middleware
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// 🛣️ API Routes
// ===============================
const userRoutes = require("./routes/userRoutes");
const turfRoutes = require("./routes/turfRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const matchRoutes = require("./routes/matchRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");

// Use routes
app.use("/api/users", userRoutes);
app.use("/api/turfs", turfRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/tournaments", tournamentRoutes);

// ===============================
// 🏠 Serve Frontend Files
// ===============================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ===============================
// 🚀 Start Server
// ===============================
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);