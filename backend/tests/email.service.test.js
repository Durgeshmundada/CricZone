const { sendPasswordResetEmail } = require("../services/emailService");

describe("email service", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.PASSWORD_RESET_FROM;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.PASSWORD_RESET_FROM;
    else process.env.PASSWORD_RESET_FROM = originalFrom;
  });

  test("sends password reset mail through the configured Resend account", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.PASSWORD_RESET_FROM = "CricZone <password-reset@example.test>";
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const result = await sendPasswordResetEmail({
      to: "player@example.test",
      name: "Test Player",
      resetUrl: "https://example.test/#reset-password?token=abc123",
      expiresMinutes: 15
    });

    expect(result).toEqual({ delivered: true, provider: "resend" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer re_test_key");
    expect(body.from).toBe("CricZone <password-reset@example.test>");
    expect(body.to).toEqual(["player@example.test"]);
    expect(body.text).toContain("expires");
  });
});
