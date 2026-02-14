const normalizeApiBase = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const isNativePlatform = () => {
  try {
    return Boolean(
      window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === "function" &&
        window.Capacitor.isNativePlatform()
    );
  } catch (_error) {
    return false;
  }
};

const readStoredApiBase = () => {
  try {
    return normalizeApiBase(localStorage.getItem("criczone_api_base"));
  } catch (_error) {
    return "";
  }
};

const API_BASE = (() => {
  const override = normalizeApiBase(window.__API_BASE__);
  if (override) {
    const isSecureWeb = window.location.protocol === "https:" && !isNativePlatform();
    const isInsecureOverride = /^http:\/\//i.test(override);
    // Prevent broken production deploys caused by committed local http API overrides.
    if (!(isSecureWeb && isInsecureOverride)) {
      return override;
    }
  }

  const stored = readStoredApiBase();
  if (stored) return stored;

  const { protocol, hostname, origin, port } = window.location;
  const isHttp = protocol === "http:" || protocol === "https:";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const frontendDevPorts = new Set(["3000", "5173", "5500"]);

  if (isHttp && isLocalhost && frontendDevPorts.has(port)) {
    return `${protocol}//${hostname}:5000/api`;
  }

  if (isHttp) {
    return `${origin}/api`;
  }

  return "";
})();
const homeSnapshot = { matches: [], tournaments: [] };
let revealTimeouts = [];
let deferredInstallPrompt = null;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeApiInput = (inputValue = "") => {
  let normalized = normalizeApiBase(inputValue);
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) return "";
  if (!/\/api$/i.test(normalized)) normalized = `${normalized}/api`;
  return normalized;
};

const getCurrentApiBase = () =>
  normalizeApiBase(window.__API_BASE__) ||
  readStoredApiBase() ||
  normalizeApiBase(API_BASE);

const saveApiBase = (apiBase) => {
  const normalized = normalizeApiInput(apiBase);
  if (!normalized) return false;

  try {
    localStorage.setItem("criczone_api_base", normalized);
    return true;
  } catch (_error) {
    return false;
  }
};

const checkApiHealth = async (apiBase) => {
  const normalized = normalizeApiInput(apiBase);
  if (!normalized) return { ok: false, error: "API URL is empty or invalid." };

  try {
    const response = await fetchWithTimeout(`${normalized}/health`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return { ok: false, error: `Health endpoint returned ${response.status}.` };
    }

    const payload = await response.json().catch(() => ({}));
    if (payload && payload.success === false) {
      return { ok: false, error: payload.message || "Health response is not valid." };
    }

    return { ok: true };
  } catch (error) {
    if (error.name === "AbortError") {
      return { ok: false, error: "Connection timed out." };
    }
    return { ok: false, error: error.message || "Network request failed." };
  }
};

const renderApiFixAction = () => {
  if (!isNativePlatform()) return "";
  return `
    <button class="book-btn" style="margin-top: 10px;" onclick="window.openApiSettings()">
      Update API URL
    </button>
  `;
};

const readResponsePayload = async (response) => {
  const text = await response.text();
  if (!text) {
    return { text: "", json: null };
  }

  try {
    return { text, json: JSON.parse(text) };
  } catch (_error) {
    return { text, json: null };
  }
};

const getReadableResponseError = (response, payload, fallbackMessage = "Request failed") => {
  if (payload?.json) {
    return (
      payload.json.message ||
      payload.json.error ||
      payload.json.details ||
      `${fallbackMessage} (HTTP ${response.status})`
    );
  }

  if (payload?.text) {
    const shortText = payload.text.slice(0, 180).replace(/\s+/g, " ").trim();
    if (shortText) return `${fallbackMessage}: ${shortText}`;
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
};

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isNativePlatform()) {
    window.addEventListener("load", async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch (error) {
        console.error("Failed to unregister service workers on native app:", error);
      }

      if ("caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        } catch (error) {
          console.error("Failed to clear caches on native app:", error);
        }
      }
    });
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}

function setupInstallPrompt() {
  const installBtn = document.getElementById("installAppBtn");
  if (!installBtn) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    installBtn.style.display = "none";
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.style.display = "inline-flex";
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.style.display = "none";
    showToast("CricZone installed on your device.", "success");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("Use browser menu -> Add to Home Screen", "info");
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.style.display = "none";
  });
}

