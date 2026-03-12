<<<<<<< HEAD
const express = require("express");
const matchController = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");
=======
// backend/routes/matchRoutes.js

const express = require('express');
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
} = require('../controllers/matchController');
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878

const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

<<<<<<< HEAD
router.get("/", matchController.getAllMatches);
router.post("/", protect, matchController.createMatch);
router.get("/user/my-matches", protect, matchController.getMyMatches);
router.get("/:matchId/report", matchController.getMatchReport);
router.get("/:matchId", matchController.getMatch);
router.put("/:matchId/toss", protect, matchController.setToss);
router.put("/:matchId/score", protect, matchController.saveScore);

=======
// ========== PUBLIC ROUTES ==========

// Get all matches
router.get('/', getAllMatches);
router.get('/live', getLiveMatches);

// ========== PROTECTED ROUTES ==========

// Get user's matches
router.get('/user/my-matches', protect, getUserMatches);

// Create new match
router.post('/', protect, createMatch);

// ========== DYNAMIC ROUTES (Match ID based) ==========

router.get('/:id/highlights', getMatchHighlights);
router.get('/:id/report', getMatchReport);

// Get match details by ID
router.get('/:id', getMatch);

// Set toss and start match
router.put('/:id/toss', protect, setMatchToss);

// Update match score
router.put('/:id/score', protect, updateMatchScore);

// Complete match
router.put('/:id/complete', protect, completeMatch);

// Delete match
router.delete('/:id', protect, deleteMatch);

>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
module.exports = router;
