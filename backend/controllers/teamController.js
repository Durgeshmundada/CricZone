const Team = require('../models/Team');
const User = require('../models/User');
const Match = require('../models/Match');

const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const isValidObjectId = (value) => {
  if (!value) return false;
  return /^[a-fA-F0-9]{24}$/.test(String(value));
};

const validateMembers = (members) => {
  if (!Array.isArray(members) || members.length === 0) {
    return 'Please provide at least one team member';
  }

  const hasInvalidMember = members.some((member) => !member || !String(member.name || '').trim());
  if (hasInvalidMember) {
    return 'Each team member must include a name';
  }

  return null;
};

const buildMemberKey = ({ playerId, name, email }) => {
  if (playerId) return `id:${String(playerId)}`;
  return `guest:${String(name || '').trim().toLowerCase()}|${String(email || '').trim().toLowerCase()}`;
};

const mapMembers = async ({
  members,
  ownerUser,
  inviterId,
  existingTeam = null
}) => {
  const existingByKey = new Map();
  if (existingTeam && Array.isArray(existingTeam.members)) {
    existingTeam.members.forEach((member) => {
      const key = buildMemberKey({
        playerId: member.player ? String(member.player) : null,
        name: member.name,
        email: member.email || ''
      });
      existingByKey.set(key, member);
    });
  }

  const processed = [];
  const seenKeys = new Set();

  for (const rawMember of members) {
    const email = rawMember.email ? String(rawMember.email).toLowerCase().trim() : '';
    const rawUserId = rawMember.userId || rawMember.id || rawMember.playerId || null;
    const hasUserId = isValidObjectId(rawUserId);

    let linkedUser = null;
    if (hasUserId) {
      linkedUser = await User.findById(rawUserId).select('_id name email');
    }
    if (!linkedUser && email) {
      linkedUser = await User.findOne({ email }).select('_id name email');
    }

    const linkedUserId = linkedUser ? String(linkedUser._id) : null;
    const resolvedName = String(rawMember.name || linkedUser?.name || '').trim();
    const resolvedEmail = String(linkedUser?.email || email || '').toLowerCase().trim();
    if (!resolvedName) continue;

    const key = buildMemberKey({
      playerId: linkedUserId,
      name: resolvedName,
      email: resolvedEmail
    });
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const existingMember = existingByKey.get(key);
    const isOwnerMember = linkedUserId && String(linkedUserId) === String(ownerUser._id);
    const isRegistered = Boolean(linkedUser);

    let inviteStatus = 'accepted';
    let invitedBy = null;
    let respondedAt = existingMember?.respondedAt || null;

    if (isRegistered && !isOwnerMember) {
      const previousStatus = String(existingMember?.inviteStatus || '').toLowerCase();
      if (previousStatus === 'accepted') {
        inviteStatus = 'accepted';
        invitedBy = existingMember?.invitedBy || inviterId;
        respondedAt = existingMember?.respondedAt || new Date();
      } else if (previousStatus === 'pending') {
        inviteStatus = 'pending';
        invitedBy = existingMember?.invitedBy || inviterId;
        respondedAt = null;
      } else {
        inviteStatus = 'pending';
        invitedBy = inviterId;
        respondedAt = null;
      }
    } else if (isOwnerMember) {
      inviteStatus = 'accepted';
      invitedBy = null;
      respondedAt = existingMember?.respondedAt || new Date();
    }

    processed.push({
      player: linkedUser ? linkedUser._id : null,
      name: resolvedName,
      email: resolvedEmail || undefined,
      isRegistered,
      inviteStatus,
      invitedBy,
      respondedAt
    });
  }

  const ownerAlreadyIncluded = processed.some(
    (member) => member.player && String(member.player) === String(ownerUser._id)
  );

  if (!ownerAlreadyIncluded) {
    processed.unshift({
      player: ownerUser._id,
      name: String(ownerUser.name || 'Owner').trim(),
      email: String(ownerUser.email || '').toLowerCase().trim() || undefined,
      isRegistered: true,
      inviteStatus: 'accepted',
      invitedBy: null,
      respondedAt: new Date()
    });
  }

  return processed;
};