async function ensureNativeApiBaseConfigured() {
  if (!isNativePlatform()) return true;
  const currentApiBase = getCurrentApiBase();

  const runApiSetupFlow = async (initialValue = "") => {
    await modal.alert(
      "Backend Setup Required",
      "Enter backend API URL (example: https://your-domain.com/api)."
    );

    while (true) {
      const input = await modal.prompt(
        "Backend API URL",
        "Use full URL with http/https. If you enter only domain, /api will be added automatically.",
        initialValue || "https://your-domain.com/api"
      );

      if (!input) {
        await modal.alert("Setup Required", "This mobile app needs a backend API URL.");
        continue;
      }

      const normalized = normalizeApiInput(input);
      if (!normalized) {
        await modal.alert("Invalid URL", "URL must start with http:// or https://");
        continue;
      }

      const health = await checkApiHealth(normalized);
      if (!health.ok) {
        await modal.alert(
          "Connection Failed",
          `Could not reach backend.\n\nURL: ${normalized}\nError: ${health.error}`
        );
        continue;
      }

      if (!saveApiBase(normalized)) {
        await modal.alert("Storage Error", "Could not save API URL on this device.");
        continue;
      }

      await modal.alert("Saved", "API URL saved. App will reload now.");
      window.location.reload();
      return false;
    }
  };

  if (!currentApiBase) {
    return runApiSetupFlow("");
  }

  const health = await checkApiHealth(currentApiBase);
  if (health.ok) return true;

  const shouldUpdate = await modal.confirm(
    "Backend Not Reachable",
    `Current URL: ${currentApiBase}\n\nError: ${health.error}\n\nDo you want to update API URL now?`
  );

  if (!shouldUpdate) {
    showToast("Backend not reachable. Some sections may fail to load.", "error");
    return true;
  }

  return runApiSetupFlow(currentApiBase);
}

async function openApiSettings() {
  const currentApi = getCurrentApiBase();
  const input = await modal.prompt(
    "Update API URL",
    "Enter backend API URL. Example: https://your-domain.com/api",
    currentApi || "https://your-domain.com/api"
  );

  if (!input) return;

  const normalized = normalizeApiInput(input);
  if (!normalized) {
    await modal.alert("Invalid URL", "URL must start with http:// or https://");
    return;
  }

  const health = await checkApiHealth(normalized);
  if (!health.ok) {
    await modal.alert(
      "Connection Failed",
      `Could not reach backend.\n\nURL: ${normalized}\nError: ${health.error}`
    );
    return;
  }

  if (!saveApiBase(normalized)) {
    await modal.alert("Storage Error", "Could not save API URL on this device.");
    return;
  }

  await modal.alert("Saved", "API URL saved. App will reload now.");
  window.location.reload();
}

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

const modal = new CustomModal();
window.openApiSettings = openApiSettings;

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message = "", type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return alert(message);

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.showToast = showToast;

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatOversFromBallCount(ballCount = 0) {
  const safeBallCount = Math.max(0, parseInt(ballCount, 10) || 0);
  const overs = Math.floor(safeBallCount / 6);
  const balls = safeBallCount % 6;
  return `${overs}.${balls}`;
}

function formatOversFromBallsRaw(balls = 0) {
  const safeBalls = Math.max(0, Number.parseInt(balls, 10) || 0);
  return `${Math.floor(safeBalls / 6)}.${safeBalls % 6}`;
}

function formatPrizePool(prizePool) {
  if (!prizePool) return "TBD";

  if (typeof prizePool === "string") {
    return prizePool.trim() || "TBD";
  }

  if (typeof prizePool === "object") {
    const total = String(prizePool.total || "").trim();
    const currency = String(prizePool.currency || "INR").trim();
    if (!total) return "TBD";
    return `${currency} ${total}`;
  }

  return "TBD";
}

