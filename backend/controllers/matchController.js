// backend/controllers/matchController.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');
const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const normalizePlayersInput = (rawPlayers) => {
  const entries = [];

  const parseStringEntry = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return;

    const [namePart, emailPart] = raw.split('|').map((item) => String(item || '').trim());
    const email = emailPart || (namePart.includes('@') ? namePart : '');
    const name = (emailPart ? namePart : namePart.replace(/@.*/, '')).trim();
    if (!name && !email) return;

    entries.push({
      name: name || email.split('@')[0],
      email: email ? email.toLowerCase() : '',
      userId: null
    });
  };

  if (typeof rawPlayers === 'string') {
    rawPlayers
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(parseStringEntry);

    return entries;
  }

  if (!Array.isArray(rawPlayers)) {
    return entries;
  }

  rawPlayers.forEach((item) => {
    if (typeof item === 'string') {
      parseStringEntry(item);
      return;
    }

    if (!item || typeof item !== 'object') return;

    const userIdRaw = item.userId || item.playerId || item.id || null;
    const userId = isValidObjectId(userIdRaw) ? String(userIdRaw) : null;
    const email = String(item.email || '').trim().toLowerCase();
    const name = String(item.name || item.playerName || '').trim();
    if (!name && !email && !userId) return;

    entries.push({
      name: name || email.split('@')[0] || 'Player',
      email,
      userId
    });
  });

  return entries;
};

const resolveTeamMemberLinks = (teamDoc) => {
  if (!teamDoc || !Array.isArray(teamDoc.members)) return [];

  const links = teamDoc.members
    .map((member) => {
      const playerDoc = member.player && typeof member.player === 'object'
        ? member.player
        : null;
      const resolvedId = playerDoc?._id || member.player || null;
      const hasRegisteredId = resolvedId && isValidObjectId(resolvedId);
      const resolvedName = String(playerDoc?.name || member.name || '').trim();
      const resolvedEmail = String(playerDoc?.email || '').trim().toLowerCase();
      const inviteStatus = String(member?.inviteStatus || 'accepted').toLowerCase();

      if (!resolvedName) return null;
      if (hasRegisteredId && inviteStatus !== 'accepted') return null;
      return {
        name: resolvedName,
        email: resolvedEmail,
        userId: hasRegisteredId ? resolvedId : null,
        isRegistered: Boolean(hasRegisteredId && member.isRegistered)
      };
    })
    .filter(Boolean);

  return links;
};

const resolvePlayerLinks = async (rawPlayers) => {
  const normalizedPlayers = normalizePlayersInput(rawPlayers);
  if (normalizedPlayers.length === 0) return [];

  const userIds = [...new Set(
    normalizedPlayers
      .map((item) => item.userId)
      .filter((value) => isValidObjectId(value))
      .map((value) => String(value))
  )];

  const emails = [...new Set(
    normalizedPlayers
      .map((item) => item.email)
      .filter((value) => Boolean(value))
      .map((value) => value.toLowerCase())
  )];

  let users = [];
  if (userIds.length > 0 || emails.length > 0) {
    const userQuery = [];
    if (userIds.length > 0) userQuery.push({ _id: { $in: userIds } });
    if (emails.length > 0) userQuery.push({ email: { $in: emails } });
    users = await User.find({ $or: userQuery }).select('_id name email');
  }

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const userByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));

  const seen = new Set();
  const resolvedLinks = [];

  normalizedPlayers.forEach((item) => {
    const userFromId = item.userId ? userById.get(String(item.userId)) : null;
    const userFromEmail = item.email ? userByEmail.get(item.email) : null;
    const linkedUser = userFromId || userFromEmail || null;

    const resolvedName = String(item.name || linkedUser?.name || '').trim();
    if (!resolvedName) return;

    const dedupeKey = linkedUser
      ? `id:${String(linkedUser._id)}`
      : `name:${resolvedName.toLowerCase()}|${String(item.email || '').toLowerCase()}`;

    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    resolvedLinks.push({
      name: resolvedName,
      email: String(linkedUser?.email || item.email || '').toLowerCase(),
      userId: linkedUser?._id || null,
      isRegistered: Boolean(linkedUser)
    });
  });

  return resolvedLinks;
};

const extractUserIdsFromLinks = (playerLinks = []) => {
  if (!Array.isArray(playerLinks)) return [];
  return [...new Set(
    playerLinks
      .map((player) => player?.userId)
      .filter((value) => isValidObjectId(value))
      .map((value) => String(value))
  )];
};

// @desc Create new match
// @route POST /api/matches
// @access Protected
exports.createMatch = async (req, res) => {
  try {
    const {
      matchName,
      matchType,
      customOvers,
      teamAName,
      teamAId,
      teamAPlayers,
      teamBName,
      teamBId,
      teamBPlayers,
      venue,
      matchDate,
      tournamentId
    } = req.body;

    if (!matchName || !venue || !matchDate || (!teamAName && !teamAId) || (!teamBName && !teamBId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    let totalOvers;
    if (matchType === 'T20') {
      totalOvers = 20;
    } else if (matchType === 'ODI') {
      totalOvers = 50;
    } else if (matchType === 'Test') {
      totalOvers = 90;
    } else if (matchType === 'Custom' && customOvers) {
      totalOvers = parseInt(customOvers, 10);
      if (!Number.isFinite(totalOvers) || totalOvers < 1 || totalOvers > 50) {
        return res.status(400).json({
          success: false,
          message: 'Overs must be between 1 and 50'
        });
      }
    } else {
      totalOvers = 20;
    }

    let teamADoc = null;
    let teamBDoc = null;

    if (teamAId) {
      teamADoc = await Team.findById(teamAId).populate('members.player', 'name email');
      if (!teamADoc) {
        return res.status(400).json({
          success: false,
          message: 'Team A not found'
        });
      }
    }

    if (teamBId) {
      teamBDoc = await Team.findById(teamBId).populate('members.player', 'name email');
      if (!teamBDoc) {
        return res.status(400).json({
          success: false,
          message: 'Team B not found'
        });
      }
    }

    if (teamAId && teamBId) {
      if (String(teamAId) === String(teamBId)) {
        return res.status(400).json({
          success: false,
          message: 'Teams cannot be the same'
        });
      }
    }

    const requestedTeamALinks = await resolvePlayerLinks(teamAPlayers);
    const requestedTeamBLinks = await resolvePlayerLinks(teamBPlayers);
    const fallbackTeamALinks = resolveTeamMemberLinks(teamADoc);
    const fallbackTeamBLinks = resolveTeamMemberLinks(teamBDoc);

    const teamAPlayerLinks = requestedTeamALinks.length > 0 ? requestedTeamALinks : fallbackTeamALinks;
    const teamBPlayerLinks = requestedTeamBLinks.length > 0 ? requestedTeamBLinks : fallbackTeamBLinks;

    const resolvedTeamAName = String(teamAName || teamADoc?.name || '').trim();
    const resolvedTeamBName = String(teamBName || teamBDoc?.name || '').trim();

    if (!resolvedTeamAName || !resolvedTeamBName) {
      return res.status(400).json({
        success: false,
        message: 'Both team names are required'
      });
    }

    const match = await Match.create({
      matchName,
      matchType,
      totalOvers,
      ballsPerOver: 6,
      teamA: {
        name: resolvedTeamAName,
        teamId: teamAId || null,
        players: teamAPlayerLinks.map((player) => player.name),
        playerLinks: teamAPlayerLinks
      },
      teamB: {
        name: resolvedTeamBName,
        teamId: teamBId || null,
        players: teamBPlayerLinks.map((player) => player.name),
        playerLinks: teamBPlayerLinks
      },
      venue,
      matchDate,
      tournament: tournamentId || null,
      createdBy: req.user._id,
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: match
    });

  } catch (error) {
    return sendServerError(res, 'Failed to create match', error);
  }
};

// @desc Get all matches
// @route GET /api/matches
// @access Public
exports.getAllMatches = async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('createdBy', 'name email')
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch matches', error);
  }
};