const normalizeInputPlayers = (players = []) => {
  if (!Array.isArray(players)) return [];

  return players
    .map((player) => {
      if (!player) return null;

      if (typeof player === 'string') {
        const [namePart, emailPart] = player.split('|').map((item) => String(item || '').trim());
        const email = emailPart || (namePart.includes('@') ? namePart : '');
        const name = (emailPart ? namePart : namePart.replace(/@.*/, '')).trim();
        if (!name && !email) return null;
        return {
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          userId: null
        };
      }

      if (typeof player === 'object') {
        const name = String(player.name || '').trim();
        const email = String(player.email || '').trim().toLowerCase();
        const userId = player.userId || player.id || player.playerId || null;
        if (!name && !email && !userId) return null;
        return {
          name: name || (email ? email.split('@')[0] : 'Player'),
          email,
          userId
        };
      }

      return null;
    })
    .filter(Boolean);
};

const computeCareerStrength = (userDoc) => {
  if (!userDoc || !userDoc.stats) return 25;
  const batting = userDoc.stats.batting || {};
  const bowling = userDoc.stats.bowling || {};
  const matches = Number(userDoc.stats.matchesPlayed || 0);
  const wins = Number(userDoc.stats.wins || 0);
  const winRate = matches > 0 ? (wins / matches) * 100 : 0;

  return Number((
    (Number(batting.runs || 0) * 0.05) +
    (Number(batting.strikeRate || 0) * 0.08) +
    (Number(bowling.wickets || 0) * 2.5) -
    (Number(bowling.economy || 0) * 1.2) +
    (winRate * 0.2) +
    20
  ).toFixed(2));
};

const computeRecentForm = (matchDocs, userId) => {
  if (!Array.isArray(matchDocs) || matchDocs.length === 0 || !userId) return 0;
  const normalizedUserId = String(userId);

  let total = 0;
  let counted = 0;

  matchDocs.forEach((match) => {
    const bats = (match.batsmanStats || []).filter((row) => String(row.playerId || '') === normalizedUserId);
    const bowls = (match.bowlerStats || []).filter((row) => String(row.playerId || '') === normalizedUserId);
    if (bats.length === 0 && bowls.length === 0) return;

    const batScore = bats.reduce((sum, row) => {
      const runs = Number(row.runs || 0);
      const fours = Number(row.fours || 0);
      const sixes = Number(row.sixes || 0);
      const balls = Number(row.ballsFaced || 0);
      const strikeBonus = balls > 0 ? Math.min(30, (runs / balls) * 100 * 0.2) : 0;
      return sum + runs + (fours * 0.4) + (sixes * 0.8) + strikeBonus;
    }, 0);

    const bowlScore = bowls.reduce((sum, row) => {
      const wickets = Number(row.wickets || 0);
      const maidens = Number(row.maidens || 0);
      const runsConceded = Number(row.runs || 0);
      const economy = Number(row.economy || 0);
      return sum + (wickets * 18) + (maidens * 5) - (runsConceded * 0.12) - (economy * 0.6);
    }, 0);

    total += batScore + bowlScore;
    counted += 1;
  });

  if (counted === 0) return 0;
  return Number((total / counted).toFixed(2));
};

const shuffleArray = (items = []) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

