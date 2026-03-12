const normalizeUserStats = (stats = {}) => {
  const batting = stats.batting || {};
  const bowling = stats.bowling || {};
  const matchesPlayed = Number(stats.matchesPlayed || 0);
  const wins = Number(stats.wins || 0);

  return {
    matchesPlayed,
    wins,
    losses: Number(stats.losses || 0),
    followers: Number(stats.followers || 0),
    winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    batting: {
      innings: Number(batting.innings || 0),
      runs: Number(batting.runs || 0),
      ballsFaced: Number(batting.ballsFaced || 0),
      fours: Number(batting.fours || 0),
      sixes: Number(batting.sixes || 0),
      highestScore: Number(batting.highestScore || 0),
      strikeRate: Number(batting.strikeRate || 0)
    },
    bowling: {
      balls: Number(bowling.balls || 0),
      runs: Number(bowling.runs || 0),
      wickets: Number(bowling.wickets || 0),
      wides: Number(bowling.wides || 0),
      noBalls: Number(bowling.noBalls || 0),
      economy: Number(bowling.economy || 0)
    }
  };
};

const safeUser = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: {
      displayName: user.profile?.displayName || user.name,
      playerType: user.profile?.playerType || "Player",
      availabilityStatus: user.profile?.availabilityStatus || "Available",
      availability: user.profile?.availabilityStatus || "Available"
    },
    media: {
      profilePicture: user.media?.profilePicture || ""
    },
    stats: normalizeUserStats(user.stats || {})
  };
};

const buildPlayerLink = (player = {}) => ({
  name: String(player.name || "").trim(),
  email: String(player.email || "").trim().toLowerCase(),
  userId: player.userId || null,
  isRegistered: Boolean(player.userId)
});

const presentTurf = (turf) => {
  const rawLocation = turf.location || turf.locationDetails || {};
  const location = typeof rawLocation === "string"
    ? {
        address: rawLocation,
        city: rawLocation,
        state: ""
      }
    : {
        address: rawLocation.address || "",
        city: rawLocation.city || rawLocation.address || "",
        state: rawLocation.state || ""
      };

  const turfName = turf.turfName || turf.name || "Unnamed Turf";
  const basePricingPerSlot = Number(
    turf.basePricingPerSlot !== undefined ? turf.basePricingPerSlot : turf.pricePerHour || 0
  );

  return {
    _id: turf._id,
    turfName,
    name: turfName,
    location,
    basePricingPerSlot,
    pricePerHour: Number(turf.pricePerHour || basePricingPerSlot || 0),
    sportTypes: Array.isArray(turf.sportTypes) && turf.sportTypes.length > 0
      ? turf.sportTypes
      : [turf.type || "cricket"],
    surfaceType: turf.surfaceType || "Standard",
    images: Array.isArray(turf.images) ? turf.images : [],
    ownerId: turf.ownerId || null,
    isActive: turf.isActive !== false,
    createdAt: turf.createdAt,
    updatedAt: turf.updatedAt
  };
};

const presentTeam = (team) => ({
  _id: team._id,
  name: team.name,
  owner: team.owner,
  members: Array.isArray(team.members)
    ? team.members.map((member) => ({
        _id: member._id,
        name: member.name || member.player?.name || "",
        email: member.email || member.player?.email || "",
        player: member.player || null,
        isRegistered: Boolean(member.player),
        inviteStatus: member.inviteStatus || "accepted",
        invitedAt: member.invitedAt || null,
        respondedAt: member.respondedAt || null
      }))
    : [],
  createdAt: team.createdAt,
  updatedAt: team.updatedAt
});

module.exports = {
  buildPlayerLink,
  normalizeUserStats,
  presentTeam,
  presentTurf,
  safeUser
};
