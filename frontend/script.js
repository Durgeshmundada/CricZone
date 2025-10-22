// Global State
let matches = [];
let tournaments = [];
let currentMatch = null;
let ballHistory = [];

// Sample Data
const sampleMatches = [
    {
        id: 1,
        name: "Sunday League Match",
        teamA: { name: "Warriors", score: 165, wickets: 4, overs: 18.3 },
        teamB: { name: "Challengers", score: 0, wickets: 0, overs: 0 },
        type: "T20",
        venue: "Central Ground",
        status: "live",
        isLive: true
    },
    {
        id: 2,
        name: "City Championship",
        teamA: { name: "Kings XI", score: 189, wickets: 7, overs: 20 },
        teamB: { name: "Super Giants", score: 145, wickets: 8, overs: 17.2 },
        type: "T20",
        venue: "Stadium A",
        status: "completed",
        isLive: false
    }
];

const sampleTournaments = [
    {
        id: 1,
        name: "Summer Cricket League 2024",
        format: "League + Knockout",
        matchType: "T20",
        teams: 8,
        matches: 28,
        startDate: "2024-06-01",
        endDate: "2024-06-30",
        status: "ongoing",
        prize: "₹50,000"
    },
    {
        id: 2,
        name: "Corporate Cricket Cup",
        format: "Knockout",
        matchType: "ODI",
        teams: 12,
        matches: 15,
        startDate: "2024-07-15",
        endDate: "2024-07-25",
        status: "upcoming",
        prize: "₹1,00,000"
    }
];

const sampleTurfs = [
    {
        id: 1,
        name: "Green Valley Cricket Ground",
        location: "Dharampeth, Nagpur",
        rating: 4.8,
        price: "₹1,500/hour",
        availability: "Available Today",
        emoji: "🏟️"
    },
    {
        id: 2,
        name: "Victory Sports Complex",
        location: "Sitabuldi, Nagpur",
        rating: 4.6,
        price: "₹1,200/hour",
        availability: "Available from 6 PM",
        emoji: "🏏"
    },
    {
        id: 3,
        name: "Champion Turf Arena",
        location: "Civil Lines, Nagpur",
        rating: 4.9,
        price: "₹2,000/hour",
        availability: "Booking Required",
        emoji: "⚡"
    }
];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    matches = [...sampleMatches];
    tournaments = [...sampleTournaments];
    
    initializeNavigation();
    renderLiveMatches();
    renderTournaments();
    renderTournamentsList();
    renderTurfList();
    populateTournamentSelect();
    setupFormHandlers();
});

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinksContainer = document.getElementById('navLinks');
    const navbar = document.getElementById('navbar');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateToPage(page);
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Close mobile menu
            navLinksContainer.classList.remove('active');
        });
    });
    
    // CTA buttons navigation
    document.querySelectorAll('.cta-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.dataset.page;
            navigateToPage(page);
            
            // Update nav active state
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelector(`[data-page="${page}"]`).classList.add('active');
        });
    });
    
    mobileMenuBtn.addEventListener('click', function() {
        navLinksContainer.classList.toggle('active');
    });
    
    // Scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

function navigateToPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Render Functions
function renderLiveMatches() {
    const grid = document.getElementById('liveMatchesGrid');
    const liveMatches = matches.filter(m => m.isLive);
    
    if (liveMatches.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #64748b;">No live matches at the moment</p>';
        return;
    }
    
    grid.innerHTML = liveMatches.map(match => `
        <div class="match-card">
            <div class="live-indicator">
                <span class="live-dot"></span>
                <span>LIVE</span>
            </div>
            <div class="match-teams">${match.teamA.name} vs ${match.teamB.name}</div>
            <div class="match-score">
                ${match.teamA.score}/${match.teamA.wickets} (${match.teamA.overs})
            </div>
            <div class="match-status">${match.venue} • ${match.type}</div>
        </div>
    `).join('');
}

