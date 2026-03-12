const Match = require("../models/Match");
const Team = require("../models/Team");
const Tournament = require("../models/Tournament");
const User = require("../models/User");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");
const {
  determineWinner,
  deriveInningState,
  getOversLimit,
  normalizeBallEvents
} = require("../utils/matchEngine");
const { formatOversFromBalls, parseOversInput } = require("../utils/time");
const { buildPlayerLink } = require("../utils/presenters");

const toObject = (document) => (typeof document?.toObject === "function" ? document.toObject() : document);

const isMatchOwner = (match, user) =>
  String(match.createdBy) === String(user._id) || user.role === "admin";

const serializeMatch = (match) => toObject(match);

const dedupePlayers = (players = []) => {
  const seen = new Set();
  return players.filter((player) => {
    const key = `${String(player.email || "").toLowerCase()}::${String(player.name || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const linkPlayers = async (players = []) => {
  const linked = [];

  for (const player of dedupePlayers(players)) {
    const name = String(player?.name || "").trim();
    const email = String(player?.email || "").trim().toLowerCase();
    if (!name) continue;

    let userId = player?.userId || null;
    if (!userId && email) {
      const user = await User.findOne({ email }).select("_id name email");
      if (user) {
        userId = user._id;
      }
    }

    linked.push(
      buildPlayerLink({
        name,
        email,
        userId
      })
    );
  }

  return linked;
};

const ensureReusableTeam = async (ownerId, name, playerLinks) => {
  if (!ownerId || !name) return;

  await Team.findOneAndUpdate(
    { owner: ownerId, name },
    {
      owner: ownerId,
      name,
      members: playerLinks.map((player) => ({
        name: player.name,
        email: player.email || "",
        player: player.userId || null,
        inviteStatus: "accepted"
      }))
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true,
      runValidators: true
    }
  );
};

const replaceInningCollections = (existingItems, inningNumber, replacementItems) => {
  const others = Array.isArray(existingItems)
    ? existingItems.filter((item) => Number(item?.inning) !== Number(inningNumber))
    : [];
  return [...others, ...replacementItems];
};

const applyMatchStats = async (match) => {
  if (match.statsAppliedAt) return;

  const userUpdates = new Map();

  const ensureUpdate = (userId) => {
    const key = String(userId || "").trim();
    if (!key) return null;
    if (!userUpdates.has(key)) {
      userUpdates.set(key, {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        batting: {
          innings: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          highestScore: 0
        },
        bowling: {
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0
        }
      });
    }
    return userUpdates.get(key);
  };

  const applyTeamOutcome = (teamKey, teamSnapshot) => {
    for (const player of teamSnapshot?.playerLinks || []) {
      if (!player?.userId) continue;
      const update = ensureUpdate(player.userId);
      if (!update) continue;
      update.matchesPlayed += 1;
      if (match.result?.winnerTeam && match.result.winnerTeam === teamKey) {
        update.wins += 1;
      } else if (match.result?.winnerTeam) {
        update.losses += 1;
      }
    }
  };

  applyTeamOutcome("teamA", match.teamA);
  applyTeamOutcome("teamB", match.teamB);

  for (const batting of match.batsmanStats || []) {
    if (!batting.playerId) continue;
    const update = ensureUpdate(batting.playerId);
    if (!update) continue;
    update.batting.innings += 1;
    update.batting.runs += Number(batting.runs || 0);
    update.batting.ballsFaced += Number(batting.ballsFaced || 0);
    update.batting.fours += Number(batting.fours || 0);
    update.batting.sixes += Number(batting.sixes || 0);
    update.batting.highestScore = Math.max(update.batting.highestScore, Number(batting.runs || 0));
  }

  for (const bowling of match.bowlerStats || []) {
    if (!bowling.playerId) continue;
    const update = ensureUpdate(bowling.playerId);
    if (!update) continue;
    update.bowling.balls += Number(bowling.balls || 0);
    update.bowling.runs += Number(bowling.runs || 0);
    update.bowling.wickets += Number(bowling.wickets || 0);
    update.bowling.wides += Number(bowling.wides || 0);
    update.bowling.noBalls += Number(bowling.noBalls || 0);
  }

  const userIds = Array.from(userUpdates.keys());
  const users = await User.find({ _id: { $in: userIds } });
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  for (const [userId, update] of userUpdates.entries()) {
    const user = usersById.get(userId);
    if (!user) continue;

    user.stats.matchesPlayed += update.matchesPlayed;
    user.stats.wins += update.wins;
    user.stats.losses += update.losses;

    user.stats.batting.innings += update.batting.innings;
    user.stats.batting.runs += update.batting.runs;
    user.stats.batting.ballsFaced += update.batting.ballsFaced;
    user.stats.batting.fours += update.batting.fours;
    user.stats.batting.sixes += update.batting.sixes;
    user.stats.batting.highestScore = Math.max(
      Number(user.stats.batting.highestScore || 0),
      update.batting.highestScore
    );
    user.stats.batting.strikeRate = user.stats.batting.ballsFaced > 0
      ? Number(((user.stats.batting.runs / user.stats.batting.ballsFaced) * 100).toFixed(2))
      : 0;

    user.stats.bowling.balls += update.bowling.balls;
    user.stats.bowling.runs += update.bowling.runs;
    user.stats.bowling.wickets += update.bowling.wickets;
    user.stats.bowling.wides += update.bowling.wides;
    user.stats.bowling.noBalls += update.bowling.noBalls;
    user.stats.bowling.economy = user.stats.bowling.balls > 0
      ? Number(((user.stats.bowling.runs / user.stats.bowling.balls) * 6).toFixed(2))
      : 0;

    await user.save();
  }

  match.statsAppliedAt = new Date();
};

exports.createMatch = asyncHandler(async (req, res) => {
  const matchName = String(req.body.matchName || "").trim();
  const venue = String(req.body.venue || "").trim();
  const teamAName = String(req.body.teamAName || "").trim();
  const teamBName = String(req.body.teamBName || "").trim();
  const matchDate = new Date(req.body.matchDate);

  if (!matchName || !venue || !teamAName || !teamBName || Number.isNaN(matchDate.getTime())) {
    throw createError(400, "Match name, teams, venue, and match date are required");
  }

  if (teamAName.toLowerCase() === teamBName.toLowerCase()) {
    throw createError(400, "Team names must be different");
  }

  const oversLimit = getOversLimit(req.body.matchType, req.body.customOvers);
  const teamAPlayerLinks = await linkPlayers(req.body.teamAPlayers || []);
  const teamBPlayerLinks = await linkPlayers(req.body.teamBPlayers || []);

  const match = await Match.create({
    matchName,
    matchType: String(req.body.matchType || "T20"),
    oversLimit,
    venue,
    matchDate,
    createdBy: req.user._id,
    tournamentId: req.body.tournamentId || null,
    teamA: {
      name: teamAName,
      players: teamAPlayerLinks.map((player) => player.name),
      playerLinks: teamAPlayerLinks,
      score: 0,
      wickets: 0,
      overs: "0.0"
    },
    teamB: {
      name: teamBName,
      players: teamBPlayerLinks.map((player) => player.name),
      playerLinks: teamBPlayerLinks,
      score: 0,
      wickets: 0,
      overs: "0.0"
    },
    innings: {
      first: {
        battingTeam: "teamA",
        score: 0,
        wickets: 0,
        overs: "0.0",
        balls: 0,
        target: 0,
        runRate: 0,
        requiredRunRate: 0,
        isComplete: false
      },
      second: {
        battingTeam: "teamB",
        score: 0,
        wickets: 0,
        overs: "0.0",
        balls: 0,
        target: 0,
        runRate: 0,
        requiredRunRate: 0,
        isComplete: false
      }
    }
  });

  await ensureReusableTeam(req.user._id, teamAName, teamAPlayerLinks);
  await ensureReusableTeam(req.user._id, teamBName, teamBPlayerLinks);

  if (match.tournamentId) {
    await Tournament.findByIdAndUpdate(match.tournamentId, {
      $addToSet: { matches: match._id }
    });
  }

  return sendSuccess(res, {
    message: "Match created successfully",
    data: serializeMatch(match)
  }, 201);
});

exports.getAllMatches = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.tournamentId) {
    query.tournamentId = req.query.tournamentId;
  }

  const matches = await Match.find(query).sort({ matchDate: -1, createdAt: -1 });

  return sendSuccess(res, {
    data: matches.map(serializeMatch)
  });
});

exports.getMyMatches = asyncHandler(async (req, res) => {
  const matches = await Match.find({
    $or: [
      { createdBy: req.user._id },
      { "teamA.playerLinks.userId": req.user._id },
      { "teamB.playerLinks.userId": req.user._id }
    ]
  }).sort({ matchDate: -1, createdAt: -1 });

  return sendSuccess(res, {
    data: matches.map(serializeMatch)
  });
});

exports.getMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId || req.params.id);
  if (!match) {
    throw createError(404, "Match not found");
  }

  return sendSuccess(res, {
    data: serializeMatch(match)
  });
});

exports.setToss = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId);
  if (!match) {
    throw createError(404, "Match not found");
  }

  if (!isMatchOwner(match, req.user)) {
    throw createError(403, "Not authorized to manage this match");
  }

  if (match.status === "completed") {
    throw createError(409, "Completed matches cannot be restarted");
  }

  const tossWinnerTeam = String(req.body.tossWinnerTeam || "").trim();
  const decision = String(req.body.decision || "").trim().toLowerCase();
  if (!["teamA", "teamB"].includes(tossWinnerTeam) || !["bat", "bowl"].includes(decision)) {
    throw createError(400, "Invalid toss details");
  }

  const battingTeam = decision === "bat"
    ? tossWinnerTeam
    : (tossWinnerTeam === "teamA" ? "teamB" : "teamA");

  match.toss = {
    winner: tossWinnerTeam,
    decision,
    at: new Date()
  };
  match.status = "live";
  match.currentInning = 1;
  match.innings.first.battingTeam = battingTeam;
  match.innings.second.battingTeam = battingTeam === "teamA" ? "teamB" : "teamA";
  match.currentStriker = "";
  match.currentStrikerId = null;
  match.currentNonStriker = "";
  match.currentNonStrikerId = null;
  match.currentBowler = "";
  match.currentBowlerId = null;

  await match.save();

  return sendSuccess(res, {
    message: "Toss saved and match started",
    data: serializeMatch(match)
  });
});

exports.saveScore = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId);
  if (!match) {
    throw createError(404, "Match not found");
  }

  if (!isMatchOwner(match, req.user)) {
    throw createError(403, "Not authorized to score this match");
  }

  if (match.status === "completed") {
    throw createError(409, "Match has already been completed");
  }

  if (!match.toss?.winner || !match.toss?.decision) {
    throw createError(409, "Match toss must be set before scoring begins");
  }

  const inningNumber = Number(match.currentInning || 1);
  const inningKey = inningNumber === 1 ? "first" : "second";
  const battingTeamKey = match.innings[inningKey].battingTeam;
  const ballEvents = normalizeBallEvents(inningNumber, req.body.ballEvents || []);
  const inningState = deriveInningState(
    inningNumber,
    ballEvents,
    match.oversLimit,
    battingTeamKey,
    Number(match.innings.first.score || 0)
  );
  const submittedBalls = parseOversInput(req.body.overs);

  if (submittedBalls === null) {
    throw createError(400, "Overs must be in O.B format with 0-5 balls in the current over");
  }

  if (Number(req.body.runs) !== inningState.score) {
    throw createError(400, `Runs do not match ball events. Expected ${inningState.score}`);
  }
  if (Number(req.body.wickets) !== inningState.wickets) {
    throw createError(400, `Wickets do not match ball events. Expected ${inningState.wickets}`);
  }
  if (submittedBalls !== inningState.balls) {
    throw createError(400, `Overs do not match ball events. Expected ${formatOversFromBalls(inningState.balls)}`);
  }

  match.innings[inningKey] = {
    ...match.innings[inningKey].toObject(),
    ...inningState
  };

  if (battingTeamKey === "teamA") {
    match.teamA.score = inningState.score;
    match.teamA.wickets = inningState.wickets;
    match.teamA.overs = inningState.overs;
  } else {
    match.teamB.score = inningState.score;
    match.teamB.wickets = inningState.wickets;
    match.teamB.overs = inningState.overs;
  }

  match.ballByBallData = replaceInningCollections(match.ballByBallData, inningNumber, ballEvents);
  match.batsmanStats = replaceInningCollections(match.batsmanStats, inningNumber, inningState.batsmanStats);
  match.bowlerStats = replaceInningCollections(match.bowlerStats, inningNumber, inningState.bowlerStats);
  match.fallOfWickets = replaceInningCollections(match.fallOfWickets, inningNumber, inningState.fallOfWickets);

  match.currentStriker = String(req.body.batsmanName || "").trim();
  match.currentStrikerId = req.body.batsmanId || null;
  match.currentNonStriker = String(req.body.nonStrikerName || "").trim();
  match.currentNonStrikerId = req.body.nonStrikerId || null;
  match.currentBowler = String(req.body.bowlerName || "").trim();
  match.currentBowlerId = req.body.bowlerId || null;
  match.status = "live";

  let inningsComplete = false;
  let matchComplete = false;
  let message = "Score updated successfully";

  if (inningState.isComplete) {
    inningsComplete = true;
    match.currentStriker = "";
    match.currentStrikerId = null;
    match.currentNonStriker = "";
    match.currentNonStrikerId = null;
    match.currentBowler = "";
    match.currentBowlerId = null;

    if (inningNumber === 1) {
      match.currentInning = 2;
      match.innings.second.target = inningState.score + 1;
      message = "First innings complete. Re-open scoring to start the chase.";
    } else {
      match.status = "completed";
      match.result = determineWinner(match);
      message = match.result.message || "Match completed";
      matchComplete = true;
      await applyMatchStats(match);
    }
  }

  await match.save();

  return sendSuccess(res, {
    message,
    inningsComplete,
    matchComplete,
    data: serializeMatch(match)
  });
});

exports.getMatchReport = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId);
  if (!match) {
    throw createError(404, "Match not found");
  }

  const rows = [
    ["Match", match.matchName],
    ["Venue", match.venue],
    ["Date", new Date(match.matchDate).toISOString().slice(0, 10)],
    ["Status", match.status],
    ["Result", match.result?.message || ""],
    [],
    ["Team", "Score", "Wickets", "Overs"],
    [match.teamA.name, match.teamA.score, match.teamA.wickets, match.teamA.overs],
    [match.teamB.name, match.teamB.score, match.teamB.wickets, match.teamB.overs]
  ];

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="match-report-${match._id}.csv"`);
  return res.status(200).send(csv);
});
