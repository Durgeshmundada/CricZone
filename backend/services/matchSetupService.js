const ServiceError = require("../utils/ServiceError");

const resetInningState = (inning) => {
  if (!inning) return;
  const targetValue = Number(inning.target || 0);
  inning.score = 0;
  inning.wickets = 0;
  inning.overs = 0;
  inning.balls = 0;
  inning.isCompleted = false;
  if (Object.prototype.hasOwnProperty.call(inning, "target")) {
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
    batsman1: "",
    batsman2: ""
  };
};

const resetTeamInningScore = (team) => {
  if (!team) return;
  team.score = 0;
  team.wickets = 0;
  team.overs = "0.0";
  team.ballsPlayed = 0;
};

const resolveTossWinner = (match, rawWinner) => {
  const normalizedWinner = String(rawWinner || "").trim().toLowerCase();
  const teamAName = String(match.teamA?.name || "").trim().toLowerCase();
  const teamBName = String(match.teamB?.name || "").trim().toLowerCase();

  if (["teama", "a", teamAName].includes(normalizedWinner)) return "teamA";
  if (["teamb", "b", teamBName].includes(normalizedWinner)) return "teamB";
  throw new ServiceError(400, "tossWinnerTeam must match Team A or Team B");
};

const configureMatchFromToss = (match, payload) => {
  const tossWinnerTeam = resolveTossWinner(match, payload.tossWinnerTeam || payload.tossWinner);
  const rawDecision = String(payload.decision || payload.tossDecision || "").trim().toLowerCase();
  if (!["bat", "bowl"].includes(rawDecision)) {
    throw new ServiceError(400, "decision must be either 'bat' or 'bowl'");
  }

  const battingTeam = rawDecision === "bat"
    ? tossWinnerTeam
    : (tossWinnerTeam === "teamA" ? "teamB" : "teamA");
  const bowlingTeam = battingTeam === "teamA" ? "teamB" : "teamA";

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
  match.currentStriker = "";
  match.currentStrikerId = null;
  match.currentNonStriker = "";
  match.currentNonStrikerId = null;
  match.currentBowler = "";
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
    winner: tossWinnerTeam === "teamA" ? match.teamA.name : match.teamB.name,
    decision: rawDecision
  };
  match.status = "live";

  return match;
};

module.exports = { configureMatchFromToss };
