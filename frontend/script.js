// script.js – Complete CricZone Frontend (FULLY DEBUGGED)
console.log("✅ CricZone script.js loaded");

const API_BASE = "http://localhost:5000/api";

// ============================================
// CUSTOM MODAL SYSTEM
// ============================================

class CustomModal {
  constructor() {
    this.modal = document.getElementById('customModal');
    this.title = document.getElementById('modalTitle');
    this.message = document.getElementById('modalMessage');
    this.input = document.getElementById('modalInput');
    this.confirmBtn = document.getElementById('modalConfirm');
    this.cancelBtn = document.getElementById('modalCancel');
    this.closeBtn = document.getElementById('modalClose');
    this.overlay = this.modal.querySelector('.modal-overlay');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    this.cancelBtn.addEventListener('click', () => this.close());
  }

  open() {
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.input.value = '';
  }

  alert(title, message) {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.add('hidden');
      this.cancelBtn.classList.add('hidden');
      this.confirmBtn.textContent = 'OK';
      
      this.open();
      
      const handleConfirm = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.close();
        resolve(true);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
    });
  }

  confirm(title, message) {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.add('hidden');
      this.cancelBtn.classList.remove('hidden');
      this.confirmBtn.textContent = 'Confirm';
      
      this.open();
      
      const handleConfirm = () => {
        cleanup();
        this.close();
        resolve(true);
      };
      
      const handleCancel = () => {
        cleanup();
        this.close();
        resolve(false);
      };
      
      const cleanup = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.cancelBtn.removeEventListener('click', handleCancel);
        this.closeBtn.removeEventListener('click', handleCancel);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
      this.cancelBtn.addEventListener('click', handleCancel);
      this.closeBtn.addEventListener('click', handleCancel);
    });
  }

  prompt(title, message, placeholder = '') {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.remove('hidden');
      this.input.placeholder = placeholder;
      this.input.value = '';
      this.cancelBtn.classList.remove('hidden');
      this.confirmBtn.textContent = 'OK';
      
      this.open();
      
      setTimeout(() => this.input.focus(), 100);
      
      const handleConfirm = () => {
        const value = this.input.value.trim();
        cleanup();
        this.close();
        resolve(value || null);
      };
      
      const handleCancel = () => {
        cleanup();
        this.close();
        resolve(null);
      };
      
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          handleConfirm();
        }
      };
      
      const cleanup = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.cancelBtn.removeEventListener('click', handleCancel);
        this.closeBtn.removeEventListener('click', handleCancel);
        this.input.removeEventListener('keypress', handleEnter);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
      this.cancelBtn.addEventListener('click', handleCancel);
      this.closeBtn.addEventListener('click', handleCancel);
      this.input.addEventListener('keypress', handleEnter);
    });
  }
}

// Initialize modal globally
const modal = new CustomModal();

// ============================================
// BALL BY BALL SCORING SYSTEM
// ============================================

let currentMatchData = {
  matchId: null,
  currentBall: 0,
  totalRuns: 0,
  totalWickets: 0,
  balls: [],
  striker: { name: '', runs: 0, balls: 0 },
  nonStriker: { name: '', runs: 0, balls: 0 },
  bowler: { name: '', runs: 0, wickets: 0, balls: 0 }
};

// ✅ FIXED: Open Ball-by-Ball Scoring
function openBallScoring(matchId) {
  const token = localStorage.getItem('token');
  if (!token) {
    modal.alert('Login Required', 'Please login to score matches');
    return;
  }
  
  // Reset match data
  currentMatchData = {
    matchId: matchId,
    currentBall: 0,
    totalRuns: 0,
    totalWickets: 0,
    balls: [],
    striker: { name: '', runs: 0, balls: 0 },
    nonStriker: { name: '', runs: 0, balls: 0 },
    bowler: { name: '', runs: 0, wickets: 0, balls: 0 }
  };
  
  loadMatchForScoring(matchId);
  showPage('ball-scoring');
}


