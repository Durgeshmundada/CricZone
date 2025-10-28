// backend/controllers/tournamentController.js
const Tournament = require("../models/Tournament");

// Create new tournament
exports.createTournament = async (req, res) => {
  try {
    const { name, description, startDate, endDate, venue, format, maxTeams, prizePool } = req.body;

    if (!name || !startDate || !endDate || !venue) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    const tournament = await Tournament.create({
      name,
      description,
      startDate,
      endDate,
      venue,
      format,
      maxTeams,
      prizePool,
      createdBy: req.user._id
    });

    res.status(201).json({
      message: "Tournament created successfully ✅",
      tournament
    });
  } catch (error) {
    console.error("❌ Tournament creation error:", error);
    res.status(500).json({ message: "Failed to create tournament", error: error.message });
  }
};

// Get all tournaments
exports.getAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      count: tournaments.length,
      tournaments
    });
  } catch (error) {
    console.error("❌ Error fetching tournaments:", error);
    res.status(500).json({ message: "Failed to fetch tournaments" });
  }
};

// Get single tournament
exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("matches");

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    res.json(tournament);
  } catch (error) {
    console.error("❌ Error fetching tournament:", error);
    res.status(500).json({ message: "Failed to fetch tournament" });
  }
};

// Register team in tournament
exports.registerTeam = async (req, res) => {
  try {
    const { teamName, captain, players } = req.body;
    const tournamentId = req.params.id;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.registeredTeams.length >= tournament.maxTeams) {
      return res.status(400).json({ message: "Tournament is full" });
    }

    const teamExists = tournament.registeredTeams.some(t => t.teamName === teamName);
    if (teamExists) {
      return res.status(400).json({ message: "Team name already registered" });
    }

    tournament.registeredTeams.push({
      teamName,
      captain,
      players,
      registeredBy: req.user._id
    });

    await tournament.save();

    res.json({
      message: "Team registered successfully ✅",
      tournament
    });
  } catch (error) {
    console.error("❌ Team registration error:", error);
    res.status(500).json({ message: "Failed to register team" });
  }
};

// Update tournament status
exports.updateTournamentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    tournament.status = status;
    await tournament.save();

    res.json({
      message: "Tournament status updated",
      tournament
    });
  } catch (error) {
    console.error("❌ Update tournament error:", error);
    res.status(500).json({ message: "Failed to update tournament" });
  }
};

// Delete tournament
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this tournament" });
    }

    await tournament.deleteOne();

    res.json({ message: "Tournament deleted successfully" });
  } catch (error) {
    console.error("❌ Delete tournament error:", error);
    res.status(500).json({ message: "Failed to delete tournament" });
  }
};