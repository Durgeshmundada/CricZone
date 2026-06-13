const mongoose = require('mongoose');
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');
const ServiceError = require('../utils/ServiceError');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));
const extractUserIdsFromLinks = (playerLinks = []) => [...new Set(
  (Array.isArray(playerLinks) ? playerLinks : [])
    .map((link) => link?.userId)
    .filter((value) => isValidObjectId(value))
    .map((value) => String(value))
)];

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

const applyExtras = (inning, rawExtras, rawRuns) => {
  let ballCounts = true;
  let runsToAdd = parseInt(rawRuns, 10) || 0;
  const normalizedExtra = extrasAlias[String(rawExtras || '').toLowerCase()] || null;

  if (normalizedExtra === 'wide' || normalizedExtra === 'noball') {
    ballCounts = false;
    runsToAdd = Math.max(1, runsToAdd);
    if (normalizedExtra === 'wide') inning.extras.wides += 1;
    if (normalizedExtra === 'noball') inning.extras.noBalls += 1;
    inning.extras.total += runsToAdd;
  } else if (normalizedExtra === 'bye' || normalizedExtra === 'legbye') {
    if (normalizedExtra === 'bye') inning.extras.byes += runsToAdd;
    if (normalizedExtra === 'legbye') inning.extras.legByes += runsToAdd;
    inning.extras.total += runsToAdd;
  }

  return { ballCounts, runsToAdd };
};

const applyWicket = (inning, battingTeam, isWicket) => {
  if (!isWicket) return false;
  inning.wickets += 1;
  battingTeam.wickets += 1;
  return inning.wickets >= 10;
};

const advanceLegalDelivery = (inning, battingTeam, ballsPerOver) => {
  inning.balls += 1;
  battingTeam.ballsPlayed += 1;

  if (inning.balls >= ballsPerOver) {
    inning.overs += 1;
    inning.balls = 0;
  }

  battingTeam.overs = `${inning.overs}.${inning.balls}`;
};

const isTargetAchieved = (inningNumber, inning) =>
  inningNumber === 2 && inning.target > 0 && inning.score >= inning.target;

const processScoreUpdate = async ({ matchId, user, payload }) => {
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
    } = payload;

    const match = await Match.findById(matchId);
    if (!match) throw new ServiceError(404, 'Match not found');

    const isOwner = match.createdBy.toString() === user._id.toString();
    const isPrivilegedRole = ['admin', 'organizer', 'scorer'].includes(user.role);
    if (!isOwner && !isPrivilegedRole) {
      throw new ServiceError(403, 'Not authorized to update this match');
    }

    if (match.status === 'completed') {
      throw new ServiceError(400, 'Match is already completed');
    }

    const statusOnlyUpdate =
      payload.status === 'live' &&
      runs === undefined &&
      wickets === undefined &&
      isWicket === undefined &&
      extras === undefined;

    if (statusOnlyUpdate) {
      match.status = 'live';
      await match.save();
      return {
        message: 'Match started successfully',
        data: match
      };
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
      const hasBallEvents = Array.isArray(payload.ballEvents);
      const parsedOvers = parseOversInput(overs, match.ballsPerOver);

      if (hasBallEvents) {
        rebuildInningFromBallEvents(match, currentInningNum, payload.ballEvents);
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

      if (isTargetAchieved(currentInningNum, currentInning)) {
        currentInning.isCompleted = true;
        await completeMatchLogic(match);
        await match.save();

        return {
          message: 'Match completed. Target achieved.',
          data: match,
          matchComplete: true
        };
      }

      if (currentInning.wickets >= 10 || currentBalls >= maxBalls) {
        const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
        return {
          message: result.message,
          data: match,
          ...result
        };
      }

      await match.save();
      return {
        message: 'Score updated successfully',
        data: match
      };
    }

    const maxBalls = match.totalOvers * match.ballsPerOver;
    const currentTotalBalls = (currentInning.overs * match.ballsPerOver) + currentInning.balls;

    if (currentTotalBalls >= maxBalls) {
      const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
      return {
        message: result.message,
        data: match,
        ...result
      };
    }

    const { ballCounts, runsToAdd } = applyExtras(currentInning, extras, runs);

    currentInning.score += runsToAdd;
    battingTeam.score += runsToAdd;

    if (applyWicket(currentInning, battingTeam, Boolean(isWicket))) {
      const result = await completeOrAdvanceInnings(match, currentInningNum, currentInning);
      return {
        message: result.message,
        data: match,
        ...result
      };
    }

    if (ballCounts) {
      advanceLegalDelivery(currentInning, battingTeam, match.ballsPerOver);
    }

    recalculateInningRates(currentInning, match.totalOvers, match.ballsPerOver);

    if (isTargetAchieved(currentInningNum, currentInning)) {
      currentInning.isCompleted = true;
      await completeMatchLogic(match);
      await match.save();

      return {
        message: 'Match completed. Target achieved.',
        data: match,
        matchComplete: true
      };
    }

    await match.save();

    return {
      message: 'Score updated successfully',
      data: match
    };
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

module.exports = {
  completeMatchLogic,
  processScoreUpdate
};