// ✅ FIXED: Load Match for Scoring - Complete Rewrite
async function loadMatchForScoring(matchId) {
  try {
    const token = localStorage.getItem('token');
    
    const res = await fetch(`${API_BASE}/matches/${matchId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ FIX: Handle both response structures
      const match = data.data || data.match || data;
      
      if (!match) {
        showToast('Match data not found', 'error');
        return;
      }

      // Update match info display
      document.getElementById('scoringMatchName').textContent = match.matchName || 'Match';
      document.getElementById('teamBattingName').textContent = match.teamA?.name || 'Team A';
      
      // Initialize current match data with existing scores
      currentMatchData.totalRuns = match.teamA?.score || 0;
      currentMatchData.totalWickets = match.teamA?.wickets || 0;
      
      // Calculate current ball from overs string (e.g., "5.3" = 33 balls)
      const oversStr = match.teamA?.overs || '0.0';
      const [completedOvers, ballsInOver] = oversStr.split('.').map(Number);
      currentMatchData.currentBall = (completedOvers * 6) + (ballsInOver || 0);
      
      // Update initial display
      updateScoringDisplay();
      
      // Setup players if match is just starting
      if (match.status === 'scheduled' || match.status === 'upcoming' || 
          !match.currentBatsman || !match.currentBowler) {
        await setupPlayers();
      } else {
        // Load existing players
        currentMatchData.striker.name = match.currentBatsman || '';
        currentMatchData.bowler.name = match.currentBowler || '';
        updateScoringDisplay();
      }
      
      showToast('Match loaded successfully!', 'success');
      
    } else {
      showToast(data.message || 'Failed to load match', 'error');
      console.error('API Error:', data);
    }

  } catch (err) {
    console.error('❌ Load match error:', err);
    showToast('Failed to load match. Check console for details.', 'error');
  }
}


async function setupPlayers() {
  const striker = await modal.prompt('Striker Name', 'Enter striker batsman name', 'Player 1');
  if (!striker) return;
  
  const nonStriker = await modal.prompt('Non-Striker Name', 'Enter non-striker name', 'Player 2');
  if (!nonStriker) return;
  
  const bowler = await modal.prompt('Bowler Name', 'Enter bowler name', 'Bowler 1');
  if (!bowler) return;
  
  currentMatchData.striker = { name: striker, runs: 0, balls: 0 };
  currentMatchData.nonStriker = { name: nonStriker, runs: 0, balls: 0 };
  currentMatchData.bowler = { name: bowler, runs: 0, wickets: 0, balls: 0 };
  
  updateScoringDisplay();
}

function updateScoringDisplay() {
  document.getElementById('currentRuns').textContent = currentMatchData.totalRuns;
  document.getElementById('currentWickets').textContent = currentMatchData.totalWickets;
  document.getElementById('currentOvers').textContent = 
    `${Math.floor(currentMatchData.currentBall / 6)}.${currentMatchData.currentBall % 6}`;
  
  const runRate = currentMatchData.currentBall > 0 
    ? (currentMatchData.totalRuns / (currentMatchData.currentBall / 6)).toFixed(2) 
    : '0.00';
  document.getElementById('currentRunRate').textContent = runRate;
  
  document.getElementById('strikerName').textContent = currentMatchData.striker.name;
  document.getElementById('strikerRuns').textContent = currentMatchData.striker.runs;
  document.getElementById('strikerBalls').textContent = currentMatchData.striker.balls;
  
  document.getElementById('nonStrikerName').textContent = currentMatchData.nonStriker.name;
  document.getElementById('nonStrikerRuns').textContent = currentMatchData.nonStriker.runs;
  document.getElementById('nonStrikerBalls').textContent = currentMatchData.nonStriker.balls;
  
  document.getElementById('bowlerName').textContent = currentMatchData.bowler.name;
  document.getElementById('bowlerOvers').textContent = 
    `${Math.floor(currentMatchData.bowler.balls / 6)}.${currentMatchData.bowler.balls % 6}`;
  document.getElementById('bowlerRuns').textContent = currentMatchData.bowler.runs;
  document.getElementById('bowlerWickets').textContent = currentMatchData.bowler.wickets;
  
  updateOverDisplay();
}

function updateOverDisplay() {
  const overBalls = document.getElementById('overBalls');
  if (!overBalls) return;
  
  overBalls.innerHTML = '';
  const startIndex = Math.max(0, currentMatchData.balls.length - 6);
  const lastBalls = currentMatchData.balls.slice(startIndex);
  
  lastBalls.forEach(ball => {
    const circle = document.createElement('div');
    circle.className = `ball-circle ${ball.class}`;
    circle.textContent = ball.display;
    overBalls.appendChild(circle);
  });
}

// ✅ FIXED: Record Ball with Backend Integration
// ✅ FIXED: Record Ball - Allow unlimited overs
function recordBall(runs, isExtra = false, extraType = null) {
  // Update total runs
  currentMatchData.totalRuns += runs;

  if (!isExtra || extraType === 'bye' || extraType === 'lb') {
    // Normal ball or bye/leg-bye
    currentMatchData.striker.runs += runs;
    currentMatchData.striker.balls += 1;
    currentMatchData.currentBall += 1;
    currentMatchData.bowler.balls += 1;
    currentMatchData.bowler.runs += runs;
  } else {
    // Wide or No Ball (doesn't count as valid ball)
    currentMatchData.totalRuns += 1; // Extra run
    currentMatchData.bowler.runs += runs + 1;
    // DON'T increment currentBall for wide/noball
  }

  // Create ball display
  let displayText = runs.toString();
  let ballClass = 'run';

  if (runs === 0) {
    displayText = '•';
    ballClass = 'dot';
  }
  if (runs === 4) ballClass = 'four';
  if (runs === 6) ballClass = 'six';
  if (isExtra) {
    displayText = extraType.toUpperCase();
    ballClass = 'extra';
  }

  currentMatchData.balls.push({
    display: displayText,
    class: ballClass,
    runs: runs,
    isExtra: isExtra,
    extraType: extraType
  });

  // Swap batsmen if odd runs
  if ((runs % 2) === 1) {
    swapBatsmen();
  }

  // ✅ FIX: Check for over complete (every 6 balls)
  if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
    handleOverComplete();
  }

  updateScoringDisplay();
  saveMatchScore();
}

// ✅ NEW: Send individual ball data to backend
async function sendBallToBackend(runs, isWicket, extras) {
  try {
    const token = localStorage.getItem('token');
    
    const res = await fetch(`${API_BASE}/matches/${currentMatchData.matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        runs: runs,
        isWicket: isWicket,
        extras: extras,
        batsmanName: currentMatchData.striker.name,
        bowlerName: currentMatchData.bowler.name
      })
    });

    const data = await res.json();

    if (res.ok) {
      // Check for match/inning completion
      if (data.inningsComplete) {
        await modal.alert('Innings Complete!', data.message);
        showPage('home');
        return;
      }
      
      if (data.matchComplete) {
        await modal.alert('Match Complete!', data.message);
        showPage('home');
        return;
      }
    } else {
      console.error('Backend error:', data.message);
      showToast(data.message || 'Failed to update score', 'error');
    }

  } catch (err) {
    console.error('❌ Error sending ball to backend:', err);
  }
}


