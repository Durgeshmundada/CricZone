// backend/routes/matchRoutes.js
const express = require("express");
const {
  createMatch,
  getAllMatches,
  getLiveMatches,
  getMatch,
  updateMatchScore,
  completeMatch,
  getUserMatches
} = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getAllMatches);
router.get("/live", getLiveMatches);
router.get("/:id", getMatch);

// Protected routes
router.post("/", protect, createMatch);
router.get("/user/my-matches", protect, getUserMatches);
router.put("/:id/score", protect, updateMatchScore);
router.put("/:id/complete", protect, completeMatch);

module.exports = router;