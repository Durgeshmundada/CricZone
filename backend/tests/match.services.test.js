jest.mock("../models/Match", () => ({ findById: jest.fn() }));
jest.mock("../models/Team", () => ({ findById: jest.fn() }));
jest.mock("../models/User", () => ({ find: jest.fn() }));

const Match = require("../models/Match");
const { configureMatchFromToss } = require("../services/matchSetupService");
const { completeCurrentInnings, processScoreUpdate } = require("../services/scoringService");

const ownerId = "507f1f77bcf86cd799439011";

const createMatch = () => ({
  _id: "507f1f77bcf86cd799439012",
  createdBy: ownerId,
  status: "live",
  currentInning: 1,
  ballsPerOver: 6,
  totalOvers: 20,
  currentStriker: "",
  currentStrikerId: null,
  currentNonStriker: "",
  currentNonStrikerId: null,
  currentBowler: "",
  currentBowlerId: null,
  ballByBallData: [],
  batsmanStats: [],
  bowlerStats: [],
  fallOfWickets: [],
  statsProcessed: false,
  winner: null,
  resultType: null,
  resultMargin: null,
  teamA: { name: "Alpha", score: 0, wickets: 0, overs: "0.0", ballsPlayed: 0, playerLinks: [] },
  teamB: { name: "Beta", score: 0, wickets: 0, overs: "0.0", ballsPlayed: 0, playerLinks: [] },
  innings: {
    first: {
      battingTeam: "teamA",
      bowlingTeam: "teamB",
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      target: 0,
      isCompleted: false,
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
      currentPartnership: { runs: 0, balls: 0, batsman1: "", batsman2: "" }
    },
    second: {
      battingTeam: "teamB",
      bowlingTeam: "teamA",
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      target: 0,
      isCompleted: false,
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
      currentPartnership: { runs: 0, balls: 0, batsman1: "", batsman2: "" }
    }
  },
  save: jest.fn().mockResolvedValue(undefined)
});

describe("match setup service", () => {
  test("resets score state and applies toss decision", () => {
    const match = createMatch();
    match.teamA.score = 99;
    match.innings.first.score = 99;

    configureMatchFromToss(match, { tossWinnerTeam: "Beta", decision: "bowl" });

    expect(match.toss).toEqual({ winner: "Beta", decision: "bowl" });
    expect(match.innings.first.battingTeam).toBe("teamA");
    expect(match.teamA.score).toBe(0);
    expect(match.status).toBe("live");
  });
});

describe("scoring service", () => {
  beforeEach(() => jest.clearAllMocks());

  test("applies an incremental legal delivery", async () => {
    const match = createMatch();
    Match.findById.mockResolvedValue(match);

    const result = await processScoreUpdate({
      matchId: match._id,
      user: { _id: ownerId, role: "user" },
      payload: { runs: 4 }
    });

    expect(result.message).toBe("Score updated successfully");
    expect(match.innings.first.score).toBe(4);
    expect(match.innings.first.balls).toBe(1);
    expect(match.teamA.overs).toBe("0.1");
    expect(match.save).toHaveBeenCalledTimes(1);
  });

  test("rejects score updates from unauthorized users", async () => {
    const match = createMatch();
    Match.findById.mockResolvedValue(match);

    await expect(processScoreUpdate({
      matchId: match._id,
      user: { _id: "507f1f77bcf86cd799439099", role: "user" },
      payload: { runs: 1 }
    })).rejects.toMatchObject({ status: 403 });
  });

  test("manually ends the first innings and prepares the chase", async () => {
    const match = createMatch();
    match.innings.first.score = 47;
    match.teamA.score = 47;
    match.currentStriker = "Batter";
    match.currentNonStriker = "Partner";
    match.currentBowler = "Bowler";
    Match.findById.mockResolvedValue(match);

    const result = await completeCurrentInnings({
      matchId: match._id,
      user: { _id: ownerId, role: "user" }
    });

    expect(result.inningsComplete).toBe(true);
    expect(match.currentInning).toBe(2);
    expect(match.status).toBe("innings_break");
    expect(match.innings.first.isCompleted).toBe(true);
    expect(match.innings.second.target).toBe(48);
    expect(match.innings.second.battingTeam).toBe("teamB");
    expect(match.currentStriker).toBe("");
    expect(match.currentBowler).toBe("");
    expect(match.save).toHaveBeenCalledTimes(1);
  });
});
