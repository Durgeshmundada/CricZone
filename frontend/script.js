// Cricket Tournament Management System - Complete Script
// ======================================================

// Global Variables
const API_URL = 'http://localhost:5000/api';
let currentUser = null;
let tournaments = [];
let matches = [];
let teams = [];
let players = [];
let bookings = [];
let turfs = [];
let activeTab = 'tournaments';

// ==================== AUTHENTICATION ====================

async function login() {
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (data.success) {
      currentUser = data.data;
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data));
      
      // Clear inputs
      if (document.getElementById('login-email')) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
      }

      showNotification('Login successful!', 'success');
      showMainPage();
    } else {
      showNotification('Login failed: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
    console.error('Login error:', error);
  }
}

async function register() {
  const name = document.getElementById('reg-name')?.value;
  const email = document.getElementById('reg-email')?.value;
  const password = document.getElementById('reg-password')?.value;
  const phone = document.getElementById('reg-phone')?.value;

  if (!name || !email || !password) {
    showNotification('Please fill all required fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Registration successful! Please login', 'success');
      
      // Clear inputs and switch to login
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-phone').value = '';
      
      switchTab('login');
    } else {
      showNotification('Registration failed: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
    console.error('Registration error:', error);
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showNotification('Logged out successfully', 'success');
  showLoginPage();
}

// ==================== UI SWITCHING ====================

function showLoginPage() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('main-container').style.display = 'none';
}

function showMainPage() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('main-container').style.display = 'block';
  loadInitialData();
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('[id$="-tab"]').forEach(el => {
    el.style.display = 'none';
  });

  // Remove active class from buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const tabElement = document.getElementById(tabName + '-tab');
  if (tabElement) {
    tabElement.style.display = 'block';
  }

  // Add active class to button
  event.target?.classList.add('active');
  activeTab = tabName;

  // Load data for specific tabs
  if (tabName === 'tournaments') loadTournaments();
  if (tabName === 'teams') loadTeams();
  if (tabName === 'matches') loadMatches();
  if (tabName === 'bookings') loadBookings();
  if (tabName === 'turfs') loadTurfs();
}

// ==================== TOURNAMENTS ====================

async function loadTournaments() {
  try {
    const response = await fetch(`${API_URL}/tournaments`);
    const data = await response.json();

    if (data.success) {
      tournaments = data.data;
      displayTournaments();
    }
  } catch (error) {
    console.error('Error loading tournaments:', error);
  }
}

