const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId");
const nonEmptyString = (max = 200) => z.string().trim().min(1).max(max);
const optionalString = (max = 500) => z.string().trim().max(max).optional();
const flexibleNumber = z.union([z.number(), z.string().trim().min(1)]);
const dateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date");
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must use HH:mm format");
const request = (shape) => z.object(shape).passthrough();
const paramsWithId = (key = "id") => z.object({ [key]: objectId }).passthrough();
const optionalObjectId = objectId.nullish();

const playerInput = z.union([
  nonEmptyString(100),
  z.object({
    name: optionalString(100),
    email: z.string().email().optional(),
    playerId: optionalObjectId,
    userId: optionalObjectId,
    id: optionalObjectId,
    _id: optionalObjectId
  }).passthrough()
]);

const teamMember = z.object({
  name: optionalString(100),
  email: z.string().email().optional().or(z.literal("")),
  playerId: optionalObjectId,
  player: optionalObjectId,
  userId: optionalObjectId
}).passthrough();

const location = z.object({
  address: nonEmptyString(300),
  city: nonEmptyString(100),
  state: nonEmptyString(100),
  pincode: nonEmptyString(20),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
}).passthrough();

const turfBody = z.object({
  turfName: nonEmptyString(100),
  location,
  sportTypes: z.array(z.enum(["cricket", "football", "badminton", "tennis", "volleyball"])).min(1),
  turfSize: z.object({
    length: z.coerce.number().positive(),
    width: z.coerce.number().positive(),
    unit: optionalString(20)
  }).passthrough(),
  surfaceType: z.enum(["artificial grass", "natural grass", "synthetic"]),
  amenities: z.union([
    z.record(z.string(), z.boolean()),
    z.array(z.string().max(100))
  ]).optional(),
  images: z.array(z.string().max(2048)).optional(),
  basePricingPerSlot: z.coerce.number().nonnegative()
}).passthrough();

