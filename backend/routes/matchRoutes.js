// backend/routes/matchRoutes.js
const express = require("express");
const {
  createMatch,
  getAllMatches,
  getLiveMatches,
  getMatch,
  setMatchToss,
  updateMatchScore,
  completeMatch,
  getUserMatches,
  deleteMatch,
  getMatchHighlights,
  getMatchReport
} = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getAllMatches);
router.get("/live", getLiveMatches);

// ========== PROTECTED ROUTES ==========
router.get("/user/my-matches", protect, getUserMatches);
router.post("/", protect, createMatch);

// ========== DYNAMIC ROUTES (Match ID based) ==========
router.get("/:id/highlights", getMatchHighlights);
router.get("/:id/report", getMatchReport);
router.get("/:id", getMatch);
router.put("/:id/toss", protect, setMatchToss);
router.put("/:id/score", protect, updateMatchScore);
router.put("/:id/complete", protect, completeMatch);
router.delete("/:id", protect, deleteMatch);

module.exports = router;
