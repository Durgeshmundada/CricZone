// backend/controllers/tournamentController.js
const mongoose = require("mongoose");
const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const isProduction = process.env.NODE_ENV === "production";

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const parseOversToDecimal = (rawOvers) => {
  if (rawOvers === undefined || rawOvers === null) return 0;

  if (typeof rawOvers === "number" && Number.isFinite(rawOvers)) {
    const overs = Math.trunc(rawOvers);
    const balls = Math.round((rawOvers - overs) * 10);
    if (balls >= 0 && balls < 6) {
      return overs + (balls / 6);
    }
    return rawOvers;
  }

  const raw = String(rawOvers).trim();
  if (!raw) return 0;

  const [oversPart, ballsPart = "0"] = raw.split(".");
  const overs = parseInt(oversPart, 10);
  const balls = parseInt(ballsPart, 10);
  if (!Number.isFinite(overs) || !Number.isFinite(balls) || balls < 0 || balls > 5) {
    return 0;
  }

  return overs + (balls / 6);
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const normalizeTournamentPlayersInput = (players = []) => {
  if (!Array.isArray(players)) return [];

  return players
    .map((player) => {
      if (!player) return null;

      if (typeof player === "string") {
        const name = String(player).trim();
        if (!name) return null;
        return { name, playerId: null, role: undefined, jerseyNumber: undefined };
      }

      if (typeof player === "object") {
        const name = String(player.name || "").trim();
        const playerIdRaw = player.playerId || player.userId || player.id || null;
        const playerId = isValidObjectId(playerIdRaw) ? String(playerIdRaw) : null;
        if (!name && !playerId) return null;
        return {
          name: name || "Player",
          playerId,
          role: player.role || undefined,
          jerseyNumber: Number.isFinite(Number(player.jerseyNumber))
            ? Number(player.jerseyNumber)
            : undefined
        };
      }

      return null;
    })
    .filter(Boolean);
};

const getTeamAcceptedPlayers = (teamDoc) => {
  if (!teamDoc || !Array.isArray(teamDoc.members)) return [];

  const seen = new Set();
  const accepted = [];
  teamDoc.members.forEach((member) => {
    const inviteStatus = String(member?.inviteStatus || "accepted").toLowerCase();
    const playerDoc = member.player && typeof member.player === "object" ? member.player : null;
    const playerId = playerDoc?._id || member.player || null;
    const name = String(playerDoc?.name || member?.name || "").trim();
    if (!name) return;
    if (playerId && inviteStatus !== "accepted") return;

    const key = playerId
      ? `id:${String(playerId)}`
      : `name:${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    accepted.push({
      name,
      playerId: playerId ? String(playerId) : null
    });
  });

  return accepted;
};

const normalizePersonName = (value = "") => String(value || "").trim().toLowerCase();

// ========== BASIC CRUD OPERATIONS ==========

// Create new tournament
exports.createTournament = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      shortName,
      startDate, 
      endDate, 
      registrationDeadline,
      venue,
      venues, 
      format, 
      customOvers,
      tournamentType,
      maxTeams,
      minPlayers,
      maxPlayers,
      prizePool,
      pointsSystem,
      rules
    } = req.body;

    // Validation
    if (!name || !startDate || !endDate || !venue) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide all required fields (name, startDate, endDate, venue)" 
      });
    }

    // Date validation
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ 
        success: false,
        message: "End date must be after start date" 
      });
    }

    if (format === "Custom") {
      const oversValue = Number(customOvers);
      if (!Number.isFinite(oversValue) || oversValue < 1 || oversValue > 50) {
        return res.status(400).json({
          success: false,
          message: "customOvers must be between 1 and 50 for custom format"
        });
      }
    }

    const normalizedPrizePool = typeof prizePool === "string"
      ? {
          total: prizePool,
          winner: "",
          runnerUp: "",
          playerOfTournament: "",
          currency: "INR"
        }
      : prizePool;

    // Initialize standings array
    const standings = [];

    const tournament = await Tournament.create({
      name,
      description,
      shortName: shortName || name.substring(0, 10).toUpperCase(),
      startDate,
      endDate,
      registrationDeadline: registrationDeadline || startDate,
      venue,
      venues: venues || [{ name: venue, location: venue }],
      format: format || "T20",
      customOvers,
      tournamentType: tournamentType || "league_knockout",
      maxTeams: maxTeams || 8,
      minPlayers: minPlayers || 11,
      maxPlayers: maxPlayers || 15,
      prizePool: normalizedPrizePool,
      pointsSystem,
      rules,
      standings,
      createdBy: req.user._id,
      status: "registration_open"
    });

    res.status(201).json({
      success: true,
      message: "Tournament created successfully",
      tournament
    });
  } catch (error) {
    return sendServerError(res, "Failed to create tournament", error);
  }
};

// Get all tournaments
exports.getAllTournaments = async (req, res) => {
  try {
    const { status, type, upcoming } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.tournamentType = type;
    if (upcoming === 'true') {
      filter.startDate = { $gte: new Date() };
      filter.status = { $in: ['upcoming', 'registration_open', 'registration_closed'] };
    }

    const tournaments = await Tournament.find(filter)
      .populate("createdBy", "name email")
      .populate({
        path: "matches",
        select: "matchName status matchDate teamA.name teamB.name winner",
        options: { limit: 5, sort: { matchDate: -1 } }
      })
      .sort({ startDate: -1 });

    res.json({
      success: true,
      count: tournaments.length,
      tournaments
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch tournaments", error);
  }
};

// Get active/live tournaments
exports.getActiveTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.getActiveTournaments();
    
    res.json({
      success: true,
      count: tournaments.length,
      tournaments
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch active tournaments", error);
  }
};

// Get single tournament with full details
exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate({
        path: "matches",
        populate: {
          path: "createdBy",
          select: "name"
        }
      })
      .populate("registeredTeams.teamId")
      .populate("registeredTeams.players.playerId", "name email");

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    res.json({
      success: true,
      tournament
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch tournament", error);
  }
};

// ========== TEAM REGISTRATION ==========

// Register team in tournament
exports.registerTeam = async (req, res) => {
  try {
    const { 
      teamId,
      teamName, 
      captain, 
      viceCaptain,
      wicketkeeper,
      coach,
      players,
      group 
    } = req.body;
    const tournamentId = req.params.id;

    let resolvedTeamId = isValidObjectId(teamId) ? String(teamId) : null;
    let resolvedTeamName = String(teamName || "").trim();
    let resolvedCaptain = String(captain || "").trim();
    const resolvedViceCaptain = String(viceCaptain || "").trim();
    const resolvedWicketkeeper = String(wicketkeeper || "").trim();
    const resolvedCoach = String(coach || "").trim();
    let resolvedPlayers = normalizeTournamentPlayersInput(players || []);

    if (teamId && !resolvedTeamId) {
      return res.status(400).json({
        success: false,
        message: "Invalid teamId"
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check registration status
    if (tournament.status === 'registration_closed' || tournament.status === 'ongoing' || tournament.status === 'completed') {
      return res.status(400).json({ 
        success: false,
        message: "Registration is closed for this tournament" 
      });
    }

    // Check if tournament is full
    if (tournament.registeredTeams.length >= tournament.maxTeams) {
      return res.status(400).json({ 
        success: false,
        message: "Tournament is full. Maximum teams reached." 
      });
    }

    if (resolvedTeamId) {
      const savedTeam = await Team.findById(resolvedTeamId).populate("members.player", "name email");
      if (!savedTeam) {
        return res.status(404).json({
          success: false,
          message: "Selected team not found"
        });
      }

      if (String(savedTeam.owner) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "Only team owner can register this team"
        });
      }

      const acceptedMembers = getTeamAcceptedPlayers(savedTeam);
      if (acceptedMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Selected team has no accepted players"
        });
      }

      const acceptedById = new Map(
        acceptedMembers
          .filter((member) => member.playerId)
          .map((member) => [String(member.playerId), member])
      );
      const acceptedByName = new Map(
        acceptedMembers.map((member) => [normalizePersonName(member.name), member])
      );

      if (resolvedPlayers.length === 0) {
        resolvedPlayers = acceptedMembers.map((member) => ({
          name: member.name,
          playerId: member.playerId
        }));
      } else {
        const filteredPlayers = [];
        const seen = new Set();

        for (const rawPlayer of resolvedPlayers) {
          const normalizedName = normalizePersonName(rawPlayer.name);
          const byId = rawPlayer.playerId ? acceptedById.get(String(rawPlayer.playerId)) : null;
          const byName = normalizedName ? acceptedByName.get(normalizedName) : null;
          const matched = byId || byName || null;
          if (!matched) {
            return res.status(400).json({
              success: false,
              message: `Player '${rawPlayer.name}' is not an accepted member of selected team`
            });
          }

          const key = matched.playerId
            ? `id:${String(matched.playerId)}`
            : `name:${normalizePersonName(matched.name)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          filteredPlayers.push({
            name: matched.name,
            playerId: matched.playerId
          });
        }

        resolvedPlayers = filteredPlayers;
      }

      if (!resolvedCaptain && resolvedPlayers.length > 0) {
        resolvedCaptain = resolvedPlayers[0].name;
      }
      if (!resolvedTeamName) {
        resolvedTeamName = String(savedTeam.name || "").trim();
      }
    }

    // Validation
    if (!resolvedTeamName || !resolvedCaptain || resolvedPlayers.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide team name, captain, and players" 
      });
    }

    // Check if team name already exists
    const teamExists = tournament.registeredTeams.some(
      (t) => String(t.teamName || "").toLowerCase() === resolvedTeamName.toLowerCase()
    );
    if (teamExists) {
      return res.status(400).json({ 
        success: false,
        message: "Team name already registered in this tournament" 
      });
    }

    if (resolvedTeamId) {
      const duplicateTeamId = tournament.registeredTeams.some(
        (team) => team.teamId && team.teamId.toString() === String(resolvedTeamId)
      );
      if (duplicateTeamId) {
        return res.status(400).json({
          success: false,
          message: "This team is already registered in the tournament"
        });
      }
    }

    // Validate player count
    if (resolvedPlayers.length < tournament.minPlayers || resolvedPlayers.length > tournament.maxPlayers) {
      return res.status(400).json({ 
        success: false,
        message: `Team must have between ${tournament.minPlayers} and ${tournament.maxPlayers} players` 
      });
    }

    const hasCaptainInPlayers = resolvedPlayers.some(
      (player) => normalizePersonName(player.name) === normalizePersonName(resolvedCaptain)
    );
    if (!hasCaptainInPlayers) {
      return res.status(400).json({
        success: false,
        message: "Captain must be selected from team players"
      });
    }

    if (resolvedViceCaptain) {
      const hasViceCaptainInPlayers = resolvedPlayers.some(
        (player) => normalizePersonName(player.name) === normalizePersonName(resolvedViceCaptain)
      );
      if (!hasViceCaptainInPlayers) {
        return res.status(400).json({
          success: false,
          message: "Vice captain must be selected from team players"
        });
      }
    }

    if (resolvedWicketkeeper) {
      const hasWicketkeeperInPlayers = resolvedPlayers.some(
        (player) => normalizePersonName(player.name) === normalizePersonName(resolvedWicketkeeper)
      );
      if (!hasWicketkeeperInPlayers) {
        return res.status(400).json({
          success: false,
          message: "Wicketkeeper must be selected from team players"
        });
      }
    }

    const registrationPlayers = resolvedPlayers.map((player) => ({
      name: String(player.name || "").trim(),
      ...(player.playerId ? { playerId: player.playerId } : {}),
      ...(player.role ? { role: player.role } : {}),
      ...(Number.isFinite(player.jerseyNumber) ? { jerseyNumber: player.jerseyNumber } : {})
    }));

    // Add team to tournament
    tournament.registeredTeams.push({
      teamId: resolvedTeamId,
      teamName: resolvedTeamName,
      captain: resolvedCaptain,
      viceCaptain: resolvedViceCaptain || undefined,
      wicketkeeper: resolvedWicketkeeper || undefined,
      coach: resolvedCoach || undefined,
      players: registrationPlayers,
      group,
      registeredBy: req.user._id,
      stats: {
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        netRunRate: 0.0
      }
    });

    // Add to standings
    tournament.standings.push({
      teamName: resolvedTeamName,
      teamId: resolvedTeamId,
      position: tournament.standings.length + 1,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      netRunRate: 0.0,
      runsScored: 0,
      oversPlayed: 0,
      runsConceded: 0,
      oversBowled: 0,
      form: [],
      group
    });

    await tournament.save();

    res.json({
      success: true,
      message: "Team registered successfully",
      tournament
    });
  } catch (error) {
    return sendServerError(res, "Failed to register team", error);
  }
};

