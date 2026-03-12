const TIME_24_HOUR = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TIME_12_HOUR = /^([1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const parseTimeInput = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;

  const as24Hour = normalized.match(TIME_24_HOUR);
  if (as24Hour) {
    return (Number(as24Hour[1]) * 60) + Number(as24Hour[2]);
  }

  const as12Hour = normalized.match(TIME_12_HOUR);
  if (!as12Hour) return null;

  let hours = Number(as12Hour[1]) % 12;
  const minutes = Number(as12Hour[2]);
  const meridiem = as12Hour[3];

  if (meridiem === "PM") {
    hours += 12;
  }

  return (hours * 60) + minutes;
};

const formatMinutes = (minutes) => {
  const safeMinutes = Math.max(0, Number.parseInt(minutes, 10) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const isIsoDate = (value) => {
  const normalized = String(value || "").trim();
  if (!ISO_DATE.test(normalized)) return false;

  const [year, month, day] = normalized.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const parseOversInput = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return 0;

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [oversPart, ballsPart = "0"] = normalized.split(".");
  const overs = Number.parseInt(oversPart, 10);
  const balls = Number.parseInt(ballsPart, 10);

  if (!Number.isFinite(overs) || overs < 0) return null;
  if (!Number.isFinite(balls) || balls < 0 || balls > 5) return null;

  return (overs * 6) + balls;
};

const formatOversFromBalls = (balls) => {
  const safeBalls = Math.max(0, Number.parseInt(balls, 10) || 0);
  return `${Math.floor(safeBalls / 6)}.${safeBalls % 6}`;
};

module.exports = {
  formatMinutes,
  formatOversFromBalls,
  isIsoDate,
  parseOversInput,
  parseTimeInput
};