// @desc Get live matches
// @route GET /api/matches/live
// @access Public
exports.getLiveMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: 'live' })
      .populate('createdBy', 'name email')
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch live matches', error);
  }
};

// @desc Get single match
// @route GET /api/matches/:id
// @access Public
exports.getMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('teamA.teamId')
      .populate('teamB.teamId');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch match', error);
  }
};

// @desc Get user's matches
// @route GET /api/matches/user/my-matches
// @access Protected
exports.getUserMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [
        { createdBy: req.user._id },
        { 'teamA.playerLinks.userId': req.user._id },
        { 'teamB.playerLinks.userId': req.user._id }
      ]
    })
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch your matches', error);
  }
};

// @desc Set toss details and start match
// @route PUT /api/matches/:id/toss
// @access Protected
exports.setMatchToss = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const isOwner = String(match.createdBy) === String(req.user._id);
    const isPrivilegedRole = ['admin', 'organizer', 'scorer'].includes(req.user.role);
    if (!isOwner && !isPrivilegedRole) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this match'
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot set toss for a completed match'
      });
    }

    const rawWinner = String(req.body.tossWinnerTeam || req.body.tossWinner || '').trim().toLowerCase();
    const rawDecision = String(req.body.decision || req.body.tossDecision || '').trim().toLowerCase();

    const teamAName = String(match.teamA?.name || '').trim().toLowerCase();
    const teamBName = String(match.teamB?.name || '').trim().toLowerCase();

    let tossWinnerTeam = null;
    if (rawWinner === 'teama' || rawWinner === 'a' || rawWinner === teamAName) tossWinnerTeam = 'teamA';
    if (rawWinner === 'teamb' || rawWinner === 'b' || rawWinner === teamBName) tossWinnerTeam = 'teamB';

    if (!tossWinnerTeam) {
      return res.status(400).json({
        success: false,
        message: 'tossWinnerTeam must match Team A or Team B'
      });
    }

    const decision = rawDecision === 'bowl' ? 'bowl' : (rawDecision === 'bat' ? 'bat' : null);
    if (!decision) {
      return res.status(400).json({
        success: false,
        message: "decision must be either 'bat' or 'bowl'"
      });
    }

    const battingTeam = decision === 'bat'
      ? tossWinnerTeam
      : (tossWinnerTeam === 'teamA' ? 'teamB' : 'teamA');
    const bowlingTeam = battingTeam === 'teamA' ? 'teamB' : 'teamA';

    // Reset match state when toss is set from scheduled/upcoming.
    resetInningState(match.innings.first);
    resetInningState(match.innings.second);
    resetTeamInningScore(match.teamA);
    resetTeamInningScore(match.teamB);

    match.innings.first.battingTeam = battingTeam;
    match.innings.first.bowlingTeam = bowlingTeam;
    match.innings.second.battingTeam = bowlingTeam;
    match.innings.second.bowlingTeam = battingTeam;
    match.innings.second.target = 0;
    match.currentInning = 1;
    match.currentStriker = '';
    match.currentStrikerId = null;
    match.currentNonStriker = '';
    match.currentNonStrikerId = null;
    match.currentBowler = '';
    match.currentBowlerId = null;
    match.ballByBallData = [];
    match.batsmanStats = [];
    match.bowlerStats = [];
    match.fallOfWickets = [];
    match.statsProcessed = false;
    match.winner = null;
    match.resultType = null;
    match.resultMargin = null;
    match.toss = {
      winner: tossWinnerTeam === 'teamA' ? match.teamA.name : match.teamB.name,
      decision
    };
    match.status = 'live';

    await match.save();

    return res.json({
      success: true,
      message: 'Toss set and match started successfully',
      data: match
    });
  } catch (error) {
    return sendServerError(res, 'Failed to set toss', error);
  }
};

const parseOversInput = (rawOvers, ballsPerOver = 6) => {
  if (rawOvers === undefined || rawOvers === null) return null;

  if (typeof rawOvers === 'number' && Number.isFinite(rawOvers)) {
    const fullOvers = Math.floor(rawOvers);
    let balls = Math.round((rawOvers - fullOvers) * 10);
    if (balls >= ballsPerOver) {
      return {
        overs: fullOvers + Math.floor(balls / ballsPerOver),
        balls: balls % ballsPerOver
      };
    }
    return { overs: fullOvers, balls: Math.max(0, balls) };
  }

  const raw = String(rawOvers).trim();
  if (!raw) return null;

  const [oversPart, ballsPart = '0'] = raw.split('.');
  const overs = parseInt(oversPart, 10);
  let balls = parseInt(ballsPart, 10);

  if (!Number.isFinite(overs) || !Number.isFinite(balls)) {
    return null;
  }

  if (balls >= ballsPerOver) {
    return {
      overs: overs + Math.floor(balls / ballsPerOver),
      balls: balls % ballsPerOver
    };
  }

  return { overs: Math.max(0, overs), balls: Math.max(0, balls) };
};

const recalculateInningRates = (inning, totalOvers, ballsPerOver = 6) => {
  const totalBalls = (inning.overs * ballsPerOver) + inning.balls;
  inning.runRate = totalBalls > 0
    ? Number(((inning.score * ballsPerOver) / totalBalls).toFixed(2))
    : 0;

  if (inning.target > 0) {
    const remainingRuns = Math.max(inning.target - inning.score, 0);
    const remainingBalls = Math.max((totalOvers * ballsPerOver) - totalBalls, 0);
    inning.requiredRunRate = remainingBalls > 0
      ? Number(((remainingRuns * ballsPerOver) / remainingBalls).toFixed(2))
      : 0;
  }
};

const findPlayerLinkById = (match, playerId) => {
  if (!isValidObjectId(playerId)) return null;
  const normalizedId = String(playerId);
  const teamALinks = Array.isArray(match.teamA?.playerLinks) ? match.teamA.playerLinks : [];
  const teamBLinks = Array.isArray(match.teamB?.playerLinks) ? match.teamB.playerLinks : [];
  return [...teamALinks, ...teamBLinks].find((player) => String(player?.userId || '') === normalizedId) || null;
};

const resolvePlayerReference = (match, rawName, rawPlayerId) => {
  const hasPlayerId = isValidObjectId(rawPlayerId);
  const linkedPlayer = hasPlayerId ? findPlayerLinkById(match, rawPlayerId) : null;
  const resolvedName = String(rawName || linkedPlayer?.name || '').trim();

  if (!resolvedName) {
    return { name: '', userId: null };
  }

  return {
    name: resolvedName,
    userId: hasPlayerId ? String(rawPlayerId) : (linkedPlayer?.userId ? String(linkedPlayer.userId) : null)
  };
};