// Unregister team from tournament
exports.unregisterTeam = async (req, res) => {
  try {
    const { teamName, teamId } = req.body;
    const tournamentId = req.params.id;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check if tournament has started
    if (tournament.status === 'ongoing' || tournament.status === 'completed') {
      return res.status(400).json({ 
        success: false,
        message: "Cannot unregister after tournament has started" 
      });
    }

    const byTeamId = (team) => teamId && team.teamId && String(team.teamId) === String(teamId);
    const byTeamName = (team) =>
      teamName && String(team.teamName).toLowerCase() === String(teamName).toLowerCase();
    const matchesTeam = (team) => Boolean(byTeamId(team) || byTeamName(team));

    const targetTeam = tournament.registeredTeams.find(matchesTeam);
    if (!targetTeam) {
      return res.status(404).json({
        success: false,
        message: "Team not registered in this tournament"
      });
    }

    const isTournamentOwner = String(tournament.createdBy || "") === String(req.user._id || "");
    const isTeamRegistrant = String(targetTeam.registeredBy || "") === String(req.user._id || "");
    if (!isTournamentOwner && !isTeamRegistrant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to unregister this team"
      });
    }

    tournament.registeredTeams = tournament.registeredTeams.filter((team) => !matchesTeam(team));
    tournament.standings = tournament.standings.filter((standing) => !matchesTeam(standing));

    await tournament.save();

    res.json({
      success: true,
      message: "Team unregistered successfully",
      tournament
    });
  } catch (error) {
    return sendServerError(res, "Failed to unregister team", error);
  }
};

