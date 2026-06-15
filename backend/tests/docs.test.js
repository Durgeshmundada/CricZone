const request = require("supertest");
const { app } = require("../server");

describe("OpenAPI documentation", () => {
  test("serves auth and match API documentation", async () => {
    const response = await request(app).get("/api/docs");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths["/api/users/login"].post).toBeDefined();
    expect(response.body.paths["/api/users/refresh"].post).toBeDefined();
    expect(response.body.paths["/api/matches"].get).toBeDefined();
    expect(response.body.paths["/api/matches"].post.security).toEqual([
      { bearerAuth: [] }
    ]);
    expect(response.body.paths["/api/matches/{id}/score"].put).toBeDefined();
    expect(response.body.paths["/api/matches/{id}/innings/complete"].put).toBeDefined();
  });
});
