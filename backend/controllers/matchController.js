// backend/controllers/matchController.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');
const { configureMatchFromToss } = require('../services/matchSetupService');
const { processScoreUpdate, completeMatchLogic } = require('../services/scoringService');
const { getPagination, getPaginationMeta } = require('../utils/pagination');
const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const sendControllerError = (res, fallbackMessage, error) => {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  return sendServerError(res, fallbackMessage, error);
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
    const { page, limit, skip } = getPagination(req.query);
    const [matches, total] = await Promise.all([
      Match.find()
        .populate('createdBy', 'name email')
        .sort({ matchDate: -1 })
        .skip(skip)
        .limit(limit),
      Match.countDocuments()
    ]);

    res.json({
      success: true,
      count: matches.length,
      data: matches,
      meta: getPaginationMeta(total, page, limit)
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
    const filter = { status: 'live' };
    const { page, limit, skip } = getPagination(req.query);
    const [matches, total] = await Promise.all([
      Match.find(filter)
        .populate('createdBy', 'name email')
        .sort({ matchDate: -1 })
        .skip(skip)
        .limit(limit),
      Match.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: matches.length,
      data: matches,
      meta: getPaginationMeta(total, page, limit)
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
    const filter = {
      $or: [
        { createdBy: req.user._id },
        { 'teamA.playerLinks.userId': req.user._id },
        { 'teamB.playerLinks.userId': req.user._id }
      ]
    };
    const { page, limit, skip } = getPagination(req.query);
    const [matches, total] = await Promise.all([
      Match.find(filter).sort({ matchDate: -1 }).skip(skip).limit(limit),
      Match.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: matches.length,
      data: matches,
      meta: getPaginationMeta(total, page, limit)
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

    configureMatchFromToss(match, req.body);

    await match.save();

    return res.json({
      success: true,
      message: 'Toss set and match started successfully',
      data: match
    });
  } catch (error) {
    return sendControllerError(res, 'Failed to set toss', error);
  }
};

// @desc Update match score
// @route PUT /api/matches/:id/score
// @access Protected
exports.updateMatchScore = async (req, res) => {
  try {
    const result = await processScoreUpdate({
      matchId: req.params.id,
      user: req.user,
      payload: req.body
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendControllerError(res, 'Failed to update score', error);
  }
};


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

