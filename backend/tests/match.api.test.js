<<<<<<< HEAD
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

jest.setTimeout(180000);

let mongoServer;
let api;
let apiApp;
let startServer;
let shutdown;
let User;
let Match;
let Booking;
let Turf;
let Team;
let Tournament;

const randomEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.local`;

const signup = async (name, email) => {
  const response = await api.post("/api/users/signup").send({
    name,
    email,
    phone: "9999999999",
    password: "Password123"
=======
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");

const dotenvPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: dotenvPath });

process.env.PORT = process.env.TEST_PORT || "5012";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const { app, server } = require("../server");
const Match = require("../models/Match");
const User = require("../models/User");

const api = request(app);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPhone = () => {
  const suffix = String(Math.floor(Math.random() * 900000000) + 100000000);
  return `9${suffix}`.slice(0, 10);
};

const randomEmail = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}@api-test.local`;

const signupUser = async (name, email) => {
  const response = await api.post("/api/users/signup").send({
    name,
    email,
    phone: buildPhone(),
    password: "Pass1234"
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
  });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.token).toBeTruthy();
<<<<<<< HEAD
  expect(response.body.user.email).toBe(email);
  return response.body;
};

const buildLegalBall = ({ strikerName, strikerId, nonStrikerName, nonStrikerId, bowlerName, bowlerId, runs }) => ({
  runs,
  isExtra: false,
  extraType: null,
  isWicket: false,
  strikerName,
  strikerId,
  nonStrikerName,
  nonStrikerId,
  bowlerName,
  bowlerId,
  wicketPlayerName: null,
  wicketPlayerId: null,
  wicketKind: null
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = "test-secret";
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.PORT = "0";

  ({ app: apiApp, startServer, shutdown } = require("../server"));
  User = require("../models/User");
  Match = require("../models/Match");
  Booking = require("../models/Booking");
  Turf = require("../models/Turf");
  Team = require("../models/Team");
  Tournament = require("../models/Tournament");

  await startServer();
  api = request(apiApp);
});

afterAll(async () => {
  await shutdown();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Match.deleteMany({}),
    Booking.deleteMany({}),
    Turf.deleteMany({}),
    Team.deleteMany({}),
    Tournament.deleteMany({})
  ]);
});

