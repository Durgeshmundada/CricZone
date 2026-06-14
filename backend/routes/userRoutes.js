// backend/routes/userRoutes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  getPlayerById,
  searchPlayers,
  getNearbyPlayers,
  getTopBatsmen,
  getTopBowlers,
  getTopAllRounders,
  updateUserRole,
  followUser,
  unfollowUser
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts, please try again in 15 minutes" }
});
const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password recovery attempts, please try again in 15 minutes"
  }
});

// ========== AUTHENTICATION ROUTES ==========
router.post("/register", authLimiter, validate(schemas.registerUser), registerUser);
router.post("/signup", authLimiter, validate(schemas.registerUser), registerUser); // Alias for register to match frontend
router.post("/login", authLimiter, validate(schemas.loginUser), loginUser);
router.post("/refresh", validate(schemas.refreshSession), refreshSession);
router.post("/logout", validate(schemas.logoutSession), logoutUser);
router.post(
  "/forgot-password",
  passwordRecoveryLimiter,
  validate(schemas.forgotPassword),
  forgotPassword
);
router.post(
  "/reset-password/:token",
  passwordRecoveryLimiter,
  validate(schemas.resetPassword),
  resetPassword
);

// ========== PLAYER DISCOVERY & SEARCH (Feature #9: Looking) ==========
// Public routes - anyone can search for players
router.get("/search-players", searchPlayers);
router.get("/nearby-players", getNearbyPlayers);

// ========== LEADERBOARDS (Feature #6) ==========
// Public routes - anyone can view leaderboards
router.get("/leaderboard/batsmen", getTopBatsmen);
router.get("/leaderboard/bowlers", getTopBowlers);
router.get("/leaderboard/all-rounders", getTopAllRounders);

// ========== USER PROFILE ROUTES ==========
// Get specific player profile (public)
router.get("/player/:id", getPlayerById);

// Get own profile (protected)
router.get("/profile", protect, getUserProfile);

// Update own profile (protected)
router.put("/profile", protect, validate(schemas.updateProfile), updateUserProfile);

// Admin only role management (for turf owner/admin/user assignment)
router.put("/role", protect, authorizeRoles("admin"), validate(schemas.updateUserRole), updateUserRole);

// ========== SOCIAL FEATURES (Feature #10: Community) ==========
// Follow/Unfollow users (protected)
router.post("/follow/:userId", protect, validate(schemas.userIdParam), followUser);
router.post("/unfollow/:userId", protect, validate(schemas.userIdParam), unfollowUser);

module.exports = router;
