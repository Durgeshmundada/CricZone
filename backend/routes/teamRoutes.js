<<<<<<< HEAD
const express = require("express");
const teamController = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/suggestions", teamController.getPlayerSuggestions);
router.get("/invitations/my", teamController.getMyInvitations);
router.post("/randomize", teamController.randomizeTeams);
router.get("/", teamController.getAllTeams);
router.post("/", teamController.createTeam);
router.post("/create", teamController.createTeam);
router.put("/:teamId/invitations/:memberId/respond", teamController.respondToInvitation);
router.get("/:teamId", teamController.getTeam);
router.put("/:teamId", teamController.updateTeam);
router.delete("/:teamId", teamController.deleteTeam);
=======
// backend/routes/teamRoutes.js
const express = require('express');
const {
  createTeam,
  getUserTeams,
  getTeam,
  getTeamPlayers,
  generateBalancedTeams,
  getPlayerSuggestions,
  getMyTeamInvitations,
  respondToTeamInvitation,
  updateTeam,
  deleteTeam
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.post('/', protect, createTeam);
router.post('/randomize', protect, generateBalancedTeams);
router.get('/suggestions', protect, getPlayerSuggestions);
router.get('/invitations/my', protect, getMyTeamInvitations);
router.put('/:id/invitations/:memberId/respond', protect, respondToTeamInvitation);
router.get('/', protect, getUserTeams);
router.get('/:id', protect, getTeam);
router.get('/:id/players', protect, getTeamPlayers); // BUG #2 FIX
router.put('/:id', protect, updateTeam);
router.delete('/:id', protect, deleteTeam);
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878

module.exports = router;
