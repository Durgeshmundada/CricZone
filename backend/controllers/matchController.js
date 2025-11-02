// backend/controllers/matchController.js
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');

// @desc Create new match
// @route POST /api/matches
// @access Protected
exports.createMatch = async (req, res) => {
  try {
    const {
      matchName,
      matchType,
      customOvers,
      teamAName,
      teamAId,
      teamAPlayers,
      teamBName,
      teamBId,
      teamBPlayers,
      venue,
      matchDate,
      tournamentId
    } = req.body;

    // ✅ BUG #8 FIX: Comprehensive validation
    if (!matchName || !teamAName || !teamBName || !venue || !matchDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // ✅ BUG #8 FIX: Validate overs
    let totalOvers;
    if (matchType === 'T20') {
      totalOvers = 20;
    } else if (matchType === 'ODI') {
      totalOvers = 50;
    } else if (matchType === 'Test') {
      totalOvers = 90;
    } else if (matchType === 'Custom' && customOvers) {
      totalOvers = parseInt(customOvers);
      if (totalOvers < 1 || totalOvers > 50) {
        return res.status(400).json({
          success: false,
          message: 'Overs must be between 1 and 50'
        });
      }
    } else {
      totalOvers = 20;
    }

    // ✅ BUG #3 FIX: Validate teams exist if IDs provided
    if (teamAId && teamBId) {
      const teamA = await Team.findById(teamAId);
      const teamB = await Team.findById(teamBId);

      if (!teamA) {
        return res.status(400).json({
          success: false,
          message: 'Team A not found'
        });
      }

      if (!teamB) {
        return res.status(400).json({
          success: false,
          message: 'Team B not found'
        });
      }

      // ✅ BUG #8 FIX: Teams cannot be the same
      if (teamAId === teamBId) {
        return res.status(400).json({
          success: false,
          message: 'Teams cannot be the same'
        });
      }
    }

    // Parse players
    const teamAPlayersList = typeof teamAPlayers === 'string' 
      ? teamAPlayers.split(',').map(p => p.trim()).filter(p => p)
      : teamAPlayers || [];

    const teamBPlayersList = typeof teamBPlayers === 'string'
      ? teamBPlayers.split(',').map(p => p.trim()).filter(p => p)
      : teamBPlayers || [];

    // Create match
    const match = await Match.create({
      matchName,
      matchType,
      totalOvers,
      ballsPerOver: 6,
      teamA: {
        name: teamAName,
        teamId: teamAId || null,
        players: teamAPlayersList
      },
      teamB: {
        name: teamBName,
        teamId: teamBId || null,
        players: teamBPlayersList
      },
      venue,
      matchDate,
      tournament: tournamentId || null,
      createdBy: req.user._id,
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: 'Match created successfully ✅',
      data: match
    });

  } catch (error) {
    console.error('❌ Match creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create match',
      error: error.message
    });
  }
};

// @desc Get all matches
// @route GET /api/matches
// @access Public
exports.getAllMatches = async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('createdBy', 'name email')
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches'
    });
  }
};

// @desc Get live matches
// @route GET /api/matches/live
// @access Public
exports.getLiveMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: 'live' })
      .populate('createdBy', 'name email')
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    console.error('❌ Error fetching live matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live matches'
    });
  }
};

// @desc Get single match
// @route GET /api/matches/:id
// @access Public
exports.getMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('teamA.teamId')
      .populate('teamB.teamId');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    console.error('❌ Error fetching match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match'
    });
  }
};

// @desc Get user's matches
// @route GET /api/matches/user/my-matches
// @access Protected
exports.getUserMatches = async (req, res) => {
  try {
    const matches = await Match.find({ createdBy: req.user._id })
      .sort({ matchDate: -1 });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    console.error('❌ Error fetching user matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your matches'
    });
  }
};

