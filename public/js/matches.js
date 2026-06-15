function toCsvCell(value) {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildFallbackMatchReportCsv(match = {}) {
  const rows = [];
  const teamA = match.teamA || {};
  const teamB = match.teamB || {};
  const scoreA = teamA.score || {};
  const scoreB = teamB.score || {};
  const teamAOvers = Number.isFinite(Number(teamA.ballsPlayed))
    ? formatOversFromBallsRaw(Number(teamA.ballsPlayed))
    : String(scoreA.overs || teamA.overs || "0.0");
  const teamBOvers = Number.isFinite(Number(teamB.ballsPlayed))
    ? formatOversFromBallsRaw(Number(teamB.ballsPlayed))
    : String(scoreB.overs || teamB.overs || "0.0");

  rows.push(["field", "value"]);
  rows.push(["match_id", match._id || ""]);
  rows.push(["match_name", match.matchName || ""]);
  rows.push(["match_type", match.matchType || ""]);
  rows.push(["venue", match.venue || ""]);
  rows.push(["match_date", match.matchDate ? new Date(match.matchDate).toISOString() : ""]);
  rows.push(["status", match.status || ""]);
  rows.push(["result", match.result || ""]);
  rows.push(["winner", match.winner || ""]);
  rows.push(["team_a", teamA.name || "Team A"]);
  rows.push(["team_a_score", `${Number(teamA.score || scoreA.runs || 0)}/${Number(teamA.wickets || scoreA.wickets || 0)} (${teamAOvers} ov)`]);
  rows.push(["team_b", teamB.name || "Team B"]);
  rows.push(["team_b_score", `${Number(teamB.score || scoreB.runs || 0)}/${Number(teamB.wickets || scoreB.wickets || 0)} (${teamBOvers} ov)`]);

  rows.push([]);
  rows.push(["batsman", "team", "runs", "balls", "fours", "sixes", "out", "dismissal"]);
  (match.batsmanStats || []).forEach((row) => {
    rows.push([
      row.playerName || row.name || "",
      row.team || "",
      Number(row.runs || 0),
      Number(row.ballsFaced || 0),
      Number(row.fours || 0),
      Number(row.sixes || 0),
      row.isOut ? "yes" : "no",
      row.dismissalType || ""
    ]);
  });

  rows.push([]);
  rows.push(["bowler", "team", "overs", "maidens", "runs", "wickets", "economy"]);
  (match.bowlerStats || []).forEach((row) => {
    rows.push([
      row.playerName || row.name || "",
      row.team || "",
      formatOversFromBallsRaw(Number(row.balls || 0)),
      Number(row.maidens || 0),
      Number(row.runs || 0),
      Number(row.wickets || 0),
      Number(row.economy || 0).toFixed(2)
    ]);
  });

  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
}

function downloadBlobAsFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadMatchReport(matchId) {
  if (!matchId) return;

  try {
    const response = await fetch(`${API_BASE}/matches/${matchId}/report?format=csv`);
    if (response.ok) {
      const blob = await response.blob();
      downloadBlobAsFile(blob, `match-report-${matchId}.csv`);
      return;
    }

    const payload = await readResponsePayload(response);
    const message = String(payload?.json?.message || payload?.text || "");
    const missingReportRoute = response.status === 404 && /route not found/i.test(message);
    if (!missingReportRoute) {
      throw new Error(getReadableResponseError(response, payload, "Failed to download report"));
    }

    const fallbackResponse = await fetch(`${API_BASE}/matches/${matchId}`);
    const fallbackPayload = await readResponsePayload(fallbackResponse);
    if (!fallbackResponse.ok || !fallbackPayload?.json?.success || !fallbackPayload?.json?.data) {
      throw new Error(getReadableResponseError(fallbackResponse, fallbackPayload, "Report unavailable on current backend"));
    }

    const csv = buildFallbackMatchReportCsv(fallbackPayload.json.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlobAsFile(blob, `match-report-${matchId}.csv`);
    showToast("Downloaded fallback report. Backend update recommended.", "info");
  } catch (error) {
    console.error("Download report error:", error);
    showToast(error.message || "Failed to download report", "error");
  }
}

function formatWicketDismissalText(dismissal) {
  if (!dismissal || !dismissal.kind) return 'Not out';
  const kind = String(dismissal.kind || '').replace(/_/g, ' ');
  const bowlerName = String(dismissal.bowlerName || '').trim();
  const fielderName = String(dismissal.fielderName || '').trim();

  if ((kind === 'caught' || kind === 'caught and bowled') && bowlerName) {
    return fielderName ? `${kind} ${fielderName} b ${bowlerName}` : `${kind} b ${bowlerName}`;
  }
  if (kind === 'run out' && fielderName) {
    return `${kind} (${fielderName})`;
  }
  if (bowlerName) {
    return `${kind} b ${bowlerName}`;
  }
  return kind;
}

function isLoggedIn() {
  const token = localStorage.getItem("token");
  const expiry = token ? readJwtExpiry(token) : null;
  if (expiry && expiry * 1000 <= Date.now()) {
    clearStoredSession("Your session expired. Please log in again.");
    return false;
  }
  return Boolean(token);
}

function getCurrentUserRole() {
  const userJson = localStorage.getItem("user");
  if (!userJson) return "";
  try {
    const user = JSON.parse(userJson);
    return String(user.role || "").toLowerCase();
  } catch (_error) {
    return "";
  }
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
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  const navAuth = document.getElementById("navAuth");
  const navUserEmail = document.getElementById("navUserEmail");
  const navLoginLink = document.getElementById("navLogin");
  
  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      navUserEmail.textContent = user.email || '';
      navAuth.style.display = 'flex';
      navLoginLink.style.display = 'none';
    } catch {
      navAuth.style.display = 'none';
      navLoginLink.style.display = 'block';
    }
  } else {
    navAuth.style.display = 'none';
    navLoginLink.style.display = 'block';
  }
}

function closeNavMenu() {
  const navMenu = document.getElementById("navMenu");
  const menuToggle = document.getElementById("menuToggle");
  if (!navMenu || !menuToggle) return;

  navMenu.classList.remove("active", "open");
  menuToggle.classList.remove("is-active");
  menuToggle.setAttribute("aria-expanded", "false");
  navMenu.querySelector('.nav-menu-close')?.style.setProperty('display', 'none');
  if (window.matchMedia('(max-width: 768px)').matches) {
    navMenu.setAttribute('aria-hidden', 'true');
    navMenu.setAttribute('inert', '');
  }
}

function setupMobileNavigation() {
  const navMenu = document.getElementById("navMenu");
  const menuToggle = document.getElementById("menuToggle");

  if (!navMenu || !menuToggle) return;

  // Add close button for mobile menu if not present
  let closeBtn = navMenu.querySelector('.nav-menu-close');
  if (!closeBtn) {
    closeBtn = document.createElement('button');
    closeBtn.className = 'nav-menu-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close navigation');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.display = 'none';
    navMenu.insertBefore(closeBtn, navMenu.firstChild);
  }

  function setMenuActive(active) {
    navMenu.classList.toggle('active', active);
    menuToggle.classList.toggle('is-active', active);
    menuToggle.setAttribute('aria-expanded', active ? 'true' : 'false');
    closeBtn.style.display = active ? 'block' : 'none';
    navMenu.toggleAttribute('inert', !active);
    navMenu.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function syncMenuForViewport() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setMenuActive(false);
    } else {
      navMenu.classList.remove('active', 'open');
      navMenu.removeAttribute('inert');
      navMenu.removeAttribute('aria-hidden');
      menuToggle.classList.remove('is-active');
      menuToggle.setAttribute('aria-expanded', 'false');
      closeBtn.style.display = 'none';
    }
  }

  menuToggle.addEventListener('click', () => {
    const nextActive = !navMenu.classList.contains('active');
    setMenuActive(nextActive);
  });

  closeBtn.addEventListener('click', () => setMenuActive(false));

  // Only close menu on outside click if menu is open and on mobile
  document.addEventListener('click', (event) => {
    if (!navMenu.classList.contains('active')) return;
    const clickedInsideMenu = navMenu.contains(event.target) || menuToggle.contains(event.target);
    if (!clickedInsideMenu) setMenuActive(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navMenu.classList.contains('active')) {
      event.preventDefault();
      setMenuActive(false);
      menuToggle.focus();
    }
  });

  window.addEventListener('resize', syncMenuForViewport);
  syncMenuForViewport();
}