const extrasAlias = {
  wd: 'wide',
  wide: 'wide',
  nb: 'noball',
  noball: 'noball',
  bye: 'bye',
  lb: 'legbye',
  legbye: 'legbye'
};

const wicketKindsWithoutBowlerCredit = new Set([
  'run_out',
  'retired_hurt',
  'timed_out',
  'obstructing_field'
]);

const allowedWicketKinds = new Set([
  'bowled',
  'caught',
  'lbw',
  'run_out',
  'stumped',
  'hit_wicket',
  'caught_and_bowled',
  'retired_hurt',
  'timed_out',
  'obstructing_field'
]);

const toInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEventExtraType = (value) => {
  const normalized = extrasAlias[String(value || '').toLowerCase()] || 'none';
  return normalized;
};

const normalizeWicketKind = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, '_');
  return allowedWicketKinds.has(normalized) ? normalized : 'bowled';
};

const getStatIdentityKey = (inning, playerId, playerName) => {
  const normalizedName = String(playerName || '').trim().toLowerCase();
  const normalizedId = isValidObjectId(playerId) ? String(playerId) : '';
  return `${inning}|${normalizedId}|${normalizedName}`;
};

const calculateEventOutcome = (rawEvent = {}) => {
  const extraType = normalizeEventExtraType(rawEvent.extraType || rawEvent.extras);
  let totalRuns = Math.max(0, toInteger(rawEvent.runs, 0));

  if (extraType === 'wide' || extraType === 'noball') {
    totalRuns = Math.max(1, totalRuns);
  }

  const batsmanRuns = extraType === 'none'
    ? totalRuns
    : (extraType === 'noball' ? Math.max(totalRuns - 1, 0) : 0);
  const extrasRuns = Math.max(totalRuns - batsmanRuns, 0);
  const isLegalDelivery = !(extraType === 'wide' || extraType === 'noball');
  const bowlerRuns = (extraType === 'bye' || extraType === 'legbye') ? 0 : totalRuns;
  const wicketKind = normalizeWicketKind(rawEvent.wicketKind || rawEvent.wicket?.kind);
  const isWicket = Boolean(rawEvent.isWicket);
  const bowlerGetsWicket = isWicket && !wicketKindsWithoutBowlerCredit.has(wicketKind);

  return {
    extraType,
    totalRuns,
    batsmanRuns,
    extrasRuns,
    isLegalDelivery,
    bowlerRuns,
    isWicket,
    wicketKind,
    bowlerGetsWicket
  };
};

const findOrCreateBatsmanStat = (statsList, inning, playerName, playerId) => {
  const normalizedName = String(playerName || '').trim();
  if (!normalizedName) return null;

  const identityKey = getStatIdentityKey(inning, playerId, normalizedName);
  let stats = statsList.find((item) => getStatIdentityKey(item.inning, item.playerId, item.name) === identityKey);
  if (stats) return stats;

  stats = {
    name: normalizedName,
    playerId: isValidObjectId(playerId) ? playerId : undefined,
    inning,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false,
    dismissal: {},
    dotBalls: 0,
    singles: 0,
    twos: 0,
    threes: 0,
    powerplayRuns: 0,
    middleOversRuns: 0,
    deathOversRuns: 0
  };
  statsList.push(stats);
  return stats;
};

const updateBatsmanRate = (batsmanStat) => {
  if (!batsmanStat) return;
  batsmanStat.strikeRate = batsmanStat.ballsFaced > 0
    ? Number(((batsmanStat.runs / batsmanStat.ballsFaced) * 100).toFixed(2))
    : 0;
};

const findOrCreateBowlerStat = (statsList, inning, playerName, playerId) => {
  const normalizedName = String(playerName || '').trim();
  if (!normalizedName) return null;

  const identityKey = getStatIdentityKey(inning, playerId, normalizedName);
  let stats = statsList.find((item) => getStatIdentityKey(item.inning, item.playerId, item.name) === identityKey);
  if (stats) return stats;

  stats = {
    name: normalizedName,
    playerId: isValidObjectId(playerId) ? playerId : undefined,
    inning,
    overs: 0,
    balls: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    economy: 0,
    wides: 0,
    noBalls: 0,
    dotBalls: 0,
    fours: 0,
    sixes: 0,
    currentSpell: {
      overs: 0,
      runs: 0,
      wickets: 0
    }
  };
  statsList.push(stats);
  return stats;
};

const updateBowlerRates = (bowlerStat) => {
  if (!bowlerStat) return;
  const oversDecimal = bowlerStat.balls / 6;
  bowlerStat.overs = Number((Math.floor(bowlerStat.balls / 6) + ((bowlerStat.balls % 6) / 10)).toFixed(1));
  bowlerStat.economy = oversDecimal > 0
    ? Number((bowlerStat.runs / oversDecimal).toFixed(2))
    : 0;
  if (!bowlerStat.currentSpell) {
    bowlerStat.currentSpell = { overs: 0, runs: 0, wickets: 0 };
  }
  bowlerStat.currentSpell.overs = bowlerStat.overs;
  bowlerStat.currentSpell.runs = bowlerStat.runs;
  bowlerStat.currentSpell.wickets = bowlerStat.wickets;
};

const getBatsmanByReference = (statsList, inning, playerName, playerId) => {
  const identityKey = getStatIdentityKey(inning, playerId, playerName);
  return statsList.find((item) => getStatIdentityKey(item.inning, item.playerId, item.name) === identityKey)
    || statsList.find((item) =>
      Number(item.inning) === Number(inning) &&
      String(item.name || '').trim().toLowerCase() === String(playerName || '').trim().toLowerCase()
    )
    || null;
};

const getCurrentInningContext = (match, inningNumber) => {
  const inningKey = inningNumber === 1 ? 'first' : 'second';
  const inning = match.innings[inningKey];

  if (!inning.battingTeam) {
    if (inningNumber === 1) {
      inning.battingTeam = 'teamA';
      inning.bowlingTeam = 'teamB';
    } else {
      const firstBattingTeam = match.innings.first.battingTeam || 'teamA';
      inning.battingTeam = firstBattingTeam === 'teamA' ? 'teamB' : 'teamA';
      inning.bowlingTeam = firstBattingTeam;
    }
  }

  if (!inning.bowlingTeam) {
    inning.bowlingTeam = inning.battingTeam === 'teamA' ? 'teamB' : 'teamA';
  }

  const battingTeam = inning.battingTeam === 'teamA' ? match.teamA : match.teamB;
  return { inning, inningKey, battingTeam };
};

const resetInningState = (inning) => {
  if (!inning) return;
  const targetValue = Number(inning.target || 0);
  inning.score = 0;
  inning.wickets = 0;
  inning.overs = 0;
  inning.balls = 0;
  inning.isCompleted = false;
  if (Object.prototype.hasOwnProperty.call(inning, 'target')) {
    inning.target = targetValue;
  }
  inning.extras = {
    total: 0,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penalties: 0
  };
  inning.runRate = 0;
  inning.requiredRunRate = 0;
  inning.currentPartnership = {
    runs: 0,
    balls: 0,
    batsman1: '',
    batsman2: ''
  };
};

