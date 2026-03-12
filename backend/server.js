const compression = require("compression");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const userRoutes = require("./routes/userRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const teamRoutes = require("./routes/teamRoutes");
const matchRoutes = require("./routes/matchRoutes");
const turfRoutes = require("./routes/turfRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const postRoutes = require("./routes/postRoutes");

const { createError } = require("./utils/http");

const isProduction = process.env.NODE_ENV === "production";
const publicDir = path.join(__dirname, "../public");

let serverInstance = null;

const getAllowedOrigins = () =>
  String(process.env.CLIENT_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const validateRuntimeConfig = () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing database configuration. Set MONGO_URI.");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET configuration.");
  }

  if (isProduction && getAllowedOrigins().length === 0) {
    throw new Error("CLIENT_URL must be configured in production.");
  }
};

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing database configuration. Set MONGO_URI.");
  }

  await mongoose.connect(mongoUri);
};

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const prefix = req.path.startsWith("/api/") ? "API" : "WEB";
    console.log(`${prefix} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
};

const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(createError(403, "Origin not allowed by CORS"));
      }
    })
  );
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
  app.use(requestLogger);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      status: "ok",
      uptime: process.uptime()
    });
  });

  app.get("/api/ready", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? "ready" : "not_ready"
    });
  });

  app.use("/api/users", userRoutes);
  app.use("/api/tournaments", tournamentRoutes);
  app.use("/api/teams", teamRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/turfs", turfRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/posts", postRoutes);

  app.use(express.static(publicDir, { maxAge: isProduction ? "1h" : 0 }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next(createError(404, "Route not found"));
    }
    return res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((req, _res, next) => {
    next(createError(404, "Route not found"));
  });

  app.use((error, _req, res, _next) => {
    const status = Number(error.status || 500);
    if (status >= 500) {
      console.error("Server error:", error);
    }

    return res.status(status).json({
      success: false,
      message: error.message || "Internal Server Error",
      ...(error.details !== undefined ? { details: error.details } : {}),
      ...(!isProduction && status >= 500 && error.stack ? { stack: error.stack } : {})
    });
  });

  return app;
};

const app = createApp();

const startServer = async () => {
  if (serverInstance) {
    return serverInstance;
  }

  validateRuntimeConfig();
  await connectDatabase();

  const port = Number(process.env.PORT || 5000);
  await new Promise((resolve) => {
    serverInstance = app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
      resolve();
    });
  });

  return serverInstance;
};

const shutdown = async () => {
  if (serverInstance) {
    await new Promise((resolve, reject) => {
      serverInstance.close((error) => (error ? reject(error) : resolve()));
    });
    serverInstance = null;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  shutdown
};
