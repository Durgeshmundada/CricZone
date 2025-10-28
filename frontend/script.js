// script.js – Complete CricZone Frontend
console.log("✅ CricZone script.js loaded");

const API_BASE = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {
  const pages = Array.from(document.querySelectorAll(".page"));
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const ctaButtons = Array.from(document.querySelectorAll("[data-page]"));
  const navAuth = document.getElementById("navAuth");
  const navUserEmail = document.getElementById("navUserEmail");
  const navLoginLink = document.getElementById("navLogin");
  const logoutBtn = document.getElementById("logoutBtn");

  // === PAGE NAVIGATION ===
  function showPage(pageId) {
    pages.forEach(p => p.style.display = p.id === pageId ? "block" : "none");
    navLinks.forEach(l => l.classList.toggle("active", l.getAttribute("data-page") === pageId));

    // Load data based on page
    if (pageId === "home") loadHomePage();
    if (pageId === "book-turf") loadTurfs();
    if (pageId === "my-stats") loadUserProfile();
    if (pageId === "tournaments") loadTournaments();
    if (pageId === "login" && isLoggedIn()) showPage("home");
  }

  showPage("home");

  // Attach navigation
  [...navLinks, ...ctaButtons].forEach(el => {
    const page = el.getAttribute("data-page");
    if (page) el.addEventListener("click", (e) => { e.preventDefault(); showPage(page); });
  });

  // === AUTH FUNCTIONS ===
  function isLoggedIn() {
    return !!localStorage.getItem("token");
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

  setUserFromStorage();

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

  // Show/hide custom overs
  matchTypeSelect?.addEventListener("change", () => {
    customOversGroup.style.display = matchTypeSelect.value === "Custom" ? "block" : "none";
  });

  // Load tournaments into dropdown
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

  loadTournamentOptions();

  hostMatchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!isLoggedIn()) {
      showToast("Please login to host a match", "error");
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

  // === HOME PAGE - Load Live Matches ===
  async function loadHomePage() {
    const liveMatchesGrid = document.getElementById("liveMatchesGrid");
    const tournamentsGrid = document.getElementById("tournamentsGrid");

    // Load live matches
    try {
      const res = await fetch(`${API_BASE}/matches/live`);
      const data = await res.json();
      
      if (res.ok && data.matches && data.matches.length > 0) {
        liveMatchesGrid.innerHTML = "";
        data.matches.forEach(match => {
          const card = document.createElement("div");
          card.className = "match-card live";
          card.innerHTML = `
            <div class="match-header">
              <span class="live-badge">🔴 LIVE</span>
              <h3>${escapeHtml(match.matchName)}</h3>
            </div>
            <div class="match-score">
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamA.name)}</span>
                <span class="score">${match.teamA.score}/${match.teamA.wickets} (${match.teamA.overs})</span>
              </div>
              <div class="vs">vs</div>
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamB.name)}</span>
                <span class="score">${match.teamB.score}/${match.teamB.wickets} (${match.teamB.overs})</span>
              </div>
            </div>
            <div class="match-footer">
              <span>📍 ${escapeHtml(match.venue)}</span>
            </div>
          `;
          liveMatchesGrid.appendChild(card);
        });
      } else {
        liveMatchesGrid.innerHTML = '<p style="text-align:center;">No live matches at the moment.</p>';
      }
    } catch (err) {
      console.error("Error loading live matches:", err);
      liveMatchesGrid.innerHTML = '<p style="text-align:center;">Failed to load matches.</p>';
    }

    // Load ongoing tournaments
    try {
      const res = await fetch(`${API_BASE}/tournaments`);
      const data = await res.json();
      
      if (res.ok && data.tournaments) {
        const ongoing = data.tournaments.filter(t => t.status === "ongoing" || t.status === "upcoming");
        
        if (ongoing.length > 0) {
          tournamentsGrid.innerHTML = "";
          ongoing.slice(0, 3).forEach(tournament => {
            const card = document.createElement("div");
            card.className = "tournament-card";
            card.innerHTML = `
              <h3>🏆 ${escapeHtml(tournament.name)}</h3>
              <p>📍 ${escapeHtml(tournament.venue)}</p>
              <p>📅 ${new Date(tournament.startDate).toLocaleDateString()}</p>
              <p>👥 ${tournament.registeredTeams.length}/${tournament.maxTeams} teams</p>
              <span class="status-badge ${tournament.status}">${tournament.status.toUpperCase()}</span>
            `;
            tournamentsGrid.appendChild(card);
          });
        } else {
          tournamentsGrid.innerHTML = '<p style="text-align:center;">Stay tuned for tournaments!</p>';
        }
      }
    } catch (err) {
      console.error("Error loading tournaments:", err);
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

    // Show create tournament form
    createTournamentBtn?.addEventListener("click", () => {
      if (!isLoggedIn()) {
        showToast("Please login to create a tournament", "error");
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

    // Load all tournaments
    try {
      const res = await fetch(`${API_BASE}/tournaments`);
      const data = await res.json();
      
      if (res.ok && data.tournaments && data.tournaments.length > 0) {
        tournamentsList.innerHTML = '<div class="tournaments-grid"></div>';
        const grid = tournamentsList.querySelector(".tournaments-grid");
        
        data.tournaments.forEach(tournament => {
          const card = document.createElement("div");
          card.className = "tournament-card-detailed";
          card.innerHTML = `
            <div class="tournament-header">
              <h3>🏆 ${escapeHtml(tournament.name)}</h3>
              <span class="status-badge ${tournament.status}">${tournament.status}</span>
            </div>
            <p class="tournament-desc">${escapeHtml(tournament.description || "No description")}</p>
            <div class="tournament-info">
              <p>📍 <strong>Venue:</strong> ${escapeHtml(tournament.venue)}</p>
              <p>📅 <strong>Dates:</strong> ${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()}</p>
              <p>🎯 <strong>Format:</strong> ${tournament.format}</p>
              <p>👥 <strong>Teams:</strong> ${tournament.registeredTeams.length}/${tournament.maxTeams}</p>
              <p>💰 <strong>Prize:</strong> ${escapeHtml(tournament.prizePool)}</p>
            </div>
            <button class="register-btn" data-id="${tournament._id}" ${tournament.registeredTeams.length >= tournament.maxTeams ? 'disabled' : ''}>
              ${tournament.registeredTeams.length >= tournament.maxTeams ? 'Tournament Full' : 'Register Team'}
            </button>
          `;
          grid.appendChild(card);
        });

        // Attach register buttons
        document.querySelectorAll(".register-btn").forEach(btn => {
          btn.addEventListener("click", () => registerTeamInTournament(btn.getAttribute("data-id")));
        });
      } else {
        tournamentsList.innerHTML = '<p style="text-align:center;">No tournaments available yet.</p>';
      }
    } catch (err) {
      console.error("Error loading tournaments:", err);
      tournamentsList.innerHTML = '<p style="text-align:center;">Failed to load tournaments.</p>';
    }
  }

  // Register team in tournament
  async function registerTeamInTournament(tournamentId) {
    if (!isLoggedIn()) {
      showToast("Please login to register", "error");
      showPage("login");
      return;
    }

    const teamName = prompt("Enter your team name:");
    const captain = prompt("Enter captain name:");
    const playersStr = prompt("Enter player names (comma-separated):");

    if (!teamName || !captain || !playersStr) {
      showToast("Registration cancelled", "info");
      return;
    }

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
        <h2 class="section-title">📈 My Stats</h2>
        <div class="profile-card"><p>Please login to view your stats.</p></div>
      `;
      return;
    }

    try {
      // Fetch user profile
      const userRes = await fetch(`${API_BASE}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!userRes.ok) throw new Error("Failed to fetch profile");
      
      const user = await userRes.json();
      localStorage.setItem("user", JSON.stringify(user.user || user));
      setUserFromStorage();

      // Fetch user's matches
      const matchesRes = await fetch(`${API_BASE}/matches/user/my-matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let matches = [];
      if (matchesRes.ok) {
        const matchData = await matchesRes.json();
        matches = matchData.matches || [];
      }

      // Fetch user's bookings
      const bookingsRes = await fetch(`${API_BASE}/bookings/mybookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let bookings = [];
      if (bookingsRes.ok) {
        const bookingData = await bookingsRes.json();
        bookings = bookingData.bookings || [];
      }

      const userData = user.user || user;

      profileSection.innerHTML = `
        <h2 class="section-title">📈 My Stats</h2>
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
                <span class="status-badge ${m.status}">${m.status}</span>
              </div>
            `).join('') : '<p>No matches hosted yet.</p>'}
          </div>
        </div>

        <div class="stats-section">
          <h3 style="margin:20px 0 10px;">🌿 My Bookings (${bookings.length})</h3>
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
        <h2 class="section-title">📈 My Stats</h2>
        <div class="profile-card"><p>Could not load profile. Please try again later.</p></div>
      `;
    }
  }

  // === BOOK TURF ===
  async function loadTurfs() {
    const turfListEl = document.getElementById("turfList");
    if (!turfListEl) return;

    turfListEl.innerHTML = `<p>Loading turfs...</p>`;

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
            <button class="book-btn" data-id="${turf._id || ""}" data-name="${escapeHtml(turf.name || "")}">Book</button>
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
    const date = prompt(`Enter booking date for ${turfName} (YYYY-MM-DD):`);
    const startTime = prompt("Start time (e.g. 18:00):");
    const endTime = prompt("End time (e.g. 19:00):");

    if (!date || !startTime || !endTime) {
      showToast("Booking cancelled", "info");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("Please login to book", "error");
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
        showToast("Booking successful", "success");
      } else {
        showToast(data.message || "Booking failed", "error");
      }
    } catch (err) {
      console.error("Booking error:", err);
      showToast("Server error while booking", "error");
    }
  }

  // === HELPERS ===
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
});