// ========== FIXTURE GENERATION ==========

// Generate league fixtures (Round-robin algorithm)
exports.generateFixtures = async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check authorization
    if (tournament.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to generate fixtures" 
      });
    }

    const teams = tournament.registeredTeams.map(t => t.teamName);
    
    if (teams.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: "Need at least 2 teams to generate fixtures" 
      });
    }

    let fixtures = [];

    if (tournament.tournamentType === 'league' || tournament.tournamentType === 'league_knockout') {
      // Round-robin algorithm (Circle method)
      fixtures = generateRoundRobinFixtures(teams, tournament.venues || [{ name: tournament.venue }]);
    } else if (tournament.tournamentType === 'knockout') {
      // Single elimination bracket
      fixtures = generateKnockoutFixtures(teams, tournament.venues || [{ name: tournament.venue }]);
    } else if (tournament.tournamentType === 'group_stage') {
      // Group-wise round-robin
      fixtures = generateGroupStageFixtures(tournament);
    }

    // Assign dates to fixtures
    const startDate = new Date(tournament.startDate);
    fixtures.forEach((fixture, index) => {
      const dayOffset = Math.floor(index / 2); // 2 matches per day
      const matchDate = new Date(startDate);
      matchDate.setDate(startDate.getDate() + dayOffset);
      fixture.date = matchDate;
      fixture.time = index % 2 === 0 ? "14:00" : "19:00"; // Afternoon and evening slots
    });

    tournament.schedule = fixtures;
    tournament.status = "registration_closed";
    await tournament.save();

    res.json({
      success: true,
      message: `${fixtures.length} fixtures generated successfully`,
      fixtures: tournament.schedule
    });
  } catch (error) {
    return sendServerError(res, "Failed to generate fixtures", error);
  }
};