function renderTournaments() {
    const grid = document.getElementById('tournamentsGrid');
    const ongoingTournaments = tournaments.filter(t => t.status === 'ongoing');
    
    if (ongoingTournaments.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #64748b;">No ongoing tournaments</p>';
        return;
    }
    
    grid.innerHTML = ongoingTournaments.map(tournament => `
        <div class="tournament-card">
            <div class="tournament-name">${tournament.name}</div>
            <div class="tournament-info">
                <span>${tournament.format}</span>
                <span>${tournament.matchType}</span>
            </div>
            <div class="tournament-stats">
                <div class="stat">
                    <div class="stat-value">${tournament.teams}</div>
                    <div class="stat-label">Teams</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${tournament.matches}</div>
                    <div class="stat-label">Matches</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${tournament.prize}</div>
                    <div class="stat-label">Prize</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderTournamentsList() {
    const list = document.getElementById('tournamentsList');
    
    if (tournaments.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #64748b;">No tournaments created yet</p>';
        return;
    }
    
    list.innerHTML = tournaments.map(tournament => `
        <div class="tournament-item">
            <div class="tournament-header">
                <h3 class="tournament-name">${tournament.name}</h3>
                <span class="status-badge ${tournament.status}">${tournament.status.toUpperCase()}</span>
            </div>
            <div class="tournament-info">
                <span>📅 ${tournament.startDate} to ${tournament.endDate}</span>
                <span>🏆 ${tournament.format}</span>
                <span>🏏 ${tournament.matchType}</span>
            </div>
            <div class="tournament-stats">
                <div class="stat">
                    <div class="stat-value">${tournament.teams}</div>
                    <div class="stat-label">Teams</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${tournament.matches}</div>
                    <div class="stat-label">Matches</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${tournament.prize}</div>
                    <div class="stat-label">Prize Pool</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderTurfList() {
    const list = document.getElementById('turfList');
    
    list.innerHTML = sampleTurfs.map(turf => `
        <div class="turf-card">
            <div class="turf-image">
                <span>${turf.emoji}</span>
            </div>
            <div class="turf-info">
                <div>
                    <h3 class="turf-name">${turf.name}</h3>
                    <div class="turf-rating">⭐ ${turf.rating}/5.0</div>
                    <div class="turf-location">📍 ${turf.location}</div>
                    <div class="turf-availability">🕐 ${turf.availability}</div>
                    <div class="turf-price">${turf.price}</div>
                </div>
                <button class="book-btn" onclick="bookTurf(${turf.id})">Book Now</button>
            </div>
        </div>
    `).join('');
}

function populateTournamentSelect() {
    const select = document.getElementById('tournamentSelect');
    select.innerHTML = '<option value="">Not part of tournament</option>' +
        tournaments.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

// Form Handlers
function setupFormHandlers() {
    // Host Match Form
    const hostMatchForm = document.getElementById('hostMatchForm');
    const matchTypeSelect = document.getElementById('matchType');
    const customOversGroup = document.getElementById('customOversGroup');
    
    matchTypeSelect.addEventListener('change', function() {
        if (this.value === 'Custom') {
            customOversGroup.style.display = 'block';
        } else {
            customOversGroup.style.display = 'none';
        }
    });
    
    hostMatchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        createMatch();
    });
    
    // Match Selection
    const selectMatch = document.getElementById('selectMatch');
    selectMatch.innerHTML = '<option value="">Choose a match...</option>' +
        matches.map(m => `<option value="${m.id}">${m.name} - ${m.teamA.name} vs ${m.teamB.name}</option>`).join('');
    
    selectMatch.addEventListener('change', function() {
        if (this.value) {
            loadMatch(parseInt(this.value));
        }
    });
    
    // Striker/Non-striker change
    document.getElementById('striker').addEventListener('change', updateBatsmanStats);
    document.getElementById('nonStriker').addEventListener('change', updateBatsmanStats);
    document.getElementById('currentBowler').addEventListener('change', updateBowlerStats);
    
    // Wicket Type Change
    document.getElementById('wicketType').addEventListener('change', function() {
        const fielderGroup = document.getElementById('fielderGroup');
        if (this.value === 'Caught' || this.value === 'Stumped' || this.value === 'Run Out') {
            fielderGroup.style.display = 'block';
        } else {
            fielderGroup.style.display = 'none';
        }
    });
    
    // Tournament Form
    document.getElementById('tournamentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createTournament();
    });
}

