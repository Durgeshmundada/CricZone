const express = require("express");
const {
  createTournament,
  getAllTournaments,
  getActiveTournaments,
  getTournament,
  registerTeam,
  unregisterTeam,
<<<<<<< HEAD
=======
  generateFixtures,
  getStandings,
  generatePlayoffs,
  getTournamentStats,
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
  updateTournamentStatus,
  deleteTournament,
  updateStandings
} = require("../controllers/tournamentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllTournaments);
router.get("/active", getActiveTournaments);
router.get("/:id", getTournament);
<<<<<<< HEAD
router.post("/", protect, createTournament);
router.post("/:id/register", protect, registerTeam);
router.post("/:id/unregister", protect, unregisterTeam);
=======
router.get("/:id/standings", getStandings);
router.get("/:id/stats", getTournamentStats);

// Protected routes
router.post("/", protect, createTournament);
router.post("/:id/register", protect, registerTeam);
router.post("/:id/unregister", protect, unregisterTeam);
router.post("/:id/generate-fixtures", protect, generateFixtures);
router.post("/:id/generate-playoffs", protect, generatePlayoffs);
router.post("/standings/update", protect, updateStandings);
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
router.put("/:id/status", protect, updateTournamentStatus);
router.delete("/:id", protect, deleteTournament);

module.exports = router;
