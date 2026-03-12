const mongoose = require("mongoose");
const Team = require("../models/Team");
const User = require("../models/User");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");
const { presentTeam } = require("../utils/presenters");

const VALID_INVITE_STATUSES = new Set(["accepted", "pending", "rejected"]);

const populateTeamQuery = (query) =>
  query
    .populate("owner", "name email")
    .populate("members.player", "name email profile stats");

const normalizeInviteStatus = (value, fallback = "accepted") => {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_INVITE_STATUSES.has(normalized) ? normalized : fallback;
};

const getUserStatsRating = (user) => {
  const battingRuns = Number(user?.stats?.batting?.runs || 0);
  const bowlingWickets = Number(user?.stats?.bowling?.wickets || 0);
  const matchesPlayed = Number(user?.stats?.matchesPlayed || 0);
  const wins = Number(user?.stats?.wins || 0);

  return battingRuns + (bowlingWickets * 25) + (wins * 10) + (matchesPlayed * 2);
};

const buildMemberKey = ({ player, email, name }) => {
  const playerKey = String(player || "").trim();
  if (playerKey) return `player:${playerKey}`;

  const emailKey = String(email || "").trim().toLowerCase();
  if (emailKey) return `email:${emailKey}`;

  return `name:${String(name || "").trim().toLowerCase()}`;
};

const collectUserLookups = async (entries = []) => {
  const userIds = [];
  const emails = [];

  for (const entry of entries) {
    const rawUserId = entry?.player?._id || entry?.player || entry?.playerId || entry?.userId || null;
    const normalizedEmail = String(entry?.email || "").trim().toLowerCase();

    if (rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId))) {
      userIds.push(String(rawUserId));
    }
    if (normalizedEmail) {
      emails.push(normalizedEmail);
    }
  }

  const queries = [];
  if (userIds.length > 0) {
    queries.push(User.find({ _id: { $in: userIds } }).select("_id name email profile stats"));
  }
  if (emails.length > 0) {
    queries.push(User.find({ email: { $in: emails } }).select("_id name email profile stats"));
  }

  const results = await Promise.all(queries);
  const users = results.flat();

  return {
    byId: new Map(users.map((user) => [String(user._id), user])),
    byEmail: new Map(
      users
        .filter((user) => user.email)
        .map((user) => [String(user.email).trim().toLowerCase(), user])
    )
  };
};

const buildMembers = async (members = [], ownerId) => {
  const lookups = await collectUserLookups(members);
  const normalizedMembers = [];
  const seen = new Set();
  const now = new Date();

  for (const member of members) {
    let player = member?.player?._id || member?.player || member?.playerId || member?.userId || null;
    if (player && !mongoose.Types.ObjectId.isValid(String(player))) {
      player = null;
    }

    const email = String(member?.email || "").trim().toLowerCase();
    const linkedUser = (player && lookups.byId.get(String(player))) || (email && lookups.byEmail.get(email)) || null;
    if (!player && linkedUser) {
      player = linkedUser._id;
    }

    const name = String(member?.name || linkedUser?.name || "").trim();
    const resolvedEmail = email || String(linkedUser?.email || "").trim().toLowerCase();
    if (!name && !resolvedEmail) continue;

    const inviteStatus = player && String(player) !== String(ownerId)
      ? normalizeInviteStatus(member?.inviteStatus, "pending")
      : normalizeInviteStatus(member?.inviteStatus, "accepted");

    const key = buildMemberKey({
      player,
      email: resolvedEmail,
      name
    });
    if (seen.has(key)) continue;
    seen.add(key);

    normalizedMembers.push({
      name: name || resolvedEmail.split("@")[0] || "Player",
      email: resolvedEmail,
      player: player || null,
      inviteStatus,
      invitedAt: inviteStatus === "pending" ? (member?.invitedAt || now) : null,
      respondedAt: inviteStatus === "pending" ? null : (member?.respondedAt || null)
    });
  }

  return normalizedMembers;
};

const normalizePlayersForDistribution = async (players = []) => {
  const lookups = await collectUserLookups(players);
  const normalizedPlayers = [];
  const seen = new Set();

  for (const playerEntry of players) {
    let userId = playerEntry?.userId || playerEntry?.playerId || playerEntry?.player || null;
    if (userId && !mongoose.Types.ObjectId.isValid(String(userId))) {
      userId = null;
    }

    const email = String(playerEntry?.email || "").trim().toLowerCase();
    const linkedUser = (userId && lookups.byId.get(String(userId))) || (email && lookups.byEmail.get(email)) || null;
    if (!userId && linkedUser) {
      userId = linkedUser._id;
    }

    const name = String(playerEntry?.name || linkedUser?.name || "").trim();
    if (!name && !email) continue;

    const key = buildMemberKey({
      player: userId,
      email,
      name
    });
    if (seen.has(key)) continue;
    seen.add(key);

    normalizedPlayers.push({
      name: name || email.split("@")[0] || "Player",
      email: email || String(linkedUser?.email || "").trim().toLowerCase(),
      userId: userId || null,
      rating: getUserStatsRating(linkedUser)
    });
  }

  return normalizedPlayers;
};

exports.createTeam = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    throw createError(400, "Team name is required");
  }

  const team = await populateTeamQuery(
    Team.findOneAndUpdate(
      { owner: req.user._id, name },
      {
        owner: req.user._id,
        name,
        members: await buildMembers(req.body.members || [], req.user._id)
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true
      }
    )
  );

  return sendSuccess(res, {
    message: "Team saved successfully",
    data: presentTeam(team)
  }, 201);
});

