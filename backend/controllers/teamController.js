const Team = require('../models/Team');
const User = require('../models/User');

const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
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

const mapMembers = async (members) => Promise.all(
  members.map(async (member) => {
    const email = member.email ? String(member.email).toLowerCase().trim() : null;
    const user = email ? await User.findOne({ email }) : null;

    return {
      player: user ? user._id : null,
      name: String(member.name).trim(),
      isRegistered: Boolean(user)
    };
  })
);

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

    const processedMembers = await mapMembers(members);

    const team = await Team.create({
      name: trimmedName,
      owner: req.user._id,
      members: processedMembers,
      tournament: tournamentId || null
    });

    return res.status(201).json({
      success: true,
      message: 'Team created successfully',
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
      .populate('members.player', 'name');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const players = team.members.map((member) => ({
      id: member._id,
      name: member.player?.name || member.name,
      isRegistered: member.isRegistered
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

      team.members = await mapMembers(members);
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