function parseTeamPlayersField(rawValue = "") {
  return String(rawValue || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [namePart, emailPart] = entry.split("|").map((item) => String(item || "").trim());
      const email = emailPart || (namePart.includes("@") ? namePart : "");
      const name = (emailPart ? namePart : namePart.replace(/@.*/, "")).trim();

      return {
        name: name || email.split("@")[0] || "Player",
        email: email || undefined
      };
    });
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

  navMenu.classList.remove("open");
  menuToggle.classList.remove("is-active");
  menuToggle.setAttribute("aria-expanded", "false");
}

function setupMobileNavigation() {
  const navMenu = document.getElementById("navMenu");
  const menuToggle = document.getElementById("menuToggle");
  const navBrand = document.querySelector(".nav-brand");

  if (!navMenu || !menuToggle) return;

  menuToggle.addEventListener("click", () => {
    const nextOpen = !navMenu.classList.contains("open");
    navMenu.classList.toggle("open", nextOpen);
    menuToggle.classList.toggle("is-active", nextOpen);
    menuToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = navMenu.contains(event.target) || menuToggle.contains(event.target);
    if (!clickedInsideMenu) closeNavMenu();
  });

  navBrand?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showPage("home");
    }
  });
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
  
  const pages = document.querySelectorAll(".page");
  pages.forEach(p => p.style.display = 'none');
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
    targetPage.classList.remove("page-enter");
    // Trigger reflow so animation restarts whenever a page is shown.
    void targetPage.offsetWidth;
    targetPage.classList.add("page-enter");
    animatePageReveal(targetPage);
  }
  
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(l => {
    l.classList.remove('active');
    if (l.getAttribute("data-page") === pageId) {
      l.classList.add('active');
    }
  });
  closeNavMenu();
  
  if (pageId === "home") loadHomePage();
  if (pageId === "book-turf") loadTurfs();
  if (pageId === "my-stats") loadUserProfile();
  if (pageId === "my-matches") loadMyMatches();
  if (pageId === "players") loadPlayers();
  if (pageId === "host-match") loadTournamentOptions();
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
  battingTeamKey: 'teamA',
  battingOptions: [],
  bowlingOptions: [],
  striker: { id: null, name: '', runs: 0, balls: 0 },
  nonStriker: { id: null, name: '', runs: 0, balls: 0 },
  bowler: { id: null, name: '', runs: 0, wickets: 0, balls: 0 }
};

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
    battingTeamKey: 'teamA',
    battingOptions: [],
    bowlingOptions: [],
    striker: { id: null, name: '', runs: 0, balls: 0 },
    nonStriker: { id: null, name: '', runs: 0, balls: 0 },
    bowler: { id: null, name: '', runs: 0, wickets: 0, balls: 0 }
  };
  
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

        let display = String(totalRuns);
        let cssClass = 'run';
        if (Boolean(ball?.isWicket)) {
          display = 'W';
          cssClass = 'wicket';
        } else if (isExtra) {
          display = extraType.toUpperCase();
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
      
      showToast('Match loaded successfully!', 'success');
      
    } else {
      showToast(data.message || 'Failed to load match', 'error');
    }

  } catch (err) {
    console.error('Load match error:', err);
    showToast('Failed to load match', 'error');
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

function recordBall(runs, isExtra = false, extraType = null) {
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

  if (isWideOrNoBall) {
    currentMatchData.totalRuns += runs;
    currentMatchData.bowler.runs += runs;
    if (runs > 1 && ((runs - 1) % 2) === 1) {
      swapBatsmen();
    }
  } else if (isByeOrLegBye) {
    currentMatchData.totalRuns += runs;
    currentMatchData.striker.balls += 1;
    currentMatchData.currentBall += 1;
    currentMatchData.bowler.balls += 1;
    if ((runs % 2) === 1) {
      swapBatsmen();
    }
    if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
      handleOverComplete();
    }
  } else {
    currentMatchData.totalRuns += runs;
    currentMatchData.striker.runs += runs;
    currentMatchData.striker.balls += 1;
    currentMatchData.currentBall += 1;
    currentMatchData.bowler.balls += 1;
    currentMatchData.bowler.runs += runs;
    
    if ((runs % 2) === 1) {
      swapBatsmen();
    }
    
    if (currentMatchData.currentBall % 6 === 0 && currentMatchData.currentBall > 0) {
      handleOverComplete();
    }
  }

  let displayText = runs.toString();
  let ballClass = 'run';

  if (runs === 0) {
    displayText = '.';
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
  else if (lastBall.isExtra && lastBall.extraType !== 'bye' && lastBall.extraType !== 'lb') {
    currentMatchData.totalRuns -= lastBall.runs;
    currentMatchData.bowler.runs -= lastBall.runs;
    if (lastBall.runs > 1 && ((lastBall.runs - 1) % 2) === 1) {
      swapBatsmen();
    }
  }
  else if (lastBall.isExtra && (lastBall.extraType === 'bye' || lastBall.extraType === 'lb')) {
    currentMatchData.totalRuns -= lastBall.runs;
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.balls -= 1;
    if ((lastBall.runs % 2) === 1) {
      swapBatsmen();
    }
  }
  else {
    currentMatchData.totalRuns -= lastBall.runs;
    currentMatchData.striker.runs -= lastBall.runs;
    currentMatchData.striker.balls -= 1;
    currentMatchData.currentBall -= 1;
    currentMatchData.bowler.balls -= 1;
    currentMatchData.bowler.runs -= lastBall.runs;
    if ((lastBall.runs % 2) === 1) {
      swapBatsmen();
    }
  }
  
  updateScoringDisplay();
  showToast('Last ball removed', 'success');
  saveMatchScore();
}

async function saveMatchScore() {
  try {
    const token = localStorage.getItem('token');
    if (!token || !currentMatchData.matchId) return;
    
    const res = await fetch(`${API_BASE}/matches/${currentMatchData.matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
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
      })
    });

    const data = await res.json();
    
    if (res.ok) {
      if (data?.data) {
        renderDetailedScoreboard(data.data);
      }
      if (data.inningsComplete) {
        await modal.alert('Innings Complete!', data.message);
        window.showPage('home');
      } else if (data.matchComplete) {
        await modal.alert('Match Complete!', data.message);
        window.showPage('home');
      }
    }

  } catch (err) {
    console.error('Save score error:', err);
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
          card.className = `match-card ${match.status}`;
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
                  ? `<button class="start-match-btn" data-id="${match._id}">Start Match</button>`
                  : `<button class="update-score-btn" data-id="${match._id}">Update Score</button>`)
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
            <span class="status-badge ${tournament.status}">${(tournament.status || "upcoming").toUpperCase()}</span>
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

      const card = document.createElement('div');
      card.className = `match-card ${match.status || 'scheduled'}`;
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
          <span>${new Date(match.matchDate).toLocaleDateString('en-IN')} • ${escapeHtml(match.venue || 'Venue TBD')}</span>
          ${isCreator
            ? ((match.status === 'scheduled' || match.status === 'upcoming')
              ? `<button class="start-match-btn" data-id="${match._id}">Start Match</button>`
              : `<button class="update-score-btn" data-id="${match._id}">Update Score</button>`)
            : ''
          }
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

function renderPlayersList(players = []) {
  const container = document.getElementById('playersResults');
  if (!container) return;

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">P</div>
        <h3>No Players Found</h3>
        <p>Try another name or filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  players.forEach((player) => {
    const runs = formatNumber(player.stats?.batting?.runs);
    const wickets = formatNumber(player.stats?.bowling?.wickets);
    const matches = formatNumber(player.stats?.matchesPlayed);
    const location = player.profile?.location?.city || player.profile?.location?.state || 'Location not set';
    const type = player.profile?.playerType || 'Not specified';
    const availability = player.profile?.availability || 'Available';

    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-card-head">
        <h3>${escapeHtml(player.profile?.displayName || player.name || 'Player')}</h3>
        <span class="status-badge ${(availability === 'Available' || availability === 'Looking for team') ? 'ongoing' : 'completed'}">${escapeHtml(availability)}</span>
      </div>
      <p class="player-sub">${escapeHtml(type)} • ${escapeHtml(location)}</p>
      <div class="player-mini-stats">
        <div><strong>${matches}</strong><small>Matches</small></div>
        <div><strong>${runs}</strong><small>Runs</small></div>
        <div><strong>${wickets}</strong><small>Wickets</small></div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadPlayers() {
  const searchInput = document.getElementById('playersSearchInput');
  const searchForm = document.getElementById('playersSearchForm');
  const searchBtn = document.getElementById('playersSearchBtn');
  const results = document.getElementById('playersResults');

  if (!searchInput || !searchForm || !searchBtn || !results) return;

  const runSearch = async () => {
    const query = searchInput.value.trim();
    const params = new URLSearchParams();
    if (query) params.set('search', query);

    try {
      results.innerHTML = '<p class="loading-text">Searching players...</p>';
      const res = await fetch(`${API_BASE}/users/search-players?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to search players');
      }

      renderPlayersList(data.data || []);
    } catch (error) {
      console.error('Player search error:', error);
      results.innerHTML = `
        <div class="error-state">
          <div class="error-icon">!</div>
          <h3>Search Failed</h3>
          <p>${escapeHtml(error.message || 'Please try again.')}</p>
        </div>
      `;
    }
  };

  if (!playersSearchInitialized) {
    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await runSearch();
    });

    searchBtn.addEventListener('click', async () => {
      await runSearch();
    });

    playersSearchInitialized = true;
  }

  if (!results.dataset.loaded) {
    results.dataset.loaded = 'true';
    await runSearch();
  }
}