exports.getAllTeams = asyncHandler(async (req, res) => {
  const teams = await populateTeamQuery(
    Team.find({
      owner: req.user._id,
      isActive: true
    }).sort({ updatedAt: -1 })
  );

  return sendSuccess(res, {
    data: teams.map(presentTeam)
  });
});

exports.getTeam = asyncHandler(async (req, res) => {
  const team = await populateTeamQuery(
    Team.findOne({
      _id: req.params.teamId,
      owner: req.user._id,
      isActive: true
    })
  );

  if (!team) {
    throw createError(404, "Team not found");
  }

  return sendSuccess(res, {
    data: presentTeam(team)
  });
});

exports.updateTeam = asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) {
      throw createError(400, "Team name cannot be empty");
    }
    updates.name = name;
  }

  if (Array.isArray(req.body.members)) {
    updates.members = await buildMembers(req.body.members, req.user._id);
  }

  if (Object.keys(updates).length === 0) {
    throw createError(400, "No team updates were provided");
  }

  const team = await populateTeamQuery(
    Team.findOneAndUpdate(
      { _id: req.params.teamId, owner: req.user._id, isActive: true },
      updates,
      { new: true, runValidators: true }
    )
  );

  if (!team) {
    throw createError(404, "Team not found");
  }

  return sendSuccess(res, {
    message: "Team updated",
    data: presentTeam(team)
  });
});

exports.deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findOneAndUpdate(
    { _id: req.params.teamId, owner: req.user._id, isActive: true },
    { isActive: false },
    { new: true }
  );

  if (!team) {
    throw createError(404, "Team not found");
  }

  return sendSuccess(res, {
    message: "Team deleted"
  });
});

exports.getPlayerSuggestions = asyncHandler(async (req, res) => {
  const q = String(req.query.q || req.query.search || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);

  const query = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { "profile.displayName": { $regex: q, $options: "i" } }
        ]
      }
    : {};

  const users = await User.find(query)
    .sort({ "stats.matchesPlayed": -1, name: 1 })
    .limit(limit)
    .select("name email profile stats");

  return sendSuccess(res, {
    data: users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      playerType: user.profile?.playerType || "Player",
      availability: user.profile?.availabilityStatus || "Available",
      runs: Number(user.stats?.batting?.runs || 0),
      wickets: Number(user.stats?.bowling?.wickets || 0)
    }))
  });
});

exports.getMyInvitations = asyncHandler(async (req, res) => {
  const teams = await Team.find({
    isActive: true,
    members: {
      $elemMatch: {
        player: req.user._id,
        inviteStatus: "pending"
      }
    }
  }).populate("owner", "name email");

  const invitations = teams.flatMap((team) =>
    team.members
      .filter(
        (member) =>
          String(member.player || "") === String(req.user._id) &&
          String(member.inviteStatus || "").toLowerCase() === "pending"
      )
      .map((member) => ({
        teamId: team._id,
        teamName: team.name,
        memberId: member._id,
        invitedAt: member.invitedAt || null,
        owner: team.owner
      }))
  );

  return sendSuccess(res, {
    data: invitations
  });
});

exports.respondToInvitation = asyncHandler(async (req, res) => {
  const action = String(req.body.action || "").trim().toLowerCase();
  if (!["accept", "reject"].includes(action)) {
    throw createError(400, "Action must be accept or reject");
  }

  const team = await populateTeamQuery(
    Team.findOne({
      _id: req.params.teamId,
      isActive: true
    })
  );

  if (!team) {
    throw createError(404, "Invitation not found");
  }

  const member = team.members.id(req.params.memberId);
  const memberPlayerId = member?.player?._id || member?.player || null;
  if (!member || String(memberPlayerId || "") !== String(req.user._id)) {
    throw createError(404, "Invitation not found");
  }

  if (String(member.inviteStatus || "").toLowerCase() !== "pending") {
    throw createError(409, "Invitation has already been responded to");
  }

  member.inviteStatus = action === "accept" ? "accepted" : "rejected";
  member.respondedAt = new Date();
  await team.save();
  await team.populate("members.player", "name email profile stats");

  return sendSuccess(res, {
    message: action === "accept" ? "Invitation accepted" : "Invitation rejected",
    data: presentTeam(team)
  });
});

exports.randomizeTeams = asyncHandler(async (req, res) => {
  const players = await normalizePlayersForDistribution(req.body.players || []);
  if (players.length < 2) {
    throw createError(400, "At least two unique players are required");
  }

  const sortedPlayers = [...players].sort(
    (left, right) => right.rating - left.rating || left.name.localeCompare(right.name)
  );

  const teamA = {
    name: String(req.body.teamAName || "").trim() || "Team A",
    players: [],
    rating: 0
  };
  const teamB = {
    name: String(req.body.teamBName || "").trim() || "Team B",
    players: [],
    rating: 0
  };

  for (const player of sortedPlayers) {
    const target = teamA.rating === teamB.rating
      ? (teamA.players.length <= teamB.players.length ? teamA : teamB)
      : (teamA.rating < teamB.rating ? teamA : teamB);
    target.players.push({
      name: player.name,
      email: player.email,
      userId: player.userId,
      rating: player.rating
    });
    target.rating += player.rating;
  }

  return sendSuccess(res, {
    distribution: {
      teamA,
      teamB,
      ratingGap: Math.abs(teamA.rating - teamB.rating)
    }
  });
});

exports.addTeamMember = exports.updateTeam;
exports.removeTeamMember = exports.updateTeam;