const resetTeamInningScore = (team) => {
  if (!team) return;
  team.score = 0;
  team.wickets = 0;
  team.overs = '0.0';
  team.ballsPlayed = 0;
};

const rebuildInningFromBallEvents = (match, inningNumber, rawEvents = []) => {
  const { inning, battingTeam } = getCurrentInningContext(match, inningNumber);
  resetInningState(inning);
  resetTeamInningScore(battingTeam);

  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const preservedBalls = (match.ballByBallData || []).filter((ball) => Number(ball.inning) !== Number(inningNumber));
  const preservedBatsmanStats = (match.batsmanStats || []).filter((stats) => Number(stats.inning) !== Number(inningNumber));
  const preservedBowlerStats = (match.bowlerStats || []).filter((stats) => Number(stats.inning) !== Number(inningNumber));
  const preservedFallOfWickets = (match.fallOfWickets || []).filter((item) => Number(item.inning) !== Number(inningNumber));

  let nextBallNumber = preservedBalls.reduce((maxValue, ball) => Math.max(maxValue, toInteger(ball.ballNumber, 0)), 0) + 1;
  const inningBalls = [];
  const inningBatsmanStats = [];
  const inningBowlerStats = [];
  const inningFallOfWickets = [];

  events.forEach((rawEvent) => {
    const strikerName = String(rawEvent.strikerName || '').trim();
    const nonStrikerName = String(rawEvent.nonStrikerName || '').trim();
    const bowlerName = String(rawEvent.bowlerName || '').trim();
    const strikerId = isValidObjectId(rawEvent.strikerId) ? rawEvent.strikerId : null;
    const bowlerId = isValidObjectId(rawEvent.bowlerId) ? rawEvent.bowlerId : null;

    if (!strikerName || !bowlerName) return;

    const eventOutcome = calculateEventOutcome(rawEvent);
    const overBeforeBall = inning.overs;
    const ballBeforeBall = inning.balls;

    if (eventOutcome.extraType === 'wide') {
      inning.extras.wides += eventOutcome.extrasRuns;
    } else if (eventOutcome.extraType === 'noball') {
      inning.extras.noBalls += 1;
    } else if (eventOutcome.extraType === 'bye') {
      inning.extras.byes += eventOutcome.extrasRuns;
    } else if (eventOutcome.extraType === 'legbye') {
      inning.extras.legByes += eventOutcome.extrasRuns;
    }
    inning.extras.total += eventOutcome.extrasRuns;

    inning.score += eventOutcome.totalRuns;
    battingTeam.score += eventOutcome.totalRuns;

    const strikerStat = findOrCreateBatsmanStat(inningBatsmanStats, inningNumber, strikerName, strikerId);
    if (strikerStat) {
      if (eventOutcome.isLegalDelivery) {
        strikerStat.ballsFaced += 1;
      }
      strikerStat.runs += eventOutcome.batsmanRuns;
      if (eventOutcome.batsmanRuns === 4) strikerStat.fours += 1;
      if (eventOutcome.batsmanRuns === 6) strikerStat.sixes += 1;
      if (eventOutcome.isLegalDelivery && eventOutcome.batsmanRuns === 0) strikerStat.dotBalls += 1;
      if (eventOutcome.batsmanRuns === 1) strikerStat.singles += 1;
      if (eventOutcome.batsmanRuns === 2) strikerStat.twos += 1;
      if (eventOutcome.batsmanRuns === 3) strikerStat.threes += 1;
      updateBatsmanRate(strikerStat);
    }

    const bowlerStat = findOrCreateBowlerStat(inningBowlerStats, inningNumber, bowlerName, bowlerId);
    if (bowlerStat) {
      if (eventOutcome.isLegalDelivery) {
        bowlerStat.balls += 1;
      }
      bowlerStat.runs += eventOutcome.bowlerRuns;
      if (eventOutcome.extraType === 'wide') bowlerStat.wides += eventOutcome.extrasRuns;
      if (eventOutcome.extraType === 'noball') bowlerStat.noBalls += 1;
      if (eventOutcome.bowlerGetsWicket) bowlerStat.wickets += 1;
      if (eventOutcome.isLegalDelivery && eventOutcome.totalRuns === 0) bowlerStat.dotBalls += 1;
      if (eventOutcome.batsmanRuns === 4) bowlerStat.fours += 1;
      if (eventOutcome.batsmanRuns === 6) bowlerStat.sixes += 1;
      updateBowlerRates(bowlerStat);
    }

    if (eventOutcome.isWicket) {
      inning.wickets += 1;
      battingTeam.wickets += 1;

      const playerOutName = String(rawEvent.wicketPlayerName || strikerName).trim() || strikerName;
      const playerOutId = isValidObjectId(rawEvent.wicketPlayerId) ? rawEvent.wicketPlayerId : null;
      const playerOutStat = getBatsmanByReference(inningBatsmanStats, inningNumber, playerOutName, playerOutId)
        || findOrCreateBatsmanStat(inningBatsmanStats, inningNumber, playerOutName, playerOutId);

      if (playerOutStat) {
        playerOutStat.isOut = true;
        playerOutStat.dismissal = {
          kind: eventOutcome.wicketKind,
          bowlerName: bowlerName || undefined,
          fielderName: String(rawEvent.fielderName || '').trim() || undefined,
          overNumber: inning.overs
        };
      }
    }

    if (eventOutcome.isLegalDelivery) {
      inning.balls += 1;
      battingTeam.ballsPlayed += 1;
      if (inning.balls >= match.ballsPerOver) {
        inning.overs += 1;
        inning.balls = 0;
      }
    }

    battingTeam.overs = `${inning.overs}.${inning.balls}`;

    inningBalls.push({
      ballNumber: nextBallNumber++,
      inning: inningNumber,
      over: overBeforeBall,
      ballInOver: ballBeforeBall,
      isLegalDelivery: eventOutcome.isLegalDelivery,
      batsmanName: strikerName,
      batsmanId: strikerId || undefined,
      nonStrikerName: nonStrikerName || undefined,
      bowlerName,
      bowlerId: bowlerId || undefined,
      runs: Math.max(0, Math.min(6, eventOutcome.batsmanRuns)),
      totalRuns: eventOutcome.totalRuns,
      batsmanRuns: eventOutcome.batsmanRuns,
      extras: {
        total: eventOutcome.extrasRuns,
        type: eventOutcome.extraType,
        runs: eventOutcome.extrasRuns
      },
      isWicket: eventOutcome.isWicket,
      wicket: eventOutcome.isWicket ? {
        playerOutName: String(rawEvent.wicketPlayerName || strikerName).trim() || strikerName,
        playerOutId: isValidObjectId(rawEvent.wicketPlayerId) ? rawEvent.wicketPlayerId : undefined,
        kind: eventOutcome.wicketKind,
        fielderName: String(rawEvent.fielderName || '').trim() || undefined,
        fielderId: isValidObjectId(rawEvent.fielderId) ? rawEvent.fielderId : undefined
      } : undefined,
      commentary: String(rawEvent.commentary || '').trim() || undefined
    });

    if (eventOutcome.isWicket) {
      inningFallOfWickets.push({
        wicketNumber: inning.wickets,
        inning: inningNumber,
        playerOut: String(rawEvent.wicketPlayerName || strikerName).trim() || strikerName,
        score: inning.score,
        overs: `${inning.overs}.${inning.balls}`,
        partnershipRuns: 0,
        dismissalType: eventOutcome.wicketKind
      });
    }
  });

  recalculateInningRates(inning, match.totalOvers, match.ballsPerOver);
  match.ballByBallData = [...preservedBalls, ...inningBalls].sort((a, b) => toInteger(a.ballNumber, 0) - toInteger(b.ballNumber, 0));
  match.batsmanStats = [...preservedBatsmanStats, ...inningBatsmanStats];
  match.bowlerStats = [...preservedBowlerStats, ...inningBowlerStats];
  match.fallOfWickets = [...preservedFallOfWickets, ...inningFallOfWickets];
};