// ============================================
// LOAD USER PROFILE
// ============================================
async function loadUserProfile() {
  const profileSection = document.getElementById('profile-section');
  const setStat = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  };

  try {
    const token = localStorage.getItem('token');

    if (!token) {
      if (profileSection) {
        profileSection.innerHTML = '<p class="placeholder-text">Please login to view your profile.</p>';
      }
      setStat('statMatchesPlayed', 0);
      setStat('statWinRate', '0%');
      setStat('statFollowers', 0);
      setStat('statWins', 0);
      setStat('statLosses', 0);
      setStat('statRuns', 0);
      setStat('statWickets', 0);
      return;
    }

    const response = await fetch(`${API_BASE}/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to load profile');
    }

    const user = data.user || {};
    const userStats = user.stats || {};
    const matchesPlayed = formatNumber(userStats.matchesPlayed ?? user.matchesPlayed ?? user.totalMatches ?? 0);
    const wins = formatNumber(userStats.wins ?? user.wins ?? 0);
    const losses = formatNumber(userStats.losses ?? user.losses ?? 0);
    const runs = formatNumber(userStats.batting?.runs ?? user.batting?.runs ?? 0);
    const wickets = formatNumber(userStats.bowling?.wickets ?? user.bowling?.wickets ?? 0);
    const computedWinRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
    const winRate = formatNumber(userStats.winRate, computedWinRate);
    const followers = formatNumber(
      userStats.followers ??
      user.followerCount ??
      user.followersCount ??
      user.social?.followers?.length ??
      0
    );

    if (profileSection) {
      profileSection.innerHTML = `
        <div>
          <h3 class="profile-title">${escapeHtml(user.name || 'Player')}</h3>
          <p class="profile-detail"><strong>Email:</strong> ${escapeHtml(user.email || 'Not available')}</p>
          <p class="profile-detail"><strong>Phone:</strong> ${escapeHtml(user.phone || 'Not available')}</p>
          <p class="profile-detail"><strong>Role:</strong> ${escapeHtml(user.role || 'User')}</p>
          <p class="profile-detail"><strong>Member Since:</strong> ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
        </div>
      `;
    }

    setStat('statMatchesPlayed', matchesPlayed);
    setStat('statWinRate', `${winRate}%`);
    setStat('statFollowers', followers);
    setStat('statWins', wins);
    setStat('statLosses', losses);
    setStat('statRuns', runs);
    setStat('statWickets', wickets);

  } catch (error) {
    console.warn('Profile load error:', error.message);
    if (profileSection) {
      profileSection.innerHTML = '<p class="placeholder-text">Unable to load profile. Please try again later.</p>';
    }
    setStat('statMatchesPlayed', 0);
    setStat('statWinRate', '0%');
    setStat('statFollowers', 0);
    setStat('statWins', 0);
    setStat('statLosses', 0);
    setStat('statRuns', 0);
    setStat('statWickets', 0);
  }
}
// ============================================
// LOAD TURFS
// ============================================
async function loadTurfs() {
  try {
    const response = await fetch(`${API_BASE}/turfs/all`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to load turfs');
    }

    const turfsContainer = document.getElementById('turfs-container');
    if (!turfsContainer) {
      console.error('Turfs container not found in HTML');
      return;
    }

    turfsContainer.innerHTML = '';

    if (!Array.isArray(data.data) || data.data.length === 0) {
      turfsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">G</div>
          <h3>No Turfs Available</h3>
          <p>Check back later for turf bookings.</p>
        </div>
      `;
      return;
    }

    data.data.forEach((turf) => {
      const sports = Array.isArray(turf.sportTypes) && turf.sportTypes.length > 0
        ? turf.sportTypes.join(', ')
        : 'Cricket';
      const city = turf.location?.city || 'N/A';
      const state = turf.location?.state || '';
      const pricePerSlot = turf.basePricingPerSlot != null ? turf.basePricingPerSlot : 'N/A';
      const ownerName = turf.ownerId?.name || 'Unknown';
      const surfaceType = turf.surfaceType || 'Standard';
      const imageUrl = turf.images && turf.images[0]
        ? turf.images[0]
        : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'180\'%3E%3Crect fill=\'%23e8efe7\' width=\'300\' height=\'180\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'18\' fill=\'%23677f75\'%3ETurf%3C/text%3E%3C/svg%3E';

      const turfCard = document.createElement('div');
      turfCard.className = 'turf-card';
      turfCard.innerHTML = `
        <div class="turf-image">
          <img src="${imageUrl}" alt="${escapeHtml(turf.turfName || 'Turf')}" />
        </div>
        <div class="turf-details">
          <h3>${escapeHtml(turf.turfName || 'Unnamed Turf')}</h3>
          <p><strong>Location:</strong> ${escapeHtml(city)}${state ? `, ${escapeHtml(state)}` : ''}</p>
          <p><strong>Sports:</strong> ${escapeHtml(sports)}</p>
          <p><strong>Surface:</strong> ${escapeHtml(surfaceType)}</p>
          <p><strong>Price:</strong> INR ${escapeHtml(pricePerSlot)}</p>
          <p><strong>Owner:</strong> ${escapeHtml(ownerName)}</p>
          <button class="book-btn" onclick="bookTurf('${turf._id}')">Book Now</button>
        </div>
      `;
      turfsContainer.appendChild(turfCard);
    });

  } catch (error) {
    console.error('Turfs error:', error.message);
    const turfsContainer = document.getElementById('turfs-container');
    if (turfsContainer) {
      turfsContainer.innerHTML = `
        <div class="error-state" style="grid-column: 1/-1;">
          <div class="error-icon">!</div>
          <h3>Failed to Load Turfs</h3>
          <p>Please check your connection and backend API URL.</p>
          <p><strong>API:</strong> ${escapeHtml(API_BASE || "Not configured")}</p>
          ${renderApiFixAction()}
        </div>
      `;
    }
  }
}
async function bookTurf(turfId) {
  if (!isLoggedIn()) {
    await modal.alert('Login Required', 'Please login to book a turf');
    showPage('login');
    return;
  }

  const bookingDate = await modal.prompt('Booking Date', 'Enter date in YYYY-MM-DD format', new Date().toISOString().slice(0, 10));
  if (!bookingDate) return;

  const startTime = await modal.prompt('Start Time', 'Enter start time in HH:MM or HH:MM AM/PM format', '18:00');
  if (!startTime) return;

  const endTime = await modal.prompt('End Time', 'Enter end time in HH:MM or HH:MM AM/PM format', '19:00');
  if (!endTime) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        turfId,
        date: bookingDate.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim()
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create booking');
    }

    const price = data?.booking?.totalPrice;
    const successMessage = Number.isFinite(Number(price))
      ? `Booking confirmed. Total: INR ${Number(price).toFixed(2)}`
      : 'Booking confirmed successfully.';
    showToast(successMessage, 'success');
  } catch (error) {
    console.error('Booking error:', error);
    showToast(error.message || 'Failed to create booking', 'error');
  }
}
window.bookTurf = bookTurf;