const schemas = {
  registerUser: request({
    body: z.object({
      name: nonEmptyString(80).min(2),
      email: z.string().trim().toLowerCase().email().max(254),
      phone: nonEmptyString(20),
      password: z.string().min(6).max(128),
      role: z.literal("user").optional()
    }).strict()
  }),
  loginUser: request({
    body: z.object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(1).max(128)
    }).strict()
  }),
  refreshSession: request({
    body: z.object({ refreshToken: z.string().min(32).max(256).optional() }).strict()
  }),
  logoutSession: request({
    body: z.object({ refreshToken: z.string().min(32).max(256).optional() }).strict()
  }),
  updateProfile: request({
    body: z.object({
      name: nonEmptyString(80).min(2).optional(),
      phone: z.string().trim().max(20).optional(),
      profile: z.record(z.string(), z.unknown()).optional(),
      media: z.record(z.string(), z.unknown()).optional(),
      notifications: z.record(z.string(), z.boolean()).optional()
    }).strict().refine((body) => Object.keys(body).length > 0, "Provide at least one profile field")
  }),
  updateUserRole: request({
    body: z.object({
      userId: objectId,
      role: z.enum(["admin", "user", "scorer", "organizer", "turf_owner"])
    }).strict()
  }),
  userIdParam: request({ params: paramsWithId("userId") }),

  createMatch: request({
    body: z.object({
      matchName: nonEmptyString(120),
      matchType: z.enum(["T20", "ODI", "Test", "Custom"]).optional(),
      customOvers: z.coerce.number().int().min(1).max(50).optional(),
      teamAName: optionalString(80),
      teamAId: optionalObjectId,
      teamAPlayers: z.array(playerInput).max(30).optional(),
      teamBName: optionalString(80),
      teamBId: optionalObjectId,
      teamBPlayers: z.array(playerInput).max(30).optional(),
      venue: nonEmptyString(200),
      matchDate: dateString,
      tournamentId: optionalObjectId
    }).passthrough()
      .refine((body) => body.teamAName || body.teamAId, "Team A name or ID is required")
      .refine((body) => body.teamBName || body.teamBId, "Team B name or ID is required")
      .refine((body) => body.matchType !== "Custom" || body.customOvers, "customOvers is required for Custom matches")
  }),
  setMatchToss: request({
    params: paramsWithId(),
    body: z.object({
      tossWinnerTeam: optionalString(100),
      tossWinner: optionalString(100),
      decision: z.enum(["bat", "bowl"]).optional(),
      tossDecision: z.enum(["bat", "bowl"]).optional()
    }).passthrough()
      .refine((body) => body.tossWinnerTeam || body.tossWinner, "Toss winner is required")
      .refine((body) => body.decision || body.tossDecision, "Toss decision is required")
  }),
  updateMatchScore: request({
    params: paramsWithId(),
    body: z.object({
      runs: flexibleNumber.optional(),
      wickets: flexibleNumber.optional(),
      isWicket: z.boolean().optional(),
      extras: z.unknown().optional(),
      batsmanName: optionalString(100),
      batsmanId: optionalObjectId,
      nonStrikerName: optionalString(100),
      nonStrikerId: optionalObjectId,
      bowlerName: optionalString(100),
      bowlerId: optionalObjectId,
      overs: flexibleNumber.optional(),
      mode: z.enum(["absolute", "ball"]).optional(),
      status: z.literal("live").optional()
    }).passthrough().refine((body) => Object.keys(body).length > 0, "Score update cannot be empty")
  }),
  matchIdParam: request({ params: paramsWithId() }),

  createTeam: request({
    body: z.object({
      name: nonEmptyString(80),
      members: z.array(teamMember).max(50).optional(),
      tournamentId: optionalObjectId
    }).passthrough()
  }),
  randomizeTeams: request({
    body: z.object({
      players: z.array(playerInput).min(2).max(50),
      historyMatches: z.coerce.number().int().min(2).max(3).optional()
    }).passthrough()
  }),
  updateTeam: request({
    params: paramsWithId(),
    body: z.object({
      name: nonEmptyString(80).optional(),
      members: z.array(teamMember).max(50).optional()
    }).passthrough().refine((body) => body.name !== undefined || body.members !== undefined, "Provide a name or members")
  }),
  teamInvitation: request({
    params: z.object({ id: objectId, memberId: objectId }).passthrough(),
    body: z.object({ action: z.enum(["accept", "reject"]) }).strict()
  }),
  teamIdParam: request({ params: paramsWithId() }),

  createTournament: request({
    body: z.object({
      name: nonEmptyString(150),
      description: optionalString(2000),
      shortName: optionalString(10),
      startDate: dateString,
      endDate: dateString,
      registrationDeadline: dateString.optional(),
      venue: nonEmptyString(200),
      venues: z.array(z.record(z.string(), z.unknown())).optional(),
      format: z.enum(["T20", "ODI", "Test", "Custom"]).optional(),
      customOvers: z.coerce.number().int().min(1).max(50).optional(),
      tournamentType: z.enum(["league", "knockout", "league_knockout", "group_stage"]).optional(),
      maxTeams: z.coerce.number().int().min(2).max(128).optional(),
      minPlayers: z.coerce.number().int().min(2).max(30).optional(),
      maxPlayers: z.coerce.number().int().min(1).max(50).optional(),
      prizePool: z.union([z.string().max(200), z.record(z.string(), z.unknown())]).optional(),
      pointsSystem: z.record(z.string(), z.unknown()).optional(),
      rules: z.unknown().optional()
    }).passthrough()
      .refine((body) => new Date(body.startDate) < new Date(body.endDate), "End date must be after start date")
      .refine((body) => body.format !== "Custom" || body.customOvers, "customOvers is required for Custom tournaments")
  }),
  registerTournamentTeam: request({
    params: paramsWithId(),
    body: z.object({
      teamId: optionalObjectId,
      teamName: optionalString(80),
      captain: optionalString(100),
      viceCaptain: optionalString(100),
      wicketkeeper: optionalString(100),
      coach: optionalString(100),
      players: z.array(playerInput).max(50).optional(),
      group: z.enum(["A", "B", "C", "D"]).optional()
    }).passthrough().refine((body) => body.teamId || body.teamName, "teamId or teamName is required")
  }),
  unregisterTournamentTeam: request({
    params: paramsWithId(),
    body: z.object({ teamId: optionalObjectId, teamName: optionalString(80) })
      .strict().refine((body) => body.teamId || body.teamName, "teamId or teamName is required")
  }),
  tournamentIdParam: request({ params: paramsWithId() }),
  updateStandings: request({
    body: z.object({
      tournamentId: objectId,
      teamA: nonEmptyString(80),
      teamB: nonEmptyString(80),
      winner: optionalString(80),
      teamAScore: z.coerce.number().nonnegative(),
      teamBScore: z.coerce.number().nonnegative(),
      teamAOvers: flexibleNumber,
      teamBOvers: flexibleNumber,
      resultType: z.enum(["tie", "no_result", "none"]).optional()
    }).passthrough()
  }),
  updateTournamentStatus: request({
    params: paramsWithId(),
    body: z.object({
      status: z.enum(["upcoming", "registration_open", "registration_closed", "ongoing", "playoffs", "completed", "cancelled"])
    }).strict()
  }),

  createBooking: request({
    body: z.object({
      turfId: objectId,
      date: dateString,
      startTime: timeString,
      endTime: timeString,
      totalAmount: z.coerce.number().nonnegative().optional(),
      slotHours: z.coerce.number().positive().max(24).optional(),
      paymentMethod: z.enum(["cash", "upi", "card", "netbanking", "wallet", "other"]).optional(),
      paymentReference: optionalString(200)
    }).passthrough()
  }),
  bookingIdParam: request({ params: paramsWithId() }),
  updateBookingPayment: request({
    params: paramsWithId(),
    body: z.object({
      paymentStatus: z.enum(["pending", "paid", "refunded", "failed"]).optional(),
      paymentMethod: z.enum(["cash", "upi", "card", "netbanking", "wallet", "other"]).optional(),
      paymentReference: optionalString(200)
    }).strict().refine((body) => Object.keys(body).length > 0, "Provide a payment update")
  }),

  createPost: request({
    body: z.object({
      content: nonEmptyString(1000),
      matchId: optionalObjectId,
      tournamentId: optionalObjectId,
      type: z.enum(["text", "match_update", "achievement", "photo", "video"]).optional(),
      media: z.unknown().optional()
    }).passthrough()
  }),
  postIdParam: request({ params: paramsWithId("postId") }),
  addComment: request({
    params: paramsWithId("postId"),
    body: z.object({ text: nonEmptyString(500) }).strict()
  }),

  createTurf: request({ body: turfBody }),
  nearbyTurfs: request({
    body: z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      maxDistance: z.coerce.number().positive().max(100000).optional()
    }).strict()
  }),
  updateTurf: request({
    params: paramsWithId(),
    body: turfBody.partial().passthrough().refine((body) => Object.keys(body).length > 0, "Provide at least one turf field")
  }),
  turfIdParam: request({ params: paramsWithId() })
};

module.exports = schemas;