const completeOrAdvanceInnings = async (match, currentInningNum, currentInning) => {
  currentInning.isCompleted = true;

  if (currentInningNum === 1) {
    match.currentInning = 2;
    match.status = 'innings_break';
    match.innings.second.target = currentInning.score + 1;
    match.innings.second.battingTeam = currentInning.battingTeam === 'teamA' ? 'teamB' : 'teamA';
    match.innings.second.bowlingTeam = currentInning.battingTeam === 'teamA' ? 'teamA' : 'teamB';

    await match.save();
    return {
      inningsComplete: true,
      message: 'First innings completed.'
    };
  }

  await completeMatchLogic(match);
  await match.save();
  return {
    matchComplete: true,
    message: 'Match completed.'
  };
};

// @desc Update match score
// @route PUT /api/matches/:id/score
// @access Protected
exports.updateMatchScore = async (req, res) => {
  try {
    const {
      runs,
      wickets,
      isWicket,
      extras,
      batsmanName,
      batsmanId,
      nonStrikerName,
      nonStrikerId,
      bowlerName,
      bowlerId,
      overs,
      mode
    } = req.body;

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const isOwner = match.createdBy.toString() === req.user._id.toString();
    const isPrivilegedRole = ['admin', 'organizer', 'scorer'].includes(req.user.role);
    if (!isOwner && !isPrivilegedRole) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this match'
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Match is already completed'
      });
    }

    const statusOnlyUpdate =
      req.body.status === 'live' &&
      runs === undefined &&
      wickets === undefined &&
      isWicket === undefined &&
      extras === undefined;

    if (statusOnlyUpdate) {
      match.status = 'live';
      await match.save();
      return res.json({
        success: true,
        message: 'Match started successfully',
        data: match
      });
    }

    if (match.status === 'scheduled' || match.status === 'upcoming') {
      match.status = 'live';
    }

    const currentInningNum = match.currentInning || 1;
    const inningKey = currentInningNum === 1 ? 'first' : 'second';
    const currentInning = match.innings[inningKey];

    if (!currentInning.battingTeam) {
      currentInning.battingTeam = 'teamA';
      currentInning.bowlingTeam = 'teamB';
    }

    const battingTeam = currentInning.battingTeam === 'teamA' ? match.teamA : match.teamB;

    if (batsmanName !== undefined || batsmanId !== undefined) {
      const strikerRef = resolvePlayerReference(match, batsmanName, batsmanId);
      if (strikerRef.name) match.currentStriker = strikerRef.name;
      match.currentStrikerId = strikerRef.userId || null;
    }

    if (nonStrikerName !== undefined || nonStrikerId !== undefined) {
      const nonStrikerRef = resolvePlayerReference(match, nonStrikerName, nonStrikerId);
      if (nonStrikerRef.name) match.currentNonStriker = nonStrikerRef.name;
      match.currentNonStrikerId = nonStrikerRef.userId || null;
    }

    if (bowlerName !== undefined || bowlerId !== undefined) {
      const bowlerRef = resolvePlayerReference(match, bowlerName, bowlerId);
      if (bowlerRef.name) match.currentBowler = bowlerRef.name;
      match.currentBowlerId = bowlerRef.userId || null;
    }

    const isAbsoluteUpdate =
      mode === 'absolute' ||
      (overs !== undefined && wickets !== undefined && extras === undefined && isWicket === undefined);

    if (isAbsoluteUpdate) {
      const hasBallEvents = Array.isArray(req.body.ballEvents);
      const parsedOvers = parseOversInput(overs, match.ballsPerOver);

      if (hasBallEvents) {
        rebuildInningFromBallEvents(match, currentInningNum, req.body.ballEvents);
      } else {
        const totalRuns = Math.max(0, parseInt(runs, 10) || 0);
        const totalWickets = Math.max(0, parseInt(wickets, 10) || 0);
        currentInning.score = totalRuns;
        currentInning.wickets = totalWickets;

        if (parsedOvers) {
          currentInning.overs = parsedOvers.overs;
          currentInning.balls = parsedOvers.balls;
        }

        battingTeam.score = currentInning.score;
        battingTeam.wickets = currentInning.wickets;
        battingTeam.overs = `${currentInning.overs}.${currentInning.balls}`;
      }

      recalculateInningRates(currentInning, match.totalOvers, match.ballsPerOver);

      const maxBalls = match.totalOvers * match.ballsPerOver;
      const currentBalls = (currentInning.overs * match.ballsPerOver) + currentInning.balls;

      if (currentInningNum === 2 && currentInning.target > 0 && currentInning.score >= currentInning.target) {
        currentInning.isCompleted = true;
        await completeMatchLogic(match);
        await match.save();

        return res.json({
          success: true,
          message: 'Match completed. Target achieved.',
          data: match,
          matchComplete: true
        });
      }

      if (currentInning.wickets >= 10 || currentBalls >= maxBalls) {
        const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
        return res.json({
          success: true,
          message: result.message,
          data: match,
          ...result
        });
      }

      await match.save();
      return res.json({
        success: true,
        message: 'Score updated successfully',
        data: match
      });
    }

    const maxBalls = match.totalOvers * match.ballsPerOver;
    const currentTotalBalls = (currentInning.overs * match.ballsPerOver) + currentInning.balls;

    if (currentTotalBalls >= maxBalls) {
      const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
      return res.json({
        success: true,
        message: result.message,
        data: match,
        ...result
      });
    }

    let ballCounts = true;
    let runsToAdd = parseInt(runs, 10) || 0;

    const normalizedExtra = extrasAlias[String(extras || '').toLowerCase()] || null;

    if (normalizedExtra) {
      if (normalizedExtra === 'wide' || normalizedExtra === 'noball') {
        ballCounts = false;
        runsToAdd = Math.max(1, runsToAdd);

        if (normalizedExtra === 'wide') {
          currentInning.extras.wides += 1;
        } else {
          currentInning.extras.noBalls += 1;
        }

        currentInning.extras.total += runsToAdd;
      } else if (normalizedExtra === 'bye' || normalizedExtra === 'legbye') {
        if (normalizedExtra === 'bye') {
          currentInning.extras.byes += runsToAdd;
        } else {
          currentInning.extras.legByes += runsToAdd;
        }
        currentInning.extras.total += runsToAdd;
      }
    }

    currentInning.score += runsToAdd;
    battingTeam.score += runsToAdd;

    const wicketBall = Boolean(isWicket);
    if (wicketBall) {
      currentInning.wickets += 1;
      battingTeam.wickets += 1;

      if (currentInning.wickets >= 10) {
        const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
        return res.json({
          success: true,
          message: result.message,
          data: match,
          ...result
        });
      }
    }

    if (ballCounts) {
      currentInning.balls += 1;
      battingTeam.ballsPlayed += 1;

      if (currentInning.balls >= match.ballsPerOver) {
        currentInning.overs += 1;
        currentInning.balls = 0;
      }

      battingTeam.overs = `${currentInning.overs}.${currentInning.balls}`;
    }

    recalculateInningRates(currentInning, match.totalOvers, match.ballsPerOver);

    if (currentInningNum === 2 && currentInning.target > 0 && currentInning.score >= currentInning.target) {
      currentInning.isCompleted = true;
      await completeMatchLogic(match);
      await match.save();

      return res.json({
        success: true,
        message: 'Match completed. Target achieved.',
        data: match,
        matchComplete: true
      });
    }

    await match.save();

    res.json({
      success: true,
      message: 'Score updated successfully',
      data: match
    });

  } catch (error) {
    return sendServerError(res, 'Failed to update score', error);
  }
};

