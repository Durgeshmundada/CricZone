const { api, auth, createAuthUser, validTurfPayload } = require("./helpers/apiTestUtils");

describe("Turf API", () => {
  test("enforces turf-owner permissions and supports the turf lifecycle", async () => {
    const owner = await createAuthUser({ role: "turf_owner" });
    const otherOwner = await createAuthUser({ role: "turf_owner" });
    const regular = await createAuthUser();
    const payload = validTurfPayload({ turfName: "Green Arena" });

    const unauthenticated = await api.post("/api/turfs/add").send(payload);
    expect(unauthenticated.status).toBe(401);
    const wrongRole = await auth(api.post("/api/turfs/add"), regular.token).send(payload);
    expect(wrongRole.status).toBe(403);

    const created = await auth(api.post("/api/turfs/add"), owner.token).send(payload);
    expect(created.status).toBe(201);
    const turfId = created.body.data._id;

    const listed = await api.get("/api/turfs/all?page=1&limit=5");
    expect(listed.status).toBe(200);
    expect(listed.body.meta.total).toBe(1);
    const fetched = await api.get(`/api/turfs/${turfId}`);
    expect(fetched.status).toBe(200);
    const owned = await auth(api.get("/api/turfs/owned"), owner.token);
    expect(owned.status).toBe(200);
    expect(owned.body.data).toHaveLength(1);

    const forbidden = await auth(api.put(`/api/turfs/${turfId}`), otherOwner.token).send({
      turfName: "Not Yours"
    });
    expect(forbidden.status).toBe(403);

    const updated = await auth(api.put(`/api/turfs/${turfId}`), owner.token).send({
      turfName: "Green Arena Updated",
      basePricingPerSlot: 1500
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.basePricingPerSlot).toBe(1500);

    const deleted = await auth(api.delete(`/api/turfs/${turfId}`), owner.token);
    expect(deleted.status).toBe(200);
    const missing = await api.get(`/api/turfs/${turfId}`);
    expect(missing.status).toBe(404);
  });
});