// ✅ CRITICAL: BUG #1, #5, #10 FIX - Complete Score Update Logic
// @desc Update match score
// @route PUT /api/matches/:id/score
// @access Protected
exports.updateMatchScore = async (req, res) => {
  try {
    const { runs, isWicket, extras, batsmanName, bowlerName } = req.body;

    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Match is already completed'
      });
    }

    // Set match to live if not already
    if (match.status === 'scheduled' || match.status === 'upcoming') {
      match.status = 'live';
    }

    // Determine current inning
    const currentInningNum = match.currentInning || 1;
    const inningKey = currentInningNum === 1 ? 'first' : 'second';
    const currentInning = match.innings[inningKey];

    // Determine batting team
    let battingTeam, bowlingTeam;
    if (!currentInning.battingTeam) {
      // First ball of match - set teamA as batting
      currentInning.battingTeam = 'teamA';
    }

    battingTeam = currentInning.battingTeam === 'teamA' ? match.teamA : match.teamB;
    bowlingTeam = currentInning.battingTeam === 'teamA' ? match.teamB : match.teamA;

    // Set current players
    if (batsmanName) match.currentBatsman = batsmanName;
    if (bowlerName) match.currentBowler = bowlerName;

    // ✅ BUG #1 FIX: Check if over limit reached BEFORE scoring
    const maxBalls = match.totalOvers * match.ballsPerOver;
    const currentTotalBalls = (currentInning.overs * 6) + currentInning.balls;

    if (currentTotalBalls >= maxBalls) {
      // Over limit reached
      currentInning.isCompleted = true;
      
      if (currentInningNum === 1) {
        // Move to second inning
        match.currentInning = 2;
        match.status = 'innings_break';
        match.innings.second.target = currentInning.score + 1;
        match.innings.second.battingTeam = currentInning.battingTeam === 'teamA' ? 'teamB' : 'teamA';
        
        await match.save();
        
        return res.json({
          success: true,
          message: 'First innings completed! Maximum overs reached.',
          data: match,
          inningsComplete: true
        });
      } else {
        // Match complete
        await completeMatchLogic(match);
        await match.save();
        
        return res.json({
          success: true,
          message: 'Match completed! Maximum overs reached.',
          data: match,
          matchComplete: true
        });
      }
    }

    // ✅ BUG #10 FIX: Handle extras differently
    let ballCounts = true; // Does this ball count towards over?
    let runsToAdd = parseInt(runs) || 0;
    let extrasRuns = 0;

    if (extras) {
      if (extras === 'wide' || extras === 'noball') {
        ballCounts = false; // Wide and no-ball don't count as valid balls
        extrasRuns = 1;
        runsToAdd += extrasRuns;
        
        if (extras === 'wide') {
          currentInning.extras.wides += 1;
        } else {
          currentInning.extras.noBalls += 1;
        }
      } else if (extras === 'bye' || extras === 'legbye') {
        // Byes and leg-byes count as balls but runs go to extras
        extrasRuns = runsToAdd;
        
        if (extras === 'bye') {
          currentInning.extras.byes += runsToAdd;
        } else {
          currentInning.extras.legByes += runsToAdd;
        }
      }
    }

    // Update score
    currentInning.score += runsToAdd;
    battingTeam.score += runsToAdd;

    // Update wickets
    if (isWicket) {
      currentInning.wickets += 1;
      battingTeam.wickets += 1;

      // ✅ BUG #5 FIX: Check if all wickets fallen
      if (currentInning.wickets >= 10) {
        currentInning.isCompleted = true;
        
        if (currentInningNum === 1) {
          // Move to second inning
          match.currentInning = 2;
          match.status = 'innings_break';
          match.innings.second.target = currentInning.score + 1;
          match.innings.second.battingTeam = currentInning.battingTeam === 'teamA' ? 'teamB' : 'teamA';
          
          await match.save();
          
          return res.json({
            success: true,
            message: 'First innings completed! All wickets fallen.',
            data: match,
            inningsComplete: true
          });
        } else {
          // Match complete
          await completeMatchLogic(match);
          await match.save();
          
          return res.json({
            success: true,
            message: 'Match completed! All wickets fallen.',
            data: match,
            matchComplete: true
          });
        }
      }
    }

    // Update balls and overs (only if ball counts)
    if (ballCounts) {
      currentInning.balls += 1;
      battingTeam.ballsPlayed += 1;

      // Check if over is complete
      if (currentInning.balls >= match.ballsPerOver) {
        currentInning.overs += 1;
        currentInning.balls = 0;
      }

      // Update overs display (e.g., "5.3")
      battingTeam.overs = `${currentInning.overs}.${currentInning.balls}`;
    }

    // ✅ BUG #5 FIX: Check if target achieved (2nd inning)
    if (currentInningNum === 2 && currentInning.score >= currentInning.target) {
      currentInning.isCompleted = true;
      await completeMatchLogic(match);
      await match.save();
      
      return res.json({
        success: true,
        message: 'Match completed! Target achieved.',
        data: match,
        matchComplete: true
      });
    }

    await match.save();

    res.json({
      success: true,
      message: 'Score updated successfully',
      data: match
    });

  } catch (error) {
    console.error('❌ Score update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update score',
      error: error.message
    });
  }
};