// Helper function to complete match
async function completeMatchLogic(match) {
  match.status = 'completed';

  const scoreA = Number(match.teamA?.score || 0);
  const scoreB = Number(match.teamB?.score || 0);
  const firstBattingTeam = match.innings.first.battingTeam || 'teamA';
  const secondBattingTeam = match.innings.second.battingTeam ||
    (firstBattingTeam === 'teamA' ? 'teamB' : 'teamA');

  if (scoreA > scoreB) {
    match.winner = match.teamA.name;
    if (secondBattingTeam === 'teamA') {
      match.resultType = 'wickets';
      match.resultMargin = Math.max(0, 10 - (match.innings.second.wickets || 0));
    } else {
      match.resultType = 'runs';
      match.resultMargin = scoreA - scoreB;
    }
  } else if (scoreB > scoreA) {
    match.winner = match.teamB.name;
    if (secondBattingTeam === 'teamB') {
      match.resultType = 'wickets';
      match.resultMargin = Math.max(0, 10 - (match.innings.second.wickets || 0));
    } else {
      match.resultType = 'runs';
      match.resultMargin = scoreB - scoreA;
    }
  } else {
    match.winner = 'Tie';
    match.resultType = 'tie';
    match.resultMargin = 0;
  }

  await updatePlayerStats(match);
  return match;
}

