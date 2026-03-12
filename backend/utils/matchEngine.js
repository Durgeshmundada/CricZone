const { formatOversFromBalls, parseOversInput } = require("./time");

const MATCH_TYPE_OVERS = {
  T20: 20,
  ODI: 50,
  Test: 90
};

const getOversLimit = (matchType, customOvers) => {
  const normalizedType = String(matchType || "T20").trim();
  if (normalizedType === "Custom") {
    const parsed = Number.parseInt(customOvers, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  }

  return MATCH_TYPE_OVERS[normalizedType] || 20;
};

const getPlayerKey = (name, id) => {
  const normalizedId = String(id || "").trim();
  if (normalizedId) return `id:${normalizedId}`;
  return `name:${String(name || "").trim().toLowerCase()}`;
};

const ensureBatsmanStats = (collection, inning, name, playerId) => {
  const key = getPlayerKey(name, playerId);
  if (!collection.has(key)) {
    collection.set(key, {
      inning,
      name: String(name || "Player").trim() || "Player",
      playerId: playerId || null,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      isOut: false,
      dismissal: {
        kind: null,
        bowlerName: null,
        fielderName: null
      }
    });
  }

  return collection.get(key);
};

const ensureBowlerStats = (collection, inning, name, playerId) => {
  const key = getPlayerKey(name, playerId);
  if (!collection.has(key)) {
    collection.set(key, {
      inning,
      name: String(name || "Bowler").trim() || "Bowler",
      playerId: playerId || null,
      balls: 0,
      runs: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
      economy: 0
    });
  }

  return collection.get(key);
};

const normalizeBallEvents = (inningNumber, ballEvents = []) => {
  let legalBallCount = 0;

  return ballEvents.map((event, index) => {
    const totalRuns = Math.max(0, Number.parseInt(event?.runs, 10) || 0);
    const extraType = event?.isExtra ? String(event.extraType || "").trim().toLowerCase() : null;
    const isWide = extraType === "wd" || extraType === "wide";
    const isNoBall = extraType === "nb" || extraType === "noball";
    const isBye = extraType === "bye";
    const isLegBye = extraType === "lb" || extraType === "legbye";
    const isLegalDelivery = !isWide && !isNoBall;

    if (isLegalDelivery) {
      legalBallCount += 1;
    }

    const over = legalBallCount === 0 ? 0 : Math.floor((legalBallCount - 1) / 6);
    const ballInOver = legalBallCount === 0 ? 0 : (((legalBallCount - 1) % 6) + 1);
    const batsmanRuns = isWide
      ? 0
      : (isNoBall ? Math.max(totalRuns - 1, 0) : (isBye || isLegBye ? 0 : totalRuns));
    const extrasRuns = totalRuns - batsmanRuns;

    return {
      inning: inningNumber,
      ballNumber: index + 1,
      over,
      ballInOver,
      totalRuns,
      batsmanRuns,
      batsmanName: String(event?.strikerName || "").trim(),
      batsmanId: event?.strikerId || null,
      nonStrikerName: String(event?.nonStrikerName || "").trim(),
      nonStrikerId: event?.nonStrikerId || null,
      bowlerName: String(event?.bowlerName || "").trim(),
      bowlerId: event?.bowlerId || null,
      extras: {
        type: extraType || null,
        runs: extrasRuns
      },
      isWicket: Boolean(event?.isWicket),
      wicket: {
        kind: event?.wicketKind || null,
        playerOutName: event?.wicketPlayerName || event?.strikerName || null,
        playerOutId: event?.wicketPlayerId || null
      },
      isReverted: false
    };
  });
};

const deriveInningState = (inningNumber, ballEvents, oversLimit, battingTeamKey, firstInningScore = 0) => {
  const batsmen = new Map();
  const bowlers = new Map();
  const fallOfWickets = [];

  let score = 0;
  let wickets = 0;
  let legalBalls = 0;

  for (const ball of ballEvents) {
    const extraType = String(ball?.extras?.type || "").trim().toLowerCase();
    const totalRuns = Number(ball?.totalRuns || 0);
    const batsmanRuns = Number(ball?.batsmanRuns || 0);
    const isWide = extraType === "wd" || extraType === "wide";
    const isNoBall = extraType === "nb" || extraType === "noball";
    const isBye = extraType === "bye";
    const isLegBye = extraType === "lb" || extraType === "legbye";
    const isLegalDelivery = !isWide && !isNoBall;

    score += totalRuns;

    const batsmanStats = ensureBatsmanStats(
      batsmen,
      inningNumber,
      ball.batsmanName,
      ball.batsmanId
    );
    const bowlerStats = ensureBowlerStats(
      bowlers,
      inningNumber,
      ball.bowlerName,
      ball.bowlerId
    );

    batsmanStats.runs += batsmanRuns;
    if (batsmanRuns === 4) batsmanStats.fours += 1;
    if (batsmanRuns === 6) batsmanStats.sixes += 1;

    if (isLegalDelivery) {
      legalBalls += 1;
      batsmanStats.ballsFaced += 1;
      bowlerStats.balls += 1;
    }

    if (isWide) {
      bowlerStats.runs += totalRuns;
      bowlerStats.wides += totalRuns;
    } else if (isNoBall) {
      bowlerStats.runs += totalRuns;
      bowlerStats.noBalls += totalRuns;
    } else if (!isBye && !isLegBye) {
      bowlerStats.runs += totalRuns;
    }

    if (ball.isWicket) {
      wickets += 1;
      const dismissedPlayerName = ball.wicket?.playerOutName || ball.batsmanName || "Player";
      const dismissedPlayerId = ball.wicket?.playerOutId || null;
      const dismissedStats = ensureBatsmanStats(
        batsmen,
        inningNumber,
        dismissedPlayerName,
        dismissedPlayerId
      );

      dismissedStats.isOut = true;
      dismissedStats.dismissal = {
        kind: ball.wicket?.kind || "bowled",
        bowlerName: ball.bowlerName || null,
        fielderName: null
      };
      if ((ball.wicket?.kind || "bowled") !== "run_out") {
        bowlerStats.wickets += 1;
      }
      fallOfWickets.push({
        inning: inningNumber,
        wicketNumber: wickets,
        playerOut: dismissedPlayerName,
        score,
        overs: formatOversFromBalls(legalBalls)
      });
    }
  }

  for (const stats of batsmen.values()) {
    stats.strikeRate = stats.ballsFaced > 0
      ? Number(((stats.runs / stats.ballsFaced) * 100).toFixed(2))
      : 0;
  }

  for (const stats of bowlers.values()) {
    stats.economy = stats.balls > 0
      ? Number(((stats.runs / stats.balls) * 6).toFixed(2))
      : 0;
  }

  const target = inningNumber === 2 ? firstInningScore + 1 : 0;
  const runRate = legalBalls > 0 ? Number(((score / legalBalls) * 6).toFixed(2)) : 0;
  const remainingBalls = Math.max((oversLimit * 6) - legalBalls, 0);
  const requiredRunRate = inningNumber === 2 && remainingBalls > 0 && target > score
    ? Number((((target - score) / remainingBalls) * 6).toFixed(2))
    : 0;
  const inningsComplete = legalBalls >= (oversLimit * 6) || wickets >= 10 || (inningNumber === 2 && target > 0 && score >= target);

  return {
    battingTeam: battingTeamKey,
    score,
    wickets,
    balls: legalBalls,
    overs: formatOversFromBalls(legalBalls),
    target,
    runRate,
    requiredRunRate,
    isComplete: inningsComplete,
    batsmanStats: Array.from(batsmen.values()),
    bowlerStats: Array.from(bowlers.values()),
    fallOfWickets
  };
};

const determineWinner = (match) => {
  const teamAScore = Number(match.teamA?.score || 0);
  const teamBScore = Number(match.teamB?.score || 0);
  const chasingTeam = String(match.innings?.second?.battingTeam || "teamB");

  if (teamAScore === teamBScore) {
    return {
      winnerTeam: null,
      message: "Match tied"
    };
  }

  const chasingTeamScore = chasingTeam === "teamA" ? teamAScore : teamBScore;
  const defendingTeamScore = chasingTeam === "teamA" ? teamBScore : teamAScore;

  if (chasingTeamScore >= defendingTeamScore + 1) {
    const wicketsLost = Number(
      chasingTeam === "teamA" ? match.teamA?.wickets || 0 : match.teamB?.wickets || 0
    );
    const wicketsRemaining = Math.max(10 - wicketsLost, 0);
    const chasingTeamName = chasingTeam === "teamA" ? match.teamA?.name : match.teamB?.name;

    return {
      winnerTeam: chasingTeam,
      message: `${chasingTeamName || "Chasing Team"} won by ${wicketsRemaining} wickets`
    };
  }

  if (teamAScore > teamBScore) {
    return {
      winnerTeam: "teamA",
      message: `${match.teamA?.name || "Team A"} won by ${teamAScore - teamBScore} runs`
    };
  }

  return {
    winnerTeam: "teamB",
    message: `${match.teamB?.name || "Team B"} won by ${teamBScore - teamAScore} runs`
  };
};

const validateAbsoluteScoreRequest = (body, inningNumber, oversLimit) => {
  const oversFromBody = parseOversInput(body.overs);
  if (oversFromBody === null) {
    return {
      ok: false,
      message: "Overs must be in O.B format with 0-5 balls in the current over."
    };
  }

  const normalizedBalls = normalizeBallEvents(inningNumber, body.ballEvents || []);
  const derived = deriveInningState(
    inningNumber,
    normalizedBalls,
    oversLimit,
    inningNumber === 1 ? "teamA" : "teamB"
  );

  if (oversFromBody !== derived.balls) {
    return {
      ok: false,
      message: `Overs do not match ball events. Expected ${formatOversFromBalls(derived.balls)} from ${normalizedBalls.length} events.`
    };
  }

  if (Number(body.runs) !== derived.score) {
    return {
      ok: false,
      message: `Runs do not match ball events. Expected ${derived.score}.`
    };
  }

  if (Number(body.wickets) !== derived.wickets) {
    return {
      ok: false,
      message: `Wickets do not match ball events. Expected ${derived.wickets}.`
    };
  }

  return {
    ok: true
  };
};

module.exports = {
  determineWinner,
  deriveInningState,
  getOversLimit,
  normalizeBallEvents,
  validateAbsoluteScoreRequest
};