test("exposes health and supports auth + player search", async () => {
  const health = await api.get("/api/health");
  expect(health.status).toBe(200);
  expect(health.body.success).toBe(true);

  const playerEmail = randomEmail("player");
  const signupResponse = await signup("Test Player", playerEmail);

  const loginResponse = await api.post("/api/users/login").send({
    email: playerEmail,
    password: "Password123"
  });
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.success).toBe(true);
  expect(loginResponse.body.user.name).toBe("Test Player");

  const profileResponse = await api
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${signupResponse.token}`);
  expect(profileResponse.status).toBe(200);
  expect(profileResponse.body.user.email).toBe(playerEmail);

  const searchResponse = await api.get("/api/users/search-players?search=Test");
  expect(searchResponse.status).toBe(200);
  expect(searchResponse.body.data).toHaveLength(1);
  expect(searchResponse.body.data[0].email).toBe(playerEmail);
});

test("creates turfs and blocks overlapping bookings", async () => {
  const ownerEmail = randomEmail("owner");
  const playerEmail = randomEmail("booker");
  const owner = await signup("Turf Owner", ownerEmail);
  const player = await signup("Booking Player", playerEmail);

  await User.findByIdAndUpdate(owner.user._id, { role: "turf_owner" });

  const turfResponse = await api
    .post("/api/turfs")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      turfName: "Central Cricket Turf",
      location: {
        address: "Main Road",
        city: "Mumbai",
        state: "MH"
      },
      pricePerHour: 1200,
      sportTypes: ["cricket"],
      surfaceType: "Mat"
    });

  expect(turfResponse.status).toBe(201);
  expect(turfResponse.body.success).toBe(true);

  const listResponse = await api.get("/api/turfs/all");
  expect(listResponse.status).toBe(200);
  expect(listResponse.body.data).toHaveLength(1);

  const turfId = turfResponse.body.data._id;
  const bookingResponse = await api
    .post("/api/bookings")
    .set("Authorization", `Bearer ${player.token}`)
    .send({
      turfId,
      date: "2026-04-01",
      startTime: "18:00",
      endTime: "19:30"
    });

  expect(bookingResponse.status).toBe(201);
  expect(bookingResponse.body.success).toBe(true);
  expect(bookingResponse.body.booking.totalPrice).toBe(1800);

  const duplicateResponse = await api
    .post("/api/bookings")
    .set("Authorization", `Bearer ${player.token}`)
    .send({
      turfId,
      date: "2026-04-01",
      startTime: "19:00",
      endTime: "20:00"
    });

  expect(duplicateResponse.status).toBe(409);

  const myBookings = await api
    .get("/api/bookings/mybookings")
    .set("Authorization", `Bearer ${player.token}`);

  expect(myBookings.status).toBe(200);
  expect(myBookings.body.bookings).toHaveLength(1);
});

test("supports match lifecycle, reusable teams, tournament registration, and stat updates", async () => {
  const ownerEmail = randomEmail("host");
  const opponentEmail = randomEmail("opponent");
  const owner = await signup("Host Player", ownerEmail);
  const opponent = await signup("Opponent Player", opponentEmail);

  const createMatchResponse = await api
    .post("/api/matches")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      matchName: `Weekend Match ${Date.now()}`,
      matchType: "Custom",
      customOvers: 1,
      teamAName: "Alpha XI",
      teamAPlayers: [{ name: owner.user.name, email: owner.user.email }],
      teamBName: "Beta XI",
      teamBPlayers: [{ name: opponent.user.name, email: opponent.user.email }],
      venue: "Test Ground",
      matchDate: "2026-04-02"
    });

  expect(createMatchResponse.status).toBe(201);
  const match = createMatchResponse.body.data;
  expect(match.teamA.playerLinks[0].userId).toBeTruthy();
  expect(match.teamB.playerLinks[0].userId).toBeTruthy();

  const teamsResponse = await api
    .get("/api/teams")
    .set("Authorization", `Bearer ${owner.token}`);
  expect(teamsResponse.status).toBe(200);
  expect(teamsResponse.body.data).toHaveLength(2);

  const tossResponse = await api
    .put(`/api/matches/${match._id}/toss`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      tossWinnerTeam: "teamA",
      decision: "bat"
    });

  expect(tossResponse.status).toBe(200);
  expect(tossResponse.body.data.status).toBe("live");
  expect(tossResponse.body.data.innings.first.battingTeam).toBe("teamA");

  const ownerPlayerId = match.teamA.playerLinks[0].userId;
  const opponentPlayerId = match.teamB.playerLinks[0].userId;

  const firstInningsBalls = Array.from({ length: 6 }, () =>
    buildLegalBall({
      strikerName: owner.user.name,
      strikerId: ownerPlayerId,
      nonStrikerName: "Guest Alpha",
      nonStrikerId: null,
      bowlerName: opponent.user.name,
      bowlerId: opponentPlayerId,
      runs: 1
    })
  );

  const firstScoreResponse = await api
    .put(`/api/matches/${match._id}/score`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      runs: 6,
      wickets: 0,
      overs: "1.0",
      batsmanName: owner.user.name,
      batsmanId: ownerPlayerId,
      nonStrikerName: "Guest Alpha",
      nonStrikerId: null,
      bowlerName: opponent.user.name,
      bowlerId: opponentPlayerId,
      ballEvents: firstInningsBalls
    });

  expect(firstScoreResponse.status).toBe(200);
  expect(firstScoreResponse.body.inningsComplete).toBe(true);
  expect(firstScoreResponse.body.data.currentInning).toBe(2);

  const secondInningsBalls = [
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 2
    }),
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 1
    }),
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 1
    }),
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 1
    }),
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 1
    }),
    buildLegalBall({
      strikerName: opponent.user.name,
      strikerId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      runs: 1
    })
  ];

  const secondScoreResponse = await api
    .put(`/api/matches/${match._id}/score`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      runs: 7,
      wickets: 0,
      overs: "1.0",
      batsmanName: opponent.user.name,
      batsmanId: opponentPlayerId,
      nonStrikerName: "Guest Beta",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      ballEvents: secondInningsBalls
    });

  expect(secondScoreResponse.status).toBe(200);
  expect(secondScoreResponse.body.matchComplete).toBe(true);
  expect(secondScoreResponse.body.data.status).toBe("completed");
  expect(secondScoreResponse.body.data.result.winnerTeam).toBe("teamB");

  const myMatchesResponse = await api
    .get("/api/matches/user/my-matches")
    .set("Authorization", `Bearer ${owner.token}`);
  expect(myMatchesResponse.status).toBe(200);
  expect(myMatchesResponse.body.data).toHaveLength(1);

  const tournamentResponse = await api
    .post("/api/tournaments")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      name: "Summer Cup",
      description: "League tournament",
      startDate: "2026-04-10",
      endDate: "2026-04-20",
      venue: "Stadium",
      format: "T20",
      maxTeams: 8,
      minPlayers: 2,
      maxPlayers: 11
    });

  expect(tournamentResponse.status).toBe(201);

  const savedTeam = teamsResponse.body.data[0];
  const registerResponse = await api
    .post(`/api/tournaments/${tournamentResponse.body.data._id}/register`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      teamId: savedTeam._id,
      teamName: savedTeam.name,
      captain: savedTeam.members[0].name,
      players: [
        ...savedTeam.members.map((member) => ({
          name: member.name,
          ...(member.player?._id ? { playerId: member.player._id } : {})
        })),
        { name: "Tournament Guest" }
      ]
    });

  expect(registerResponse.status).toBe(200);
  expect(registerResponse.body.data.registeredTeams).toHaveLength(1);

  const unregisterResponse = await api
    .post(`/api/tournaments/${tournamentResponse.body.data._id}/unregister`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      teamId: savedTeam._id,
      teamName: savedTeam.name
    });

  expect(unregisterResponse.status).toBe(200);
  expect(unregisterResponse.body.data.registeredTeams).toHaveLength(0);

  const ownerProfile = await api
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${owner.token}`);
  const opponentProfile = await api
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${opponent.token}`);

  expect(ownerProfile.body.user.stats.matchesPlayed).toBe(1);
  expect(ownerProfile.body.user.stats.losses).toBe(1);
  expect(ownerProfile.body.user.stats.batting.runs).toBe(6);
  expect(ownerProfile.body.user.stats.bowling.runs).toBe(7);

  expect(opponentProfile.body.user.stats.matchesPlayed).toBe(1);
  expect(opponentProfile.body.user.stats.wins).toBe(1);
  expect(opponentProfile.body.user.stats.batting.runs).toBe(7);
});

test("supports team invitations, player suggestions, and balanced randomization helpers", async () => {
  const ownerEmail = randomEmail("team-owner");
  const inviteeEmail = randomEmail("invitee");
  const owner = await signup("Captain Owner", ownerEmail);
  const invitee = await signup("Invited Player", inviteeEmail);

  const createTeamResponse = await api
    .post("/api/teams")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      name: "Night Riders",
      members: [
        { name: owner.user.name, email: owner.user.email, userId: owner.user._id, inviteStatus: "accepted" },
        { name: invitee.user.name, email: invitee.user.email }
      ]
    });

  expect(createTeamResponse.status).toBe(201);
  expect(createTeamResponse.body.data.members).toHaveLength(2);
  expect(
    createTeamResponse.body.data.members.find((member) => member.email === invitee.user.email).inviteStatus
  ).toBe("pending");

  const suggestionsResponse = await api
    .get("/api/teams/suggestions?q=Invited")
    .set("Authorization", `Bearer ${owner.token}`);

  expect(suggestionsResponse.status).toBe(200);
  expect(
    suggestionsResponse.body.data.some((player) => player.email === invitee.user.email)
  ).toBe(true);

  const invitationsResponse = await api
    .get("/api/teams/invitations/my")
    .set("Authorization", `Bearer ${invitee.token}`);

  expect(invitationsResponse.status).toBe(200);
  expect(invitationsResponse.body.data).toHaveLength(1);

  const invitation = invitationsResponse.body.data[0];
  const respondResponse = await api
    .put(`/api/teams/${invitation.teamId}/invitations/${invitation.memberId}/respond`)
    .set("Authorization", `Bearer ${invitee.token}`)
    .send({ action: "accept" });

  expect(respondResponse.status).toBe(200);
  expect(
    respondResponse.body.data.members.find((member) => member.email === invitee.user.email).inviteStatus
  ).toBe("accepted");

  const randomizeResponse = await api
    .post("/api/teams/randomize")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      teamAName: "Red",
      teamBName: "Blue",
      players: [
        { name: owner.user.name, email: owner.user.email, userId: owner.user._id },
        { name: invitee.user.name, email: invitee.user.email, userId: invitee.user._id },
        { name: "Guest One" },
        { name: "Guest Two" }
      ]
    });

  expect(randomizeResponse.status).toBe(200);
  expect(randomizeResponse.body.distribution.teamA.players.length).toBe(2);
  expect(randomizeResponse.body.distribution.teamB.players.length).toBe(2);
});

test("exports booking csv reports and limits turf owner payment access to owned turfs", async () => {
  const ownerEmail = randomEmail("billing-owner");
  const otherOwnerEmail = randomEmail("other-owner");
  const playerEmail = randomEmail("billing-player");
  const owner = await signup("Billing Owner", ownerEmail);
  const otherOwner = await signup("Other Owner", otherOwnerEmail);
  const player = await signup("Billing Player", playerEmail);

  await Promise.all([
    User.findByIdAndUpdate(owner.user._id, { role: "turf_owner" }),
    User.findByIdAndUpdate(otherOwner.user._id, { role: "turf_owner" })
  ]);

  const [ownerTurfResponse, otherTurfResponse] = await Promise.all([
    api
      .post("/api/turfs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        turfName: "Owner Turf",
        location: { address: "Owner Lane", city: "Pune", state: "MH" },
        pricePerHour: 1000,
        sportTypes: ["cricket"],
        surfaceType: "Grass"
      }),
    api
      .post("/api/turfs")
      .set("Authorization", `Bearer ${otherOwner.token}`)
      .send({
        turfName: "Other Turf",
        location: { address: "Other Lane", city: "Pune", state: "MH" },
        pricePerHour: 900,
        sportTypes: ["cricket"],
        surfaceType: "Mat"
      })
  ]);

  const [ownerBookingResponse, otherBookingResponse] = await Promise.all([
    api
      .post("/api/bookings")
      .set("Authorization", `Bearer ${player.token}`)
      .send({
        turfId: ownerTurfResponse.body.data._id,
        date: "2026-05-01",
        startTime: "18:00",
        endTime: "19:00"
      }),
    api
      .post("/api/bookings")
      .set("Authorization", `Bearer ${player.token}`)
      .send({
        turfId: otherTurfResponse.body.data._id,
        date: "2026-05-02",
        startTime: "19:00",
        endTime: "20:00"
      })
  ]);

  const myCsvResponse = await api
    .get("/api/bookings/mybookings/report.csv")
    .set("Authorization", `Bearer ${player.token}`);

  expect(myCsvResponse.status).toBe(200);
  expect(myCsvResponse.headers["content-type"]).toContain("text/csv");
  expect(myCsvResponse.text).toContain("Invoice");
  expect(myCsvResponse.text).toContain("Owner Turf");

  const paymentAllowedResponse = await api
    .put(`/api/bookings/${ownerBookingResponse.body.booking._id}/payment`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ paymentStatus: "paid", paymentMethod: "upi" });

  expect(paymentAllowedResponse.status).toBe(200);

  const paymentBlockedResponse = await api
    .put(`/api/bookings/${otherBookingResponse.body.booking._id}/payment`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ paymentStatus: "paid", paymentMethod: "upi" });

  expect(paymentBlockedResponse.status).toBe(403);

  const ownerSummaryResponse = await api
    .get("/api/bookings/billing/summary")
    .set("Authorization", `Bearer ${owner.token}`);

  expect(ownerSummaryResponse.status).toBe(200);
  expect(ownerSummaryResponse.body.bookings).toHaveLength(1);
  expect(ownerSummaryResponse.body.bookings[0].turf.turfName).toBe("Owner Turf");
});

test("awards the win correctly when team A chases in the second innings", async () => {
  const ownerEmail = randomEmail("chase-owner");
  const opponentEmail = randomEmail("chase-opponent");
  const owner = await signup("Chasing Owner", ownerEmail);
  const opponent = await signup("First Innings Opponent", opponentEmail);

  const createMatchResponse = await api
    .post("/api/matches")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      matchName: `Chase Match ${Date.now()}`,
      matchType: "Custom",
      customOvers: 1,
      teamAName: "Chasers",
      teamAPlayers: [{ name: owner.user.name, email: owner.user.email }],
      teamBName: "Setters",
      teamBPlayers: [{ name: opponent.user.name, email: opponent.user.email }],
      venue: "Evening Ground",
      matchDate: "2026-04-15"
    });

  expect(createMatchResponse.status).toBe(201);
  const match = createMatchResponse.body.data;
  const ownerPlayerId = match.teamA.playerLinks[0].userId;
  const opponentPlayerId = match.teamB.playerLinks[0].userId;

  const tossResponse = await api
    .put(`/api/matches/${match._id}/toss`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      tossWinnerTeam: "teamA",
      decision: "bowl"
    });

  expect(tossResponse.status).toBe(200);
  expect(tossResponse.body.data.innings.first.battingTeam).toBe("teamB");

  const firstInningsResponse = await api
    .put(`/api/matches/${match._id}/score`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      runs: 4,
      wickets: 0,
      overs: "1.0",
      batsmanName: opponent.user.name,
      batsmanId: opponentPlayerId,
      nonStrikerName: "Guest Setter",
      nonStrikerId: null,
      bowlerName: owner.user.name,
      bowlerId: ownerPlayerId,
      ballEvents: [
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 1
        }),
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 1
        }),
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 0
        }),
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 1
        }),
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 0
        }),
        buildLegalBall({
          strikerName: opponent.user.name,
          strikerId: opponentPlayerId,
          nonStrikerName: "Guest Setter",
          nonStrikerId: null,
          bowlerName: owner.user.name,
          bowlerId: ownerPlayerId,
          runs: 1
        })
      ]
    });

  expect(firstInningsResponse.status).toBe(200);
  expect(firstInningsResponse.body.inningsComplete).toBe(true);

  const secondInningsResponse = await api
    .put(`/api/matches/${match._id}/score`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({
      runs: 5,
      wickets: 1,
      overs: "0.5",
      batsmanName: owner.user.name,
      batsmanId: ownerPlayerId,
      nonStrikerName: "Guest Chaser",
      nonStrikerId: null,
      bowlerName: opponent.user.name,
      bowlerId: opponentPlayerId,
      ballEvents: [
        buildLegalBall({
          strikerName: owner.user.name,
          strikerId: ownerPlayerId,
          nonStrikerName: "Guest Chaser",
          nonStrikerId: null,
          bowlerName: opponent.user.name,
          bowlerId: opponentPlayerId,
          runs: 1
        }),
        buildLegalBall({
          strikerName: owner.user.name,
          strikerId: ownerPlayerId,
          nonStrikerName: "Guest Chaser",
          nonStrikerId: null,
          bowlerName: opponent.user.name,
          bowlerId: opponentPlayerId,
          runs: 1
        }),
        {
          runs: 0,
          isExtra: false,
          extraType: null,
          isWicket: true,
          strikerName: owner.user.name,
          strikerId: ownerPlayerId,
          nonStrikerName: "Guest Chaser",
          nonStrikerId: null,
          bowlerName: opponent.user.name,
          bowlerId: opponentPlayerId,
          wicketPlayerName: owner.user.name,
          wicketPlayerId: ownerPlayerId,
          wicketKind: "bowled"
        },
        buildLegalBall({
          strikerName: "New Chaser",
          strikerId: null,
          nonStrikerName: "Guest Chaser",
          nonStrikerId: null,
          bowlerName: opponent.user.name,
          bowlerId: opponentPlayerId,
          runs: 1
        }),
        buildLegalBall({
          strikerName: "New Chaser",
          strikerId: null,
          nonStrikerName: "Guest Chaser",
          nonStrikerId: null,
          bowlerName: opponent.user.name,
          bowlerId: opponentPlayerId,
          runs: 2
        })
      ]
    });

  expect(secondInningsResponse.status).toBe(200);
  expect(secondInningsResponse.body.matchComplete).toBe(true);
  expect(secondInningsResponse.body.data.result.winnerTeam).toBe("teamA");
  expect(secondInningsResponse.body.data.result.message).toContain("won by 9 wickets");
=======
  return response.body;
};

describe("Match API scoring lifecycle", () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const health = await api.get("/api/health");
        if (health.status === 200 && health.body.success) {
          ready = true;
          break;
        }
      } catch (_error) {
        // Retry until boot is done.
      }
      // eslint-disable-next-line no-await-in-loop
      await delay(250);
    }

    if (!ready) {
      throw new Error("Server did not become ready for tests");
    }
  });

  afterAll(async () => {
    await Promise.all([
      Match.deleteMany({ matchName: /^API TEST:/ }),
      User.deleteMany({ email: /@api-test\.local$/i })
    ]);

    await new Promise((resolve) => {
      if (!server || !server.listening) return resolve();
      return server.close(() => resolve());
    });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  });

  test("supports toss -> score -> undo -> complete and updates user stats", async () => {
    const ownerEmail = randomEmail("owner");
    const opponentEmail = randomEmail("opponent");

    const owner = await signupUser("API Owner", ownerEmail);
    const opponent = await signupUser("API Opponent", opponentEmail);

    const ownerToken = owner.token;
    const opponentToken = opponent.token;

    const createMatchResponse = await api
      .post("/api/matches")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        matchName: `API TEST: lifecycle ${Date.now()}`,
        matchType: "T20",
        teamAName: "Alpha XI",
        teamAPlayers: [{ name: owner.user.name, email: owner.user.email }],
        teamBName: "Beta XI",
        teamBPlayers: [{ name: opponent.user.name, email: opponent.user.email }],
        venue: "Test Ground",
        matchDate: new Date().toISOString().slice(0, 10)
      });

    expect(createMatchResponse.status).toBe(201);
    expect(createMatchResponse.body.success).toBe(true);
    const matchId = createMatchResponse.body.data._id;
    const ownerPlayerId = createMatchResponse.body.data.teamA.playerLinks[0].userId;
    const opponentPlayerId = createMatchResponse.body.data.teamB.playerLinks[0].userId;

    const tossResponse = await api
      .put(`/api/matches/${matchId}/toss`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        tossWinnerTeam: "teamA",
        decision: "bat"
      });

    expect(tossResponse.status).toBe(200);
    expect(tossResponse.body.success).toBe(true);
    expect(tossResponse.body.data.status).toBe("live");
    expect(tossResponse.body.data.innings.first.battingTeam).toBe("teamA");

    const ballEvents = [
      {
        runs: 1,
        isExtra: false,
        extraType: null,
        isWicket: false,
        strikerName: owner.user.name,
        strikerId: ownerPlayerId,
        nonStrikerName: "Guest Partner",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId
      },
      {
        runs: 0,
        isExtra: false,
        extraType: null,
        isWicket: false,
        strikerName: "Guest Partner",
        strikerId: null,
        nonStrikerName: owner.user.name,
        nonStrikerId: ownerPlayerId,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId
      },
      {
        runs: 0,
        isExtra: false,
        extraType: null,
        isWicket: true,
        wicketKind: "bowled",
        strikerName: "Guest Partner",
        strikerId: null,
        nonStrikerName: owner.user.name,
        nonStrikerId: ownerPlayerId,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        wicketPlayerName: "Guest Partner",
        wicketPlayerId: null
      }
    ];

    const scoreResponse = await api
      .put(`/api/matches/${matchId}/score`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        mode: "absolute",
        runs: 1,
        wickets: 1,
        overs: "0.3",
        batsmanName: owner.user.name,
        batsmanId: ownerPlayerId,
        nonStrikerName: "New Batter",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        ballEvents
      });

    expect(scoreResponse.status).toBe(200);
    expect(scoreResponse.body.success).toBe(true);
    expect(scoreResponse.body.data.innings.first.score).toBe(1);
    expect(scoreResponse.body.data.innings.first.wickets).toBe(1);
    expect(scoreResponse.body.data.ballByBallData.filter((b) => b.inning === 1)).toHaveLength(3);

    const undoEvents = ballEvents.slice(0, 2);
    const undoResponse = await api
      .put(`/api/matches/${matchId}/score`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        mode: "absolute",
        runs: 1,
        wickets: 0,
        overs: "0.2",
        batsmanName: owner.user.name,
        batsmanId: ownerPlayerId,
        nonStrikerName: "Guest Partner",
        nonStrikerId: null,
        bowlerName: opponent.user.name,
        bowlerId: opponentPlayerId,
        ballEvents: undoEvents
      });

    expect(undoResponse.status).toBe(200);
    expect(undoResponse.body.success).toBe(true);
    expect(undoResponse.body.data.innings.first.score).toBe(1);
    expect(undoResponse.body.data.innings.first.wickets).toBe(0);
    expect(undoResponse.body.data.ballByBallData.filter((b) => b.inning === 1)).toHaveLength(2);

    const completeResponse = await api
      .put(`/api/matches/${matchId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.data.status).toBe("completed");

    const completeAgainResponse = await api
      .put(`/api/matches/${matchId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(completeAgainResponse.status).toBe(400);

    const ownerProfileResponse = await api
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${ownerToken}`);
    const opponentProfileResponse = await api
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${opponentToken}`);

    expect(ownerProfileResponse.status).toBe(200);
    expect(opponentProfileResponse.status).toBe(200);

    const ownerStats = ownerProfileResponse.body.user.stats;
    const opponentStats = opponentProfileResponse.body.user.stats;

    expect(ownerStats.matchesPlayed).toBe(1);
    expect(ownerStats.wins).toBe(1);
    expect(ownerStats.batting.runs).toBe(1);
    expect(ownerStats.batting.innings).toBe(1);
    expect(ownerStats.batting.ballsFaced).toBe(1);

    expect(opponentStats.matchesPlayed).toBe(1);
    expect(opponentStats.losses).toBe(1);
    expect(opponentStats.bowling.runs).toBe(1);
    expect(opponentStats.bowling.wickets).toBe(0);
    expect(opponentStats.bowling.balls).toBe(2);
  });
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
});
