const jwt = require("jsonwebtoken");
const request = require("supertest");
const { app } = require("../../server");
const User = require("../../models/User");
const Turf = require("../../models/Turf");

let sequence = 0;

const api = request(app);

const nextValue = (prefix) => `${prefix}-${Date.now()}-${sequence++}`;

const createUser = async (overrides = {}) => {
  const suffix = nextValue("user");
  return User.create({
    name: overrides.name || `Test User ${sequence}`,
    email: overrides.email || `${suffix}@example.test`,
    phone: overrides.phone || `98${String(10000000 + sequence).slice(-8)}`,
    password: overrides.password || "Pass1234",
    role: overrides.role || "user",
    profile: overrides.profile,
    stats: overrides.stats,
    rankings: overrides.rankings
  });
};

const tokenFor = (user, expiresIn = "30m") => jwt.sign(
  { id: user._id.toString(), tokenVersion: Number(user.tokenVersion) || 0 },
  process.env.JWT_SECRET,
  { expiresIn }
);

const createAuthUser = async (overrides = {}) => {
  const user = await createUser(overrides);
  return { user, token: tokenFor(user) };
};

const auth = (testRequest, token) => testRequest.set("Authorization", `Bearer ${token}`);

const validTurfPayload = (overrides = {}) => ({
  turfName: overrides.turfName || `Test Turf ${sequence}`,
  location: {
    address: "1 Test Road",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    latitude: 18.5204,
    longitude: 73.8567,
    ...(overrides.location || {})
  },
  sportTypes: ["cricket"],
  turfSize: { length: 30, width: 20, unit: "meters" },
  surfaceType: "artificial grass",
  amenities: { parking: true, lighting: true },
  images: [],
  basePricingPerSlot: 1200,
  ...overrides
});

const createTurf = async (ownerId, overrides = {}) => Turf.create({
  turfName: overrides.turfName || nextValue("Test Turf"),
  ownerId,
  location: {
    address: "1 Test Road",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    coordinates: { type: "Point", coordinates: [73.8567, 18.5204] }
  },
  sportTypes: ["cricket"],
  turfSize: { length: 30, width: 20, unit: "meters" },
  surfaceType: "artificial grass",
  basePricingPerSlot: 1200,
  ...overrides
});

module.exports = {
  api,
  auth,
  createAuthUser,
  createTurf,
  createUser,
  nextValue,
  tokenFor,
  validTurfPayload
};