// ✅ FIXED: Record Wicket
async function recordWicket() {
  const confirmed = await modal.confirm('Wicket!', 'Record a wicket?');
  if (!confirmed) return;

  currentMatchData.totalWickets += 1;
  currentMatchData.striker.balls += 1;
  currentMatchData.currentBall += 1;
  currentMatchData.bowler.wickets += 1;
  currentMatchData.bowler.balls += 1;

  currentMatchData.balls.push({
    display: 'W',
    class: 'wicket',
    runs: 0,
    isWicket: true
  });

  // Send wicket to backend
  await sendBallToBackend(0, true, null);

  // Get new batsman
  const newBatsman = await modal.prompt('New Batsman', 'Enter new batsman name', 'Player');
  if (newBatsman) {
    currentMatchData.striker = { name: newBatsman, runs: 0, balls: 0 };
  }

  updateScoringDisplay();
}


function swapBatsmen() {
  const temp = currentMatchData.striker;
  currentMatchData.striker = currentMatchData.nonStriker;
  currentMatchData.nonStriker = temp;
}

// ✅ FIXED: Handle Over Complete
async function handleOverComplete() {
  const overNumber = Math.floor(currentMatchData.currentBall / 6);
  await modal.alert('Over Complete!', `Over ${overNumber} completed`);
  
  // Swap batsmen at the end of over
  swapBatsmen();
  
  // Ask if user wants to change bowler
  const changeBowlerConfirm = await modal.confirm(
    'Change Bowler?',
    'Do you want to change the bowler for the next over?'
  );
  
  if (changeBowlerConfirm) {
    await changeBowler();
  } else {
    // Reset bowler stats for new over but keep same bowler
    currentMatchData.bowler.balls = 0;
  }
  
  // Reset current ball counter for new over
  currentMatchData.currentBall = 0;
  
  updateScoringDisplay();
}


function undoLastBall() {
  if (currentMatchData.balls.length === 0) {
    showToast('No balls to undo', 'info');
    return;
  }
  
  const lastBall = currentMatchData.balls.pop();
  currentMatchData.totalRuns -= lastBall.runs;
  
  if (!lastBall.isExtra || lastBall.extraType === 'bye' || lastBall.extraType === 'lb') {
    currentMatchData.striker.runs -= lastBall.runs;
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.balls -= 1;
  } else {
    currentMatchData.totalRuns -= 1;
  }
  
  updateScoringDisplay();
  showToast('Last ball removed', 'success');
}