// Update player statistics
async function updatePlayerStats(match) {
  try {
    if (match.statsProcessed) return;

    const teamAUserIds = new Set(extractUserIdsFromLinks(match.teamA?.playerLinks));
    const teamBUserIds = new Set(extractUserIdsFromLinks(match.teamB?.playerLinks));

    // Backward compatibility for old matches that only have teamId and members.
    const [teamADoc, teamBDoc] = await Promise.all([
      match.teamA?.teamId ? Team.findById(match.teamA.teamId).select('members stats') : null,
      match.teamB?.teamId ? Team.findById(match.teamB.teamId).select('members stats') : null
    ]);

    const addTeamMembersToSet = (teamDoc, bucket) => {
      if (!teamDoc || !Array.isArray(teamDoc.members)) return;
      teamDoc.members.forEach((member) => {
        const candidateId = member?.player;
        if (isValidObjectId(candidateId)) {
          bucket.add(String(candidateId));
        }
      });
    };

    addTeamMembersToSet(teamADoc, teamAUserIds);
    addTeamMembersToSet(teamBDoc, teamBUserIds);

    const battingByUser = new Map();
    (match.batsmanStats || []).forEach((stats) => {
      const playerId = stats?.playerId;
      if (!isValidObjectId(playerId)) return;
      const key = String(playerId);

      const existing = battingByUser.get(key) || {
        innings: 0,
        runs: 0,
        ballsFaced: 0,
        highestScore: 0,
        notOuts: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        centuries: 0,
        halfCenturies: 0
      };

      const playerRuns = toInteger(stats.runs, 0);
      const playerBalls = toInteger(stats.ballsFaced, 0);
      const didBat = playerBalls > 0 || playerRuns > 0 || Boolean(stats.isOut);

      if (didBat) {
        existing.innings += 1;
        existing.runs += playerRuns;
        existing.ballsFaced += playerBalls;
        existing.highestScore = Math.max(existing.highestScore, playerRuns);
        existing.fours += toInteger(stats.fours, 0);
        existing.sixes += toInteger(stats.sixes, 0);

        if (!stats.isOut) existing.notOuts += 1;
        if (playerRuns === 0 && stats.isOut) existing.ducks += 1;
        if (playerRuns >= 100) existing.centuries += 1;
        if (playerRuns >= 50 && playerRuns < 100) existing.halfCenturies += 1;
      }

      battingByUser.set(key, existing);
    });

    const bowlingByUser = new Map();
    (match.bowlerStats || []).forEach((stats) => {
      const playerId = stats?.playerId;
      if (!isValidObjectId(playerId)) return;
      const key = String(playerId);

      const existing = bowlingByUser.get(key) || {
        innings: 0,
        balls: 0,
        runs: 0,
        wickets: 0,
        maidens: 0,
        fiveWickets: 0,
        tenWickets: 0,
        bestFigures: { wickets: 0, runs: 0 }
      };

      const balls = toInteger(stats.balls, 0);
      const runs = toInteger(stats.runs, 0);
      const wickets = toInteger(stats.wickets, 0);
      const maidens = toInteger(stats.maidens, 0);
      const didBowl = balls > 0 || runs > 0 || wickets > 0;

      if (didBowl) {
        existing.innings += 1;
        existing.balls += balls;
        existing.runs += runs;
        existing.wickets += wickets;
        existing.maidens += maidens;

        if (wickets > existing.bestFigures.wickets ||
          (wickets === existing.bestFigures.wickets && wickets > 0 && runs < existing.bestFigures.runs)) {
          existing.bestFigures = { wickets, runs };
        }

        if (wickets >= 5) existing.fiveWickets += 1;
        if (wickets >= 10) existing.tenWickets += 1;
      }

      bowlingByUser.set(key, existing);
    });

    const allUserIds = [...new Set([
      ...teamAUserIds,
      ...teamBUserIds,
      ...battingByUser.keys(),
      ...bowlingByUser.keys()
    ])];

    if (allUserIds.length > 0) {
      const winnerIsTeamA = match.winner === match.teamA?.name;
      const winnerIsTeamB = match.winner === match.teamB?.name;
      const isTie = match.winner === 'Tie' || match.resultType === 'tie';
      const formatKey = ['T20', 'ODI', 'Test'].includes(match.matchType) ? match.matchType : null;

      const users = await User.find({ _id: { $in: allUserIds } }).select('stats formatStats matchHistory');

      for (const user of users) {
        const userId = String(user._id);
        const batting = battingByUser.get(userId) || null;
        const bowling = bowlingByUser.get(userId) || null;

        user.stats.matchesPlayed += 1;

        if (isTie) {
          user.stats.ties += 1;
        } else if (winnerIsTeamA && teamAUserIds.has(userId)) {
          user.stats.wins += 1;
        } else if (winnerIsTeamB && teamBUserIds.has(userId)) {
          user.stats.wins += 1;
        } else if (winnerIsTeamA && teamBUserIds.has(userId)) {
          user.stats.losses += 1;
        } else if (winnerIsTeamB && teamAUserIds.has(userId)) {
          user.stats.losses += 1;
        }

        if (batting && batting.innings > 0) {
          user.stats.batting.innings += batting.innings;
          user.stats.batting.runs += batting.runs;
          user.stats.batting.ballsFaced += batting.ballsFaced;
          user.stats.batting.fours += batting.fours;
          user.stats.batting.sixes += batting.sixes;
          user.stats.batting.notOuts += batting.notOuts;
          user.stats.batting.ducks += batting.ducks;
          user.stats.batting.centuries += batting.centuries;
          user.stats.batting.halfCenturies += batting.halfCenturies;
          user.stats.batting.highestScore = Math.max(user.stats.batting.highestScore, batting.highestScore);

          const dismissals = user.stats.batting.innings - user.stats.batting.notOuts;
          user.stats.batting.average = dismissals > 0
            ? Number((user.stats.batting.runs / dismissals).toFixed(2))
            : 0;
          user.stats.batting.strikeRate = user.stats.batting.ballsFaced > 0
            ? Number(((user.stats.batting.runs / user.stats.batting.ballsFaced) * 100).toFixed(2))
            : 0;
        }

        if (bowling && bowling.innings > 0) {
          user.stats.bowling.innings += bowling.innings;
          user.stats.bowling.balls += bowling.balls;
          user.stats.bowling.overs = Number((Math.floor(user.stats.bowling.balls / 6) + ((user.stats.bowling.balls % 6) / 10)).toFixed(1));
          user.stats.bowling.runs += bowling.runs;
          user.stats.bowling.wickets += bowling.wickets;
          user.stats.bowling.maidens += bowling.maidens;
          user.stats.bowling.fiveWickets += bowling.fiveWickets;
          user.stats.bowling.tenWickets += bowling.tenWickets;

          const currentBest = user.stats.bowling.bestFigures || { wickets: 0, runs: 0 };
          if (bowling.bestFigures.wickets > currentBest.wickets ||
            (bowling.bestFigures.wickets === currentBest.wickets &&
              bowling.bestFigures.wickets > 0 &&
              bowling.bestFigures.runs < currentBest.runs)) {
            user.stats.bowling.bestFigures = {
              wickets: bowling.bestFigures.wickets,
              runs: bowling.bestFigures.runs
            };
          }

          const oversDecimal = user.stats.bowling.balls / 6;
          user.stats.bowling.economy = oversDecimal > 0
            ? Number((user.stats.bowling.runs / oversDecimal).toFixed(2))
            : 0;
          user.stats.bowling.average = user.stats.bowling.wickets > 0
            ? Number((user.stats.bowling.runs / user.stats.bowling.wickets).toFixed(2))
            : 0;
          user.stats.bowling.strikeRate = user.stats.bowling.wickets > 0
            ? Number((user.stats.bowling.balls / user.stats.bowling.wickets).toFixed(2))
            : 0;
        }

        if (formatKey && user.formatStats?.[formatKey]) {
          user.formatStats[formatKey].matches += 1;
          if (batting) {
            user.formatStats[formatKey].runs += batting.runs;
            user.formatStats[formatKey].strikeRate = batting.ballsFaced > 0
              ? Number(((batting.runs / batting.ballsFaced) * 100).toFixed(2))
              : user.formatStats[formatKey].strikeRate;
          }
          if (bowling) {
            user.formatStats[formatKey].wickets += bowling.wickets;
          }
        }

        const hasHistory = Array.isArray(user.matchHistory) &&
          user.matchHistory.some((entry) => String(entry.matchId) === String(match._id));
        if (!hasHistory) {
          user.matchHistory.push({
            matchId: match._id,
            date: match.matchDate || new Date(),
            performance: {
              runs: batting?.runs || 0,
              wickets: bowling?.wickets || 0,
              catches: 0
            }
          });
        }

        await user.save();
      }
    }

    // Update linked team stats exactly once.
    if (teamADoc && teamBDoc) {
      teamADoc.stats.matchesPlayed += 1;
      teamBDoc.stats.matchesPlayed += 1;

      if (match.winner === 'Tie' || match.resultType === 'tie') {
        teamADoc.stats.draws += 1;
        teamBDoc.stats.draws += 1;
      } else if (match.winner === match.teamA?.name) {
        teamADoc.stats.wins += 1;
        teamBDoc.stats.losses += 1;
      } else if (match.winner === match.teamB?.name) {
        teamBDoc.stats.wins += 1;
        teamADoc.stats.losses += 1;
      }

      await Promise.all([teamADoc.save(), teamBDoc.save()]);
    }

    match.statsProcessed = true;
  } catch (error) {
    console.error('Error updating player stats:', error);
  }
}

// @desc Complete match manually
// @route PUT /api/matches/:id/complete
// @access Protected
exports.completeMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Match is already completed'
      });
    }

    if (match.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this match'
      });
    }

    await completeMatchLogic(match);
    await match.save();

    res.json({
      success: true,
      message: 'Match completed successfully',
      data: match
    });

  } catch (error) {
    return sendServerError(res, 'Failed to complete match', error);
  }
};

// @desc Delete match
// @route DELETE /api/matches/:id
// @access Protected
exports.deleteMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this match'
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed matches'
      });
    }

    await match.deleteOne();

    res.json({
      success: true,
      message: 'Match deleted successfully'
    });
  } catch (error) {
    return sendServerError(res, 'Failed to delete match', error);
  }
};

const asCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatInningOvers = (inning = {}) => `${Number(inning.overs || 0)}.${Number(inning.balls || 0)}`;

const buildResultText = (match) => {
  if (!match) return '';
  if (match.resultType === 'tie' || String(match.winner || '').toLowerCase() === 'tie') {
    return 'Match tied';
  }
  if (!match.winner) return 'Result pending';
  if (match.resultType === 'runs') {
    return `${match.winner} won by ${Number(match.resultMargin || 0)} runs`;
  }
  if (match.resultType === 'wickets') {
    return `${match.winner} won by ${Number(match.resultMargin || 0)} wickets`;
  }
  return `${match.winner} won`;
};

