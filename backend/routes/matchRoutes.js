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
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getAllMatches);
router.get("/live", getLiveMatches);

// ========== PROTECTED ROUTES ==========
router.get("/user/my-matches", protect, getUserMatches);
router.post("/", protect, validate(schemas.createMatch), createMatch);

// ========== DYNAMIC ROUTES (Match ID based) ==========
router.get("/:id/highlights", getMatchHighlights);
router.get("/:id/report", getMatchReport);
router.get("/:id", getMatch);
router.put("/:id/toss", protect, validate(schemas.setMatchToss), setMatchToss);
router.put("/:id/score", protect, validate(schemas.updateMatchScore), updateMatchScore);
router.put("/:id/complete", protect, validate(schemas.matchIdParam), completeMatch);
router.delete("/:id", protect, validate(schemas.matchIdParam), deleteMatch);

module.exports = router;
