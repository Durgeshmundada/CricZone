const Tournament = require("../models/Tournament");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");

const REGISTRATION_OPEN_STATES = new Set(["upcoming", "registration_open"]);

const presentTournament = (tournament) => ({
  _id: tournament._id,
  name: tournament.name,
  description: tournament.description,
  startDate: tournament.startDate,
  endDate: tournament.endDate,
  venue: tournament.venue,
  format: tournament.format,
  maxTeams: tournament.maxTeams,
  minPlayers: tournament.minPlayers,
  maxPlayers: tournament.maxPlayers,
  registeredTeams: tournament.registeredTeams,
  status: tournament.status,
  createdBy: tournament.createdBy,
  matches: tournament.matches,
  winner: tournament.winner,
  prizePool: tournament.prizePool,
  createdAt: tournament.createdAt,
  updatedAt: tournament.updatedAt
});

exports.createTournament = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const venue = String(req.body.venue || "").trim();
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  const maxTeams = Number.parseInt(req.body.maxTeams, 10);
  const minPlayers = Number.parseInt(req.body.minPlayers, 10);
  const maxPlayers = Number.parseInt(req.body.maxPlayers, 10);

  if (!name || !venue || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw createError(400, "Tournament name, venue, start date, and end date are required");
  }

  if (endDate < startDate) {
    throw createError(400, "End date must be on or after start date");
  }

  const safeMaxTeams = Number.isFinite(maxTeams) ? maxTeams : 8;
  const safeMinPlayers = Number.isFinite(minPlayers) ? minPlayers : 11;
  const safeMaxPlayers = Number.isFinite(maxPlayers) ? maxPlayers : 15;

  if (safeMaxTeams < 2) {
    throw createError(400, "Tournament must allow at least two teams");
  }
  if (safeMinPlayers < 2) {
    throw createError(400, "Each team must have at least two players");
  }
  if (safeMaxPlayers < safeMinPlayers) {
    throw createError(400, "Maximum players must be greater than or equal to minimum players");
  }

  const tournament = await Tournament.create({
    name,
    description: String(req.body.description || "").trim(),
    startDate,
    endDate,
    venue,
    format: String(req.body.format || "T20"),
    maxTeams: safeMaxTeams,
    minPlayers: safeMinPlayers,
    maxPlayers: safeMaxPlayers,
    prizePool: String(req.body.prizePool || "TBD").trim() || "TBD",
    createdBy: req.user._id,
    status: "upcoming"
  });

  return sendSuccess(res, {
    message: "Tournament created successfully",
    tournament: presentTournament(tournament),
    data: presentTournament(tournament)
  }, 201);
});

exports.getAllTournaments = asyncHandler(async (_req, res) => {
  const tournaments = await Tournament.find()
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  return sendSuccess(res, {
    count: tournaments.length,
    tournaments: tournaments.map(presentTournament),
    data: tournaments.map(presentTournament)
  });
});

exports.getTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("matches");

  if (!tournament) {
    throw createError(404, "Tournament not found");
  }

  return sendSuccess(res, {
    tournament: presentTournament(tournament),
    data: presentTournament(tournament)
  });
});

