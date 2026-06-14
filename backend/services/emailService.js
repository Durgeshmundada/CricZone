const logger = require("../utils/logger");

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresMinutes }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.PASSWORD_RESET_FROM || "CricZone <onboarding@resend.dev>"
  ).trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === "test") {
      return { delivered: false, skipped: true };
    }
    throw new Error("RESEND_API_KEY is not configured");
  }

  const safeName = escapeHtml(name || "there");
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = "Reset your CricZone password";
  const text = [
    `Hi ${name || "there"},`,
    "",
    "We received a request to reset your CricZone password.",
    `This link expires in ${expiresMinutes} minutes:`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px">
      <h1 style="font-size:24px">Reset your CricZone password</h1>
      <p>Hi ${safeName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${safeResetUrl}" style="display:inline-block;padding:12px 18px;background:#0aa77f;color:#fff;text-decoration:none;border-radius:8px">
          Reset password
        </a>
      </p>
      <p>This link expires in ${expiresMinutes} minutes and can be used only once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseBody = await response.text();
      logger.error(
        { status: response.status, responseBody: responseBody.slice(0, 500) },
        "Password reset email provider rejected the request"
      );
      throw new Error("Password reset email could not be sent");
    }

    return { delivered: true, provider: "resend" };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  sendPasswordResetEmail
};
