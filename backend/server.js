const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
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
const allowAllOrigins = String(process.env.ALLOW_ALL_ORIGINS || "").toLowerCase() === "true";
const hasConfiguredClientOrigins = String(process.env.CLIENT_URL || "").trim().length > 0;
const allowAnyOriginByDefault = NODE_ENV === "production" && !hasConfiguredClientOrigins;

const parseAllowedOrigins = () => {
  const defaults = [
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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

const isLocalDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch (_error) {
    return false;
  }
};

const isTrustedHostedOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".onrender.com");
  } catch (_error) {
    return false;
  }
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowAllOrigins || allowAnyOriginByDefault) return true;
  if (isLocalDevOrigin(origin)) return true;
  if (isTrustedHostedOrigin(origin)) return true;
  if (allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(origin);
};

if (allowAnyOriginByDefault) {
  console.warn("CLIENT_URL is not set. Allowing all origins. Set CLIENT_URL to restrict CORS.");
}

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

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

if (NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

const userRoutes = require("./routes/userRoutes");
const turfRoutes = require("./routes/turfRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const matchRoutes = require("./routes/matchRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const teamRoutes = require("./routes/teamRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

let postRoutes = null;
try {
  postRoutes = require("./routes/postRoutes");
} catch (_error) {
  // Optional route module.
}

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

app.get("/api/version", (_req, res) => {
  res.json({
    success: true,
    version: "1.0.0"
  });
});

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

app.set("io", io);

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

const publicDir = path.join(__dirname, "../public");
const indexPath = path.join(publicDir, "index.html");

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
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

if (NODE_ENV === "production" && fs.existsSync(indexPath)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(indexPath);
  });
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({
    success: false,
    message,
    ...(NODE_ENV !== "production" ? { stack: err.stack } : {})
  });
});

const validateEnvironment = () => {
  const missing = [];
  if (!process.env.MONGO_URI) missing.push("MONGO_URI");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
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

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Promise Rejection:", error);
  gracefulShutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

module.exports = { app, server, io };
