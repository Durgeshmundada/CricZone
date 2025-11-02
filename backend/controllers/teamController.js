// backend/controllers/teamController.js
const Team = require('../models/Team');
const User = require('../models/User');

// @desc Create new team
// @route POST /api/teams
// @access Protected
exports.createTeam = async (req, res) => {
  try {
    const { name, members, tournamentId } = req.body;

    // Validation
    if (!name || !members || members.length === 0) {
      return res.status(400).json({
        message: 'Please provide team name and at least one member'
      });
    }

    // Check if team name already exists for this user
    const existingTeam = await Team.findOne({ 
      name: name.trim(), 
      owner: req.user._id 
    });

    if (existingTeam) {
      return res.status(400).json({
        message: 'You already have a team with this name'
      });
    }

    // Process members
    const processedMembers = await Promise.all(
      members.map(async (member) => {
        // Check if member is a registered user
        const user = await User.findOne({ email: member.email });
        
        return {
          player: user ? user._id : null,
          name: member.name,
          isRegistered: !!user
        };
      })
    );

    // Create team
    const team = await Team.create({
      name: name.trim(),
      owner: req.user._id,
      members: processedMembers,
      tournament: tournamentId || null
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully ✅',
      data: team
    });

  } catch (error) {
    console.error('❌ Team creation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create team', 
      error: error.message 
    });
  }
};

// @desc Get all teams for logged-in user
// @route GET /api/teams
// @access Protected
exports.getUserTeams = async (req, res) => {
  try {
    const teams = await Team.find({ owner: req.user._id })
      .populate('tournament', 'name')
      .populate('members.player', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: teams.length,
      data: teams
    });

  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch teams' 
    });
  }
};

// @desc Get single team
// @route GET /api/teams/:id
// @access Protected
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

    res.json({
      success: true,
      data: team
    });

  } catch (error) {
    console.error('❌ Error fetching team:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch team' 
    });
  }
};

// @desc Get team players (for dropdowns) - BUG #2 FIX
// @route GET /api/teams/:id/players
// @access Protected
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

    // Return player list for dropdown
    const players = team.members.map(member => ({
      id: member._id,
      name: member.player?.name || member.name,
      isRegistered: member.isRegistered
    }));

    res.json({
      success: true,
      data: players
    });

  } catch (error) {
    console.error('❌ Error fetching team players:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch team players' 
    });
  }
};

// @desc Update team
// @route PUT /api/teams/:id
// @access Protected
exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ 
        success: false,
        message: 'Team not found' 
      });
    }

    // Check ownership
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to update this team' 
      });
    }

    const { name, members } = req.body;

    if (name) team.name = name.trim();
    if (members) {
      const processedMembers = await Promise.all(
        members.map(async (member) => {
          const user = await User.findOne({ email: member.email });
          return {
            player: user ? user._id : null,
            name: member.name,
            isRegistered: !!user
          };
        })
      );
      team.members = processedMembers;
    }

    await team.save();

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });

  } catch (error) {
    console.error('❌ Update team error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update team' 
    });
  }
};

// @desc Delete team
// @route DELETE /api/teams/:id
// @access Protected
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ 
        success: false,
        message: 'Team not found' 
      });
    }

    // Check ownership
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to delete this team' 
      });
    }

    await team.deleteOne();

    res.json({ 
      success: true,
      message: 'Team deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Delete team error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete team' 
    });
  }
};
