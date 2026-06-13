const request = require("supertest");
const { app } = require("../server");
const escapeRegex = require("../utils/escapeRegex");

describe("security middleware", () => {
  test("sets an explicit content security policy", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("fonts.googleapis.com");
  });

  test("rejects MongoDB operator keys before controller execution", async () => {
    const response = await request(app)
      .post("/api/users/login")
      .send({ email: { $ne: null }, password: "secret" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid request key");
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
