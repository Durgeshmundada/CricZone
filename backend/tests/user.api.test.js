const User = require("../models/User");
const { api, auth, createAuthUser, createUser, nextValue } = require("./helpers/apiTestUtils");

describe("User API", () => {
  test("registers, rejects duplicates, rotates refresh tokens, and logs out", async () => {
    const email = `${nextValue("register")}@example.test`;
    const payload = { name: "Registered User", email, phone: "9876543210", password: "Pass1234" };
    const ip = "203.0.113.10";

    const registered = await api.post("/api/users/register").set("X-Forwarded-For", ip).send(payload);
    expect(registered.status).toBe(201);
    expect(registered.body.token).toBeTruthy();
    expect(registered.headers["set-cookie"][0]).toContain("criczone_refresh=");

    const duplicate = await api.post("/api/users/register").set("X-Forwarded-For", ip).send(payload);
    expect(duplicate.status).toBe(400);

    const login = await api.post("/api/users/login").set("X-Forwarded-For", ip).send({
      email,
      password: payload.password
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const refreshed = await api
      .post("/api/users/refresh")
      .set("Cookie", registered.headers["set-cookie"])
      .send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toBeTruthy();
    expect(refreshed.headers["set-cookie"][0]).toContain("criczone_refresh=");

    const loggedOut = await api
      .post("/api/users/logout")
      .set("Cookie", refreshed.headers["set-cookie"])
      .send({});
    expect(loggedOut.status).toBe(200);

    const rejectedRefresh = await api
      .post("/api/users/refresh")
      .set("Cookie", refreshed.headers["set-cookie"])
      .send({});
    expect(rejectedRefresh.status).toBe(401);
  });

  test("locks an account after five invalid passwords", async () => {
    const user = await createUser({ email: `${nextValue("lockout")}@example.test` });
    const ip = "203.0.113.20";

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await api.post("/api/users/login").set("X-Forwarded-For", ip).send({
        email: user.email,
        password: "wrong-password"
      });
      expect(response.status).toBe(attempt === 5 ? 423 : 401);
    }

    const lockedUser = await User.findById(user._id).select("+failedLoginAttempts +lockUntil");
    expect(lockedUser.failedLoginAttempts).toBe(5);
    expect(lockedUser.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test("updates profiles, discovers players, follows users, and enforces admin role changes", async () => {
    const owner = await createAuthUser();
    const target = await createUser({
      name: "Searchable Batter",
      profile: { displayName: "Boundary Finder", location: { city: "Pune" }, availability: "Available" }
    });
    const regular = await createAuthUser();
    const admin = await createAuthUser({ role: "admin" });

    const profile = await auth(api.put("/api/users/profile"), owner.token).send({
      name: "Updated Player",
      profile: { bio: "Top order batter", location: { city: "Pune" } }
    });
    expect(profile.status).toBe(200);
    expect(profile.body.user.name).toBe("Updated Player");

    const ownProfile = await auth(api.get("/api/users/profile"), owner.token);
    expect(ownProfile.status).toBe(200);

    const publicProfile = await api.get(`/api/users/player/${target._id}`);
    expect(publicProfile.status).toBe(200);

    const search = await api.get("/api/users/search-players").query({ search: "Searchable", location: "Pune" });
    expect(search.status).toBe(200);
    expect(search.body.data).toHaveLength(1);

    const nearby = await api.get("/api/users/nearby-players").query({ city: "Pune" });
    expect(nearby.status).toBe(200);
    expect(nearby.body.data.some((player) => player.id === target.id)).toBe(true);

    const batsmen = await api.get("/api/users/leaderboard/batsmen?limit=5");
    const bowlers = await api.get("/api/users/leaderboard/bowlers?limit=5");
    const allRounders = await api.get("/api/users/leaderboard/all-rounders?limit=5");
    expect(batsmen.status).toBe(200);
    expect(bowlers.status).toBe(200);
    expect(allRounders.status).toBe(200);

    const followed = await auth(api.post(`/api/users/follow/${target._id}`), owner.token).send({});
    expect(followed.status).toBe(200);
    const unfollowed = await auth(api.post(`/api/users/unfollow/${target._id}`), owner.token).send({});
    expect(unfollowed.status).toBe(200);

    const forbidden = await auth(api.put("/api/users/role"), regular.token).send({
      userId: target._id.toString(),
      role: "scorer"
    });
    expect(forbidden.status).toBe(403);

    const changed = await auth(api.put("/api/users/role"), admin.token).send({
      userId: target._id.toString(),
      role: "scorer"
    });
    expect(changed.status).toBe(200);
    expect(changed.body.user.role).toBe("scorer");
  });
});
