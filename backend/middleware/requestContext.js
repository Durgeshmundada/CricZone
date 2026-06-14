const { randomUUID } = require("crypto");
const logger = require("../utils/logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const requestContext = (req, res, next) => {
  const suppliedId = String(req.get("x-request-id") || "").trim();
  req.id = REQUEST_ID_PATTERN.test(suppliedId) ? suppliedId : randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader("X-Request-Id", req.id);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body === "object" && !Array.isArray(body)) {
      return originalJson({ ...body, requestId: body.requestId || req.id });
    }
    return originalJson(body);
  };

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    req.log.info({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      kind: req.path.startsWith("/api/") ? "api" : "web"
    }, "request completed");
  });

  next();
};

module.exports = requestContext;
