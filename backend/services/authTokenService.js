const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const REFRESH_COOKIE = "criczone_refresh";
const MAX_REFRESH_TOKENS = 5;

const getRefreshLifetimeMs = () => {
  const days = Math.min(Math.max(Number(process.env.JWT_REFRESH_EXPIRE_DAYS) || 14, 1), 30);
  return days * 24 * 60 * 60 * 1000;
};

const hashRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const generateAccessToken = (userId, tokenVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id: userId, tokenVersion: Number(tokenVersion) || 0 },
    process.env.JWT_SECRET,
    {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || process.env.JWT_EXPIRE || "30m"
    }
  );
};

const getRefreshTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE];
  const bodyToken = req.body?.refreshToken;
  return String(cookieToken || bodyToken || "").trim();
};

const setRefreshCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/api/users",
    maxAge: getRefreshLifetimeMs()
  });
};

const clearRefreshCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/api/users"
  });
};

const issueSession = async (user, req, res) => {
  const now = Date.now();
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(now + getRefreshLifetimeMs());
  const activeTokens = (user.refreshTokens || [])
    .filter((entry) => entry.expiresAt && new Date(entry.expiresAt).getTime() > now)
    .slice(-(MAX_REFRESH_TOKENS - 1));

  activeTokens.push({
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
    createdAt: new Date(now),
    userAgent: String(req.get("user-agent") || "").slice(0, 300)
  });

  user.refreshTokens = activeTokens;
  await user.save({ validateBeforeSave: false });
  setRefreshCookie(res, refreshToken);

  return {
    token: generateAccessToken(user._id, user.tokenVersion),
    expiresIn: process.env.JWT_ACCESS_EXPIRE || process.env.JWT_EXPIRE || "30m"
  };
};

module.exports = {
  clearRefreshCookie,
  generateAccessToken,
  getRefreshTokenFromRequest,
  hashRefreshToken,
  issueSession
};
