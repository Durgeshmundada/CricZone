const { api, auth, createAuthUser } = require("./helpers/apiTestUtils");

const tournamentPayload = () => ({
  name: "API Premier League",
  description: "Integration test tournament",
  startDate: "2026-07-10",
  endDate: "2026-07-30",
  venue: "Test Stadium",
  venues: [{ name: "Test Stadium", location: "Pune" }],
  format: "T20",
  tournamentType: "league_knockout",
  maxTeams: 4,
  minPlayers: 2,
  maxPlayers: 5
});

const registrationPayload = (number) => ({
  teamName: `Tournament Team ${number}`,
  captain: `Captain ${number}`,
  players: [
    { name: `Captain ${number}` },
    { name: `Player ${number}` }
  ]
});

describe("Tournament API", () => {
  test("runs registration, standings, fixtures, playoffs, status, and deletion workflows", async () => {
    const owner = await createAuthUser();
    const outsider = await createAuthUser();

    const unauthorized = await api.post("/api/tournaments").send(tournamentPayload());
    expect(unauthorized.status).toBe(401);
    const invalid = await auth(api.post("/api/tournaments"), owner.token).send({
      ...tournamentPayload(),
      endDate: "2026-07-01"
    });
    expect(invalid.status).toBe(400);

    const created = await auth(api.post("/api/tournaments"), owner.token).send(tournamentPayload());
    expect(created.status).toBe(201);
    const tournamentId = created.body.tournament._id;

    const all = await api.get("/api/tournaments?page=1&limit=5");
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(1);
    const active = await api.get("/api/tournaments/active");
    expect(active.status).toBe(200);
    expect(active.body.data).toHaveLength(1);
    const fetched = await api.get(`/api/tournaments/${tournamentId}`);
    expect(fetched.status).toBe(200);

    for (let number = 1; number <= 4; number += 1) {
      const registered = await auth(
        api.post(`/api/tournaments/${tournamentId}/register`),
        owner.token
      ).send(registrationPayload(number));
      expect(registered.status).toBe(200);
    }

    const duplicate = await auth(
      api.post(`/api/tournaments/${tournamentId}/register`),
      owner.token
    ).send(registrationPayload(1));
    expect(duplicate.status).toBe(400);

    const forbiddenUnregister = await auth(
      api.post(`/api/tournaments/${tournamentId}/unregister`),
      outsider.token
    ).send({ teamName: "Tournament Team 4" });
    expect(forbiddenUnregister.status).toBe(403);

    const unregistered = await auth(
      api.post(`/api/tournaments/${tournamentId}/unregister`),
      owner.token
    ).send({ teamName: "Tournament Team 4" });
    expect(unregistered.status).toBe(200);
    const registeredAgain = await auth(
      api.post(`/api/tournaments/${tournamentId}/register`),
      owner.token
    ).send(registrationPayload(4));
    expect(registeredAgain.status).toBe(200);

    const standings = await api.get(`/api/tournaments/${tournamentId}/standings`);
    expect(standings.status).toBe(200);
    expect(standings.body.standings).toHaveLength(4);

    const standingsPayload = {
      tournamentId,
      teamA: "Tournament Team 1",
      teamB: "Tournament Team 2",
      winner: "Tournament Team 1",
      teamAScore: 150,
      teamBScore: 140,
      teamAOvers: "20.0",
      teamBOvers: "20.0",
      resultType: "none"
    };
    const forbiddenStandings = await auth(
      api.post("/api/tournaments/standings/update"),
      outsider.token
    ).send(standingsPayload);
    expect(forbiddenStandings.status).toBe(403);
    const updatedStandings = await auth(
      api.post("/api/tournaments/standings/update"),
      owner.token
    ).send(standingsPayload);
    expect(updatedStandings.status).toBe(200);
    expect(updatedStandings.body.standings[0].teamName).toBe("Tournament Team 1");

    const forbiddenFixtures = await auth(
      api.post(`/api/tournaments/${tournamentId}/generate-fixtures`),
      outsider.token
    ).send({});
    expect(forbiddenFixtures.status).toBe(403);
    const fixtures = await auth(
      api.post(`/api/tournaments/${tournamentId}/generate-fixtures`),
      owner.token
    ).send({});
    expect(fixtures.status).toBe(200);
    expect(fixtures.body.fixtures.length).toBeGreaterThan(0);

    const forbiddenStatus = await auth(
      api.put(`/api/tournaments/${tournamentId}/status`),
      outsider.token
    ).send({ status: "ongoing" });
    expect(forbiddenStatus.status).toBe(403);

    const playoffs = await auth(
      api.post(`/api/tournaments/${tournamentId}/generate-playoffs`),
      owner.token
    ).send({});
    expect(playoffs.status).toBe(200);
    expect(playoffs.body.knockout.qualifier1.team1).toBeTruthy();

    const blockedDelete = await auth(api.delete(`/api/tournaments/${tournamentId}`), owner.token);
    expect(blockedDelete.status).toBe(400);

    const stats = await api.get(`/api/tournaments/${tournamentId}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body.statistics.completedMatches).toBe(1);

    const completed = await auth(
      api.put(`/api/tournaments/${tournamentId}/status`),
      owner.token
    ).send({ status: "completed" });
    expect(completed.status).toBe(200);

    const forbiddenDelete = await auth(api.delete(`/api/tournaments/${tournamentId}`), outsider.token);
    expect(forbiddenDelete.status).toBe(403);
    const deleted = await auth(api.delete(`/api/tournaments/${tournamentId}`), owner.token);
    expect(deleted.status).toBe(200);
    const missing = await api.get(`/api/tournaments/${tournamentId}`);
    expect(missing.status).toBe(404);
  });
});
