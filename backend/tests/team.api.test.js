const { api, auth, createAuthUser } = require("./helpers/apiTestUtils");

describe("Team API", () => {
  test("handles team ownership, invitations, updates, suggestions, and deletion", async () => {
    const owner = await createAuthUser();
    const invitee = await createAuthUser({ name: "Invited Player" });
    const outsider = await createAuthUser({ name: "Outside Player" });

    const created = await auth(api.post("/api/teams"), owner.token).send({
      name: "API XI",
      members: [
        { name: invitee.user.name, email: invitee.user.email, playerId: invitee.user._id.toString() },
        { name: "Guest Player", email: "guest@example.test" }
      ]
    });
    expect(created.status).toBe(201);
    expect(created.body.data.members).toHaveLength(3);
    const teamId = created.body.data._id;
    const invitedMember = created.body.data.members.find(
      (member) => member.player === invitee.user._id.toString()
    );

    const duplicate = await auth(api.post("/api/teams/create"), owner.token).send({
      name: "API XI",
      members: [{ name: "Another Player" }]
    });
    expect(duplicate.status).toBe(400);

    const invitations = await auth(api.get("/api/teams/invitations/my"), invitee.token);
    expect(invitations.status).toBe(200);
    expect(invitations.body.data).toHaveLength(1);

    const accepted = await auth(
      api.put(`/api/teams/${teamId}/invitations/${invitedMember._id}/respond`),
      invitee.token
    ).send({ action: "accept" });
    expect(accepted.status).toBe(200);

    const listed = await auth(api.get("/api/teams?page=1&limit=10"), owner.token);
    expect(listed.status).toBe(200);
    expect(listed.body.meta.total).toBe(1);

    const viewed = await auth(api.get(`/api/teams/${teamId}`), invitee.token);
    expect(viewed.status).toBe(200);
    const players = await auth(api.get(`/api/teams/${teamId}/players`), invitee.token);
    expect(players.status).toBe(200);

    const forbiddenView = await auth(api.get(`/api/teams/${teamId}`), outsider.token);
    expect(forbiddenView.status).toBe(403);
    const forbiddenUpdate = await auth(api.put(`/api/teams/${teamId}`), outsider.token).send({ name: "Hijacked" });
    expect(forbiddenUpdate.status).toBe(403);

    const suggestions = await auth(api.get("/api/teams/suggestions").query({ q: "Outside" }), owner.token);
    expect(suggestions.status).toBe(200);
    expect(suggestions.body.data.some((entry) => entry.userId === outsider.user.id)).toBe(true);

    const updated = await auth(api.put(`/api/teams/${teamId}`), owner.token).send({
      name: "API XI Updated",
      members: [{ name: owner.user.name, playerId: owner.user.id }, { name: "Replacement Guest" }]
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("API XI Updated");

    const deleted = await auth(api.delete(`/api/teams/${teamId}`), owner.token);
    expect(deleted.status).toBe(200);
    const missing = await auth(api.get(`/api/teams/${teamId}`), owner.token);
    expect(missing.status).toBe(404);
  });

  test("generates two balanced sides and validates authentication", async () => {
    const owner = await createAuthUser();
    const unauthorized = await api.post("/api/teams/randomize").send({ players: ["A", "B"] });
    expect(unauthorized.status).toBe(401);

    const generated = await auth(api.post("/api/teams/randomize"), owner.token).send({
      players: ["A", "B", "C", "D", "E", "F"]
    });
    expect(generated.status).toBe(200);
    expect(generated.body.distribution.teamA.players).toHaveLength(3);
    expect(generated.body.distribution.teamB.players).toHaveLength(3);
  });
});
