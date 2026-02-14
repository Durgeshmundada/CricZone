const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");

const dotenvPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: dotenvPath });

process.env.PORT = process.env.TEST_PORT || "5012";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const { app, server } = require("../server");
const Match = require("../models/Match");
const User = require("../models/User");

const api = request(app);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPhone = () => {
  const suffix = String(Math.floor(Math.random() * 900000000) + 100000000);
  return `9${suffix}`.slice(0, 10);
};

const randomEmail = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}@api-test.local`;

const signupUser = async (name, email) => {
  const response = await api.post("/api/users/signup").send({
    name,
    email,
    phone: buildPhone(),
    password: "Pass1234"
  });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.token).toBeTruthy();
  return response.body;
};

describe("Match API scoring lifecycle", () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const health = await api.get("/api/health");
        if (health.status === 200 && health.body.success) {
          ready = true;
          break;
        }
      } catch (_error) {
        // Retry until boot is done.
      }
      // eslint-disable-next-line no-await-in-loop
      await delay(250);
    }

    if (!ready) {
      throw new Error("Server did not become ready for tests");
    }
  });

  afterAll(async () => {
    await Promise.all([
      Match.deleteMany({ matchName: /^API TEST:/ }),
      User.deleteMany({ email: /@api-test\.local$/i })
    ]);

    await new Promise((resolve) => {
      if (!server || !server.listening) return resolve();
      return server.close(() => resolve());
    });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  });

  test("supports toss -> score -> undo -> complete and updates user stats", async () => {
    const ownerEmail = randomEmail("owner");
    const opponentEmail = randomEmail("opponent");

    const owner = await signupUser("API Owner", ownerEmail);
    const opponent = await signupUser("API Opponent", opponentEmail);

    const ownerToken = owner.token;
    const opponentToken = opponent.token;

    const createMatchResponse = await api
      .post("/api/matches")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        matchName: `API TEST: lifecycle ${Date.now()}`,
        matchType: "T20",
        teamAName: "Alpha XI",
        teamAPlayers: [{ name: owner.user.name, email: owner.user.email }],
        teamBName: "Beta XI",
        teamBPlayers: [{ name: opponent.user.name, email: opponent.user.email }],
        venue: "Test Ground",
        matchDate: new Date().toISOString().slice(0, 10)
      });

    expect(createMatchResponse.status).toBe(201);
    expect(createMatchResponse.body.success).toBe(true);
    const matchId = createMatchResponse.body.data._id;
    const ownerPlayerId = createMatchResponse.body.data.teamA.playerLinks[0].userId;
    const opponentPlayerId = createMatchResponse.body.data.teamB.playerLinks[0].userId;

    const tossResponse = await api
      .put(`/api/matches/${matchId}/toss`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        tossWinnerTeam: "teamA",
        decision: "bat"
      });

    expect(tossResponse.status).toBe(200);
    expect(tossResponse.body.success).toBe(true);
    expect(tossResponse.body.data.status).toBe("live");
    expect(tossResponse.body.data.innings.first.battingTeam).toBe("teamA");

    const ballEvents = [
      {
        runs: 1,
        isExtra: false,
        extraType: null,
        isWicket: false,
        strikerName: owner.user.name,
        strikerId: ownerPlayerId,
        nonStrikerName: "Guest Partner",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId
      },
      {
        runs: 0,
        isExtra: false,
        extraType: null,
        isWicket: false,
        strikerName: "Guest Partner",
        strikerId: null,
        nonStrikerName: owner.user.name,
        nonStrikerId: ownerPlayerId,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId
      },
      {
        runs: 0,
        isExtra: false,
        extraType: null,
        isWicket: true,
        wicketKind: "bowled",
        strikerName: "Guest Partner",
        strikerId: null,
        nonStrikerName: owner.user.name,
        nonStrikerId: ownerPlayerId,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        wicketPlayerName: "Guest Partner",
        wicketPlayerId: null
      }
    ];

    const scoreResponse = await api
      .put(`/api/matches/${matchId}/score`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        mode: "absolute",
        runs: 1,
        wickets: 1,
        overs: "0.3",
        batsmanName: owner.user.name,
        batsmanId: ownerPlayerId,
        nonStrikerName: "New Batter",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        ballEvents
      });

    expect(scoreResponse.status).toBe(200);
    expect(scoreResponse.body.success).toBe(true);
    expect(scoreResponse.body.data.innings.first.score).toBe(1);
    expect(scoreResponse.body.data.innings.first.wickets).toBe(1);
    expect(scoreResponse.body.data.ballByBallData.filter((b) => b.inning === 1)).toHaveLength(3);

    const undoEvents = ballEvents.slice(0, 2);
    const undoResponse = await api
      .put(`/api/matches/${matchId}/score`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        mode: "absolute",
        runs: 1,
        wickets: 0,
        overs: "0.2",
        batsmanName: owner.user.name,
        batsmanId: ownerPlayerId,
        nonStrikerName: "Guest Partner",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        ballEvents: undoEvents
      });

    expect(undoResponse.status).toBe(200);
    expect(undoResponse.body.success).toBe(true);
    expect(undoResponse.body.data.innings.first.score).toBe(1);
    expect(undoResponse.body.data.innings.first.wickets).toBe(0);
    expect(undoResponse.body.data.ballByBallData.filter((b) => b.inning === 1)).toHaveLength(2);

    const completeResponse = await api
      .put(`/api/matches/${matchId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.data.status).toBe("completed");

    const completeAgainResponse = await api
      .put(`/api/matches/${matchId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(completeAgainResponse.status).toBe(400);

    const ownerProfileResponse = await api
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${ownerToken}`);
    const opponentProfileResponse = await api
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${opponentToken}`);

    expect(ownerProfileResponse.status).toBe(200);
    expect(opponentProfileResponse.status).toBe(200);

    const ownerStats = ownerProfileResponse.body.user.stats;
    const opponentStats = opponentProfileResponse.body.user.stats;

    expect(ownerStats.matchesPlayed).toBe(1);
    expect(ownerStats.wins).toBe(1);
    expect(ownerStats.batting.runs).toBe(1);
    expect(ownerStats.batting.innings).toBe(1);
    expect(ownerStats.batting.ballsFaced).toBe(1);

    expect(opponentStats.matchesPlayed).toBe(1);
    expect(opponentStats.losses).toBe(1);
    expect(opponentStats.bowling.runs).toBe(1);
    expect(opponentStats.bowling.wickets).toBe(0);
    expect(opponentStats.bowling.balls).toBe(2);
  });
});