// Helper: Round-robin fixture generation (Circle method)
function generateRoundRobinFixtures(teams, venues) {
  const fixtures = [];
  const teamsCopy = [...teams];
  let matchNumber = 1;

  // If odd number of teams, add a "BYE"
  if (teamsCopy.length % 2 !== 0) {
    teamsCopy.push("BYE");
  }

  const numRounds = teamsCopy.length - 1;
  const halfSize = teamsCopy.length / 2;

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < halfSize; i++) {
      const team1 = teamsCopy[i];
      const team2 = teamsCopy[teamsCopy.length - 1 - i];

      // Skip if either team is BYE
      if (team1 !== "BYE" && team2 !== "BYE") {
        fixtures.push({
          round: `Round ${round + 1}`,
          matchNumber: matchNumber++,
          teamA: team1,
          teamB: team2,
          venue: venues[Math.floor(Math.random() * venues.length)].name,
          status: 'scheduled'
        });
      }
    }

    // Rotate teams (keep first team fixed, rotate others)
    teamsCopy.splice(1, 0, teamsCopy.pop());
  }

  return fixtures;
}

// Helper: Knockout bracket generation
function generateKnockoutFixtures(teams, venues) {
  const fixtures = [];
  let matchNumber = 1;
  const numTeams = teams.length;

  // Round 1 (or Quarter-finals, etc.)
  for (let i = 0; i < numTeams; i += 2) {
    if (i + 1 < numTeams) {
      fixtures.push({
        round: `Round 1`,
        matchNumber: matchNumber++,
        teamA: teams[i],
        teamB: teams[i + 1],
        venue: venues[Math.floor(Math.random() * venues.length)].name,
        status: 'scheduled'
      });
    }
  }

  return fixtures;
}