function animatePageReveal(pageElement) {
  if (!pageElement) return;
  revealTimeouts.forEach(clearTimeout);
  revealTimeouts = [];

  const revealNodes = pageElement.querySelectorAll(".reveal");
  revealNodes.forEach((node, index) => {
    node.classList.remove("visible");
    const delay = Math.min(index * 90, 500);
    const timeoutId = setTimeout(() => node.classList.add("visible"), delay);
    revealTimeouts.push(timeoutId);
  });
}

function updateHomeMetrics(matchesInput, tournamentsInput) {
  if (Array.isArray(matchesInput)) {
    homeSnapshot.matches = matchesInput;
  }
  if (Array.isArray(tournamentsInput)) {
    homeSnapshot.tournaments = tournamentsInput;
  }

  const matches = homeSnapshot.matches;
  const tournaments = homeSnapshot.tournaments;
  const liveMatches = matches.filter((match) => match.status === "live").length;
  const upcomingMatches = matches.filter((match) => ["scheduled", "upcoming"].includes(match.status)).length;
  const activeTournaments = tournaments.filter((tournament) =>
    ["ongoing", "upcoming", "registration_open", "registration_closed", "playoffs"].includes(tournament.status)
  ).length;

  const counters = {
    liveMatchesCount: liveMatches,
    upcomingMatchesCount: upcomingMatches,
    activeTournamentsCount: activeTournaments
  };

  Object.entries(counters).forEach(([id, count]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(count);
  });
}

function showPage(pageId) {  
  window.scrollTo(0, 0);
  document.body.classList.toggle('scoring-mode', pageId === 'ball-scoring');
  
  const pages = document.querySelectorAll(".page");
  const targetPage = document.getElementById(pageId);
  const activeElement = document.activeElement;
  const activePage = activeElement instanceof Element ? activeElement.closest(".page") : null;

  if (activePage && activePage !== targetPage && activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  pages.forEach((page) => {
    page.style.display = 'none';
    page.setAttribute('aria-hidden', 'true');
    page.setAttribute('inert', '');
  });
  
  if (targetPage) {
    targetPage.style.display = 'block';
    targetPage.setAttribute('aria-hidden', 'false');
    targetPage.removeAttribute('inert');
    targetPage.classList.remove("page-enter");
    // Trigger reflow so animation restarts whenever a page is shown.
    void targetPage.offsetWidth;
    targetPage.classList.add("page-enter");
    animatePageReveal(targetPage);

    const pageHeading = targetPage.querySelector("h1");
    if (pageHeading instanceof HTMLElement) {
      pageHeading.setAttribute("tabindex", "-1");
      pageHeading.focus({ preventScroll: true });
    }
  }
  
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(l => {
    l.classList.remove('active');
    l.removeAttribute('aria-current');
    if (l.getAttribute("data-page") === pageId) {
      l.classList.add('active');
      l.setAttribute('aria-current', 'page');
    }
  });
  closeNavMenu();
  
  if (pageId === "home") {
    const liveMatchesGrid = document.getElementById('liveMatchesGrid');
    if (liveMatchesGrid) liveMatchesGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    loadHomePage();
  }
  if (pageId === "book-turf") loadTurfs();
  if (pageId === "my-stats") loadUserProfile();
  if (pageId === "my-matches") {
    const myMatchesGrid = document.getElementById('myMatchesGrid');
    if (myMatchesGrid) myMatchesGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    loadMyMatches();
  }
  if (pageId === "players") loadPlayers();
  if (pageId === "billing") loadBillingDashboard();
  if (pageId === "host-match") {
    loadTournamentOptions();
    loadHostTeams();
  }
  if (pageId === "teams") {
    loadHostTeams();
    loadTeamInvitations();
    searchTeamPlayerSuggestions();
  }
}

window.showPage = showPage;

// ============================================
// BALL BY BALL SCORING SYSTEM
// ============================================
let currentMatchData = {
  matchId: null,
  currentBall: 0,
  totalRuns: 0,
  totalWickets: 0,
  balls: [],
  currentInning: 1,
  battingTeamKey: 'teamA',
  battingOptions: [],
  bowlingOptions: [],
  striker: { id: null, name: '', runs: 0, balls: 0 },
  nonStriker: { id: null, name: '', runs: 0, balls: 0 },
  bowler: { id: null, name: '', runs: 0, wickets: 0, balls: 0 }
};
let scoreSaveQueue = Promise.resolve();

function setScoringSaveStatus(message, state = 'idle') {
  const status = document.getElementById('scoringSaveStatus');
  if (!status) return;

  status.textContent = message;
  status.dataset.state = state;
}

function setScoringControlsDisabled(disabled) {
  const scoringPage = document.getElementById('ball-scoring');
  if (!scoringPage) return;

  scoringPage.dataset.scoringReady = disabled ? 'false' : 'true';
  scoringPage.querySelectorAll(
    '.run-btn, .extra-btn, .wicket-btn, .undo-btn, .change-player-btn, .swap-batsmen-btn, .end-innings-btn'
  ).forEach((button) => {
    button.disabled = disabled;
  });

  if (!disabled) {
    const undoButton = document.getElementById('undoBtn');
    if (undoButton) undoButton.disabled = currentMatchData.balls.length === 0;
  }
}

const normalizePlayerOption = (player) => {
  if (!player) return null;
  const name = String(player.name || player.playerName || '').trim();
  if (!name) return null;
  const id = player.userId || player.playerId || player.id || null;

  return {
    id: id ? String(id) : null,
    name,
    email: String(player.email || '').trim().toLowerCase(),
    isRegistered: Boolean(player.isRegistered && id)
  };
};

const buildTeamPlayerOptions = (team = {}) => {
  const linked = Array.isArray(team.playerLinks)
    ? team.playerLinks.map(normalizePlayerOption).filter(Boolean)
    : [];

  if (linked.length > 0) return linked;

  if (!Array.isArray(team.players)) return [];

  return team.players
    .map((name) => normalizePlayerOption({ name, isRegistered: false }))
    .filter(Boolean);
};

const findOptionByName = (options, name) => {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) return null;
  return options.find((option) => String(option.name || '').toLowerCase() === normalizedName) || null;
};

const findOptionById = (options, id) => {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  return options.find((option) => String(option.id || '') === normalizedId) || null;
};

function renderSquadHints() {
  const battingHint = document.getElementById('battingSquadHint');
  const bowlingHint = document.getElementById('bowlingSquadHint');

  if (battingHint) {
    battingHint.textContent = currentMatchData.battingOptions.length > 0
      ? `Batting options: ${currentMatchData.battingOptions.map((p) => p.name).join(', ')}`
      : 'Batting options: not provided for this match';
  }

  if (bowlingHint) {
    bowlingHint.textContent = currentMatchData.bowlingOptions.length > 0
      ? `Bowling options: ${currentMatchData.bowlingOptions.map((p) => p.name).join(', ')}`
      : 'Bowling options: not provided for this match';
  }
}

