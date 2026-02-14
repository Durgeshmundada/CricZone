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

const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

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

module.exports = router;