// Helper: Group stage fixtures
function generateGroupStageFixtures(tournament) {
  const fixtures = [];
  let matchNumber = 1;

  tournament.groups.forEach(group => {
    const groupFixtures = generateRoundRobinFixtures(group.teams, tournament.venues || [{ name: tournament.venue }]);
    groupFixtures.forEach(fixture => {
      fixture.matchNumber = matchNumber++;
      fixture.round = `Group ${group.name} - ${fixture.round}`;
      fixtures.push(fixture);
    });
  });

  return fixtures;
}

// ========== STANDINGS & POINTS TABLE ==========

// Get tournament standings/points table
exports.getStandings = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Sort standings by points, then NRR
    const sortedStandings = tournament.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.netRunRate - a.netRunRate;
    });

    // Update positions
    sortedStandings.forEach((team, index) => {
      team.position = index + 1;
    });

    res.json({
      success: true,
      standings: sortedStandings
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch standings", error);
  }
};

// Update standings after a match (called by matchController)
exports.updateStandings = async (req, res) => {
  try {
    const { 
      tournamentId,
      teamA, 
      teamB, 
      winner,
      teamAScore,
      teamBScore,
      teamAOvers,
      teamBOvers,
      resultType 
    } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Find teams in standings
    let teamAStanding = tournament.standings.find(s => s.teamName === teamA);
    let teamBStanding = tournament.standings.find(s => s.teamName === teamB);

    if (!teamAStanding || !teamBStanding) {
      return res.status(400).json({ 
        success: false,
        message: "Teams not found in standings" 
      });
    }

    // Update match statistics
    teamAStanding.played++;
    teamBStanding.played++;

    const normalizedTeamAScore = Number(teamAScore) || 0;
    const normalizedTeamBScore = Number(teamBScore) || 0;
    const normalizedTeamAOvers = parseOversToDecimal(teamAOvers);
    const normalizedTeamBOvers = parseOversToDecimal(teamBOvers);
    const pointsSystem = {
      win: Number(tournament.pointsSystem?.win ?? 2),
      loss: Number(tournament.pointsSystem?.loss ?? 0),
      tie: Number(tournament.pointsSystem?.tie ?? 1),
      noResult: Number(tournament.pointsSystem?.noResult ?? 1)
    };

    // Update runs and overs for NRR calculation
    teamAStanding.runsScored += normalizedTeamAScore;
    teamAStanding.oversPlayed += normalizedTeamAOvers;
    teamAStanding.runsConceded += normalizedTeamBScore;
    teamAStanding.oversBowled += normalizedTeamBOvers;

    teamBStanding.runsScored += normalizedTeamBScore;
    teamBStanding.oversPlayed += normalizedTeamBOvers;
    teamBStanding.runsConceded += normalizedTeamAScore;
    teamBStanding.oversBowled += normalizedTeamAOvers;

    // Update wins/losses/ties
    if (resultType === 'tie') {
      teamAStanding.tied++;
      teamBStanding.tied++;
      teamAStanding.points += pointsSystem.tie;
      teamBStanding.points += pointsSystem.tie;
      teamAStanding.form.push('T');
      teamBStanding.form.push('T');
    } else if (resultType === 'no_result') {
      teamAStanding.noResult++;
      teamBStanding.noResult++;
      teamAStanding.points += pointsSystem.noResult;
      teamBStanding.points += pointsSystem.noResult;
      teamAStanding.form.push('NR');
      teamBStanding.form.push('NR');
    } else if (winner === teamA) {
      teamAStanding.won++;
      teamBStanding.lost++;
      teamAStanding.points += pointsSystem.win;
      teamBStanding.points += pointsSystem.loss;
      teamAStanding.form.push('W');
      teamBStanding.form.push('L');
    } else if (winner === teamB) {
      teamBStanding.won++;
      teamAStanding.lost++;
      teamBStanding.points += pointsSystem.win;
      teamAStanding.points += pointsSystem.loss;
      teamBStanding.form.push('W');
      teamAStanding.form.push('L');
    }

    // Keep only last 5 form results
    if (teamAStanding.form.length > 5) teamAStanding.form.shift();
    if (teamBStanding.form.length > 5) teamBStanding.form.shift();

    // Calculate NRR
    tournament.calculateNRR(teamAStanding);
    tournament.calculateNRR(teamBStanding);

    // Sort standings
    tournament.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.netRunRate - a.netRunRate;
    });

    // Update positions
    tournament.standings.forEach((team, index) => {
      team.position = index + 1;
    });

    // Update tournament statistics
    tournament.statistics.completedMatches++;

    await tournament.save();

    res.json({
      success: true,
      message: "Standings updated successfully",
      standings: tournament.standings
    });
  } catch (error) {
    return sendServerError(res, "Failed to update standings", error);
  }
};