// ============================================
// LOAD TOURNAMENT OPTIONS
// ============================================
async function loadTournamentOptions() {
  const tournamentSelect = document.getElementById("tournamentSelect");
  if (!tournamentSelect) return;
  
  try {
    const res = await fetch(`${API_BASE}/tournaments`);
    const data = await res.json();
    if (res.ok && data.tournaments) {
      tournamentSelect.innerHTML = '<option value="">Not part of tournament</option>';
      data.tournaments.forEach(t => {
        if (["upcoming", "ongoing", "registration_open", "registration_closed", "playoffs"].includes(t.status)) {
          tournamentSelect.innerHTML += `<option value="${t._id}">${escapeHtml(t.name)}</option>`;
        }
      });
    }
  } catch (err) {
    console.error("Failed to load tournaments:", err);
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  registerServiceWorker();
  setupInstallPrompt();

  const canContinue = await ensureNativeApiBaseConfigured();
  if (!canContinue) return;

  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  setupMobileNavigation();
  setUserFromStorage();

  const navApiConfigBtn = document.getElementById("navApiConfig");
  if (navApiConfigBtn) {
    if (isNativePlatform()) {
      navApiConfigBtn.style.display = "inline-flex";
      navApiConfigBtn.addEventListener("click", async () => {
        await openApiSettings();
      });
    } else {
      navApiConfigBtn.style.display = "none";
    }
  }

  showPage("home");

  if (isNativePlatform() && !isLoggedIn()) {
    showToast("Please login to continue.", "info");
    setTimeout(() => showPage("login"), 250);
  }

  // Navigation
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(el => {
    const page = el.getAttribute("data-page");
    if (page) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showPage(page);
      });
    }
  });

  // Data-page links
  document.querySelectorAll('[data-page]').forEach(el => {
    if (!el.classList.contains('nav-link')) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const page = el.getAttribute("data-page");
        if (page) showPage(page);
      });
    }
  });

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUserFromStorage();
    showToast("Logged out", "info");
    showPage("home");
  });

  // Match type selector
  const matchTypeSelect = document.getElementById("matchType");
  const customOversGroup = document.getElementById("customOversGroup");
  matchTypeSelect?.addEventListener("change", () => {
    customOversGroup.style.display = matchTypeSelect.value === "Custom" ? "block" : "none";
  });

  // HOST MATCH FORM
  const hostMatchForm = document.getElementById("hostMatchForm");
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
      teamAPlayers: parseTeamPlayersField(document.getElementById("teamAPlayers").value),
      teamBName: document.getElementById("teamBName").value.trim(),
      teamBPlayers: parseTeamPlayersField(document.getElementById("teamBPlayers").value),
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
        showToast("Match created successfully.", "success");
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

  // LOGIN FORM
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const submitBtn = loginForm.querySelector('.submit-btn');
      
      if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
      }
      
      try {
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_BASE}/users/login`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const payload = await readResponsePayload(response);
        const data = payload.json;

        if (!response.ok) {
          throw new Error(getReadableResponseError(response, payload, "Login failed"));
        }

        if (data && data.token && data.user) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify({
            _id: data.user._id,
            id: data.user._id,
            email: data.user.email,
            name: data.user.name,
            phone: data.user.phone,
            role: data.user.role
          }));

          showToast('Login successful.', 'success');
          setUserFromStorage();
          
          setTimeout(() => {
            showPage('home');
          }, 1500);
        } else {
          throw new Error(getReadableResponseError(response, payload, 'Unexpected server response'));
        }

      } catch (error) {
        console.error('Login error:', error);
        if (error.message === 'Failed to fetch' || error.message.includes('network')) {
          showToast('Cannot connect to server. Please check if the server is running.', 'error');
        } else {
          showToast(error.message, 'error');
        }
      } finally {
        submitBtn.textContent = 'Login';
        submitBtn.disabled = false;
      }
    });
  }

  // SIGNUP FORM
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const phone = document.getElementById('signupPhone').value.trim();
      const password = document.getElementById('signupPassword').value.trim();
      const submitBtn = signupForm.querySelector('.submit-btn');
      
      if (!name || !email || !phone || !password) {
        showToast('Please fill all fields', 'error');
        return;
      }
      
      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
      
      try {
        submitBtn.textContent = 'Signing up...';
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_BASE}/users/signup`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ name, email, phone, password })
        });
        
        const payload = await readResponsePayload(response);
        const data = payload.json;

        if (!response.ok) {
          throw new Error(getReadableResponseError(response, payload, "Signup failed"));
        }

        if (data && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user || { email, name }));
          showToast('Signup successful.', 'success');
          setUserFromStorage();
          setTimeout(() => showPage('home'), 1500);
        } else {
          throw new Error(getReadableResponseError(response, payload, 'Unexpected server response'));
        }
      } catch (error) {
        console.error('Signup error:', error);
        if (error.message === 'Failed to fetch' || error.message.includes('network')) {
          showToast('Cannot connect to server. Please check if the server is running.', 'error');
        } else {
          showToast(error.message, 'error');
        }
      } finally {
        submitBtn.textContent = 'Sign Up';
        submitBtn.disabled = false;
      }
    });
  }

  // BALL SCORING EVENT LISTENERS
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
      const runs = (extraType === 'wd' || extraType === 'nb') ? 1 : 0;
      recordBall(runs, true, extraType);
    });
  });

  document.getElementById('wicketBtn')?.addEventListener('click', recordWicket);
  document.getElementById('undoBtn')?.addEventListener('click', undoLastBall);
  document.getElementById('changeStrikerBtn')?.addEventListener('click', changeStriker);
  document.getElementById('changeNonStrikerBtn')?.addEventListener('click', changeNonStriker);
  document.getElementById('changeBowlerBtn')?.addEventListener('click', changeBowler);
  document.getElementById('swapBatsmenBtn')?.addEventListener('click', manualSwapBatsmen);

  // CREATE TOURNAMENT BUTTON
  const createTournamentBtn = document.getElementById("createTournamentBtn");
  createTournamentBtn?.addEventListener("click", async () => {
    if (!isLoggedIn()) {
      await modal.alert("Login Required", "Please login to create a tournament");
      showPage("login");
      return;
    }

    const createTournamentFormContainer = document.getElementById("createTournamentForm");
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
              <input type="text" id="tournamentPrize" placeholder="e.g., INR 50,000" />
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
          showToast("Tournament created successfully.", "success");
          createTournamentFormContainer.style.display = "none";
          loadTournamentsList();
        } else {
          showToast(data.message || "Failed to create tournament", "error");
        }
      } catch (err) {
        console.error("Tournament creation error:", err);
        showToast("Server error", "error");
      }
    });
  });

  // Load tournaments list function
  async function loadTournamentsList() {
    const tournamentsList = document.getElementById("tournamentsList");
    if (!tournamentsList) return;

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
            <div class="tournament-icon">T</div>
            <h3>${escapeHtml(tournament.name)}</h3>
            <span class="status-badge ${tournament.status}">${tournament.status}</span>
            <p>${escapeHtml(tournament.description || "No description")}</p>
            <p><strong>Venue:</strong> ${escapeHtml(tournament.venue)}</p>
            <p><strong>Dates:</strong> ${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()}</p>
            <p><strong>Format:</strong> ${tournament.format}</p>
            <p><strong>Teams:</strong> ${(tournament.registeredTeams?.length || 0)}/${tournament.maxTeams || 0}</p>
            <p><strong>Prize:</strong> ${escapeHtml(formatPrizePool(tournament.prizePool))}</p>
          `;
          grid.appendChild(card);
        });
      } else {
        tournamentsList.innerHTML = '<p style="text-align:center;">No tournaments available yet.</p>';
      }
    } catch (err) {
      console.error("Error loading tournaments:", err);
      tournamentsList.innerHTML = '<p style="text-align:center;">Failed to load tournaments.</p>';
    }
  }

  // Load tournaments on tournaments page
  const tournamentsPage = document.getElementById("tournaments");
  if (tournamentsPage) {
    const observer = new MutationObserver(() => {
      if (tournamentsPage.style.display !== 'none') {
        loadTournamentsList();
      }
    });
    observer.observe(tournamentsPage, { attributes: true, attributeFilter: ['style'] });
  }
});










