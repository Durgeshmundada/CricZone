const express = require("express");
const {
  createTournament,
  getAllTournaments,
  getActiveTournaments,
  getTournament,
  registerTeam,
  unregisterTeam,
  generateFixtures,
  getStandings,
  generatePlayoffs,
  getTournamentStats,
  updateTournamentStatus,
  deleteTournament,
  updateStandings
} = require("../controllers/tournamentController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

const router = express.Router();

// Public routes
router.get("/", getAllTournaments);
router.get("/active", getActiveTournaments);
router.get("/:id", getTournament);
router.get("/:id/standings", getStandings);
router.get("/:id/stats", getTournamentStats);

// Protected routes
router.post("/", protect, validate(schemas.createTournament), createTournament);
router.post("/:id/register", protect, validate(schemas.registerTournamentTeam), registerTeam);
router.post("/:id/unregister", protect, validate(schemas.unregisterTournamentTeam), unregisterTeam);
router.post("/:id/generate-fixtures", protect, validate(schemas.tournamentIdParam), generateFixtures);
router.post("/:id/generate-playoffs", protect, validate(schemas.tournamentIdParam), generatePlayoffs);
router.post("/standings/update", protect, validate(schemas.updateStandings), updateStandings);
router.put("/:id/status", protect, validate(schemas.updateTournamentStatus), updateTournamentStatus);
router.delete("/:id", protect, validate(schemas.tournamentIdParam), deleteTournament);

module.exports = router;