function createMatch() {
    const matchData = {
        id: matches.length + 1,
        name: document.getElementById('matchName').value,
        type: document.getElementById('matchType').value,
        teamA: {
            name: document.getElementById('teamAName').value,
            players: document.getElementById('teamAPlayers').value.split(',').map(p => p.trim()),
            score: 0,
            wickets: 0,
            overs: 0
        },
        teamB: {
            name: document.getElementById('teamBName').value,
            players: document.getElementById('teamBPlayers').value.split(',').map(p => p.trim()),
            score: 0,
            wickets: 0,
            overs: 0
        },
        venue: document.getElementById('venue').value,
        date: document.getElementById('matchDate').value,
        tournament: document.getElementById('tournamentSelect').value,
        status: 'upcoming',
        isLive: false,
        innings: 1,
        battingTeam: 'teamA',
        currentBatsmen: [],
        currentBowler: null,
        ballByBall: []
    };
    
    if (matchData.type === 'Custom') {
        matchData.overs = parseInt(document.getElementById('customOvers').value);
    } else {
        matchData.overs = matchData.type === 'T20' ? 20 : matchData.type === 'ODI' ? 50 : 90;
    }
    
    matches.push(matchData);
    showToast('Match created successfully!', 'success');
    
    // Update select dropdown
    const selectMatch = document.getElementById('selectMatch');
    selectMatch.innerHTML += `<option value="${matchData.id}">${matchData.name} - ${matchData.teamA.name} vs ${matchData.teamB.name}</option>`;
    
    // Reset form
    document.getElementById('hostMatchForm').reset();
    document.getElementById('customOversGroup').style.display = 'none';
    
    // Navigate to score match page
    navigateToPage('score-match');
}

function loadMatch(matchId) {
    currentMatch = matches.find(m => m.id === matchId);
    if (!currentMatch) return;
    
    ballHistory = [];
    
    // Show scoring interface
    document.getElementById('scoringInterface').style.display = 'block';
    
    // Update match header
    document.getElementById('matchTitle').textContent = 
        `${currentMatch.teamA.name} vs ${currentMatch.teamB.name}`;
    
    // Populate player dropdowns
    populatePlayerDropdowns();
    
    // Update display
    updateScoreDisplay();
}

function populatePlayerDropdowns() {
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    const bowlingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamB : currentMatch.teamA;
    
    // Batsmen
    const strikerSelect = document.getElementById('striker');
    const nonStrikerSelect = document.getElementById('nonStriker');
    const newBatsmanSelect = document.getElementById('newBatsman');
    
    const batsmenOptions = '<option value="">Select Batsman</option>' +
        battingTeam.players.map(p => `<option value="${p}">${p}</option>`).join('');
    
    strikerSelect.innerHTML = batsmenOptions;
    nonStrikerSelect.innerHTML = batsmenOptions;
    newBatsmanSelect.innerHTML = batsmenOptions;
    
    // Bowler & Fielder
    const bowlerSelect = document.getElementById('currentBowler');
    const fielderSelect = document.getElementById('fielder');
    
    const bowlerOptions = '<option value="">Select Bowler</option>' +
        bowlingTeam.players.map(p => `<option value="${p}">${p}</option>`).join('');
    
    bowlerSelect.innerHTML = bowlerOptions;
    fielderSelect.innerHTML = '<option value="">Select Fielder</option>' +
        bowlingTeam.players.map(p => `<option value="${p}">${p}</option>`).join('');
}

