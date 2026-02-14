// backend/routes/tournamentRoutes.js
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

const router = express.Router();

// Public routes
router.get("/", getAllTournaments);
router.get("/active", getActiveTournaments);
router.get("/:id", getTournament);
router.get("/:id/standings", getStandings);
router.get("/:id/stats", getTournamentStats);

// Protected routes
router.post("/", protect, createTournament);
router.post("/:id/register", protect, registerTeam);
router.post("/:id/unregister", protect, unregisterTeam);
router.post("/:id/generate-fixtures", protect, generateFixtures);
router.post("/:id/generate-playoffs", protect, generatePlayoffs);
router.post("/standings/update", protect, updateStandings);
router.put("/:id/status", protect, updateTournamentStatus);
router.delete("/:id", protect, deleteTournament);

module.exports = router;
