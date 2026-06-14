const request = require("supertest");
const { app } = require("../server");
const escapeRegex = require("../utils/escapeRegex");

describe("security middleware", () => {
  test("sets an explicit content security policy", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "audit-health-check");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("audit-health-check");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("fonts.googleapis.com");
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers["content-security-policy"]).not.toContain("googletagmanager.com");
    expect(response.headers["content-security-policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test("prevents stale app-shell and service-worker responses", async () => {
    const [indexResponse, serviceWorkerResponse] = await Promise.all([
      request(app).get("/"),
      request(app).get("/sw.js")
    ]);

    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers["cache-control"]).toContain("no-cache");
    expect(serviceWorkerResponse.status).toBe(200);
    expect(serviceWorkerResponse.headers["cache-control"]).toContain("no-store");
  });

  test("rejects MongoDB operator keys before controller execution", async () => {
    const response = await request(app)
      .post("/api/users/login")
      .send({ email: { $ne: null }, password: "secret" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid request key");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body.requestId).toBeTruthy();
  });

  test("rejects privileged self-registration roles", async () => {
    const response = await request(app)
      .post("/api/users/register")
      .send({
        name: "Test User",
        email: "test@example.com",
        phone: "1234567890",
        password: "secret123",
        role: "admin"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Request validation failed");
  });

  test("limits repeated authentication attempts", async () => {
    const agent = request(app);
    const ip = "198.51.100.42";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await agent
        .post("/api/users/login")
        .set("X-Forwarded-For", ip)
        .send({ email: "invalid", password: "x" });
      expect(response.status).toBe(400);
    }

    const limitedResponse = await agent
      .post("/api/users/login")
      .set("X-Forwarded-For", ip)
      .send({ email: "invalid", password: "x" });

    expect(limitedResponse.status).toBe(429);
  });
});

describe("escapeRegex", () => {
  test("treats regex metacharacters as literal text", () => {
    const expression = new RegExp(escapeRegex("a+b(c)[d].*?"), "i");

    expect(expression.test("a+b(c)[d].*?")).toBe(true);
    expect(expression.test("aaabccdZZ")).toBe(false);
  });
});