function updateScoreDisplay() {
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    const bowlingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamB : currentMatch.teamA;
    
    document.getElementById('battingTeamName').textContent = battingTeam.name;
    document.getElementById('battingScore').textContent = 
        `${battingTeam.score}/${battingTeam.wickets}`;
    document.getElementById('battingOvers').textContent = 
        `Overs: ${battingTeam.overs.toFixed(1)}/${currentMatch.overs}`;
    
    document.getElementById('bowlingTeamName').textContent = bowlingTeam.name;
    
    if (currentMatch.innings === 1) {
        document.getElementById('bowlingScore').textContent = 'Yet to bat';
        document.getElementById('targetInfo').textContent = '';
    } else {
        document.getElementById('bowlingScore').textContent = 
            `${bowlingTeam.score}/${bowlingTeam.wickets}`;
        const target = battingTeam.score + 1;
        const required = target - bowlingTeam.score;
        document.getElementById('targetInfo').textContent = 
            `Target: ${target} | Required: ${required}`;
    }
}

function updateBatsmanStats() {
    // Placeholder - In real app, calculate from ball-by-ball data
    document.getElementById('strikerStats').innerHTML = `
        <span>0</span><span>0</span><span>0.00</span>
    `;
    document.getElementById('nonStrikerStats').innerHTML = `
        <span>0</span><span>0</span><span>0.00</span>
    `;
}

function updateBowlerStats() {
    // Placeholder - In real app, calculate from ball-by-ball data
    document.getElementById('bowlerStats').innerHTML = `
        <span>0.0</span><span>0</span><span>0</span>
    `;
}

// Scoring Functions
function addRuns(runs) {
    if (!validateSelection()) return;
    
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    battingTeam.score += runs;
    battingTeam.overs += 0.1;
    
    if (battingTeam.overs % 1 === 0.6) {
        battingTeam.overs = Math.floor(battingTeam.overs) + 1;
    }
    
    ballHistory.push({ type: 'run', runs, overs: battingTeam.overs });
    
    updateScoreDisplay();
    showToast(`${runs} run${runs !== 1 ? 's' : ''} added`, 'success');
    
    checkInningsEnd();
}

function addExtra(type) {
    if (!validateSelection()) return;
    
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    
    if (type === 'wide') {
        battingTeam.score += 1;
        showToast('Wide ball - 1 run added', 'info');
    } else if (type === 'noball') {
        battingTeam.score += 1;
        showToast('No ball - 1 run added', 'info');
    }
    
    ballHistory.push({ type, overs: battingTeam.overs });
    updateScoreDisplay();
}

function showWicketModal() {
    if (!validateSelection()) return;
    
    const modal = document.getElementById('wicketModal');
    modal.classList.add('active');
}

function closeWicketModal() {
    document.getElementById('wicketModal').classList.remove('active');
    document.getElementById('wicketType').value = '';
    document.getElementById('newBatsman').value = '';
    document.getElementById('fielderGroup').style.display = 'none';
}

function confirmWicket() {
    const wicketType = document.getElementById('wicketType').value;
    const newBatsman = document.getElementById('newBatsman').value;
    
    if (!wicketType || !newBatsman) {
        showToast('Please fill all wicket details', 'error');
        return;
    }
    
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    battingTeam.wickets += 1;
    battingTeam.overs += 0.1;
    
    if (battingTeam.overs % 1 === 0.6) {
        battingTeam.overs = Math.floor(battingTeam.overs) + 1;
    }
    
    ballHistory.push({ type: 'wicket', wicketType, overs: battingTeam.overs });
    
    closeWicketModal();
    updateScoreDisplay();
    showToast(`Wicket! ${wicketType}`, 'info');
    
    checkInningsEnd();
}

function undoLastBall() {
    if (ballHistory.length === 0) {
        showToast('No balls to undo', 'error');
        return;
    }
    
    const lastBall = ballHistory.pop();
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    
    if (lastBall.type === 'run') {
        battingTeam.score -= lastBall.runs;
        battingTeam.overs -= 0.1;
    } else if (lastBall.type === 'wicket') {
        battingTeam.wickets -= 1;
        battingTeam.overs -= 0.1;
    } else if (lastBall.type === 'wide' || lastBall.type === 'noball') {
        battingTeam.score -= 1;
    }
    
    if (battingTeam.overs < 0) battingTeam.overs = 0;
    
    updateScoreDisplay();
    showToast('Last ball undone', 'info');
}