exports.generateBalancedTeams = async (req, res) => {
  try {
    const historyMatches = Number.parseInt(req.body.historyMatches, 10);
    const recentMatchesToUse = Number.isFinite(historyMatches)
      ? Math.max(2, Math.min(historyMatches, 3))
      : 3;

    const incomingPlayers = normalizeInputPlayers(req.body.players || []);
    if (incomingPlayers.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two players are required for random team distribution'
      });
    }

    const userIds = [...new Set(
      incomingPlayers
        .map((p) => p.userId)
        .filter(Boolean)
        .map((id) => String(id))
    )];

    const emails = [...new Set(
      incomingPlayers
        .map((p) => p.email)
        .filter(Boolean)
        .map((email) => String(email).toLowerCase())
    )];

    let users = [];
    if (userIds.length > 0 || emails.length > 0) {
      users = await User.find({
        $or: [
          ...(userIds.length > 0 ? [{ _id: { $in: userIds } }] : []),
          ...(emails.length > 0 ? [{ email: { $in: emails } }] : [])
        ]
      }).select('_id name email stats');
    }

    const userById = new Map(users.map((user) => [String(user._id), user]));
    const userByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));

    const matchedUserIds = [...new Set(users.map((user) => String(user._id)))];
    const recentMatches = matchedUserIds.length > 0
      ? await Match.find({
        status: 'completed',
        $or: [
          { 'teamA.playerLinks.userId': { $in: matchedUserIds } },
          { 'teamB.playerLinks.userId': { $in: matchedUserIds } },
          { 'batsmanStats.playerId': { $in: matchedUserIds } },
          { 'bowlerStats.playerId': { $in: matchedUserIds } }
        ]
      })
        .sort({ matchDate: -1 })
        .limit(Math.max(8, recentMatchesToUse * 4))
        .select('matchDate teamA teamB batsmanStats bowlerStats status')
      : [];

    const playerPool = incomingPlayers.map((rawPlayer) => {
      const mappedById = rawPlayer.userId ? userById.get(String(rawPlayer.userId)) : null;
      const mappedByEmail = rawPlayer.email ? userByEmail.get(String(rawPlayer.email).toLowerCase()) : null;
      const linkedUser = mappedById || mappedByEmail || null;

      const linkedUserId = linkedUser ? String(linkedUser._id) : null;
      const recentForm = computeRecentForm(
        recentMatches.slice(0, Math.max(recentMatchesToUse * 3, 6)),
        linkedUserId
      );
      const careerStrength = computeCareerStrength(linkedUser);
      const jitter = Math.random() * 3;
      const rating = Number((careerStrength + recentForm + jitter).toFixed(2));

      return {
        name: rawPlayer.name || linkedUser?.name || 'Player',
        email: rawPlayer.email || linkedUser?.email || '',
        userId: linkedUserId,
        rating,
        metrics: {
          careerStrength,
          recentForm
        }
      };
    });

    const rankedPool = shuffleArray(playerPool).sort((a, b) => b.rating - a.rating);

    const teamA = [];
    const teamB = [];
    let teamARating = 0;
    let teamBRating = 0;

    rankedPool.forEach((player) => {
      const preferTeamA = teamA.length < teamB.length
        || (teamA.length === teamB.length && teamARating <= teamBRating);

      if (preferTeamA) {
        teamA.push(player);
        teamARating += player.rating;
      } else {
        teamB.push(player);
        teamBRating += player.rating;
      }
    });

    return res.json({
      success: true,
      inputCount: rankedPool.length,
      historyMatchesUsed: recentMatchesToUse,
      distribution: {
        teamA: {
          name: req.body.teamAName || 'Team A',
          totalRating: Number(teamARating.toFixed(2)),
          players: teamA
        },
        teamB: {
          name: req.body.teamBName || 'Team B',
          totalRating: Number(teamBRating.toFixed(2)),
          players: teamB
        },
        ratingGap: Number(Math.abs(teamARating - teamBRating).toFixed(2))
      }
    });
  } catch (error) {
    return sendServerError(res, 'Failed to generate balanced teams', error);
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, members, tournamentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a team name'
      });
    }

    const membersError = validateMembers(members);
    if (membersError) {
      return res.status(400).json({
        success: false,
        message: membersError
      });
    }

    const trimmedName = String(name).trim();
    const existingTeam = await Team.findOne({
      name: trimmedName,
      owner: req.user._id
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You already have a team with this name'
      });
    }

    const processedMembers = await mapMembers({
      members,
      ownerUser: req.user,
      inviterId: req.user._id
    });

    const team = await Team.create({
      name: trimmedName,
      owner: req.user._id,
      members: processedMembers,
      tournament: tournamentId || null
    });

    const pendingInvites = processedMembers.filter((member) => member.inviteStatus === 'pending').length;

    return res.status(201).json({
      success: true,
      message: pendingInvites > 0
        ? `Team created. ${pendingInvites} player invitation(s) pending verification.`
        : 'Team created successfully',
      data: team
    });
  } catch (error) {
    return sendServerError(res, 'Failed to create team', error);
  }
};

exports.getUserTeams = async (req, res) => {
  try {
    const teams = await Team.find({ owner: req.user._id })
      .populate('tournament', 'name')
      .populate('members.player', 'name email')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch teams', error);
  }
};

exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('tournament', 'name')
      .populate('members.player', 'name email');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const isOwner = String(team.owner?._id || team.owner) === String(req.user._id);
    const isMember = Array.isArray(team.members) && team.members.some(
      (member) => member.player && String(member.player?._id || member.player) === String(req.user._id)
    );
    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this team'
      });
    }

    return res.json({
      success: true,
      data: team
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch team', error);
  }
};