// ========== PLAYOFF GENERATION (IPL Style) ==========

// Generate playoff bracket
exports.generatePlayoffs = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check authorization
    if (tournament.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to generate playoffs" 
      });
    }

    if (tournament.standings.length < 4) {
      return res.status(400).json({ 
        success: false,
        message: "Need at least 4 teams for playoffs" 
      });
    }

    // Sort standings to get top 4
    const sortedStandings = tournament.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.netRunRate - a.netRunRate;
    });

    const top4 = sortedStandings.slice(0, 4);

    if (tournament.knockout.playoffFormat === 'ipl_style') {
      // IPL Format: Qualifier 1, Eliminator, Qualifier 2, Final
      tournament.knockout.qualifier1 = {
        team1: top4[0].teamName,
        team2: top4[1].teamName,
        venue: tournament.venues[0]?.name || tournament.venue,
        date: new Date(tournament.endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days before end
      };

      tournament.knockout.eliminator = {
        team1: top4[2].teamName,
        team2: top4[3].teamName,
        venue: tournament.venues[1]?.name || tournament.venue,
        date: new Date(tournament.endDate.getTime() - 6 * 24 * 60 * 60 * 1000)
      };

      tournament.knockout.qualifier2 = {
        team1: "TBD (Loser of Q1)",
        team2: "TBD (Winner of Eliminator)",
        venue: tournament.venues[0]?.name || tournament.venue,
        date: new Date(tournament.endDate.getTime() - 4 * 24 * 60 * 60 * 1000)
      };

      tournament.knockout.final = {
        team1: "TBD (Winner of Q1)",
        team2: "TBD (Winner of Q2)",
        venue: tournament.venue,
        date: tournament.endDate
      };
    } else {
      // Standard: Semi-Final 1, Semi-Final 2, Final
      tournament.knockout.semiFinals = [
        {
          team1: top4[0].teamName,
          team2: top4[3].teamName,
          venue: tournament.venues[0]?.name || tournament.venue,
          date: new Date(tournament.endDate.getTime() - 5 * 24 * 60 * 60 * 1000)
        },
        {
          team1: top4[1].teamName,
          team2: top4[2].teamName,
          venue: tournament.venues[1]?.name || tournament.venue,
          date: new Date(tournament.endDate.getTime() - 4 * 24 * 60 * 60 * 1000)
        }
      ];

      tournament.knockout.final = {
        team1: "TBD (Winner of SF1)",
        team2: "TBD (Winner of SF2)",
        venue: tournament.venue,
        date: tournament.endDate
      };
    }

    tournament.status = "playoffs";
    await tournament.save();

    res.json({
      success: true,
      message: "Playoff bracket generated successfully",
      knockout: tournament.knockout
    });
  } catch (error) {
    return sendServerError(res, "Failed to generate playoffs", error);
  }
};

