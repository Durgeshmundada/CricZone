const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncHandler, createError } = require("../utils/http");

<<<<<<< HEAD
const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = String(authorizationHeader).trim().split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

const protect = asyncHandler(async (req, _res, next) => {
  if (!process.env.JWT_SECRET) {
    throw createError(500, "JWT_SECRET is not configured");
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    throw createError(401, "Authentication required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    throw createError(401, "Invalid or expired token");
=======
const isProduction = process.env.NODE_ENV === "production";

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided"
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      return res.status(500).json({
        success: false,
        message: "Server configuration error"
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    return next();
  } catch (error) {
    console.error("JWT middleware error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired, please login again"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid token",
      ...(isProduction ? {} : { error: error.message })
    });
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw createError(401, "User not found for token");
  }

  req.user = user;
  next();
});

const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(createError(401, "Authentication required"));
  }

  if (!roles.includes(req.user.role)) {
    return next(createError(403, "You do not have permission to perform this action"));
  }

  return next();
};

<<<<<<< HEAD
const admin = authorizeRoles("admin");
const adminOrTurfOwner = authorizeRoles("admin", "turf_owner");

module.exports = protect;
module.exports.protect = protect;
module.exports.admin = admin;
module.exports.adminOrTurfOwner = adminOrTurfOwner;
module.exports.authorizeRoles = authorizeRoles;
=======
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied - Admins only"
  });
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized"
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied - allowed roles: ${roles.join(", ")}`
    });
  }

  return next();
};

const optionalAuth = async (req, _res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = await User.findById(decoded.id).select("-password");
    return next();
  } catch (_error) {
    return next();
  }
};

module.exports = { protect, admin, authorizeRoles, optionalAuth };
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