function renderDetailedScoreboard(match) {
  const batsmanBody = document.getElementById('batsmanStatsBody');
  const bowlerBody = document.getElementById('bowlerStatsBody');
  const fowList = document.getElementById('fallOfWicketsList');
  const tossInfo = document.getElementById('tossInfo');
  const inningsInfo = document.getElementById('inningsInfo');
  const targetInfo = document.getElementById('targetInfo');

  if (!match || !batsmanBody || !bowlerBody || !fowList) return;

  const inningNumber = Number(match.currentInning || 1);
  const inningKey = inningNumber === 1 ? 'first' : 'second';
  const inning = match.innings?.[inningKey] || {};
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';
  const battingTeamLabel = inning.battingTeam === 'teamB' ? teamBName : teamAName;
  const bowlingTeamLabel = inning.bowlingTeam === 'teamB' ? teamBName : teamAName;
  const tossWinner = String(match.toss?.winner || '').trim();
  const tossDecision = String(match.toss?.decision || '').trim();
  const targetValue = Number(inning.target || 0);

  if (tossInfo) {
    tossInfo.textContent = tossWinner && tossDecision
      ? `Toss: ${tossWinner} chose to ${tossDecision}`
      : 'Toss: not set';
  }
  if (inningsInfo) {
    inningsInfo.textContent = `Innings: ${inningNumber === 1 ? '1st' : '2nd'} (${battingTeamLabel} batting vs ${bowlingTeamLabel})`;
  }
  if (targetInfo) {
    targetInfo.textContent = targetValue > 0
      ? `Target: ${targetValue} | CRR: ${Number(inning.runRate || 0).toFixed(2)} | RRR: ${Number(inning.requiredRunRate || 0).toFixed(2)}`
      : `Target: N/A | CRR: ${Number(inning.runRate || 0).toFixed(2)}`;
  }

  const batsmen = Array.isArray(match.batsmanStats)
    ? match.batsmanStats.filter((item) => Number(item?.inning) === inningNumber)
    : [];
  batsmanBody.innerHTML = '';
  if (batsmen.length === 0) {
    batsmanBody.innerHTML = '<tr><td colspan="7">No batting data yet.</td></tr>';
  } else {
    batsmen.forEach((stats) => {
      const row = document.createElement('tr');
      const dismissalText = formatWicketDismissalText(stats.dismissal);
      row.innerHTML = `
        <td>${escapeHtml(stats.name || '-')}</td>
        <td>${Number(stats.runs || 0)}</td>
        <td>${Number(stats.ballsFaced || 0)}</td>
        <td>${Number(stats.fours || 0)}</td>
        <td>${Number(stats.sixes || 0)}</td>
        <td>${Number(stats.strikeRate || 0).toFixed(2)}</td>
        <td>${escapeHtml(stats.isOut ? dismissalText : 'Not out')}</td>
      `;
      batsmanBody.appendChild(row);
    });
  }

  const bowlers = Array.isArray(match.bowlerStats)
    ? match.bowlerStats.filter((item) => Number(item?.inning) === inningNumber)
    : [];
  bowlerBody.innerHTML = '';
  if (bowlers.length === 0) {
    bowlerBody.innerHTML = '<tr><td colspan="7">No bowling data yet.</td></tr>';
  } else {
    bowlers.forEach((stats) => {
      const row = document.createElement('tr');
      const balls = Number(stats.balls || 0);
      row.innerHTML = `
        <td>${escapeHtml(stats.name || '-')}</td>
        <td>${escapeHtml(formatOversFromBallsRaw(balls))}</td>
        <td>${Number(stats.runs || 0)}</td>
        <td>${Number(stats.wickets || 0)}</td>
        <td>${Number(stats.economy || 0).toFixed(2)}</td>
        <td>${Number(stats.wides || 0)}</td>
        <td>${Number(stats.noBalls || 0)}</td>
      `;
      bowlerBody.appendChild(row);
    });
  }

  const fallOfWickets = Array.isArray(match.fallOfWickets)
    ? match.fallOfWickets.filter((item) => Number(item?.inning) === inningNumber)
    : [];
  fowList.innerHTML = '';
  if (fallOfWickets.length === 0) {
    fowList.innerHTML = '<li>No wickets yet.</li>';
  } else {
    fallOfWickets.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${Number(item.wicketNumber || 0)}-${String(item.playerOut || 'Player')} (${Number(item.score || 0)} @ ${String(item.overs || '0.0')})`;
      fowList.appendChild(li);
    });
  }
}

async function selectPlayerFromOptions(title, message, options, fallbackPlaceholder = 'Player') {
  if (!Array.isArray(options) || options.length === 0) {
    const typedName = await modal.prompt(title, message, fallbackPlaceholder);
    if (!typedName) return null;
    return { id: null, name: typedName.trim() };
  }

  const shortlist = options.slice(0, 12);
  const optionsText = shortlist
    .map((player, index) => `${index + 1}. ${player.name}`)
    .join('\n');

  const promptMessage = `${message}\n\nType player number or exact name:\n${optionsText}`;
  const typedValue = await modal.prompt(title, promptMessage, shortlist[0].name);
  if (!typedValue) return null;

  const asNumber = Number.parseInt(typedValue, 10);
  if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= shortlist.length) {
    const picked = shortlist[asNumber - 1];
    return { id: picked.id || null, name: picked.name };
  }

  const byName = findOptionByName(options, typedValue);
  if (byName) {
    return { id: byName.id || null, name: byName.name };
  }

  return { id: null, name: typedValue.trim() };
}

function openBallScoring(matchId) {
  const token = localStorage.getItem('token');
  if (!token) {
    modal.alert('Login Required', 'Please login to score matches');
    return;
  }
  
  currentMatchData = {
    matchId: matchId,
    currentBall: 0,
    totalRuns: 0,
    totalWickets: 0,
    balls: [],
    currentInning: 1,
    battingTeamKey: 'teamA',
    battingOptions: [],
    bowlingOptions: [],
    striker: { id: null, name: '', runs: 0, balls: 0 },
    nonStriker: { id: null, name: '', runs: 0, balls: 0 },
    bowler: { id: null, name: '', runs: 0, wickets: 0, balls: 0 }
  };

  const scoringPage = document.getElementById('ball-scoring');
  if (scoringPage) scoringPage.setAttribute('aria-busy', 'true');
  const matchName = document.getElementById('scoringMatchName');
  const battingTeamName = document.getElementById('teamBattingName');
  if (matchName) matchName.textContent = 'Loading match...';
  if (battingTeamName) battingTeamName.textContent = 'Batting team';
  setScoringControlsDisabled(true);
  setScoringSaveStatus('Loading scorecard...', 'saving');
  updateScoringDisplay();
  
  loadMatchForScoring(matchId);
  window.showPage('ball-scoring');
}

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
      const match = data.data || data.match || data;
      
      if (!match) {
        setScoringSaveStatus('Match data could not be loaded', 'error');
        showToast('Match data not found', 'error');
        return;
      }

      const inningNumber = match.currentInning || 1;
      const inningKey = inningNumber === 1 ? 'first' : 'second';
      const battingTeamKey = match.innings?.[inningKey]?.battingTeam || 'teamA';
      const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';
      const battingTeam = battingTeamKey === 'teamB' ? match.teamB : match.teamA;
      const bowlingTeam = bowlingTeamKey === 'teamB' ? match.teamB : match.teamA;
      const battingOptions = buildTeamPlayerOptions(battingTeam);
      const bowlingOptions = buildTeamPlayerOptions(bowlingTeam);

      currentMatchData.battingTeamKey = battingTeamKey;
      currentMatchData.currentInning = Number(inningNumber);
      currentMatchData.battingOptions = battingOptions;
      currentMatchData.bowlingOptions = bowlingOptions;

      document.getElementById('scoringMatchName').textContent = match.matchName || 'Match';
      document.getElementById('teamBattingName').textContent = battingTeam?.name || 'Batting Team';
      
      currentMatchData.totalRuns = battingTeam?.score || 0;
      currentMatchData.totalWickets = battingTeam?.wickets || 0;
      
      const oversStr = battingTeam?.overs || '0.0';
      const [completedOvers, ballsInOver] = oversStr.split('.').map(Number);
      currentMatchData.currentBall = (completedOvers * 6) + (ballsInOver || 0);
      const inningsBalls = Array.isArray(match.ballByBallData)
        ? match.ballByBallData
          .filter((ball) => Number(ball?.inning) === Number(inningNumber) && !ball?.isReverted)
          .sort((a, b) => Number(a?.ballNumber || 0) - Number(b?.ballNumber || 0))
        : [];
      const extraTypeMap = { wide: 'wd', noball: 'nb', bye: 'bye', legbye: 'lb' };
      currentMatchData.balls = inningsBalls.map((ball) => {
        const extraType = extraTypeMap[ball?.extras?.type] || null;
        const isExtra = Boolean(extraType);
        const totalRuns = Number(ball?.totalRuns ?? ball?.runs ?? 0);
        const batsmanRuns = Number(ball?.batsmanRuns ?? ball?.runs ?? 0);
        const extrasRuns = Number(ball?.extras?.runs ?? Math.max(totalRuns - batsmanRuns, 0));

        let display = String(totalRuns);
        let cssClass = 'run';
        if (Boolean(ball?.isWicket)) {
          display = 'W';
          cssClass = 'wicket';
        } else if (isExtra) {
          const shortLabel = extraType === 'bye'
            ? 'BYE'
            : (extraType === 'lb' ? 'LB' : extraType.toUpperCase());
          display = totalRuns > 1 ? `${shortLabel}${totalRuns}` : shortLabel;
          cssClass = 'extra';
        } else if (batsmanRuns === 0) {
          display = '.';
          cssClass = 'dot';
        } else if (batsmanRuns === 4) {
          cssClass = 'four';
        } else if (batsmanRuns === 6) {
          cssClass = 'six';
        }

        return {
          display,
          class: cssClass,
          runs: totalRuns,
          batsmanRuns,
          extrasRuns,
          isExtra,
          extraType,
          isWicket: Boolean(ball?.isWicket),
          strikerName: ball?.batsmanName || '',
          strikerId: ball?.batsmanId || null,
          nonStrikerName: ball?.nonStrikerName || '',
          nonStrikerId: null,
          bowlerName: ball?.bowlerName || '',
          bowlerId: ball?.bowlerId || null,
          wicketPlayerName: ball?.wicket?.playerOutName || ball?.batsmanName || '',
          wicketPlayerId: ball?.wicket?.playerOutId || null,
          wicketKind: ball?.wicket?.kind || null
        };
      });
      renderSquadHints();
      
      updateScoringDisplay();
      
      if (match.status === 'scheduled' || match.status === 'upcoming' ||
          (!match.currentStriker && !match.currentBatsman) ||
          !match.currentBowler) {
        await setupPlayers(match);
      } else {
        const inningBatsmanStats = Array.isArray(match.batsmanStats)
          ? match.batsmanStats.filter((stats) => Number(stats?.inning) === Number(inningNumber))
          : [];
        const inningBowlerStats = Array.isArray(match.bowlerStats)
          ? match.bowlerStats.filter((stats) => Number(stats?.inning) === Number(inningNumber))
          : [];
        const findBatsmanStats = (name, id) => inningBatsmanStats.find((stats) =>
          (id && String(stats?.playerId || '') === String(id)) ||
          (String(stats?.name || '').toLowerCase() === String(name || '').toLowerCase())
        );
        const findBowlerStats = (name, id) => inningBowlerStats.find((stats) =>
          (id && String(stats?.playerId || '') === String(id)) ||
          (String(stats?.name || '').toLowerCase() === String(name || '').toLowerCase())
        );

        const currentStriker = match.currentStriker || match.currentBatsman || '';
        const strikerOption = findOptionByName(battingOptions, currentStriker) || findOptionById(battingOptions, match.currentStrikerId);
        const strikerStats = findBatsmanStats(currentStriker || strikerOption?.name, match.currentStrikerId || strikerOption?.id);
        currentMatchData.striker = {
          id: match.currentStrikerId || strikerOption?.id || null,
          name: currentStriker || strikerOption?.name || '',
          runs: Number(strikerStats?.runs || 0),
          balls: Number(strikerStats?.ballsFaced || 0)
        };

        const currentNonStriker = match.currentNonStriker || '';
        const nonStrikerOption = findOptionByName(battingOptions, currentNonStriker) || findOptionById(battingOptions, match.currentNonStrikerId);
        const nonStrikerStats = findBatsmanStats(currentNonStriker || nonStrikerOption?.name, match.currentNonStrikerId || nonStrikerOption?.id);
        currentMatchData.nonStriker = {
          id: match.currentNonStrikerId || nonStrikerOption?.id || null,
          name: currentNonStriker || nonStrikerOption?.name || '',
          runs: Number(nonStrikerStats?.runs || 0),
          balls: Number(nonStrikerStats?.ballsFaced || 0)
        };

        const currentBowler = match.currentBowler || '';
        const bowlerOption = findOptionByName(bowlingOptions, currentBowler) || findOptionById(bowlingOptions, match.currentBowlerId);
        const bowlerStats = findBowlerStats(currentBowler || bowlerOption?.name, match.currentBowlerId || bowlerOption?.id);
        currentMatchData.bowler = {
          id: match.currentBowlerId || bowlerOption?.id || null,
          name: currentBowler || bowlerOption?.name || '',
          runs: Number(bowlerStats?.runs || 0),
          wickets: Number(bowlerStats?.wickets || 0),
          balls: Number(bowlerStats?.balls || 0)
        };
        updateScoringDisplay();
      }
      renderDetailedScoreboard(match);
      setScoringControlsDisabled(false);
      setScoringSaveStatus('Ready - score saves automatically', 'saved');
      
      showToast('Match loaded successfully!', 'success');
      
    } else {
      setScoringSaveStatus('Match data could not be loaded', 'error');
      showToast(data.message || 'Failed to load match', 'error');
    }

  } catch (err) {
    console.error('Load match error:', err);
    setScoringSaveStatus('Match data could not be loaded', 'error');
    showToast('Failed to load match', 'error');
  } finally {
    const scoringPage = document.getElementById('ball-scoring');
    if (scoringPage) scoringPage.setAttribute('aria-busy', 'false');
  }
}

async function setupPlayers(_match) {
  const [defaultStriker, defaultNonStriker] = currentMatchData.battingOptions;
  const defaultBowler = currentMatchData.bowlingOptions[0];

  if (defaultStriker) {
    currentMatchData.striker = {
      id: defaultStriker.id || null,
      name: defaultStriker.name,
      runs: 0,
      balls: 0
    };
  } else {
    const striker = await selectPlayerFromOptions(
      'Striker Name',
      'Enter striker batsman name.',
      currentMatchData.battingOptions,
      'Player 1'
    );
    if (!striker) return;
    currentMatchData.striker = { id: striker.id || null, name: striker.name, runs: 0, balls: 0 };
  }

  if (defaultNonStriker && defaultNonStriker.name !== currentMatchData.striker.name) {
    currentMatchData.nonStriker = {
      id: defaultNonStriker.id || null,
      name: defaultNonStriker.name,
      runs: 0,
      balls: 0
    };
  } else {
    const nonStriker = await selectPlayerFromOptions(
      'Non-Striker Name',
      'Enter non-striker batsman name.',
      currentMatchData.battingOptions.filter((player) => player.name !== currentMatchData.striker.name),
      'Player 2'
    );
    if (!nonStriker) return;
    currentMatchData.nonStriker = { id: nonStriker.id || null, name: nonStriker.name, runs: 0, balls: 0 };
  }

  if (defaultBowler) {
    currentMatchData.bowler = {
      id: defaultBowler.id || null,
      name: defaultBowler.name,
      runs: 0,
      wickets: 0,
      balls: 0
    };
  } else {
    const bowler = await selectPlayerFromOptions(
      'Bowler Name',
      'Enter bowler name.',
      currentMatchData.bowlingOptions,
      'Bowler 1'
    );
    if (!bowler) return;
    currentMatchData.bowler = { id: bowler.id || null, name: bowler.name, runs: 0, wickets: 0, balls: 0 };
  }

  updateScoringDisplay();
  saveMatchScore();
}

function updateScoringDisplay() {
  document.getElementById('currentRuns').textContent = currentMatchData.totalRuns;
  document.getElementById('currentWickets').textContent = currentMatchData.totalWickets;
  document.getElementById('currentOvers').textContent =
    formatOversFromBallCount(currentMatchData.currentBall);
  
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
    formatOversFromBallCount(currentMatchData.bowler.balls);
  document.getElementById('bowlerRuns').textContent = currentMatchData.bowler.runs;
  document.getElementById('bowlerWickets').textContent = currentMatchData.bowler.wickets;

  const scoreDisplay = document.querySelector('#ball-scoring .score-display');
  if (scoreDisplay) {
    scoreDisplay.setAttribute(
      'aria-label',
      `${currentMatchData.totalRuns} runs for ${currentMatchData.totalWickets} wickets`
    );
  }

  const scoringPage = document.getElementById('ball-scoring');
  const undoButton = document.getElementById('undoBtn');
  if (undoButton) {
    undoButton.disabled = scoringPage?.dataset.scoringReady !== 'true' || currentMatchData.balls.length === 0;
  }
  
  updateOverDisplay();
}

function updateOverDisplay() {
  const overBalls = document.getElementById('overBalls');
  if (!overBalls) return;
  
  overBalls.innerHTML = '';
  const completedOvers = [];
  let activeOver = [];
  let legalBalls = 0;

  currentMatchData.balls.forEach((ball) => {
    activeOver.push(ball);
    const isIllegalExtra = ball?.isExtra && (ball.extraType === 'wd' || ball.extraType === 'nb');
    if (!isIllegalExtra) legalBalls += 1;

    if (legalBalls === 6) {
      completedOvers.push(activeOver);
      activeOver = [];
      legalBalls = 0;
    }
  });

  const displayedBalls = activeOver.length > 0
    ? activeOver
    : (completedOvers[completedOvers.length - 1] || []);

  if (displayedBalls.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'over-empty';
    empty.textContent = 'No deliveries yet';
    overBalls.appendChild(empty);
    return;
  }

  displayedBalls.forEach((ball, index) => {
    const circle = document.createElement('div');
    circle.className = `ball-circle ${ball.class}`;
    circle.textContent = ball.display;
    circle.setAttribute('role', 'listitem');
    circle.setAttribute('aria-label', `Delivery ${index + 1}: ${ball.display}`);
    overBalls.appendChild(circle);
  });
}

async function promptExtraRuns(extraType) {
  const normalized = String(extraType || '').toLowerCase();
  const label = normalized === 'wd'
    ? 'Wide'
    : (normalized === 'nb' ? 'No Ball' : (normalized === 'bye' ? 'Bye' : 'Leg Bye'));
  const rawInput = await modal.prompt(
    `${label} Runs`,
    `Enter total runs for this ${label} ball (including the automatic extra run for wide/no-ball).`,
    '1'
  );
  if (rawInput === null) return null;

  const runs = Number.parseInt(String(rawInput).trim(), 10);
  const maxRuns = (normalized === 'wd' || normalized === 'nb') ? 7 : 6;
  if (!Number.isFinite(runs) || runs < 1 || runs > maxRuns) {
    await modal.alert('Invalid Runs', `Please enter a number between 1 and ${maxRuns}.`);
    return null;
  }

  if ((normalized === 'wd' || normalized === 'nb') && runs < 1) {
    await modal.alert('Invalid Runs', 'Wide/No Ball must add at least 1 run.');
    return null;
  }

  return runs;
}

function recordBall(runs, isExtra = false, extraType = null) {
  const totalRuns = Math.max(0, Number.parseInt(runs, 10) || 0);
  const preState = {
    totalRuns: currentMatchData.totalRuns,
    totalWickets: currentMatchData.totalWickets,
    currentBall: currentMatchData.currentBall,
    striker: { ...currentMatchData.striker },
    nonStriker: { ...currentMatchData.nonStriker },
    bowler: { ...currentMatchData.bowler }
  };

  const deliverySnapshot = {
    striker: { ...currentMatchData.striker },
    nonStriker: { ...currentMatchData.nonStriker },
    bowler: { ...currentMatchData.bowler }
  };

  const normalizedExtra = String(extraType || '').toLowerCase();
  const isWideOrNoBall = isExtra && (normalizedExtra === 'wd' || normalizedExtra === 'nb');
  const isByeOrLegBye = isExtra && (normalizedExtra === 'bye' || normalizedExtra === 'lb');
  let batsmanRuns = 0;
  let extrasRuns = 0;

  if (isWideOrNoBall) {
    extrasRuns = totalRuns;
    currentMatchData.totalRuns += totalRuns;
    currentMatchData.bowler.runs += totalRuns;

    if (normalizedExtra === 'nb') {
      batsmanRuns = Math.max(totalRuns - 1, 0);
      currentMatchData.striker.runs += batsmanRuns;
      if ((batsmanRuns % 2) === 1) swapBatsmen();
    } else if (totalRuns > 1 && ((totalRuns - 1) % 2) === 1) {
      swapBatsmen();
    }
  } else if (isByeOrLegBye) {
    extrasRuns = totalRuns;
    currentMatchData.totalRuns += totalRuns;
    currentMatchData.striker.balls += 1;
    currentMatchData.currentBall += 1;
    currentMatchData.bowler.balls += 1;
    if ((totalRuns % 2) === 1) {
      swapBatsmen();
    }
    if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
      handleOverComplete();
    }
  } else {
    batsmanRuns = totalRuns;
    currentMatchData.totalRuns += totalRuns;
    currentMatchData.striker.runs += totalRuns;
    currentMatchData.striker.balls += 1;
    currentMatchData.currentBall += 1;
    currentMatchData.bowler.balls += 1;
    currentMatchData.bowler.runs += totalRuns;
    
    if ((totalRuns % 2) === 1) {
      swapBatsmen();
    }
    
    if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
      handleOverComplete();
    }
  }

  let displayText = totalRuns.toString();
  let ballClass = 'run';

  if (totalRuns === 0) {
    displayText = '.';
    ballClass = 'dot';
  }
  if (totalRuns === 4) ballClass = 'four';
  if (totalRuns === 6) ballClass = 'six';
  if (isExtra) {
    const shortLabel = normalizedExtra === 'bye'
      ? 'BYE'
      : (normalizedExtra === 'lb' ? 'LB' : normalizedExtra.toUpperCase());
    displayText = totalRuns > 1 ? `${shortLabel}${totalRuns}` : shortLabel;
    ballClass = 'extra';
  }

  currentMatchData.balls.push({
    display: displayText,
    class: ballClass,
    runs: totalRuns,
    batsmanRuns,
    extrasRuns,
    isExtra: isExtra,
    extraType: extraType,
    isWicket: false,
    strikerName: deliverySnapshot.striker.name,
    strikerId: deliverySnapshot.striker.id || null,
    nonStrikerName: deliverySnapshot.nonStriker.name,
    nonStrikerId: deliverySnapshot.nonStriker.id || null,
    bowlerName: deliverySnapshot.bowler.name,
    bowlerId: deliverySnapshot.bowler.id || null,
    wicketPlayerName: null,
    wicketPlayerId: null,
    wicketKind: null,
    preState
  });

  updateScoringDisplay();
  saveMatchScore();
}

async function recordWicket() {
  const confirmed = await modal.confirm('Wicket!', 'Record a wicket?');
  if (!confirmed) return;

  const preState = {
    totalRuns: currentMatchData.totalRuns,
    totalWickets: currentMatchData.totalWickets,
    currentBall: currentMatchData.currentBall,
    striker: { ...currentMatchData.striker },
    nonStriker: { ...currentMatchData.nonStriker },
    bowler: { ...currentMatchData.bowler }
  };

  const wicketSnapshot = {
    striker: { ...currentMatchData.striker },
    nonStriker: { ...currentMatchData.nonStriker },
    bowler: { ...currentMatchData.bowler }
  };

  currentMatchData.totalWickets += 1;
  currentMatchData.striker.balls += 1;
  currentMatchData.currentBall += 1;
  currentMatchData.bowler.wickets += 1;
  currentMatchData.bowler.balls += 1;

  const unavailableNames = [currentMatchData.striker.name, currentMatchData.nonStriker.name]
    .map((name) => String(name || '').trim().toLowerCase())
    .filter(Boolean);
  const availableBatters = currentMatchData.battingOptions.filter(
    (player) => !unavailableNames.includes(String(player.name || '').trim().toLowerCase())
  );

  const newBatsman = await selectPlayerFromOptions(
    'New Batsman',
    'Select or enter the incoming batsman.',
    availableBatters,
    'Player'
  );
  if (newBatsman) {
    currentMatchData.striker = { id: newBatsman.id || null, name: newBatsman.name, runs: 0, balls: 0 };
  }

  currentMatchData.balls.push({
    display: 'W',
    class: 'wicket',
    runs: 0,
    isExtra: false,
    extraType: null,
    isWicket: true,
    strikerName: wicketSnapshot.striker.name,
    strikerId: wicketSnapshot.striker.id || null,
    nonStrikerName: wicketSnapshot.nonStriker.name,
    nonStrikerId: wicketSnapshot.nonStriker.id || null,
    bowlerName: wicketSnapshot.bowler.name,
    bowlerId: wicketSnapshot.bowler.id || null,
    wicketPlayerName: wicketSnapshot.striker.name,
    wicketPlayerId: wicketSnapshot.striker.id || null,
    wicketKind: 'bowled',
    preState
  });

  if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
    await handleOverComplete();
  }

  updateScoringDisplay();
  saveMatchScore();
}

function swapBatsmen() {
  const temp = currentMatchData.striker;
  currentMatchData.striker = currentMatchData.nonStriker;
  currentMatchData.nonStriker = temp;
}

async function handleOverComplete() {
  const overNumber = Math.floor(currentMatchData.currentBall / 6);
  await modal.alert('Over Complete!', `Over ${overNumber} completed`);
  
  swapBatsmen();
  
  const changeBowlerConfirm = await modal.confirm(
    'Change Bowler?',
    'Do you want to change the bowler for the next over?'
  );
  
  if (changeBowlerConfirm) {
    await changeBowler();
  }
  
  updateScoringDisplay();
}

function undoLastBall() {
  if (currentMatchData.balls.length === 0) {
    showToast('No balls to undo', 'info');
    return;
  }
  
  const lastBall = currentMatchData.balls.pop();

  if (lastBall?.preState) {
    currentMatchData.totalRuns = Number(lastBall.preState.totalRuns || 0);
    currentMatchData.totalWickets = Number(lastBall.preState.totalWickets || 0);
    currentMatchData.currentBall = Number(lastBall.preState.currentBall || 0);
    currentMatchData.striker = { ...(lastBall.preState.striker || { id: null, name: '', runs: 0, balls: 0 }) };
    currentMatchData.nonStriker = { ...(lastBall.preState.nonStriker || { id: null, name: '', runs: 0, balls: 0 }) };
    currentMatchData.bowler = { ...(lastBall.preState.bowler || { id: null, name: '', runs: 0, wickets: 0, balls: 0 }) };

    updateScoringDisplay();
    showToast('Last ball removed', 'success');
    saveMatchScore();
    return;
  }
  
  if (lastBall.isWicket) {
    currentMatchData.totalWickets -= 1;
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.wickets -= 1;
    currentMatchData.bowler.balls -= 1;
  }
  else if (lastBall.isExtra && (lastBall.extraType === 'bye' || lastBall.extraType === 'lb')) {
    currentMatchData.totalRuns -= Number(lastBall.runs || 0);
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.balls -= 1;
    if ((Number(lastBall.runs || 0) % 2) === 1) {
      swapBatsmen();
    }
  }
  else if (lastBall.isExtra && (lastBall.extraType === 'wd' || lastBall.extraType === 'nb')) {
    const totalRuns = Number(lastBall.runs || 0);
    const batsmanRuns = Number(
      lastBall.batsmanRuns !== undefined && lastBall.batsmanRuns !== null
        ? lastBall.batsmanRuns
        : Math.max(totalRuns - 1, 0)
    );
    currentMatchData.totalRuns -= totalRuns;
    currentMatchData.bowler.runs -= totalRuns;
    if (lastBall.extraType === 'nb') {
      currentMatchData.striker.runs -= batsmanRuns;
      if ((batsmanRuns % 2) === 1) {
        swapBatsmen();
      }
    } else if (totalRuns > 1 && ((totalRuns - 1) % 2) === 1) {
      swapBatsmen();
    }
  }
  else {
    const totalRuns = Number(lastBall.runs || 0);
    currentMatchData.totalRuns -= totalRuns;
    currentMatchData.striker.runs -= totalRuns;
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.balls -= 1;
    currentMatchData.bowler.runs -= totalRuns;
    if ((totalRuns % 2) === 1) {
      swapBatsmen();
    }
  }
  
  updateScoringDisplay();
  showToast('Last ball removed', 'success');
  saveMatchScore();
}

function buildCurrentScorePayload() {
  return {
    mode: 'absolute',
    runs: currentMatchData.totalRuns,
    wickets: currentMatchData.totalWickets,
    overs: formatOversFromBallCount(currentMatchData.currentBall),
    batsmanName: currentMatchData.striker.name,
    batsmanId: currentMatchData.striker.id || null,
    nonStrikerName: currentMatchData.nonStriker.name,
    nonStrikerId: currentMatchData.nonStriker.id || null,
    bowlerName: currentMatchData.bowler.name,
    bowlerId: currentMatchData.bowler.id || null,
    ballEvents: currentMatchData.balls.map((ball) => ({
      runs: Number(ball?.runs || 0),
      isExtra: Boolean(ball?.isExtra),
      extraType: ball?.extraType || null,
      isWicket: Boolean(ball?.isWicket),
      strikerName: ball?.strikerName || '',
      strikerId: ball?.strikerId || null,
      nonStrikerName: ball?.nonStrikerName || '',
      nonStrikerId: ball?.nonStrikerId || null,
      bowlerName: ball?.bowlerName || '',
      bowlerId: ball?.bowlerId || null,
      wicketPlayerName: ball?.wicketPlayerName || null,
      wicketPlayerId: ball?.wicketPlayerId || null,
      wicketKind: ball?.wicketKind || null
    })),
    status: 'live'
  };
}

function saveMatchScore() {
  const token = localStorage.getItem('token');
  const matchId = currentMatchData.matchId;
  if (!token || !matchId) return Promise.resolve();

  const scorePayload = buildCurrentScorePayload();
  setScoringSaveStatus('Saving score...', 'saving');
  scoreSaveQueue = scoreSaveQueue
    .catch(() => undefined)
    .then(() => {
      if (currentMatchData.matchId === matchId) {
        setScoringSaveStatus('Saving score...', 'saving');
      }
      return persistMatchScore(matchId, token, scorePayload);
    });

  return scoreSaveQueue;
}

async function persistMatchScore(matchId, token, scorePayload) {
  try {
    const res = await fetch(`${API_BASE}/matches/${matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(scorePayload)
    });

    const data = await res.json();
    
    if (res.ok) {
      if (currentMatchData.matchId === matchId) {
        setScoringSaveStatus('Saved just now', 'saved');
      }
      if (data?.data && currentMatchData.matchId === matchId) {
        renderDetailedScoreboard(data.data);
      }
      if (data.inningsComplete) {
        await modal.alert('Innings Complete!', data.message);
        window.showPage('home');
      } else if (data.matchComplete) {
        await modal.alert('Match Complete!', data.message);
        window.showPage('home');
      }
    } else if (currentMatchData.matchId === matchId) {
      setScoringSaveStatus(data.message || 'Score could not be saved', 'error');
      return { ok: false };
    }

    return {
      ok: res.ok,
      inningsComplete: Boolean(data.inningsComplete),
      matchComplete: Boolean(data.matchComplete)
    };

  } catch (err) {
    console.error('Save score error:', err);
    if (currentMatchData.matchId === matchId) {
      setScoringSaveStatus('Score could not be saved', 'error');
    }
    return { ok: false };
  }
}