exports.registerTeam = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) {
    throw createError(404, "Tournament not found");
  }

  if (!REGISTRATION_OPEN_STATES.has(String(tournament.status || "").toLowerCase())) {
    throw createError(409, "Tournament registration is closed");
  }

  if (tournament.registeredTeams.length >= tournament.maxTeams) {
    throw createError(409, "Tournament is full");
  }

  const teamName = String(req.body.teamName || "").trim();
  const captain = String(req.body.captain || "").trim();
  const players = Array.isArray(req.body.players) ? req.body.players : [];
  const normalizedPlayers = players
    .map((player) => ({
      name: String(player?.name || "").trim(),
      playerId: player?.playerId || null
    }))
    .filter((player) => player.name);

  if (!teamName || !captain || normalizedPlayers.length === 0) {
    throw createError(400, "Team name, captain, and players are required");
  }

  if (normalizedPlayers.length < tournament.minPlayers || normalizedPlayers.length > tournament.maxPlayers) {
    throw createError(400, `Select ${tournament.minPlayers}-${tournament.maxPlayers} players`);
  }

  const playerKeys = new Set();
  for (const player of normalizedPlayers) {
    const key = `${String(player.playerId || "").trim()}::${player.name.toLowerCase()}`;
    if (playerKeys.has(key)) {
      throw createError(400, "Duplicate players are not allowed in a tournament registration");
    }
    playerKeys.add(key);
  }

  if (!normalizedPlayers.some((player) => player.name === captain)) {
    throw createError(400, "Captain must be selected from the registered players");
  }

  const viceCaptain = String(req.body.viceCaptain || "").trim();
  if (viceCaptain && !normalizedPlayers.some((player) => player.name === viceCaptain)) {
    throw createError(400, "Vice captain must be selected from the registered players");
  }

  const wicketkeeper = String(req.body.wicketkeeper || "").trim();
  if (wicketkeeper && !normalizedPlayers.some((player) => player.name === wicketkeeper)) {
    throw createError(400, "Wicketkeeper must be selected from the registered players");
  }

  const alreadyRegistered = tournament.registeredTeams.some(
    (entry) =>
      String(entry.registeredBy) === String(req.user._id) ||
      (req.body.teamId && String(entry.teamId || "") === String(req.body.teamId)) ||
      String(entry.teamName || "").toLowerCase() === teamName.toLowerCase()
  );

  if (alreadyRegistered) {
    throw createError(409, "This team or user is already registered");
  }

  tournament.registeredTeams.push({
    teamId: req.body.teamId || null,
    teamName,
    captain,
    viceCaptain,
    wicketkeeper,
    coach: String(req.body.coach || "").trim(),
    players: normalizedPlayers,
    registeredBy: req.user._id
  });

  await tournament.save();

  return sendSuccess(res, {
    message: "Team registered successfully",
    tournament: presentTournament(tournament),
    data: presentTournament(tournament)
  });
});

exports.unregisterTeam = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) {
    throw createError(404, "Tournament not found");
  }

  if (!REGISTRATION_OPEN_STATES.has(String(tournament.status || "").toLowerCase())) {
    throw createError(409, "Cannot unregister after tournament has started");
  }

  const beforeCount = tournament.registeredTeams.length;
  tournament.registeredTeams = tournament.registeredTeams.filter((entry) => {
    const matchesUser = String(entry.registeredBy) === String(req.user._id);
    const matchesTeam = req.body.teamId && String(entry.teamId || "") === String(req.body.teamId);
    const matchesName = req.body.teamName && String(entry.teamName || "").toLowerCase() === String(req.body.teamName).trim().toLowerCase();
    return !(matchesUser || matchesTeam || matchesName);
  });

  if (beforeCount === tournament.registeredTeams.length) {
    throw createError(404, "Registered team not found for this user");
  }

  await tournament.save();

  return sendSuccess(res, {
    message: "Team unregistered successfully",
    tournament: presentTournament(tournament),
    data: presentTournament(tournament)
  });
});

exports.updateTournamentStatus = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) {
    throw createError(404, "Tournament not found");
  }

  const isOwner = String(tournament.createdBy) === String(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw createError(403, "Not authorized to update this tournament");
  }

  const nextStatus = String(req.body.status || "").trim();
  if (!["upcoming", "registration_open", "ongoing", "playoffs", "completed", "cancelled"].includes(nextStatus)) {
    throw createError(400, "Invalid tournament status");
  }

  tournament.status = nextStatus;
  await tournament.save();

  return sendSuccess(res, {
    message: "Tournament status updated",
    tournament: presentTournament(tournament),
    data: presentTournament(tournament)
  });
});

exports.deleteTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) {
    throw createError(404, "Tournament not found");
  }

  const isOwner = String(tournament.createdBy) === String(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw createError(403, "Not authorized to delete this tournament");
  }

  await tournament.deleteOne();

  return sendSuccess(res, {
    message: "Tournament deleted successfully"
  });
});