exports.getTeamPlayers = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.player', 'name email');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const isOwner = String(team.owner) === String(req.user._id);
    const isMember = Array.isArray(team.members) && team.members.some(
      (member) => member.player && String(member.player?._id || member.player) === String(req.user._id)
    );
    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this team players'
      });
    }

    const players = team.members.map((member) => ({
      id: member._id,
      name: member.player?.name || member.name,
      email: member.player?.email || member.email || '',
      isRegistered: member.isRegistered,
      inviteStatus: member.inviteStatus || 'accepted',
      invitedBy: member.invitedBy || null,
      respondedAt: member.respondedAt || null
    }));

    return res.json({
      success: true,
      data: players
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch team players', error);
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this team'
      });
    }

    const { name, members } = req.body;

    if (name && String(name).trim()) {
      team.name = String(name).trim();
    }

    if (Array.isArray(members)) {
      const membersError = validateMembers(members);
      if (membersError) {
        return res.status(400).json({
          success: false,
          message: membersError
        });
      }

      team.members = await mapMembers({
        members,
        ownerUser: req.user,
        inviterId: req.user._id,
        existingTeam: team
      });
    }

    await team.save();

    return res.json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    return sendServerError(res, 'Failed to update team', error);
  }
};

exports.getPlayerSuggestions = async (req, res) => {
  try {
    const queryText = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
    const teamId = String(req.query.teamId || '').trim();

    let excludedUserIds = new Set([String(req.user._id)]);
    if (teamId && isValidObjectId(teamId)) {
      const team = await Team.findById(teamId).select('owner members');
      if (team && String(team.owner) === String(req.user._id)) {
        (team.members || []).forEach((member) => {
          if (member.player) excludedUserIds.add(String(member.player));
        });
      }
    }

    const filters = {
      _id: { $nin: [...excludedUserIds] },
      isActive: true
    };

    if (queryText) {
      const regex = new RegExp(queryText, 'i');
      filters.$or = [
        { name: regex },
        { email: regex },
        { 'profile.displayName': regex }
      ];
    } else {
      filters['profile.availability'] = { $in: ['Available', 'Looking for team'] };
    }

    const users = await User.find(filters)
      .select('name email profile stats')
      .sort({ 'stats.matchesPlayed': -1 })
      .limit(limit);

    const suggestions = users.map((user) => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      availability: user.profile?.availability || 'Available',
      playerType: user.profile?.playerType || 'Not specified',
      runs: Number(user.stats?.batting?.runs || 0),
      wickets: Number(user.stats?.bowling?.wickets || 0)
    }));

    return res.json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    return sendServerError(res, 'Failed to load player suggestions', error);
  }
};

exports.getMyTeamInvitations = async (req, res) => {
  try {
    const teams = await Team.find({
      members: {
        $elemMatch: {
          player: req.user._id,
          inviteStatus: 'pending'
        }
      }
    })
      .populate('owner', 'name email')
      .populate('members.player', 'name email')
      .sort({ updatedAt: -1 });

    const invitations = teams.map((team) => {
      const member = (team.members || []).find(
        (row) => row.player && String(row.player._id || row.player) === String(req.user._id) && row.inviteStatus === 'pending'
      );

      return {
        teamId: team._id,
        teamName: team.name,
        owner: team.owner,
        memberId: member?._id || null,
        invitedAt: member?.addedAt || null
      };
    }).filter((entry) => entry.memberId);

    return res.json({
      success: true,
      count: invitations.length,
      data: invitations
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch team invitations', error);
  }
};

exports.respondToTeamInvitation = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const action = String(req.body.action || '').toLowerCase();
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be either 'accept' or 'reject'"
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const member = team.members.id(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Invitation member entry not found'
      });
    }

    if (!member.player || String(member.player) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to respond to this invitation'
      });
    }

    if (String(member.inviteStatus || 'pending') !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invitation already responded'
      });
    }

    member.inviteStatus = action === 'accept' ? 'accepted' : 'rejected';
    member.respondedAt = new Date();
    await team.save();

    return res.json({
      success: true,
      message: action === 'accept'
        ? 'You have joined the team successfully'
        : 'Team invitation rejected',
      data: team
    });
  } catch (error) {
    return sendServerError(res, 'Failed to respond to team invitation', error);
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this team'
      });
    }

    await team.deleteOne();

    return res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    return sendServerError(res, 'Failed to delete team', error);
  }
};