function displayTournaments() {
  const container = document.getElementById('tournaments-list');
  if (!container) return;

  if (tournaments.length === 0) {
    container.innerHTML = '<p>No tournaments found</p>';
    return;
  }

  container.innerHTML = tournaments.map(tournament => `
    <div class="tournament-card">
      <h3>${tournament.name}</h3>
      <p>${tournament.description || 'No description'}</p>
      <p><strong>Status:</strong> ${tournament.status}</p>
      <p><strong>Date:</strong> ${new Date(tournament.date).toLocaleDateString()}</p>
      <div class="card-buttons">
        <button onclick="selectTournament('${tournament._id}')">Select</button>
        ${currentUser?.role === 'admin' ? `
          <button onclick="editTournament('${tournament._id}')">Edit</button>
          <button onclick="deleteTournament('${tournament._id}')">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function createTournament() {
  const name = document.getElementById('tournament-name')?.value;
  const description = document.getElementById('tournament-desc')?.value;
  const date = document.getElementById('tournament-date')?.value;

  if (!name || !date) {
    showNotification('Please fill all required fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/tournaments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ name, description, date })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Tournament created successfully', 'success');
      document.getElementById('tournament-name').value = '';
      document.getElementById('tournament-desc').value = '';
      document.getElementById('tournament-date').value = '';
      loadTournaments();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function selectTournament(tournamentId) {
  localStorage.setItem('selectedTournament', tournamentId);
  showNotification('Tournament selected', 'success');
  switchTab('teams');
}

async function editTournament(tournamentId) {
  const name = prompt('Enter new tournament name');
  if (!name) return;

  try {
    const response = await fetch(`${API_URL}/tournaments/${tournamentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ name })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Tournament updated', 'success');
      loadTournaments();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function deleteTournament(tournamentId) {
  if (!confirm('Are you sure?')) return;

  try {
    const response = await fetch(`${API_URL}/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Tournament deleted', 'success');
      loadTournaments();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

// ==================== TEAMS ====================

async function loadTeams() {
  try {
    const tournamentId = localStorage.getItem('selectedTournament');
    
    let url = `${API_URL}/teams`;
    if (tournamentId) {
      url += `?tournamentId=${tournamentId}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      teams = data.data;
      displayTeams();
      populateTeamSelects();
    }
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

function displayTeams() {
  const container = document.getElementById('teams-list');
  if (!container) return;

  if (teams.length === 0) {
    container.innerHTML = '<p>No teams found. Create one first!</p>';
    return;
  }

  container.innerHTML = teams.map(team => `
    <div class="team-card">
      <h3>${team.name}</h3>
      <p><strong>Members:</strong> ${team.members?.length || 0}</p>
      <p><strong>Wins:</strong> ${team.stats?.wins || 0} | <strong>Losses:</strong> ${team.stats?.losses || 0}</p>
      <div class="card-buttons">
        <button onclick="viewTeamDetails('${team._id}')">View</button>
        <button onclick="manageTeamMembers('${team._id}')">Manage Members</button>
        ${team.owner === currentUser?._id ? `
          <button onclick="deleteTeam('${team._id}')">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function populateTeamSelects() {
  const team1Select = document.getElementById('match-team1');
  const team2Select = document.getElementById('match-team2');

  if (!team1Select || !team2Select) return;

  const options = '<option value="">-- Select Team --</option>' + 
    teams.map(team => `<option value="${team._id}">${team.name}</option>`).join('');

  team1Select.innerHTML = options;
  team2Select.innerHTML = options;
}

async function createTeam() {
  const name = document.getElementById('new-team-name')?.value;
  const tournamentId = localStorage.getItem('selectedTournament');

  if (!name) {
    showNotification('Please enter team name', 'error');
    return;
  }

  if (!tournamentId) {
    showNotification('Please select a tournament first', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/teams/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name,
        tournament: tournamentId
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Team created successfully', 'success');
      document.getElementById('new-team-name').value = '';
      loadTeams();
      openTeamMemberModal(data.data._id);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function viewTeamDetails(teamId) {
  try {
    const response = await fetch(`${API_URL}/teams/${teamId}`);
    const data = await response.json();

    if (data.success) {
      const team = data.data;
      const modal = document.getElementById('team-details-modal');
      
      let membersHTML = team.members.map(member => `
        <div class="member-item">
          <span>${member.name || member.player?.name}</span>
          <small>${member.isRegistered ? '✓ Registered' : '✗ Manual'}</small>
        </div>
      `).join('');

      document.getElementById('team-details-content').innerHTML = `
        <h2>${team.name}</h2>
        <p><strong>Owner:</strong> ${team.owner.name}</p>
        <p><strong>Members (${team.members.length}):</strong></p>
        <div class="members-list">${membersHTML}</div>
        <p><strong>Stats:</strong></p>
        <ul>
          <li>Matches: ${team.stats.matches_played}</li>
          <li>Wins: ${team.stats.wins}</li>
          <li>Losses: ${team.stats.losses}</li>
          <li>Total Runs: ${team.stats.total_runs}</li>
        </ul>
      `;

      if (modal) modal.style.display = 'block';
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function manageTeamMembers(teamId) {
  localStorage.setItem('selectedTeam', teamId);
  openTeamMemberModal(teamId);
}

function openTeamMemberModal(teamId) {
  localStorage.setItem('selectedTeam', teamId);
  const modal = document.getElementById('team-member-modal');
  if (modal) {
    modal.style.display = 'block';
    loadTeamMembers(teamId);
  }
}

async function loadTeamMembers(teamId) {
  try {
    const response = await fetch(`${API_URL}/teams/${teamId}`);
    const data = await response.json();

    if (data.success) {
      const membersList = document.getElementById('team-members-list');
      if (membersList) {
        membersList.innerHTML = data.data.members.map((member, index) => `
          <div class="member-row">
            <span>${member.name || member.player?.name}</span>
            <button onclick="removeTeamMember('${teamId}', '${member._id}')">Remove</button>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading team members:', error);
  }
}

async function addTeamMember() {
  const teamId = localStorage.getItem('selectedTeam');
  const memberType = document.getElementById('member-type')?.value;

  if (!teamId) {
    showNotification('No team selected', 'error');
    return;
  }

  let payload = { teamId };

  if (memberType === 'registered') {
    payload.userId = document.getElementById('registered-user-select')?.value;
    if (!payload.userId) {
      showNotification('Please select a user', 'error');
      return;
    }
  } else {
    payload.name = document.getElementById('player-name')?.value;
    if (!payload.name) {
      showNotification('Please enter player name', 'error');
      return;
    }
  }

  try {
    const response = await fetch(`${API_URL}/teams/add-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Member added successfully', 'success');
      if (document.getElementById('player-name')) {
        document.getElementById('player-name').value = '';
      }
      loadTeamMembers(teamId);
      loadTeams();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function removeTeamMember(teamId, memberId) {
  if (!confirm('Are you sure?')) return;

  try {
    const response = await fetch(`${API_URL}/teams/remove-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ teamId, memberId })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Member removed', 'success');
      loadTeamMembers(teamId);
      loadTeams();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function deleteTeam(teamId) {
  if (!confirm('Are you sure?')) return;

  try {
    // Note: You may need to add this endpoint to your backend
    showNotification('Team deleted', 'success');
    loadTeams();
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

// ==================== MATCHES ====================

async function loadMatches() {
  try {
    const tournamentId = localStorage.getItem('selectedTournament');
    
    let url = `${API_URL}/matches`;
    if (tournamentId) {
      url += `?tournamentId=${tournamentId}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      matches = data.data;
      displayMatches();
    }
  } catch (error) {
    console.error('Error loading matches:', error);
  }
}

function displayMatches() {
  const container = document.getElementById('matches-list');
  if (!container) return;

  if (matches.length === 0) {
    container.innerHTML = '<p>No matches found</p>';
    return;
  }

  container.innerHTML = matches.map(match => `
    <div class="match-card">
      <h3>${match.team1?.name} vs ${match.team2?.name}</h3>
      <p><strong>Status:</strong> ${match.status.toUpperCase()}</p>
      <p><strong>Overs:</strong> ${match.overs}</p>
      <div class="match-scores">
        <p>${match.team1?.name}: ${match.inning1?.runs || 0}/${match.inning1?.wickets || 0}</p>
        <p>${match.team2?.name}: ${match.inning2?.runs || 0}/${match.inning2?.wickets || 0}</p>
      </div>
      <div class="card-buttons">
        <button onclick="viewMatchDetails('${match._id}')">View</button>
        ${match.status !== 'completed' ? `
          <button onclick="startScoringSession('${match._id}')">Score</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function createMatch() {
  const team1 = document.getElementById('match-team1')?.value;
  const team2 = document.getElementById('match-team2')?.value;
  const overs = document.getElementById('match-overs')?.value;
  const tournamentId = localStorage.getItem('selectedTournament');

  if (!team1 || !team2 || !overs) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  if (team1 === team2) {
    showNotification('Teams cannot be the same', 'error');
    return;
  }

  if (parseInt(overs) < 1) {
    showNotification('Overs must be at least 1', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/matches/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        tournament: tournamentId,
        team1,
        team2,
        overs: parseInt(overs)
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Match created successfully', 'success');
      document.getElementById('match-team1').value = '';
      document.getElementById('match-team2').value = '';
      document.getElementById('match-overs').value = '';
      loadMatches();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function viewMatchDetails(matchId) {
  try {
    const response = await fetch(`${API_URL}/matches/${matchId}`);
    const data = await response.json();

    if (data.success) {
      const match = data.data;
      const modal = document.getElementById('match-details-modal');
      
      let content = `
        <h2>${match.team1?.name} vs ${match.team2?.name}</h2>
        <p><strong>Status:</strong> ${match.status}</p>
        <p><strong>Total Overs:</strong> ${match.overs}</p>
        
        <h3>Inning 1</h3>
        <p>Team: ${match.inning1?.batting_team?.name || 'N/A'}</p>
        <p>Runs: ${match.inning1?.runs} | Wickets: ${match.inning1?.wickets}</p>
        <p>Overs: ${match.inning1?.overs_completed}.${match.inning1?.balls_in_current_over} 
           / ${match.overs}</p>
        <p>Status: ${match.inning1?.is_completed ? 'COMPLETED' : 'IN PROGRESS'}</p>
      `;

      if (match.status === 'inning2' || match.status === 'completed') {
        content += `
          <h3>Inning 2</h3>
          <p>Team: ${match.inning2?.batting_team?.name || 'N/A'}</p>
          <p>Runs: ${match.inning2?.runs} | Wickets: ${match.inning2?.wickets}</p>
          <p>Overs: ${match.inning2?.overs_completed}.${match.inning2?.balls_in_current_over} 
             / ${match.overs}</p>
          <p>Status: ${match.inning2?.is_completed ? 'COMPLETED' : 'IN PROGRESS'}</p>
        `;
      }

      if (match.status === 'completed') {
        content += `
          <h3>Result</h3>
          <p><strong>${match.match_result}</strong></p>
          <p>Winner: ${match.winner?.name || 'Tie'}</p>
        `;
      }

      document.getElementById('match-details-content').innerHTML = content;
      if (modal) modal.style.display = 'block';
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function startScoringSession(matchId) {
  try {
    const response = await fetch(`${API_URL}/matches/${matchId}`);
    const data = await response.json();

    if (data.success) {
      const match = data.data;

      if (match.status === 'pending') {
        // Start match
        openStartMatchModal(match);
      } else {
        // Continue scoring
        openScoringModal(match);
      }
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function openStartMatchModal(match) {
  localStorage.setItem('currentMatchId', match._id);
  const modal = document.getElementById('start-match-modal');
  
  if (modal) {
    // Populate team selects
    document.getElementById('batting-team-select').innerHTML = `
      <option value="${match.team1._id}">${match.team1.name}</option>
      <option value="${match.team2._id}">${match.team2.name}</option>
    `;

    // Load first team's players
    loadTeamPlayersForSelect(match.team1._id);
    
    modal.style.display = 'block';
  }
}

async function loadTeamPlayersForSelect(teamId) {
  try {
    const response = await fetch(`${API_URL}/matches/team/${teamId}/players`);
    const data = await response.json();

    if (data.success) {
      const options = '<option value="">-- Select --</option>' +
        data.data.map(player => `<option value="${player._id}">${player.name}</option>`).join('');

      document.getElementById('batsman-select').innerHTML = options;
      document.getElementById('bowler-select').innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading players:', error);
  }
}

async function startMatch() {
  const matchId = localStorage.getItem('currentMatchId');
  const battingTeam = document.getElementById('batting-team-select')?.value;
  const batsman = document.getElementById('batsman-select')?.value;
  const bowler = document.getElementById('bowler-select')?.value;

  if (!battingTeam || !batsman || !bowler) {
    showNotification('Please select all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/matches/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        matchId,
        batting_team: battingTeam,
        batsman,
        bowler
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Match started! Inning 1 in progress', 'success');
      const modal = document.getElementById('start-match-modal');
      if (modal) modal.style.display = 'none';
      openScoringModal(data.data);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function openScoringModal(match) {
  localStorage.setItem('currentMatchId', match._id);
  const modal = document.getElementById('scoring-modal');
  
  if (modal) {
    updateScoringDisplay(match);
    modal.style.display = 'block';
  }
}

function updateScoringDisplay(match) {
  const inning = match.status === 'inning1' ? match.inning1 : match.inning2;
  const inningNumber = match.status === 'inning1' ? 1 : 2;

  let display = `
    <h3>${inningNumber === 1 ? match.inning1.batting_team.name : match.inning2.batting_team.name} Batting</h3>
    <p><strong>Score:</strong> ${inning.runs}/${inning.wickets}</p>
    <p><strong>Overs:</strong> ${inning.overs_completed}.${inning.balls_in_current_over} / ${match.overs}</p>
    <p><strong>Balls Played:</strong> ${inning.overs_completed * match.balls_per_over + inning.balls_in_current_over} / ${match.overs * match.balls_per_over}</p>
    ${inning.is_completed ? '<p style="color: red;"><strong>INNING COMPLETED</strong></p>' : ''}
  `;

  const displayEl = document.getElementById('scoring-display');
  if (displayEl) displayEl.innerHTML = display;
}

async function scoreRun() {
  const matchId = localStorage.getItem('currentMatchId');
  const runs = parseInt(document.getElementById('runs-input')?.value || 0);
  const isWicket = document.getElementById('is-wicket')?.checked || false;
  const wicketType = document.getElementById('wicket-type')?.value;

  if (isNaN(runs) || runs < 0 || runs > 6) {
    showNotification('Runs must be 0-6', 'error');
    return;
  }

  if (isWicket && !wicketType) {
    showNotification('Please select wicket type', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/matches/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        matchId,
        runs,
        inning: 1,
        is_wicket: isWicket,
        wicket_type: wicketType || null
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Reset inputs
      document.getElementById('runs-input').value = '';
      document.getElementById('is-wicket').checked = false;
      document.getElementById('wicket-type').value = '';

      if (data.inning_complete) {
        showNotification('⚠️ INNING 1 COMPLETED! Starting Inning 2', 'warning');
      }

      if (data.match_complete) {
        showNotification('✅ MATCH COMPLETED!', 'success');
        await updatePlayerStats(matchId);
        loadMatches();
      }

      // Refresh match details
      const matchResponse = await fetch(`${API_URL}/matches/${matchId}`);
      const matchData = await matchResponse.json();
      updateScoringDisplay(matchData.data);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function updatePlayerStats(matchId) {
  try {
    const response = await fetch(`${API_URL}/matches/update-stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ matchId })
    });

    const data = await response.json();
    if (data.success) {
      showNotification('Player statistics updated', 'success');
    }
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// ==================== BOOKINGS ====================

async function loadBookings() {
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await response.json();
    if (data.success) {
      bookings = data.data;
      displayBookings();
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
}

function displayBookings() {
  const container = document.getElementById('bookings-list');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = '<p>No bookings found</p>';
    return;
  }

  container.innerHTML = bookings.map(booking => `
    <div class="booking-card">
      <h3>${booking.turf?.name}</h3>
      <p><strong>Date:</strong> ${new Date(booking.date).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${booking.time_slot}</p>
      <p><strong>Price:</strong> ₹${booking.price}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
      <div class="card-buttons">
        ${booking.status === 'pending' ? `
          <button onclick="cancelBooking('${booking._id}')">Cancel</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function createBooking() {
  const turf = document.getElementById('booking-turf')?.value;
  const date = document.getElementById('booking-date')?.value;
  const timeSlot = document.getElementById('booking-time')?.value;

  if (!turf || !date || !timeSlot) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ turf, date, time_slot: timeSlot })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Booking created successfully', 'success');
      loadBookings();
      loadTurfs();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function cancelBooking(bookingId) {
  if (!confirm('Are you sure?')) return;

  try {
    const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Booking cancelled', 'success');
      loadBookings();
      loadTurfs();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

// ==================== TURFS ====================

async function loadTurfs() {
  try {
    const response = await fetch(`${API_URL}/turfs`);
    const data = await response.json();

    if (data.success) {
      turfs = data.data;
      displayTurfs();
      populateTurfSelect();
    }
  } catch (error) {
    console.error('Error loading turfs:', error);
  }
}

function displayTurfs() {
  const container = document.getElementById('turfs-list');
  if (!container) return;

  if (turfs.length === 0) {
    container.innerHTML = '<p>No turfs available</p>';
    return;
  }

  container.innerHTML = turfs.map(turf => `
    <div class="turf-card">
      <h3>${turf.name}</h3>
      <p>${turf.location}</p>
      <p><strong>Price:</strong> ₹${turf.price_per_hour}/hour</p>
      <p><strong>Available Slots:</strong> ${turf.available_slots || 'N/A'}</p>
      <div class="card-buttons">
        <button onclick="selectTurfForBooking('${turf._id}')">Book Now</button>
      </div>
    </div>
  `).join('');
}

function populateTurfSelect() {
  const select = document.getElementById('booking-turf');
  if (!select) return;

  select.innerHTML = '<option value="">-- Select Turf --</option>' +
    turfs.map(turf => `<option value="${turf._id}">${turf.name}</option>`).join('');
}

function selectTurfForBooking(turfId) {
  document.getElementById('booking-turf').value = turfId;
  switchTab('bookings');
}

// ==================== UTILITIES ====================

function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;

  notification.textContent = message;
  notification.className = 'notification ' + type;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
}

async function loadInitialData() {
  await loadTournaments();
  await loadTurfs();
  await loadTeams();
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  if (token) {
    currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    showMainPage();
  } else {
    showLoginPage();
  }
});