// ✅ FIXED: Save Match Score
async function saveMatchScore() {
  try {
    const token = localStorage.getItem('token');
    const overs = (currentMatchData.currentBall / 6).toFixed(1);
    
    const res = await fetch(`${API_BASE}/matches/${currentMatchData.matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        runs: currentMatchData.totalRuns,
        isWicket: false,
        batsmanName: currentMatchData.striker.name,
        bowlerName: currentMatchData.bowler.name
      })
    });

    const data = await res.json();
    
    if (res.ok) {
      // Check for inning/match completion
      if (data.inningsComplete) {
        await modal.alert('Innings Complete!', data.message);
        showPage('home');
      } else if (data.matchComplete) {
        await modal.alert('Match Complete!', data.message);
        showPage('home');
      }
    } else {
      console.error('Save error:', data);
    }

  } catch (err) {
    console.error('❌ Save score error:', err);
  }
}


// ============================================
// MAIN APP
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const pages = Array.from(document.querySelectorAll(".page"));
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const ctaButtons = Array.from(document.querySelectorAll("[data-page]"));
  const navAuth = document.getElementById("navAuth");
  const navUserEmail = document.getElementById("navUserEmail");
  const navLoginLink = document.getElementById("navLogin");
  const logoutBtn = document.getElementById("logoutBtn");

  // === HELPER FUNCTIONS ===
  function isLoggedIn() {
    return !!localStorage.getItem("token");
  }

  function getCurrentUserId() {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        return user._id || user.id;
      } catch {
        return null;
      }
    }
    return null;
  }

  function setUserFromStorage() {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        navUserEmail.textContent = user.email || user.name || "";
        navAuth.style.display = "flex";
        navLoginLink.style.display = "none";
      } catch {
        navUserEmail.textContent = "";
      }
    } else {
      navAuth.style.display = "none";
      navLoginLink.style.display = "inline-block";
    }
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showToast(message = "", type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return alert(message);

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // Make showToast and showPage available globally
  window.showToast = showToast;
  
  window.showPage = function(pageId) {
    pages.forEach(p => p.style.display = p.id === pageId ? "block" : "none");
    navLinks.forEach(l => l.classList.toggle("active", l.getAttribute("data-page") === pageId));

    if (pageId === "home") loadHomePage();
    if (pageId === "book-turf") loadTurfs();
    if (pageId === "my-stats") loadUserProfile();
    if (pageId === "tournaments") loadTournaments();
    if (pageId === "host-match") loadTournamentOptions();
    if (pageId === "login" && isLoggedIn()) showPage("home");
  };

  // Initial page load
  setUserFromStorage();
  showPage("home");

  // Navigation event listeners
  [...navLinks, ...ctaButtons].forEach(el => {
    const page = el.getAttribute("data-page");
    if (page) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showPage(page);
      });
    }
  });

  // Logout
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUserFromStorage();
    showToast("Logged out", "info");
    showPage("home");
  });

  // === LOGIN FORM ===
  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) return showToast("Please fill both fields", "error");

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUserFromStorage();
        showToast("Login successful", "success");
        setTimeout(() => showPage("home"), 700);
      } else {
        showToast(data.message || "Invalid credentials", "error");
      }
    } catch (err) {
      console.error("Login error:", err);
      showToast("Server error. Try later.", "error");
    }
  });

  // === HOST MATCH FORM ===
  const hostMatchForm = document.getElementById("hostMatchForm");
  const matchTypeSelect = document.getElementById("matchType");
  const customOversGroup = document.getElementById("customOversGroup");
  const tournamentSelect = document.getElementById("tournamentSelect");

  matchTypeSelect?.addEventListener("change", () => {
    customOversGroup.style.display = matchTypeSelect.value === "Custom" ? "block" : "none";
  });

  async function loadTournamentOptions() {
    try {
      const res = await fetch(`${API_BASE}/tournaments`);
      const data = await res.json();
      if (res.ok && data.tournaments) {
        tournamentSelect.innerHTML = '<option value="">Not part of tournament</option>';
        data.tournaments.forEach(t => {
          if (t.status === "upcoming" || t.status === "ongoing") {
            tournamentSelect.innerHTML += `<option value="${t._id}">${escapeHtml(t.name)}</option>`;
          }
        });
      }
    } catch (err) {
      console.error("Failed to load tournaments:", err);
    }
  }

  hostMatchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isLoggedIn()) {
      await modal.alert("Login Required", "Please login to host a match");
      showPage("login");
      return;
    }

    const matchData = {
      matchName: document.getElementById("matchName").value.trim(),
      matchType: document.getElementById("matchType").value,
      customOvers: document.getElementById("customOvers")?.value || null,
      teamAName: document.getElementById("teamAName").value.trim(),
      teamAPlayers: document.getElementById("teamAPlayers").value.trim(),
      teamBName: document.getElementById("teamBName").value.trim(),
      teamBPlayers: document.getElementById("teamBPlayers").value.trim(),
      venue: document.getElementById("venue").value.trim(),
      matchDate: document.getElementById("matchDate").value,
      tournamentId: document.getElementById("tournamentSelect").value || null
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(matchData)
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Match created successfully! 🏏", "success");
        hostMatchForm.reset();
        setTimeout(() => showPage("home"), 1000);
      } else {
        showToast(data.message || "Failed to create match", "error");
      }
    } catch (err) {
      console.error("Match creation error:", err);
      showToast("Server error", "error");
    }
  });

  // === HOME PAGE ===
  // ✅ FIXED: Load Home Page with correct API response handling
// ✅ UPDATED: Show Recent Matches (Live + Scheduled)
async function loadHomePage() {
  const liveMatchesGrid = document.getElementById("liveMatchesGrid");
  const tournamentsGrid = document.getElementById("tournamentsGrid");
  const currentUserId = getCurrentUserId();

  // Load Recent Matches (not just live)
  try {
    const res = await fetch(`${API_BASE}/matches`);
    const data = await res.json();

    if (res.ok && data.success && data.data && data.data.length > 0) {
      liveMatchesGrid.innerHTML = "";
      
      // Show recent 5 matches (live, scheduled, or upcoming)
      const recentMatches = data.data
        .filter(m => m.status !== 'completed')
        .slice(0, 5);
      
      if (recentMatches.length > 0) {
        recentMatches.forEach(match => {
          const isCreator = match.createdBy && currentUserId && 
            (match.createdBy === currentUserId || match.createdBy._id === currentUserId);
          
          // Set badge based on status
          let statusBadge = '';
          let statusClass = '';
          
          if (match.status === 'live') {
            statusBadge = '🔴 LIVE';
            statusClass = 'live-badge';
          } else if (match.status === 'scheduled' || match.status === 'upcoming') {
            statusBadge = '📅 SCHEDULED';
            statusClass = 'scheduled-badge';
          }
          
          const card = document.createElement("div");
          card.className = `match-card ${match.status}`;
          card.innerHTML = `
            <div class="match-header">
              <span class="${statusClass}">${statusBadge}</span>
              <h3>${escapeHtml(match.matchName)}</h3>
            </div>
            <div class="match-score">
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamA.name)}</span>
                <span class="score">${match.teamA.score || 0}/${match.teamA.wickets || 0} (${match.teamA.overs || '0.0'})</span>
              </div>
              <div class="vs">vs</div>
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamB.name)}</span>
                <span class="score">${match.teamB.score || 0}/${match.teamB.wickets || 0} (${match.teamB.overs || '0.0'})</span>
              </div>
            </div>
            <div class="match-footer">
              <span>📍 ${escapeHtml(match.venue)}</span>
              <span class="match-type-badge">${escapeHtml(match.matchType)}</span>
              ${isCreator ? 
                (match.status === 'scheduled' || match.status === 'upcoming' 
                  ? `<button class="start-match-btn" data-id="${match._id}">🏏 Start Match</button>`
                  : `<button class="update-score-btn" data-id="${match._id}">📊 Update Score</button>`
                )
                : ''
              }
            </div>
          `;
          liveMatchesGrid.appendChild(card);
        });

        // Add event listeners
        document.querySelectorAll(".start-match-btn").forEach(btn => {
          btn.addEventListener("click", () => startMatch(btn.getAttribute("data-id")));
        });
        
        document.querySelectorAll(".update-score-btn").forEach(btn => {
          btn.addEventListener("click", () => openBallScoring(btn.getAttribute("data-id")));
        });
        
      } else {
        liveMatchesGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🏏</div>
            <h3>No Matches</h3>
            <p>There are no matches at the moment.</p>
            <p>Host your own match to get started!</p>
          </div>
        `;
      }
      
    } else {
      liveMatchesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏏</div>
          <h3>No Matches</h3>
          <p>There are no matches at the moment.</p>
          <p>Check back later or host your own match!</p>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading matches:", err);
    liveMatchesGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Matches</h3>
        <p>Please check your connection and try again.</p>
      </div>
    `;
  }

  // Load Tournaments (keep existing code)
  try {
    const res = await fetch(`${API_BASE}/tournaments`);
    const data = await res.json();

    if (res.ok && data.tournaments && data.tournaments.length > 0) {
      const ongoing = data.tournaments.filter(t => 
        t.status === "ongoing" || t.status === "upcoming"
      );
      
      if (ongoing.length > 0) {
        tournamentsGrid.innerHTML = "";
        
        ongoing.slice(0, 3).forEach(tournament => {
          const card = document.createElement("div");
          card.className = "tournament-card";
          card.innerHTML = `
            <div class="tournament-icon">🏆</div>
            <h3>${escapeHtml(tournament.name)}</h3>
            <p class="tournament-venue">📍 ${escapeHtml(tournament.venue)}</p>
            <p class="tournament-date">📅 ${new Date(tournament.startDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}</p>
            <p class="tournament-teams">👥 ${tournament.registeredTeams?.length || 0}/${tournament.maxTeams} teams</p>
            <span class="status-badge ${tournament.status}">${tournament.status.toUpperCase()}</span>
          `;
          tournamentsGrid.appendChild(card);
        });
        
      } else {
        tournamentsGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🏆</div>
            <h3>No Tournaments</h3>
            <p>Stay tuned for upcoming tournaments!</p>
          </div>
        `;
      }
    } else {
      tournamentsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <h3>No Tournaments</h3>
          <p>Stay tuned for upcoming tournaments!</p>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading tournaments:", err);
    tournamentsGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Tournaments</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}



  // === TOURNAMENTS PAGE ===
  async function loadTournaments() {
    const tournamentsContainer = document.getElementById("tournaments").querySelector(".container");
    tournamentsContainer.innerHTML = `
      <h2 class="section-title">🏆 Tournaments</h2>
      <div style="text-align:center; margin-bottom:20px;">
        <button id="createTournamentBtn" class="submit-btn" style="max-width:300px;">Create New Tournament</button>
      </div>
      <div id="tournamentsList"></div>
      <div id="createTournamentForm" style="display:none;"></div>
    `;

    const createTournamentBtn = document.getElementById("createTournamentBtn");
    const tournamentsList = document.getElementById("tournamentsList");
    const createTournamentFormContainer = document.getElementById("createTournamentForm");

    createTournamentBtn?.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        await modal.alert("Login Required", "Please login to create a tournament");
        showPage("login");
        return;
      }

      createTournamentFormContainer.style.display = "block";
      createTournamentFormContainer.innerHTML = `
        <div class="form-card">
          <h2 class="form-title">Create Tournament</h2>
          <form id="newTournamentForm">
            <div class="form-group">
              <label>Tournament Name</label>
              <input type="text" id="tournamentName" required />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="tournamentDesc" rows="3"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Start Date</label>
                <input type="date" id="tournamentStartDate" required />
              </div>
              <div class="form-group">
                <label>End Date</label>
                <input type="date" id="tournamentEndDate" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Venue</label>
                <input type="text" id="tournamentVenue" required />
              </div>
              <div class="form-group">
                <label>Format</label>
                <select id="tournamentFormat">
                  <option value="T20">T20</option>
                  <option value="ODI">ODI</option>
                  <option value="Test">Test</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Max Teams</label>
                <input type="number" id="tournamentMaxTeams" value="8" min="2" max="32" />
              </div>
              <div class="form-group">
                <label>Prize Pool</label>
                <input type="text" id="tournamentPrize" placeholder="e.g., ₹50,000" />
              </div>
            </div>
            <button type="submit" class="submit-btn">Create Tournament</button>
            <button type="button" id="cancelTournamentBtn" class="btn-logout" style="width:100%; margin-top:10px;">Cancel</button>
          </form>
        </div>
      `;

      document.getElementById("cancelTournamentBtn")?.addEventListener("click", () => {
        createTournamentFormContainer.style.display = "none";
      });

      document.getElementById("newTournamentForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const tournamentData = {
          name: document.getElementById("tournamentName").value.trim(),
          description: document.getElementById("tournamentDesc").value.trim(),
          startDate: document.getElementById("tournamentStartDate").value,
          endDate: document.getElementById("tournamentEndDate").value,
          venue: document.getElementById("tournamentVenue").value.trim(),
          format: document.getElementById("tournamentFormat").value,
          maxTeams: parseInt(document.getElementById("tournamentMaxTeams").value),
          prizePool: document.getElementById("tournamentPrize").value.trim() || "TBD"
        };

        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/tournaments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(tournamentData)
          });

          const data = await res.json();

          if (res.ok) {
            showToast("Tournament created successfully! 🏆", "success");
            createTournamentFormContainer.style.display = "none";
            loadTournaments();
          } else {
            showToast(data.message || "Failed to create tournament", "error");
          }
        } catch (err) {
          console.error("Tournament creation error:", err);
          showToast("Server error", "error");
        }
      });
    });

    try {
      const res = await fetch(`${API_BASE}/tournaments`);
      const data = await res.json();

      if (res.ok && data.tournaments && data.tournaments.length > 0) {
        tournamentsList.innerHTML = '<div class="tournaments-grid"></div>';
        const grid = tournamentsList.querySelector(".tournaments-grid");

        data.tournaments.forEach(tournament => {
          const card = document.createElement("div");
          card.className = "tournament-card";
          card.innerHTML = `
            <div class="tournament-header">
              <h3>🏆 ${escapeHtml(tournament.name)}</h3>
              <span class="status-badge ${tournament.status}">${tournament.status}</span>
            </div>
            <p class="tournament-desc">${escapeHtml(tournament.description || "No description")}</p>
            <div class="tournament-info">
              <p><strong>Venue:</strong> ${escapeHtml(tournament.venue)}</p>
              <p><strong>Dates:</strong> ${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()}</p>
              <p><strong>Format:</strong> ${tournament.format}</p>
              <p><strong>Teams:</strong> ${tournament.registeredTeams.length}/${tournament.maxTeams}</p>
              <p><strong>Prize:</strong> ${escapeHtml(tournament.prizePool)}</p>
            </div>
            <button class="register-btn" data-id="${tournament._id}" 
              ${tournament.registeredTeams.length >= tournament.maxTeams ? 'disabled' : ''}>
              ${tournament.registeredTeams.length >= tournament.maxTeams ? 'Tournament Full' : 'Register Team'}
            </button>
          `;
          grid.appendChild(card);
        });

        document.querySelectorAll(".register-btn").forEach(btn => {
          btn.addEventListener("click", () => registerTeamInTournament(btn.getAttribute("data-id")));
        });
      } else {
        tournamentsList.innerHTML = '<p style="text-align:center;">No tournaments available yet.</p>';
      }
    } catch (err) {
      console.error("Error loading tournaments:", err);
      tournamentsList.innerHTML = '<p style="text-align:center;">⚠️ Failed to load tournaments.</p>';
    }
  }

  async function registerTeamInTournament(tournamentId) {
    if (!isLoggedIn()) {
      await modal.alert("Login Required", "Please login to register");
      showPage("login");
      return;
    }

    const teamName = await modal.prompt("Team Registration", "Enter your team name:", "Team Name");
    if (!teamName) return showToast("Registration cancelled", "info");

    const captain = await modal.prompt("Team Captain", "Enter captain name:", "Captain Name");
    if (!captain) return showToast("Registration cancelled", "info");

    const playersStr = await modal.prompt("Team Players", "Enter player names (comma-separated):", "Player1, Player2, Player3...");
    if (!playersStr) return showToast("Registration cancelled", "info");

    const players = playersStr.split(',').map(p => p.trim()).filter(p => p);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ teamName, captain, players })
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Team registered successfully! 🎉", "success");
        loadTournaments();
      } else {
        showToast(data.message || "Registration failed", "error");
      }
    } catch (err) {
      console.error("Team registration error:", err);
      showToast("Server error", "error");
    }
  }

  // === MY STATS PAGE ===
  async function loadUserProfile() {
    const profileSection = document.getElementById("profile-section");
    const token = localStorage.getItem("token");

    if (!token) {
      profileSection.innerHTML = `
        <h2 class="section-title">My Stats</h2>
        <div class="profile-card"><p>Please login to view your stats.</p></div>
      `;
      return;
    }

    try {
      const userRes = await fetch(`${API_BASE}/users/profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!userRes.ok) throw new Error("Failed to fetch profile");

      const user = await userRes.json();
      localStorage.setItem("user", JSON.stringify(user.user || user));
      setUserFromStorage();

      const matchesRes = await fetch(`${API_BASE}/matches/user/my-matches`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      let matches = [];
      if (matchesRes.ok) {
        const matchData = await matchesRes.json();
        matches = matchData.matches || [];
      }

      const bookingsRes = await fetch(`${API_BASE}/bookings/mybookings`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      let bookings = [];
      if (bookingsRes.ok) {
        const bookingData = await bookingsRes.json();
        bookings = bookingData.bookings || [];
      }

      const userData = user.user || user;

      profileSection.innerHTML = `
        <h2 class="section-title">My Stats</h2>
        <div class="profile-card">
          <h3 style="margin-bottom:15px;">👤 ${escapeHtml(userData.name || "User")}</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <p><strong>Email:</strong> ${escapeHtml(userData.email || "-")}</p>
              <p><strong>Phone:</strong> ${escapeHtml(userData.phone || "-")}</p>
              <p><strong>Role:</strong> ${escapeHtml(userData.role || "user")}</p>
              <p><strong>Joined:</strong> ${userData.createdAt ? new Date(userData.createdAt).toDateString() : "-"}</p>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <h3 style="margin:20px 0 10px;">🏏 My Matches (${matches.length})</h3>
          <div class="matches-list">
            ${matches.length > 0 ? matches.map(m => `
              <div class="match-item">
                <h4>${escapeHtml(m.matchName)}</h4>
                <p>${escapeHtml(m.teamA.name)} vs ${escapeHtml(m.teamB.name)}</p>
                <p>📍 ${escapeHtml(m.venue)} | 📅 ${new Date(m.matchDate).toLocaleDateString()}</p>
                <span class="status-badge ${m.status.toLowerCase()}">${m.status.toUpperCase()}</span>
                ${(m.status.toLowerCase() === 'upcoming' || m.status.toLowerCase() === 'scheduled') ? `<button class="start-match-btn" data-id="${m._id}">Start Match</button>` : ''}
                ${m.status.toLowerCase() === 'live' ? `
                  <button class="update-score-btn" data-id="${m._id}">Update Score</button>
                  <button class="complete-match-btn" data-id="${m._id}">Complete Match</button>
                ` : ''}
              </div>
            `).join('') : '<p>No matches hosted yet.</p>'}
          </div>
        </div>

        <div class="stats-section">
          <h3 style="margin:20px 0 10px;">📅 My Bookings (${bookings.length})</h3>
          <div class="bookings-list">
            ${bookings.length > 0 ? bookings.map(b => `
              <div class="booking-item">
                <h4>${escapeHtml(b.turf?.name || "Turf")}</h4>
                <p>📍 ${escapeHtml(b.turf?.location || "-")}</p>
                <p>📅 ${b.date} | ⏰ ${b.startTime} - ${b.endTime}</p>
                <p>💰 ₹${b.totalPrice}</p>
                <span class="status-badge ${b.status}">${b.status}</span>
              </div>
            `).join('') : '<p>No bookings yet.</p>'}
          </div>
        </div>

        <div style="margin-top:20px; text-align:center;">
          <button id="profileLogoutBtn" class="submit-btn" style="max-width:200px;">Logout</button>
        </div>
      `;

      document.querySelectorAll(".start-match-btn").forEach(btn => {
        btn.addEventListener("click", () => startMatch(btn.getAttribute("data-id")));
      });

      document.querySelectorAll(".update-score-btn").forEach(btn => {
        btn.addEventListener("click", () => openBallScoring(btn.getAttribute("data-id")));
      });

      document.querySelectorAll(".complete-match-btn").forEach(btn => {
        btn.addEventListener("click", () => completeMatch(btn.getAttribute("data-id")));
      });

      document.getElementById("profileLogoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUserFromStorage();
        showToast("Logged out", "info");
        showPage("home");
      });

    } catch (err) {
      console.error("Profile load error:", err);
      profileSection.innerHTML = `
        <h2 class="section-title">My Stats</h2>
        <div class="profile-card"><p>Could not load profile. Please try again later.</p></div>
      `;
    }
  }

  // ✅ FIXED: Start Match function
async function startMatch(matchId) {
  if (!isLoggedIn()) {
    await modal.alert('Login Required', 'Please login to start a match');
    showPage('login');
    return;
  }

  const confirmed = await modal.confirm(
    'Start Match',
    'Are you sure you want to start this match? This will open the scoring interface.'
  );

  if (!confirmed) return;

  try {
    const token = localStorage.getItem('token');
    
    // First, set match status to live
    const res = await fetch(`${API_BASE}/matches/${matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'live',
        teamA: { score: 0, wickets: 0, overs: '0.0' },
        teamB: { score: 0, wickets: 0, overs: '0.0' }
      })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Match started! Opening scoring interface...', 'success');
      
      // Open ball-by-ball scoring after 1 second
      setTimeout(() => {
        openBallScoring(matchId);
      }, 1000);
    } else {
      showToast(data.message || 'Failed to start match', 'error');
    }

  } catch (err) {
    console.error('Start match error:', err);
    showToast('Server error', 'error');
  }
}


  async function completeMatch(matchId) {
    const confirmed = await modal.confirm(
      "Complete Match",
      "Are you sure you want to mark this match as completed? This action cannot be undone."
    );
    
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/matches/${matchId}/complete`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Match completed! 🏆", "success");
        loadUserProfile();
      } else {
        showToast(data.message || "Failed to complete match", "error");
      }
    } catch (err) {
      console.error("Complete match error:", err);
      showToast("Server error", "error");
    }
  }

  // === BOOK TURF ===
  async function loadTurfs() {
    const turfListEl = document.getElementById("turfList");
    if (!turfListEl) return;

    turfListEl.innerHTML = "<p>Loading turfs...</p>";

    try {
      const res = await fetch(`${API_BASE}/turfs`);
      const data = await res.json();

      if (!res.ok) throw new Error("Failed to load turfs");

      if (!Array.isArray(data) || data.length === 0) {
        turfListEl.innerHTML = `<p>No turfs available.</p>`;
        return;
      }

      turfListEl.innerHTML = "";
      data.forEach(turf => {
        const card = document.createElement("div");
        card.className = "turf-card";
        card.innerHTML = `
          <div class="turf-info">
            <h3 class="turf-name">${escapeHtml(turf.name || "Turf")}</h3>
            <p class="turf-location">📍 ${escapeHtml(turf.location || "Unknown")}</p>
            <p class="turf-price">💰 ₹${turf.pricePerHour || "0"}/hr</p>
          </div>
          <div>
            <button class="book-btn" data-id="${turf._id}" data-name="${escapeHtml(turf.name)}">Book</button>
          </div>
        `;
        turfListEl.appendChild(card);
      });

      turfListEl.querySelectorAll(".book-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const turfId = btn.getAttribute("data-id");
          const turfName = btn.getAttribute("data-name");
          bookTurf(turfId, turfName);
        });
      });

    } catch (err) {
      console.error("Load turfs error:", err);
      turfListEl.innerHTML = `<p>Failed to load turfs.</p>`;
    }
  }

  async function bookTurf(turfId, turfName) {
    const date = await modal.prompt(
      "Book Turf", 
      `Enter booking date for ${turfName}`,
      "YYYY-MM-DD"
    );
    if (!date) return showToast("Booking cancelled", "info");

    const startTime = await modal.prompt(
      "Start Time",
      "Enter start time",
      "e.g., 18:00"
    );
    if (!startTime) return showToast("Booking cancelled", "info");

    const endTime = await modal.prompt(
      "End Time",
      "Enter end time",
      "e.g., 19:00"
    );
    if (!endTime) return showToast("Booking cancelled", "info");

    const token = localStorage.getItem("token");
    if (!token) {
      await modal.alert("Login Required", "Please login to book a turf");
      showPage("login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ turfId, date, startTime, endTime })
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Booking successful! 🎉", "success");
      } else {
        showToast(data.message || "Booking failed", "error");
      }
    } catch (err) {
      console.error("Booking error:", err);
      showToast("Server error while booking", "error");
    }
  }

  // === BALL SCORING EVENT LISTENERS ===
  document.getElementById('backToHome')?.addEventListener('click', () => {
    showPage('home');
  });

  document.querySelectorAll('.run-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const runs = parseInt(btn.getAttribute('data-runs'));
      recordBall(runs, false, null);
    });
  });

  document.querySelectorAll('.extra-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const extraType = btn.getAttribute('data-extra');
      recordBall(0, true, extraType);
    });
  });

  document.getElementById('wicketBtn')?.addEventListener('click', recordWicket);
  document.getElementById('undoBtn')?.addEventListener('click', undoLastBall);
});
// ✅ NEW: Change Striker
async function changeStriker() {
  const newStriker = await modal.prompt('Change Striker', 'Enter new striker name', currentMatchData.striker.name);
  if (newStriker && newStriker.trim()) {
    currentMatchData.striker = {
      name: newStriker.trim(),
      runs: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Striker changed to ' + newStriker, 'success');
  }
}

// ✅ NEW: Change Non-Striker
async function changeNonStriker() {
  const newNonStriker = await modal.prompt('Change Non-Striker', 'Enter new non-striker name', currentMatchData.nonStriker.name);
  if (newNonStriker && newNonStriker.trim()) {
    currentMatchData.nonStriker = {
      name: newNonStriker.trim(),
      runs: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Non-striker changed to ' + newNonStriker, 'success');
  }
}

// ✅ NEW: Change Bowler
async function changeBowler() {
  const newBowler = await modal.prompt('Change Bowler', 'Enter new bowler name', currentMatchData.bowler.name);
  if (newBowler && newBowler.trim()) {
    currentMatchData.bowler = {
      name: newBowler.trim(),
      runs: 0,
      wickets: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Bowler changed to ' + newBowler, 'success');
  }
}

// ✅ NEW: Manual Swap Batsmen
function manualSwapBatsmen() {
  swapBatsmen();
  updateScoringDisplay();
  showToast('Batsmen swapped', 'info');
}

// ✅ ADD EVENT LISTENERS for new buttons
document.getElementById('changeStrikerBtn')?.addEventListener('click', changeStriker);
document.getElementById('changeNonStrikerBtn')?.addEventListener('click', changeNonStriker);
document.getElementById('changeBowlerBtn')?.addEventListener('click', changeBowler);
document.getElementById('swapBatsmenBtn')?.addEventListener('click', manualSwapBatsmen);
