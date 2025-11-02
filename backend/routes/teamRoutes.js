// backend/routes/teamRoutes.js
const express = require('express');
const {
  createTeam,
  getUserTeams,
  getTeam,
  getTeamPlayers,
  updateTeam,
  deleteTeam
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.post('/', protect, createTeam);
router.get('/', protect, getUserTeams);
router.get('/:id', protect, getTeam);
router.get('/:id/players', protect, getTeamPlayers); // BUG #2 FIX
router.put('/:id', protect, updateTeam);
router.delete('/:id', protect, deleteTeam);

module.exports = router;
