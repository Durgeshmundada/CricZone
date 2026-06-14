const request = require("supertest");
const { app } = require("../server");

const api = request(app);

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

    const allMatches = await api.get("/api/matches?page=1&limit=5");
    expect(allMatches.status).toBe(200);
    expect(allMatches.body.meta.total).toBe(1);
    const matchDetails = await api.get(`/api/matches/${matchId}`);
    expect(matchDetails.status).toBe(200);
    const ownerMatches = await api
      .get("/api/matches/user/my-matches")
      .set("Authorization", `Bearer ${ownerToken}`);
    const opponentMatches = await api
      .get("/api/matches/user/my-matches")
      .set("Authorization", `Bearer ${opponentToken}`);
    expect(ownerMatches.body.data).toHaveLength(1);
    expect(opponentMatches.body.data).toHaveLength(1);

    const forbiddenToss = await api
      .put(`/api/matches/${matchId}/toss`)
      .set("Authorization", `Bearer ${opponentToken}`)
      .send({ tossWinnerTeam: "teamA", decision: "bat" });
    expect(forbiddenToss.status).toBe(403);

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

    const liveMatches = await api.get("/api/matches/live");
    expect(liveMatches.status).toBe(200);
    expect(liveMatches.body.data).toHaveLength(1);

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

    const report = await api.get(`/api/matches/${matchId}/report`);
    expect(report.status).toBe(200);
    expect(report.body.report.meta.matchId).toBe(matchId);
    const reportCsv = await api.get(`/api/matches/${matchId}/report?format=csv`);
    expect(reportCsv.status).toBe(200);
    expect(reportCsv.headers["content-type"]).toContain("text/csv");
    const highlights = await api.get(`/api/matches/${matchId}/highlights`);
    expect(highlights.status).toBe(200);
    expect(highlights.body.highlights.some((item) => item.type === "wicket")).toBe(true);

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

    const forbiddenComplete = await api
      .put(`/api/matches/${matchId}/complete`)
      .set("Authorization", `Bearer ${opponentToken}`)
      .send({});
    expect(forbiddenComplete.status).toBe(403);

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

    const forbiddenDelete = await api
      .delete(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${opponentToken}`);
    expect(forbiddenDelete.status).toBe(403);
    const blockedDelete = await api
      .delete(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(blockedDelete.status).toBe(400);

    const disposableMatch = await api
      .post("/api/matches")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        matchName: `API TEST: disposable ${Date.now()}`,
        matchType: "Custom",
        customOvers: 5,
        teamAName: "Delete A",
        teamBName: "Delete B",
        venue: "Test Ground",
        matchDate: new Date().toISOString().slice(0, 10)
      });
    expect(disposableMatch.status).toBe(201);
    const deleted = await api
      .delete(`/api/matches/${disposableMatch.body.data._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(deleted.status).toBe(200);
  });

});
