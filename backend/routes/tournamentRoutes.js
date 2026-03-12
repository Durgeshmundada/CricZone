const express = require("express");
const {
  createTournament,
  getAllTournaments,
  getTournament,
  registerTeam,
  unregisterTeam,
  updateTournamentStatus,
  deleteTournament
} = require("../controllers/tournamentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllTournaments);
router.get("/:id", getTournament);
router.post("/", protect, createTournament);
router.post("/:id/register", protect, registerTeam);
router.post("/:id/unregister", protect, unregisterTeam);
router.put("/:id/status", protect, updateTournamentStatus);
router.delete("/:id", protect, deleteTournament);

module.exports = router;