async function endCurrentInnings() {
  const matchId = currentMatchData.matchId;
  const token = localStorage.getItem('token');
  if (!matchId || !token) return;

  const isFirstInnings = Number(currentMatchData.currentInning || 1) === 1;
  const title = isFirstInnings ? 'End first innings?' : 'End second innings?';
  const consequence = isFirstInnings
    ? `This will lock the score at ${currentMatchData.totalRuns}/${currentMatchData.totalWickets} and set the chase target to ${currentMatchData.totalRuns + 1}.`
    : `This will lock the score at ${currentMatchData.totalRuns}/${currentMatchData.totalWickets} and complete the match.`;
  const confirmed = await modal.confirm(title, `${consequence}\n\nThis action cannot be undone.`);
  if (!confirmed) return;

  setScoringControlsDisabled(true);
  setScoringSaveStatus('Saving final innings score...', 'saving');

  const saveResult = await saveMatchScore();
  if (!saveResult?.ok) {
    setScoringControlsDisabled(false);
    await modal.alert('Could Not End Innings', 'The latest score could not be saved. Check your connection and try again.');
    return;
  }
  if (saveResult.inningsComplete || saveResult.matchComplete) return;

  try {
    setScoringSaveStatus('Ending innings...', 'saving');
    const response = await fetch(`${API_BASE}/matches/${matchId}/innings/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: '{}'
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to end innings');
    }

    if (data.matchComplete) {
      await modal.alert('Match Complete', data.message || 'The match has been completed.');
      window.showPage('home');
      return;
    }

    const target = Number(data.data?.innings?.second?.target || (currentMatchData.totalRuns + 1));
    await modal.alert('Innings Complete', `First innings closed. The target is ${target}.`);
    await loadMatchForScoring(matchId);
  } catch (error) {
    console.error('End innings error:', error);
    setScoringSaveStatus(error.message || 'Could not end innings', 'error');
    setScoringControlsDisabled(false);
    await modal.alert('Could Not End Innings', error.message || 'Please try again.');
  }
}

async function changeStriker() {
  const availableBatters = currentMatchData.battingOptions.filter(
    (player) => String(player.name || '').toLowerCase() !== String(currentMatchData.nonStriker.name || '').toLowerCase()
  );
  const newStriker = await selectPlayerFromOptions(
    'Change Striker',
    'Select or enter the new striker.',
    availableBatters,
    currentMatchData.striker.name || 'Player'
  );
  if (newStriker && newStriker.name.trim()) {
    currentMatchData.striker = {
      id: newStriker.id || null,
      name: newStriker.name.trim(),
      runs: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Striker changed to ' + newStriker.name, 'success');
  }
}

async function changeNonStriker() {
  const availableBatters = currentMatchData.battingOptions.filter(
    (player) => String(player.name || '').toLowerCase() !== String(currentMatchData.striker.name || '').toLowerCase()
  );
  const newNonStriker = await selectPlayerFromOptions(
    'Change Non-Striker',
    'Select or enter the new non-striker.',
    availableBatters,
    currentMatchData.nonStriker.name || 'Player'
  );
  if (newNonStriker && newNonStriker.name.trim()) {
    currentMatchData.nonStriker = {
      id: newNonStriker.id || null,
      name: newNonStriker.name.trim(),
      runs: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Non-striker changed to ' + newNonStriker.name, 'success');
  }
}

async function changeBowler() {
  const newBowler = await selectPlayerFromOptions(
    'Change Bowler',
    'Select or enter the new bowler.',
    currentMatchData.bowlingOptions,
    currentMatchData.bowler.name || 'Bowler'
  );
  if (newBowler && newBowler.name.trim()) {
    currentMatchData.bowler = {
      id: newBowler.id || null,
      name: newBowler.name.trim(),
      runs: 0,
      wickets: 0,
      balls: 0
    };
    updateScoringDisplay();
    showToast('Bowler changed to ' + newBowler.name, 'success');
  }
}

function manualSwapBatsmen() {
  swapBatsmen();
  updateScoringDisplay();
  showToast('Batsmen swapped', 'info');
}
// ============================================
// HOME PAGE
// ============================================
async function loadHomePage() {
  const liveMatchesGrid = document.getElementById("liveMatchesGrid");
  const tournamentsGrid = document.getElementById("tournamentsGrid");
  const currentUserId = getCurrentUserId();
  let allMatches = [];
  let allTournaments = [];

  try {
    const res = await fetch(`${API_BASE}/matches`);
    const data = await res.json();

    if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
      allMatches = data.data;
      liveMatchesGrid.innerHTML = "";

      const recentMatches = allMatches.filter((match) => match.status !== "completed").slice(0, 5);

      if (recentMatches.length > 0) {
        recentMatches.forEach((match) => {
          const isCreator = match.createdBy && currentUserId &&
            (match.createdBy === currentUserId || match.createdBy._id === currentUserId);

          let statusBadge = "UPCOMING";
          let statusClass = "scheduled-badge";
          if (match.status === "live") {
            statusBadge = "LIVE";
            statusClass = "live-badge";
          }

          const card = document.createElement("div");
          card.className = `match-card ${safeCssToken(match.status, "scheduled")}`;
          card.innerHTML = `
            <div class="match-header">
              <span class="${statusClass}">${statusBadge}</span>
              <h3>${escapeHtml(match.matchName || "Untitled Match")}</h3>
            </div>
            <div class="match-score">
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamA?.name || "Team A")}</span>
                <span class="score">${match.teamA?.score || 0}/${match.teamA?.wickets || 0} (${match.teamA?.overs || "0.0"})</span>
              </div>
              <div class="vs">vs</div>
              <div class="team">
                <span class="team-name">${escapeHtml(match.teamB?.name || "Team B")}</span>
                <span class="score">${match.teamB?.score || 0}/${match.teamB?.wickets || 0} (${match.teamB?.overs || "0.0"})</span>
              </div>
            </div>
            <div class="match-footer">
              <span>Venue: ${escapeHtml(match.venue || "Not specified")}</span>
              ${isCreator
                ? ((match.status === "scheduled" || match.status === "upcoming")
                  ? `<button class="start-match-btn" data-id="${escapeHtml(safeObjectId(match._id))}">Start Match</button>`
                  : `<button class="update-score-btn" data-id="${escapeHtml(safeObjectId(match._id))}">Update Score</button>`)
                : ""}
            </div>
          `;
          liveMatchesGrid.appendChild(card);
        });

        document.querySelectorAll(".start-match-btn").forEach((btn) => {
          btn.addEventListener("click", () => startMatch(btn.getAttribute("data-id")));
        });

        document.querySelectorAll(".update-score-btn").forEach((btn) => {
          btn.addEventListener("click", () => openBallScoring(btn.getAttribute("data-id")));
        });
      } else {
        liveMatchesGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">M</div>
            <h3>No Matches</h3>
            <p>There are no matches at the moment.</p>
            <p>Host your own match to get started.</p>
          </div>
        `;
      }
    } else {
      liveMatchesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">M</div>
          <h3>No Matches</h3>
          <p>There are no matches at the moment.</p>
        </div>
      `;
    }
    updateHomeMetrics(allMatches, null);
  } catch (err) {
    console.error("Error loading matches:", err);
    liveMatchesGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h3>Failed to Load Matches</h3>
        <p>Please check your connection and backend API URL.</p>
        <p><strong>API:</strong> ${escapeHtml(API_BASE || "Not configured")}</p>
        ${renderApiFixAction()}
      </div>
    `;
    updateHomeMetrics([], null);
  }

  try {
    const res = await fetch(`${API_BASE}/tournaments`);
    const data = await res.json();

    if (res.ok && Array.isArray(data.tournaments) && data.tournaments.length > 0) {
      allTournaments = data.tournaments;
      const ongoing = allTournaments.filter((t) =>
        ["ongoing", "upcoming", "registration_open", "registration_closed", "playoffs"].includes(t.status)
      );

      if (ongoing.length > 0) {
        tournamentsGrid.innerHTML = "";

        ongoing.slice(0, 3).forEach((tournament) => {
          const card = document.createElement("div");
          card.className = "tournament-card";
          card.innerHTML = `
            <div class="tournament-icon">T</div>
            <h3>${escapeHtml(tournament.name || "Tournament")}</h3>
            <p class="tournament-venue">Venue: ${escapeHtml(tournament.venue || "Not specified")}</p>
            <p class="tournament-date">Starts: ${new Date(tournament.startDate).toLocaleDateString("en-IN")}</p>
            <p class="tournament-teams">Teams: ${tournament.registeredTeams?.length || 0}/${tournament.maxTeams || 0}</p>
            <span class="status-badge ${safeCssToken(tournament.status, "upcoming")}">${escapeHtml((tournament.status || "upcoming").toUpperCase())}</span>
          `;
          tournamentsGrid.appendChild(card);
        });
      } else {
        tournamentsGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">T</div>
            <h3>No Tournaments</h3>
            <p>Stay tuned for upcoming tournaments.</p>
          </div>
        `;
      }
    } else {
      tournamentsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">T</div>
          <h3>No Tournaments</h3>
          <p>Stay tuned for upcoming tournaments.</p>
        </div>
      `;
    }
    updateHomeMetrics(null, allTournaments);
  } catch (err) {
    console.error("Error loading tournaments:", err);
    tournamentsGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h3>Failed to Load Tournaments</h3>
        <p>Please check your connection and backend API URL.</p>
        <p><strong>API:</strong> ${escapeHtml(API_BASE || "Not configured")}</p>
        ${renderApiFixAction()}
      </div>
    `;
    updateHomeMetrics(null, []);
  }
}

async function startMatch(matchId) {
  if (!isLoggedIn()) {
    await modal.alert('Login Required', 'Please login to start a match');
    showPage('login');
    return;
  }

  const confirmed = await modal.confirm(
    'Start Match',
    'Are you sure you want to start this match?'
  );

  if (!confirmed) return;

  try {
    const token = localStorage.getItem('token');

    const matchRes = await fetch(`${API_BASE}/matches/${matchId}`);
    const matchPayload = await matchRes.json();
    if (!matchRes.ok || !matchPayload.success) {
      throw new Error(matchPayload.message || 'Failed to load match details');
    }

    const match = matchPayload.data || {};
    const teamAName = String(match.teamA?.name || 'Team A');
    const teamBName = String(match.teamB?.name || 'Team B');

    const tossWinnerInput = await modal.prompt(
      'Toss Winner',
      `Choose toss winner:\n1. ${teamAName}\n2. ${teamBName}\n\nType 1 or 2.`,
      '1'
    );
    if (!tossWinnerInput) return;

    const tossWinnerTeam = String(tossWinnerInput).trim() === '2' ? 'teamB' : 'teamA';

    const tossDecisionInput = await modal.prompt(
      'Toss Decision',
      'Enter toss decision: bat or bowl',
      'bat'
    );
    if (!tossDecisionInput) return;

    const decisionRaw = String(tossDecisionInput).trim().toLowerCase();
    if (!['bat', 'bowl'].includes(decisionRaw)) {
      showToast("Toss decision must be 'bat' or 'bowl'", 'error');
      return;
    }

    const res = await fetch(`${API_BASE}/matches/${matchId}/toss`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tossWinnerTeam,
        decision: decisionRaw
      })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Match started with toss set. Opening scoring...', 'success');
      setTimeout(() => {
        openBallScoring(matchId);
      }, 700);
    } else {
      showToast(data.message || 'Failed to start match', 'error');
    }

  } catch (err) {
    console.error('Start match error:', err);
    showToast('Server error', 'error');
  }
}

let playersSearchInitialized = false;

async function loadMyMatches() {
  const container = document.getElementById('myMatchesGrid');
  if (!container) return;

  const token = localStorage.getItem('token');
  const currentUserId = getCurrentUserId();

  if (!token) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">M</div>
        <h3>Login Required</h3>
        <p>Please login to view your matches.</p>
      </div>
    `;
    return;
  }

  try {
    container.innerHTML = '<p class="loading-text">Loading your matches...</p>';
    const res = await fetch(`${API_BASE}/matches/user/my-matches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch your matches');
    }

    const matches = Array.isArray(data.data) ? data.data : [];
    if (matches.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">M</div>
          <h3>No Matches Found</h3>
          <p>Create or join matches to see them here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    matches.forEach((match) => {
      const isCreator = match.createdBy && currentUserId &&
        (match.createdBy === currentUserId || match.createdBy._id === currentUserId);

      const statusClass = match.status === 'live' ? 'live-badge' : 'scheduled-badge';
      const statusLabel = (match.status || 'scheduled').toUpperCase();
      const creatorAction = isCreator
        ? ((match.status === 'scheduled' || match.status === 'upcoming')
          ? `<button class="start-match-btn" data-id="${escapeHtml(safeObjectId(match._id))}">Start Match</button>`
          : `<button class="update-score-btn" data-id="${escapeHtml(safeObjectId(match._id))}">Update Score</button>`)
        : '';
      const reportAction = `<button class="download-report-btn" data-id="${escapeHtml(safeObjectId(match._id))}">Report</button>`;

      const card = document.createElement('div');
      card.className = `match-card ${safeCssToken(match.status, 'scheduled')}`;
      card.innerHTML = `
        <div class="match-header">
          <span class="${statusClass}">${statusLabel}</span>
          <h3>${escapeHtml(match.matchName || 'Untitled Match')}</h3>
        </div>
        <div class="match-score">
          <div class="team">
            <span class="team-name">${escapeHtml(match.teamA?.name || 'Team A')}</span>
            <span class="score">${match.teamA?.score || 0}/${match.teamA?.wickets || 0} (${match.teamA?.overs || '0.0'})</span>
          </div>
          <div class="vs">vs</div>
          <div class="team">
            <span class="team-name">${escapeHtml(match.teamB?.name || 'Team B')}</span>
            <span class="score">${match.teamB?.score || 0}/${match.teamB?.wickets || 0} (${match.teamB?.overs || '0.0'})</span>
          </div>
        </div>
        <div class="match-footer">
          <span>${new Date(match.matchDate).toLocaleDateString('en-IN')} - ${escapeHtml(match.venue || 'Venue TBD')}</span>
          <div class="match-actions-inline">${creatorAction}${reportAction}</div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.start-match-btn').forEach((btn) => {
      btn.addEventListener('click', () => startMatch(btn.getAttribute('data-id')));
    });
    container.querySelectorAll('.update-score-btn').forEach((btn) => {
      btn.addEventListener('click', () => openBallScoring(btn.getAttribute('data-id')));
    });
    container.querySelectorAll('.download-report-btn').forEach((btn) => {
      btn.addEventListener('click', () => downloadMatchReport(btn.getAttribute('data-id')));
    });
  } catch (error) {
    console.error('My matches error:', error);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h3>Failed to Load Matches</h3>
        <p>${escapeHtml(error.message || 'Please try again.')}</p>
        <p><strong>API:</strong> ${escapeHtml(API_BASE || "Not configured")}</p>
        ${renderApiFixAction()}
      </div>
    `;
  }
}
