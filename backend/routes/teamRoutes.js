// backend/routes/teamRoutes.js
const express = require("express");
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
} = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

const router = express.Router();

// All routes are protected
router.post("/", protect, validate(schemas.createTeam), createTeam);
router.post("/create", protect, validate(schemas.createTeam), createTeam); // alias
router.post("/randomize", protect, validate(schemas.randomizeTeams), generateBalancedTeams);
router.get("/suggestions", protect, getPlayerSuggestions);
router.get("/invitations/my", protect, getMyTeamInvitations);
router.put("/:id/invitations/:memberId/respond", protect, validate(schemas.teamInvitation), respondToTeamInvitation);
router.get("/", protect, getUserTeams);
router.get("/:id", protect, getTeam);
router.get("/:id/players", protect, getTeamPlayers);
router.put("/:id", protect, validate(schemas.updateTeam), updateTeam);
router.delete("/:id", protect, validate(schemas.teamIdParam), deleteTeam);

module.exports = router;
