// backend/routes/tournamentRoutes.js
const express = require("express");
const {
  createTournament,
  getAllTournaments,
  getTournament,
  registerTeam,
  updateTournamentStatus,
  deleteTournament
} = require("../controllers/tournamentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getAllTournaments);
router.get("/:id", getTournament);

// Protected routes
router.post("/", protect, createTournament);
router.post("/:id/register", protect, registerTeam);
router.put("/:id/status", protect, updateTournamentStatus);
router.delete("/:id", protect, deleteTournament);

module.exports = router;