// backend/controllers/matchController.js
const Match = require("../models/Match");
const Tournament = require("../models/Tournament");

// Create new match
exports.createMatch = async (req, res) => {
  try {
    const {
      matchName,
      matchType,
      customOvers,
      teamAName,
      teamAPlayers,
      teamBName,
      teamBPlayers,
      venue,
      matchDate,
      tournamentId
    } = req.body;

    if (!matchName || !matchType || !teamAName || !teamBName || !venue || !matchDate) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    let overs = 20;
    if (matchType === "T20") overs = 20;
    else if (matchType === "ODI") overs = 50;
    else if (matchType === "Custom") overs = customOvers || 20;

    const teamAPlayersList = typeof teamAPlayers === 'string' 
      ? teamAPlayers.split(',').map(p => p.trim()).filter(p => p)
      : teamAPlayers;

    const teamBPlayersList = typeof teamBPlayers === 'string'
      ? teamBPlayers.split(',').map(p => p.trim()).filter(p => p)
      : teamBPlayers;

    const match = await Match.create({
      matchName,
      matchType,
      overs,
      teamA: {
        name: teamAName,
        players: teamAPlayersList
      },
      teamB: {
        name: teamBName,
        players: teamBPlayersList
      },
      venue,
      matchDate,
      tournament: tournamentId || null,
      createdBy: req.user._id
    });

    // If part of tournament, add match to tournament
    if (tournamentId) {
      await Tournament.findByIdAndUpdate(tournamentId, {
        $push: { matches: match._id }
      });
    }

    res.status(201).json({
      message: "Match created successfully ✅",
      match
    });
  } catch (error) {
    console.error("❌ Match creation error:", error);
    res.status(500).json({ message: "Failed to create match", error: error.message });
  }
};

// Get all matches
exports.getAllMatches = async (req, res) => {
  try {
    const matches = await Match.find()
      .populate("createdBy", "name email")
      .populate("tournament", "name")
      .sort({ matchDate: -1 });

    res.json({
      count: matches.length,
      matches
    });
  } catch (error) {
    console.error("❌ Error fetching matches:", error);
    res.status(500).json({ message: "Failed to fetch matches" });
  }
};

// Get live matches
exports.getLiveMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: "live" })
      .populate("createdBy", "name email")
      .populate("tournament", "name")
      .sort({ matchDate: -1 });

    res.json({
      count: matches.length,
      matches
    });
  } catch (error) {
    console.error("❌ Error fetching live matches:", error);
    res.status(500).json({ message: "Failed to fetch live matches" });
  }
};

// Get single match
exports.getMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("tournament", "name");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.json(match);
  } catch (error) {
    console.error("❌ Error fetching match:", error);
    res.status(500).json({ message: "Failed to fetch match" });
  }
};

// Update match score
exports.updateMatchScore = async (req, res) => {
  try {
    const { teamAScore, teamAWickets, teamAOvers, teamBScore, teamBWickets, teamBOvers, status } = req.body;
    
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (teamAScore !== undefined) match.teamA.score = teamAScore;
    if (teamAWickets !== undefined) match.teamA.wickets = teamAWickets;
    if (teamAOvers !== undefined) match.teamA.overs = teamAOvers;
    if (teamBScore !== undefined) match.teamB.score = teamBScore;
    if (teamBWickets !== undefined) match.teamB.wickets = teamBWickets;
    if (teamBOvers !== undefined) match.teamB.overs = teamBOvers;
    if (status) match.status = status;

    await match.save();

    res.json({
      message: "Match score updated",
      match
    });
  } catch (error) {
    console.error("❌ Update match error:", error);
    res.status(500).json({ message: "Failed to update match" });
  }
};

// Complete match
exports.completeMatch = async (req, res) => {
  try {
    const { winner, result } = req.body;
    
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    match.status = "completed";
    match.winner = winner;
    match.result = result;

    await match.save();

    res.json({
      message: "Match completed",
      match
    });
  } catch (error) {
    console.error("❌ Complete match error:", error);
    res.status(500).json({ message: "Failed to complete match" });
  }
};

// Get user's matches
exports.getUserMatches = async (req, res) => {
  try {
    const matches = await Match.find({ createdBy: req.user._id })
      .populate("tournament", "name")
      .sort({ matchDate: -1 });

    res.json({
      count: matches.length,
      matches
    });
  } catch (error) {
    console.error("❌ Error fetching user matches:", error);
    res.status(500).json({ message: "Failed to fetch user matches" });
  }
};