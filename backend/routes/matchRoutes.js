// backend/routes/matchRoutes.js
const express = require('express');
const {
  createMatch,
  getAllMatches,
  getLiveMatches,
  getMatch,
  updateMatchScore,
  completeMatch,
  getUserMatches
} = require('../controllers/matchController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/', getAllMatches);
router.get('/live', getLiveMatches);

// ✅ BUG #9 FIX: Protected routes - Add authMiddleware
router.get('/user/my-matches', protect, getUserMatches);

// Dynamic routes after specific ones
router.get('/:id', getMatch);

// ✅ BUG #9 FIX: All modification routes protected
router.post('/', protect, createMatch);
router.put('/:id/score', protect, updateMatchScore);
router.put('/:id/complete', protect, completeMatch);

module.exports = router;