// ✅ Helper function to complete match and update stats
async function completeMatchLogic(match) {
  match.status = 'completed';

  // Determine winner
  const scoreA = match.innings.first.battingTeam === 'teamA' 
    ? match.innings.first.score 
    : match.innings.second.score;

  const scoreB = match.innings.first.battingTeam === 'teamB' 
    ? match.innings.first.score 
    : match.innings.second.score;

  if (scoreA > scoreB) {
    match.winner = match.teamA.name;
  } else if (scoreB > scoreA) {
    match.winner = match.teamB.name;
  } else {
    match.winner = 'Draw';
  }

  // ✅ BUG #4 FIX: Update player statistics
  await updatePlayerStats(match);

  return match;
}

// ✅ BUG #4 FIX: Update user statistics after match
async function updatePlayerStats(match) {
  try {
    // Get team IDs
    const teamAId = match.teamA.teamId;
    const teamBId = match.teamB.teamId;

    if (!teamAId || !teamBId) return; // Skip if teams aren't linked

    // Get teams with player data
    const teamA = await Team.findById(teamAId).populate('members.player');
    const teamB = await Team.findById(teamBId).populate('members.player');

    if (!teamA || !teamB) return;

    // Update stats for all registered players
    const allPlayers = [
      ...teamA.members.filter(m => m.isRegistered && m.player),
      ...teamB.members.filter(m => m.isRegistered && m.player)
    ];

    for (const member of allPlayers) {
      const userId = member.player._id;
      
      await User.findByIdAndUpdate(userId, {
        $inc: {
          'stats.matchesPlayed': 1
        }
      });
    }

    // Update team stats
    const winnerTeam = match.winner === match.teamA.name ? teamA : 
                       match.winner === match.teamB.name ? teamB : null;
    const loserTeam = match.winner === match.teamA.name ? teamB : 
                      match.winner === match.teamB.name ? teamA : null;

    if (winnerTeam) {
      winnerTeam.stats.matchesPlayed += 1;
      winnerTeam.stats.wins += 1;
      await winnerTeam.save();
    }

    if (loserTeam) {
      loserTeam.stats.matchesPlayed += 1;
      loserTeam.stats.losses += 1;
      await loserTeam.save();
    }

    // Handle draw
    if (match.winner === 'Draw') {
      teamA.stats.matchesPlayed += 1;
      teamA.stats.draws += 1;
      teamB.stats.matchesPlayed += 1;
      teamB.stats.draws += 1;
      await teamA.save();
      await teamB.save();
    }

  } catch (error) {
    console.error('❌ Error updating player stats:', error);
  }
}

// @desc Complete match manually
// @route PUT /api/matches/:id/complete
// @access Protected
exports.completeMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this match'
      });
    }

    await completeMatchLogic(match);
    await match.save();

    res.json({
      success: true,
      message: 'Match completed successfully',
      data: match
    });

  } catch (error) {
    console.error('❌ Complete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete match',
      error: error.message
    });
  }
};
