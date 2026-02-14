// backend/routes/userRoutes.js
const express = require("express");
const { 
  registerUser, 
  loginUser,
  getUserProfile,
  updateUserProfile,
  getPlayerById,
  searchPlayers,
  getNearbyPlayers,
  getTopBatsmen,
  getTopBowlers,
  getTopAllRounders,
  followUser,
  unfollowUser
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUserProfile 
} = require("../controllers/userController");
const { protect } = require('../middleware/authMiddleware');

// ========== AUTHENTICATION ROUTES ==========
router.post("/register", registerUser);
router.post("/signup", registerUser); // Alias for register to match frontend
router.post("/login", loginUser);

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
router.put("/profile", protect, updateUserProfile);

// ========== SOCIAL FEATURES (Feature #10: Community) ==========
// Follow/Unfollow users (protected)
router.post("/follow/:userId", protect, followUser);
router.post("/unfollow/:userId", protect, unfollowUser);

module.exports = router;