// ========== TOURNAMENT STATUS MANAGEMENT ==========

// Update tournament status
exports.updateTournamentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check authorization
    if (tournament.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to update tournament status" 
      });
    }

    const validStatuses = [
      "upcoming",
      "registration_open",
      "registration_closed",
      "ongoing",
      "playoffs",
      "completed",
      "cancelled"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tournament status"
      });
    }

    tournament.status = status;
    await tournament.save();

    res.json({
      success: true,
      message: "Tournament status updated",
      tournament
    });
  } catch (error) {
    return sendServerError(res, "Failed to update tournament", error);
  }
};

// ========== DELETE TOURNAMENT ==========

// Delete tournament
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    // Check authorization
    if (tournament.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to delete this tournament" 
      });
    }

    // Prevent deletion of ongoing/completed tournaments
    if (tournament.status === 'ongoing' || tournament.status === 'playoffs') {
      return res.status(400).json({ 
        success: false,
        message: "Cannot delete an ongoing tournament" 
      });
    }

    // Delete associated matches (optional - you may want to keep them)
    // await Match.deleteMany({ tournament: tournament._id });

    await tournament.deleteOne();

    res.json({ 
      success: true,
      message: "Tournament deleted successfully" 
    });
  } catch (error) {
    return sendServerError(res, "Failed to delete tournament", error);
  }
};

// ========== TOURNAMENT STATISTICS ==========

// Get tournament statistics
exports.getTournamentStats = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate("matches");

    if (!tournament) {
      return res.status(404).json({ 
        success: false,
        message: "Tournament not found" 
      });
    }

    res.json({
      success: true,
      statistics: tournament.statistics,
      awards: tournament.awards
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch tournament statistics", error);
  }
};


