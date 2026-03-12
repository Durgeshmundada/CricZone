const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncHandler, createError } = require("../utils/http");

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

const admin = authorizeRoles("admin");
const adminOrTurfOwner = authorizeRoles("admin", "turf_owner");

module.exports = protect;
module.exports.protect = protect;
module.exports.admin = admin;
module.exports.adminOrTurfOwner = adminOrTurfOwner;
module.exports.authorizeRoles = authorizeRoles;
