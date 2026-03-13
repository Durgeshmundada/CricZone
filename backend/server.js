// backend/server.js — Cleaned up and merged
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");

dotenv.config();

const connectDB = require("./config/db");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// --------------- CORS CONFIGURATION ---------------
const parseAllowedOrigins = () => {
  const defaults = [
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "capacitor://localhost",
    "ionic://localhost"
  ];

  const envOrigins = String(process.env.CLIENT_URL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...envOrigins])];
};

const allowedOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin) => {
  if (!origin) return true; // same-origin or server-to-server
  if (allowedOrigins.includes("*")) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    // Allow localhost / 127.0.0.1 in dev
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return true;
    // Allow *.onrender.com over https
    if (parsed.protocol === "https:" && parsed.hostname.endsWith(".onrender.com")) return true;
  } catch (_e) {
    /* invalid origin string – deny */
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

// --------------- SOCKET.IO ---------------
const io = socketio(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Socket CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ["websocket", "polling"]
});

// --------------- MIDDLEWARE ---------------
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Request logger (dev only)
if (!isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const prefix = req.path.startsWith("/api/") ? "API" : "WEB";
      console.log(`${prefix} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
}

// --------------- ROUTES ---------------
const userRoutes = require("./routes/userRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const teamRoutes = require("./routes/teamRoutes");
const matchRoutes = require("./routes/matchRoutes");
const turfRoutes = require("./routes/turfRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

let postRoutes = null;
try {
  postRoutes = require("./routes/postRoutes");
} catch (_error) {
  // Optional route module.
}

// Health & readiness
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/api/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "not_ready"
  });
});

app.get("/api/version", (_req, res) => {
  res.json({ success: true, version: "1.0.0" });
});

// API routes
app.use("/api/users", userRoutes);
app.use("/api/turfs", turfRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
if (postRoutes) {
  app.use("/api/posts", postRoutes);
}

// Expose io to route handlers
app.set("io", io);

// --------------- SOCKET.IO EVENTS ---------------
const activeUsers = new Map();
io.on("connection", (socket) => {
  socket.on("user-join", (userData = {}) => {
    activeUsers.set(socket.id, userData);
    io.emit("active-users-count", activeUsers.size);
  });

  socket.on("score-update", (data = {}) => {
    if (!data.matchId) return;
    io.emit("live-score", {
      matchId: data.matchId,
      teamA: data.teamA,
      teamB: data.teamB,
      currentInning: data.currentInning,
      timestamp: new Date()
    });
  });

  socket.on("ball-update", (data = {}) => {
    if (!data.matchId) return;
    io.to(`match-${data.matchId}`).emit("live-ball", {
      matchId: data.matchId,
      ball: data.ball,
      runs: data.runs,
      isWicket: data.isWicket,
      commentary: data.commentary,
      timestamp: new Date()
    });
  });

  socket.on("join-match", (matchId) => {
    if (!matchId) return;
    socket.join(`match-${matchId}`);
  });

  socket.on("leave-match", (matchId) => {
    if (!matchId) return;
    socket.leave(`match-${matchId}`);
  });

  socket.on("disconnect", () => {
    activeUsers.delete(socket.id);
    io.emit("active-users-count", activeUsers.size);
  });
});

// --------------- STATIC FILES ---------------
const publicDir = path.join(__dirname, "../public");
const indexPath = path.join(publicDir, "index.html");

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { maxAge: isProduction ? "1h" : 0 }));
}

app.get("/", (_req, res) => {
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.json({
    success: true,
    message: "CricZone API server",
    environment: NODE_ENV,
    endpoints: {
      health: "/api/health",
      version: "/api/version"
    }
  });
});

// SPA fallback in production
if (isProduction && fs.existsSync(indexPath)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(indexPath);
  });
}

// --------------- ERROR HANDLING ---------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  if (status >= 500) {
    console.error("Server error:", err);
  }
  res.status(status).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// --------------- SERVER STARTUP ---------------
const validateEnvironment = () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing database configuration. Set MONGO_URI.");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET configuration.");
  }
};

const startServer = async () => {
  validateEnvironment();
  await connectDB();

  await new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT} (${NODE_ENV})`);
      resolve();
    });
  });
};

// --------------- GRACEFUL SHUTDOWN ---------------
let shuttingDown = false;
const gracefulShutdown = async (reason = "shutdown") => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shutting down (${reason})...`);

  server.close(async () => {
    try {
      await mongoose.connection.close(false);
    } catch (_error) {
      // Ignore close errors during shutdown.
    }
    process.exit(0);
  });

  const forcedExit = setTimeout(() => {
    process.exit(1);
  }, 10000);
  forcedExit.unref();
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Promise Rejection:", error);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

module.exports = { app, server, io, startServer, gracefulShutdown };