function endInnings() {
    if (!currentMatch) return;
    
    if (currentMatch.innings === 1) {
        currentMatch.innings = 2;
        currentMatch.battingTeam = currentMatch.battingTeam === 'teamA' ? 'teamB' : 'teamA';
        ballHistory = [];
        
        populatePlayerDropdowns();
        updateScoreDisplay();
        showToast('Innings ended. Second innings begins!', 'success');
    } else {
        endMatch();
    }
}

function endMatch() {
    if (!currentMatch) return;
    
    const teamA = currentMatch.teamA;
    const teamB = currentMatch.teamB;
    
    let result = '';
    if (teamA.score > teamB.score) {
        result = `${teamA.name} won by ${teamA.score - teamB.score} runs`;
    } else if (teamB.score > teamA.score) {
        result = `${teamB.name} won by ${10 - teamB.wickets} wickets`;
    } else {
        result = 'Match Tied!';
    }
    
    currentMatch.isLive = false;
    currentMatch.status = 'completed';
    
    showResultModal(result);
    renderLiveMatches();
}

function checkInningsEnd() {
    const battingTeam = currentMatch.battingTeam === 'teamA' ? currentMatch.teamA : currentMatch.teamB;
    
    if (battingTeam.wickets >= 10 || battingTeam.overs >= currentMatch.overs) {
        setTimeout(() => {
            if (currentMatch.innings === 1) {
                endInnings();
            } else {
                endMatch();
            }
        }, 1000);
    }
}

function validateSelection() {
    const striker = document.getElementById('striker').value;
    const nonStriker = document.getElementById('nonStriker').value;
    const bowler = document.getElementById('currentBowler').value;
    
    if (!striker || !nonStriker || !bowler) {
        showToast('Please select batsmen and bowler', 'error');
        return false;
    }
    
    if (striker === nonStriker) {
        showToast('Striker and non-striker cannot be same', 'error');
        return false;
    }
    
    return true;
}

// Tournament Functions
function showCreateTournamentModal() {
    document.getElementById('tournamentModal').classList.add('active');
}

function closeTournamentModal() {
    document.getElementById('tournamentModal').classList.remove('active');
    document.getElementById('tournamentForm').reset();
}

function createTournament() {
    const tournament = {
        id: tournaments.length + 1,
        name: document.getElementById('tournamentName').value,
        format: document.getElementById('tournamentFormat').value,
        matchType: document.getElementById('tournamentMatchType').value,
        startDate: document.getElementById('tournamentStartDate').value,
        endDate: document.getElementById('tournamentEndDate').value,
        teams: parseInt(document.getElementById('tournamentTeams').value),
        prize: document.getElementById('tournamentPrize').value,
        status: 'upcoming',
        matches: 0
    };
    
    tournaments.push(tournament);
    closeTournamentModal();
    renderTournamentsList();
    populateTournamentSelect();
    showToast('Tournament created successfully!', 'success');
}

// Turf Booking
function bookTurf(turfId) {
    const turf = sampleTurfs.find(t => t.id === turfId);
    if (!turf) return;
    
    document.getElementById('bookingTurfName').textContent = `🏟️ ${turf.name}`;
    document.getElementById('bookingDate').textContent = `📅 ${new Date().toLocaleDateString()}`;
    document.getElementById('bookingAmount').textContent = turf.price;
    
    document.getElementById('bookingModal').classList.add('active');
    showToast('Booking confirmed!', 'success');
}

function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

// Result Modal
function showResultModal(result) {
    const modal = document.getElementById('resultModal');
    document.getElementById('resultTitle').textContent = '🏆 Match Result';
    document.getElementById('resultDetails').innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h2 style="color: var(--primary); margin-bottom: 1rem;">${result}</h2>
            <div style="font-size: 1.2rem; color: #64748b;">
                <p>${currentMatch.teamA.name}: ${currentMatch.teamA.score}/${currentMatch.teamA.wickets} (${currentMatch.teamA.overs})</p>
                <p>${currentMatch.teamB.name}: ${currentMatch.teamB.score}/${currentMatch.teamB.wickets} (${currentMatch.teamB.overs})</p>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

function closeResultModal() {
    document.getElementById('resultModal').classList.remove('active');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}