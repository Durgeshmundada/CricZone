const { api, auth, createAuthUser, createTurf } = require("./helpers/apiTestUtils");

describe("Booking API", () => {
  test("prevents overlaps and supports billing, reports, and cancellation permissions", async () => {
    const owner = await createAuthUser({ role: "turf_owner" });
    const customer = await createAuthUser();
    const outsider = await createAuthUser();
    const turf = await createTurf(owner.user._id);
    const payload = {
      turfId: turf.id,
      date: "2026-07-01",
      startTime: "18:00",
      endTime: "19:00",
      slotHours: 1
    };

    const unauthenticated = await api.post("/api/bookings").send(payload);
    expect(unauthenticated.status).toBe(401);
    const created = await auth(api.post("/api/bookings"), customer.token).send(payload);
    expect(created.status).toBe(201);
    const bookingId = created.body.booking._id;

    const overlap = await auth(api.post("/api/bookings"), outsider.token).send({
      ...payload,
      startTime: "18:30",
      endTime: "19:30"
    });
    expect(overlap.status).toBe(400);

    const mine = await auth(api.get("/api/bookings/mybookings"), customer.token);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    const forbiddenCancel = await auth(api.put(`/api/bookings/${bookingId}/cancel`), outsider.token).send({});
    expect(forbiddenCancel.status).toBe(403);

    const payment = await auth(api.put(`/api/bookings/${bookingId}/payment`), owner.token).send({
      paymentStatus: "paid",
      paymentMethod: "upi",
      paymentReference: "UPI-TEST"
    });
    expect(payment.status).toBe(200);

    const all = await auth(api.get("/api/bookings"), owner.token);
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(1);
    const summary = await auth(api.get("/api/bookings/billing/summary"), owner.token);
    expect(summary.status).toBe(200);
    expect(summary.body.totalRevenue).toBe(1200);

    const billingCsv = await auth(api.get("/api/bookings/billing/report.csv"), owner.token);
    expect(billingCsv.status).toBe(200);
    expect(billingCsv.headers["content-type"]).toContain("text/csv");
    const userCsv = await auth(api.get("/api/bookings/mybookings/report.csv"), customer.token);
    expect(userCsv.status).toBe(200);

    const cancelled = await auth(api.put(`/api/bookings/${bookingId}/cancel`), customer.token).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.billing.paymentStatus).toBe("refunded");
    const cancelledAgain = await auth(api.put(`/api/bookings/${bookingId}/cancel`), customer.token).send({});
    expect(cancelledAgain.status).toBe(400);
  });
});
