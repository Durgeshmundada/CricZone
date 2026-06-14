const { api, createUser } = require("./helpers/apiTestUtils");

describe("Leaderboard API", () => {
  test("orders batting, bowling, and all-rounder leaderboards", async () => {
    await createUser({
      name: "Top Batter",
      stats: { batting: { runs: 500 }, bowling: { wickets: 2 } },
      profile: { playerType: "Batsman" },
      rankings: { allRounder: 10 }
    });
    await createUser({
      name: "Top Bowler",
      stats: { batting: { runs: 50 }, bowling: { wickets: 25 } },
      profile: { playerType: "Bowler" },
      rankings: { allRounder: 20 }
    });
    await createUser({
      name: "Top All Rounder",
      stats: { batting: { runs: 300 }, bowling: { wickets: 15 } },
      profile: { playerType: "All-rounder" },
      rankings: { allRounder: 99 }
    });

    const batsmen = await api.get("/api/leaderboard/batsmen?limit=2");
    expect(batsmen.status).toBe(200);
    expect(batsmen.body.batsmen[0].name).toBe("Top Batter");
    expect(batsmen.body.batsmen).toHaveLength(2);

    const bowlers = await api.get("/api/leaderboard/bowlers?limit=2");
    expect(bowlers.status).toBe(200);
    expect(bowlers.body.bowlers[0].name).toBe("Top Bowler");

    const allRounders = await api.get("/api/leaderboard/all-rounders");
    expect(allRounders.status).toBe(200);
    expect(allRounders.body.allRounders).toHaveLength(1);
    expect(allRounders.body.allRounders[0].name).toBe("Top All Rounder");
  });
});
