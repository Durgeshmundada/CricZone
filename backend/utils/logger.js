const pino = require("pino");

const environment = process.env.NODE_ENV || "development";
const isDevelopment = environment === "development";
const isTest = environment === "test";

const options = {
  level: process.env.LOG_LEVEL || (isTest ? "silent" : isDevelopment ? "debug" : "info"),
  base: {
    service: "criczone-api",
    environment
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "confirmPassword",
      "refreshToken",
      "resetToken",
      "passwordResetToken",
      "token",
      "authorization",
      "cookie"
    ],
    censor: "[REDACTED]"
  }
};

const transport = isDevelopment
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname"
      }
    })
  : undefined;

const logger = pino(options, transport);

const getRequestLogger = (requestOrResponse) => (
  requestOrResponse?.log || requestOrResponse?.req?.log || logger
);

module.exports = logger;
module.exports.getRequestLogger = getRequestLogger;