const buildMatchReportPayload = (match) => {
  const firstInning = match.innings?.first || {};
  const secondInning = match.innings?.second || {};
  const batsmanStats = Array.isArray(match.batsmanStats) ? match.batsmanStats : [];
  const bowlerStats = Array.isArray(match.bowlerStats) ? match.bowlerStats : [];

  return {
    meta: {
      matchId: String(match._id),
      matchName: match.matchName,
      matchType: match.matchType,
      venue: match.venue,
      matchDate: match.matchDate,
      status: match.status,
      result: buildResultText(match),
      winner: match.winner || null
    },
    teams: {
      teamA: {
        name: match.teamA?.name || 'Team A',
        score: Number(match.teamA?.score || 0),
        wickets: Number(match.teamA?.wickets || 0),
        overs: match.teamA?.overs || '0.0'
      },
      teamB: {
        name: match.teamB?.name || 'Team B',
        score: Number(match.teamB?.score || 0),
        wickets: Number(match.teamB?.wickets || 0),
        overs: match.teamB?.overs || '0.0'
      }
    },
    innings: [
      {
        inning: 1,
        battingTeam: firstInning.battingTeam === 'teamB' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A'),
        bowlingTeam: firstInning.bowlingTeam === 'teamB' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A'),
        score: Number(firstInning.score || 0),
        wickets: Number(firstInning.wickets || 0),
        overs: formatInningOvers(firstInning),
        runRate: Number(firstInning.runRate || 0),
        extras: {
          total: Number(firstInning.extras?.total || 0),
          wides: Number(firstInning.extras?.wides || 0),
          noBalls: Number(firstInning.extras?.noBalls || 0),
          byes: Number(firstInning.extras?.byes || 0),
          legByes: Number(firstInning.extras?.legByes || 0)
        }
      },
      {
        inning: 2,
        battingTeam: secondInning.battingTeam === 'teamB' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A'),
        bowlingTeam: secondInning.bowlingTeam === 'teamB' ? (match.teamB?.name || 'Team B') : (match.teamA?.name || 'Team A'),
        score: Number(secondInning.score || 0),
        wickets: Number(secondInning.wickets || 0),
        overs: formatInningOvers(secondInning),
        runRate: Number(secondInning.runRate || 0),
        target: Number(secondInning.target || 0),
        extras: {
          total: Number(secondInning.extras?.total || 0),
          wides: Number(secondInning.extras?.wides || 0),
          noBalls: Number(secondInning.extras?.noBalls || 0),
          byes: Number(secondInning.extras?.byes || 0),
          legByes: Number(secondInning.extras?.legByes || 0)
        }
      }
    ],
    topPerformers: {
      batsmen: batsmanStats
        .slice()
        .sort((a, b) => Number(b.runs || 0) - Number(a.runs || 0))
        .slice(0, 5)
        .map((row) => ({
          name: row.name,
          inning: Number(row.inning || 0),
          runs: Number(row.runs || 0),
          balls: Number(row.ballsFaced || 0),
          fours: Number(row.fours || 0),
          sixes: Number(row.sixes || 0),
          strikeRate: Number(row.strikeRate || 0),
          isOut: Boolean(row.isOut)
        })),
      bowlers: bowlerStats
        .slice()
        .sort((a, b) => {
          const wicketDiff = Number(b.wickets || 0) - Number(a.wickets || 0);
          if (wicketDiff !== 0) return wicketDiff;
          return Number(a.runs || 0) - Number(b.runs || 0);
        })
        .slice(0, 5)
        .map((row) => ({
          name: row.name,
          inning: Number(row.inning || 0),
          overs: Number(row.overs || 0),
          balls: Number(row.balls || 0),
          runs: Number(row.runs || 0),
          wickets: Number(row.wickets || 0),
          economy: Number(row.economy || 0),
          wides: Number(row.wides || 0),
          noBalls: Number(row.noBalls || 0)
        }))
    }
  };
};

const buildMatchReportCsv = (report) => {
  const rows = [];
  rows.push(['field', 'value']);
  rows.push(['match_id', report.meta.matchId]);
  rows.push(['match_name', report.meta.matchName]);
  rows.push(['match_type', report.meta.matchType]);
  rows.push(['venue', report.meta.venue]);
  rows.push(['match_date', report.meta.matchDate ? new Date(report.meta.matchDate).toISOString() : '']);
  rows.push(['status', report.meta.status]);
  rows.push(['result', report.meta.result]);
  rows.push(['winner', report.meta.winner || '']);
  rows.push([]);

  rows.push(['inning', 'batting_team', 'bowling_team', 'score', 'wickets', 'overs', 'run_rate', 'target', 'extras_total', 'wides', 'no_balls', 'byes', 'leg_byes']);
  report.innings.forEach((inning) => {
    rows.push([
      inning.inning,
      inning.battingTeam,
      inning.bowlingTeam,
      inning.score,
      inning.wickets,
      inning.overs,
      inning.runRate,
      inning.target || '',
      inning.extras.total,
      inning.extras.wides,
      inning.extras.noBalls,
      inning.extras.byes,
      inning.extras.legByes
    ]);
  });
  rows.push([]);

  rows.push(['top_batsmen']);
  rows.push(['name', 'inning', 'runs', 'balls', 'fours', 'sixes', 'strike_rate', 'is_out']);
  report.topPerformers.batsmen.forEach((batsman) => {
    rows.push([
      batsman.name,
      batsman.inning,
      batsman.runs,
      batsman.balls,
      batsman.fours,
      batsman.sixes,
      batsman.strikeRate,
      batsman.isOut ? 'yes' : 'no'
    ]);
  });
  rows.push([]);

  rows.push(['top_bowlers']);
  rows.push(['name', 'inning', 'overs', 'balls', 'runs', 'wickets', 'economy', 'wides', 'no_balls']);
  report.topPerformers.bowlers.forEach((bowler) => {
    rows.push([
      bowler.name,
      bowler.inning,
      bowler.overs,
      bowler.balls,
      bowler.runs,
      bowler.wickets,
      bowler.economy,
      bowler.wides,
      bowler.noBalls
    ]);
  });

  return rows.map((row) => row.map(asCsvValue).join(',')).join('\n');
};

// @desc Get downloadable match report (JSON/CSV)
// @route GET /api/matches/:id/report
// @access Public
exports.getMatchReport = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const report = buildMatchReportPayload(match);
    const format = String(req.query.format || 'json').toLowerCase();

    if (format === 'csv') {
      const csv = buildMatchReportCsv(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="match-report-${match._id}.csv"`);
      return res.status(200).send(csv);
    }

    return res.json({
      success: true,
      report
    });
  } catch (error) {
    return sendServerError(res, 'Failed to build match report', error);
  }
};

// @desc Get match highlights
// @route GET /api/matches/:id/highlights
// @access Public
exports.getMatchHighlights = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const highlights = detectHighlights(match);

    res.json({
      success: true,
      count: highlights.length,
      highlights
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch highlights', error);
  }
};

// Helper: Detect highlights from ball data
function detectHighlights(match) {
  const highlights = [];
  const ballData = match.ballByBallData || [];
  
  if (ballData.length === 0) return highlights;
  
  ballData.forEach((ball, index) => {
    if (ball.runs === 4 || ball.runs === 6) {
      highlights.push({
        type: ball.runs === 6 ? 'six' : 'four',
        ballNumber: ball.ballNumber,
        description: `${ball.batsmanName} hits a ${ball.runs === 6 ? 'SIX' : 'FOUR'}!`,
        timestamp: ball.timestamp,
        priority: ball.runs === 6 ? 10 : 7
      });
    }
    
    if (ball.isWicket) {
      highlights.push({
        type: 'wicket',
        ballNumber: ball.ballNumber,
        description: `${ball.wicket?.playerOutName || ball.batsmanName} OUT!`,
        timestamp: ball.timestamp,
        priority: 10
      });
    }
  });
  
  return highlights.sort((a, b) => b.priority - a.priority).slice(0, 10);
}
