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
  const stored = readStoredApiBase();
  if (stored) return stored;

  const { protocol, hostname, origin, port } = window.location;
  const isHttp = protocol === "http:" || protocol === "https:";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const frontendDevPorts = new Set(["3000", "5173", "5500"]);
  const override = normalizeApiBase(window.__API_BASE__);
  const isLocalOverride = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api$/i.test(override);

  // In local web testing, prefer local backend instead of committed remote runtime config.
  if (isHttp && isLocalhost && !isNativePlatform()) {
    if (override && isLocalOverride) {
      return override;
    }
    if (frontendDevPorts.has(port)) {
      return `${protocol}//${hostname}:5000/api`;
    }
    return `${origin}/api`;
  }

  if (override) {
    const isSecureWeb = window.location.protocol === "https:" && !isNativePlatform();
    const isInsecureOverride = /^http:\/\//i.test(override);
    // Prevent broken production deploys caused by committed local http API overrides.
    if (!(isSecureWeb && isInsecureOverride)) {
      return override;
    }
  }

  if (isHttp && isLocalhost && frontendDevPorts.has(port)) {
    return `${protocol}//${hostname}:5000/api`;
  }

  if (isHttp) {
    return `${origin}/api`;
  }

  return "";
})();
const homeSnapshot = { matches: [], tournaments: [] };
let hostTeamsCache = [];
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

function formatTeamMembersForInput(members = []) {
  if (!Array.isArray(members)) return "";
  return members
    .map((member) => {
      const inviteStatus = String(member?.inviteStatus || "accepted").toLowerCase();
      const isRegistered = Boolean(member?.isRegistered || member?.player?._id || member?.player);
      if (isRegistered && inviteStatus !== "accepted") return "";
      const name = String(member?.player?.name || member?.name || "").trim();
      const email = String(member?.player?.email || member?.email || "").trim().toLowerCase();
      if (!name) return "";
      return email ? `${name}|${email}` : name;
    })
    .filter(Boolean)
    .join(", ");
}

function getPlayerSelectionKey(player = {}) {
  const userId = String(player.userId || "").trim();
  if (userId) return `id:${userId}`;
  const email = String(player.email || "").trim().toLowerCase();
  if (email) return `mail:${email}`;
  return `name:${String(player.name || "").trim().toLowerCase()}`;
}

function getAcceptedTeamMembers(team = {}) {
  if (!team || !Array.isArray(team.members)) return [];

  const seen = new Set();
  return team.members
    .map((member) => {
      const inviteStatus = String(member?.inviteStatus || "accepted").toLowerCase();
      const playerDoc = member?.player && typeof member.player === "object" ? member.player : null;
      const userId = String(playerDoc?._id || member?.player || "").trim();
      const isRegistered = Boolean(member?.isRegistered || userId);
      if (isRegistered && inviteStatus !== "accepted") return null;

      const name = String(playerDoc?.name || member?.name || "").trim();
      const email = String(playerDoc?.email || member?.email || "").trim().toLowerCase();
      if (!name) return null;

      const normalized = { name, email, userId: userId || null };
      const key = getPlayerSelectionKey(normalized);
      if (seen.has(key)) return null;
      seen.add(key);
      return normalized;
    })
    .filter(Boolean);
}

function formatPlayersForInput(players = []) {
  if (!Array.isArray(players)) return "";
  return players
    .map((player) => {
      const name = String(player?.name || "").trim();
      const email = String(player?.email || "").trim().toLowerCase();
      if (!name) return "";
      return email ? `${name}|${email}` : name;
    })
    .filter(Boolean)
    .join(", ");
}

function renderTeamPlayingSelector(side = "A") {
  const select = document.getElementById(side === "A" ? "teamASelect" : "teamBSelect");
  const playersField = document.getElementById(side === "A" ? "teamAPlayers" : "teamBPlayers");
  const container = document.getElementById(side === "A" ? "teamAPlayingSelector" : "teamBPlayingSelector");
  if (!select || !playersField || !container) return;

  const selectedTeamId = String(select.value || "").trim();
  if (!selectedTeamId) {
    container.innerHTML = "";
    return;
  }

  const team = hostTeamsCache.find((item) => String(item._id) === selectedTeamId);
  if (!team) {
    container.innerHTML = "";
    return;
  }

  const teamPlayers = getAcceptedTeamMembers(team);
  if (teamPlayers.length === 0) {
    container.innerHTML = '<p class="join-help">No accepted players found in this saved team.</p>';
    return;
  }

  const existingSelections = parseTeamPlayersField(playersField.value);
  const existingKeys = new Set(existingSelections.map((player) => getPlayerSelectionKey(player)));
  const hasExistingFromTeam = teamPlayers.some((player) => existingKeys.has(getPlayerSelectionKey(player)));
  const shouldSelectAllByDefault = existingSelections.length === 0 || !hasExistingFromTeam;

  container.innerHTML = `
    <div class="selector-head">
      <p>Select playing players from <strong>${escapeHtml(team.name || "Saved Team")}</strong></p>
      <div class="selector-actions">
        <button type="button" data-selector-action="all">All</button>
        <button type="button" data-selector-action="clear">Clear</button>
      </div>
    </div>
    <div class="selector-list">
      ${teamPlayers.map((player, index) => {
        const key = getPlayerSelectionKey(player);
        const checked = shouldSelectAllByDefault || existingKeys.has(key) ? "checked" : "";
        return `
          <label class="selector-item">
            <input type="checkbox" data-team-player="${escapeHtml(key)}" data-team-player-index="${index}" ${checked} />
            <span>${escapeHtml(player.name)}</span>
            ${player.email ? `<small>${escapeHtml(player.email)}</small>` : ""}
          </label>
        `;
      }).join("")}
    </div>
  `;

  const syncPlayersField = () => {
    const selectedPlayers = [];
    container.querySelectorAll("[data-team-player-index]").forEach((checkbox) => {
      if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;
      const index = Number.parseInt(checkbox.getAttribute("data-team-player-index"), 10);
      if (!Number.isFinite(index) || !teamPlayers[index]) return;
      selectedPlayers.push(teamPlayers[index]);
    });
    playersField.value = formatPlayersForInput(selectedPlayers);
  };

  container.querySelectorAll("[data-team-player-index]").forEach((checkbox) => {
    checkbox.addEventListener("change", syncPlayersField);
  });

  container.querySelectorAll("[data-selector-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-selector-action");
      container.querySelectorAll("[data-team-player-index]").forEach((checkbox) => {
        if (!(checkbox instanceof HTMLInputElement)) return;
        checkbox.checked = action === "all";
      });
      syncPlayersField();
    });
  });

  if (shouldSelectAllByDefault) {
    syncPlayersField();
  }
}

function appendPlayerToReusableInput(name, email = "") {
  const playersInput = document.getElementById("newReusableTeamPlayers");
  if (!playersInput) return;

  const nextEntry = email ? `${String(name).trim()}|${String(email).trim().toLowerCase()}` : String(name).trim();
  if (!nextEntry) return;

  const existing = parseTeamPlayersField(playersInput.value);
  const alreadyExists = existing.some((player) => {
    const sameEmail = email && String(player.email || "").toLowerCase() === String(email).toLowerCase();
    const sameName = String(player.name || "").toLowerCase() === String(name || "").toLowerCase();
    return sameEmail || sameName;
  });
  if (alreadyExists) {
    showToast("Player already in reusable team list", "info");
    return;
  }

  playersInput.value = playersInput.value.trim()
    ? `${playersInput.value.trim()}, ${nextEntry}`
    : nextEntry;
}

function setHostTeamSelectOptions(teams = []) {
  const teamASelect = document.getElementById("teamASelect");
  const teamBSelect = document.getElementById("teamBSelect");
  if (!teamASelect || !teamBSelect) return;

  const previousA = teamASelect.value;
  const previousB = teamBSelect.value;

  const defaultOption = '<option value="">Custom (manual entry)</option>';
  const options = teams
    .map((team) => `<option value="${team._id}">${escapeHtml(team.name)}</option>`)
    .join("");

  teamASelect.innerHTML = defaultOption + options;
  teamBSelect.innerHTML = defaultOption + options;

  if (teams.some((team) => String(team._id) === String(previousA))) {
    teamASelect.value = previousA;
  }
  if (teams.some((team) => String(team._id) === String(previousB))) {
    teamBSelect.value = previousB;
  }
}

function applySelectedReusableTeam(side = "A") {
  const select = document.getElementById(side === "A" ? "teamASelect" : "teamBSelect");
  const nameField = document.getElementById(side === "A" ? "teamAName" : "teamBName");
  const playersField = document.getElementById(side === "A" ? "teamAPlayers" : "teamBPlayers");
  if (!select || !nameField || !playersField) return;

  const selectedId = String(select.value || "").trim();
  if (!selectedId) {
    renderTeamPlayingSelector(side);
    return;
  }

  const team = hostTeamsCache.find((item) => String(item._id) === selectedId);
  if (!team) {
    renderTeamPlayingSelector(side);
    return;
  }

  nameField.value = team.name || "";
  playersField.value = formatTeamMembersForInput(team.members || []);
  renderTeamPlayingSelector(side);
}

async function loadHostTeams() {
  const token = localStorage.getItem("token");
  const teamASelect = document.getElementById("teamASelect");
  const teamBSelect = document.getElementById("teamBSelect");
  if (!teamASelect || !teamBSelect) return;

  if (!token) {
    hostTeamsCache = [];
    setHostTeamSelectOptions([]);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/teams`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to load teams"));
    }

    hostTeamsCache = Array.isArray(payload.json.data) ? payload.json.data : [];
    setHostTeamSelectOptions(hostTeamsCache);
    renderTeamPlayingSelector("A");
    renderTeamPlayingSelector("B");
  } catch (error) {
    console.error("Load reusable teams error:", error);
    showToast(error.message || "Failed to load saved teams", "error");
  }
}

function renderTeamPlayerSuggestions(suggestions = []) {
  const container = document.getElementById("teamPlayerSuggestions");
  if (!container) return;

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-icon">P</div>
        <h3>No Suggestions</h3>
        <p>Try a different name/email.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = suggestions.map((player) => `
    <div class="player-card">
      <div class="player-card-head">
        <div>
          <h3>${escapeHtml(player.name || "Player")}</h3>
          <p class="player-sub">${escapeHtml(player.email || "No email")} - ${escapeHtml(player.availability || "Available")}</p>
        </div>
      </div>
      <div class="player-mini-stats">
        <div><strong>${Number(player.runs || 0)}</strong><small>Runs</small></div>
        <div><strong>${Number(player.wickets || 0)}</strong><small>Wickets</small></div>
      </div>
      <button
        type="button"
        class="team-suggestion-add-btn"
        data-suggest-name="${escapeHtml(player.name || "")}"
        data-suggest-email="${escapeHtml(player.email || "")}"
        style="margin-top:0.65rem;"
      >Add To Team</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-suggest-name]").forEach((button) => {
    button.addEventListener("click", () => {
      appendPlayerToReusableInput(
        button.getAttribute("data-suggest-name") || "",
        button.getAttribute("data-suggest-email") || ""
      );
    });
  });
}

async function searchTeamPlayerSuggestions() {
  const queryInput = document.getElementById("teamPlayerSuggestionQuery");
  const container = document.getElementById("teamPlayerSuggestions");
  if (!queryInput || !container) return;

  if (!isLoggedIn()) {
    showToast("Login required to fetch player suggestions", "error");
    showPage("login");
    return;
  }

  const q = String(queryInput.value || "").trim();
  container.innerHTML = '<p class="loading-text">Loading suggestions...</p>';

  try {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "12");

    const response = await fetch(`${API_BASE}/teams/suggestions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to load player suggestions"));
    }

    renderTeamPlayerSuggestions(payload.json.data || []);
  } catch (error) {
    console.error("Team player suggestions error:", error);
    container.innerHTML = `
      <div class="error-state" style="grid-column: 1/-1;">
        <div class="error-icon">!</div>
        <h3>Suggestions Failed</h3>
        <p>${escapeHtml(error.message || "Failed to load suggestions")}</p>
      </div>
    `;
  }
}

function renderTeamInvitations(invitations = []) {
  const container = document.getElementById("teamInvitationsList");
  if (!container) return;

  if (!Array.isArray(invitations) || invitations.length === 0) {
    container.innerHTML = '<p class="loading-text">No pending invitations.</p>';
    return;
  }

  container.innerHTML = invitations.map((invite) => `
    <div class="team-invite-card">
      <h3>${escapeHtml(invite.teamName || "Team Invitation")}</h3>
      <p>Owner: ${escapeHtml(invite.owner?.name || "Unknown")}</p>
      <p>Invited on: ${invite.invitedAt ? new Date(invite.invitedAt).toLocaleDateString("en-IN") : "-"}</p>
      <div class="team-invite-actions">
        <button type="button" class="team-accept-btn" data-team-action="accept" data-team-id="${invite.teamId}" data-member-id="${invite.memberId}">Accept</button>
        <button type="button" class="team-reject-btn" data-team-action="reject" data-team-id="${invite.teamId}" data-member-id="${invite.memberId}">Reject</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-team-action]").forEach((button) => {
    button.addEventListener("click", () => {
      respondToTeamInvitation(
        button.getAttribute("data-team-id"),
        button.getAttribute("data-member-id"),
        button.getAttribute("data-team-action")
      );
    });
  });
}

async function loadTeamInvitations() {
  const container = document.getElementById("teamInvitationsList");
  if (!container) return;

  if (!isLoggedIn()) {
    container.innerHTML = '<p class="loading-text">Login required to view invitations.</p>';
    return;
  }

  container.innerHTML = '<p class="loading-text">Loading invitations...</p>';
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/teams/invitations/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to load invitations"));
    }

    renderTeamInvitations(payload.json.data || []);
  } catch (error) {
    console.error("Load invitations error:", error);
    container.innerHTML = `<p class="loading-text">${escapeHtml(error.message || "Failed to load invitations")}</p>`;
  }
}

async function respondToTeamInvitation(teamId, memberId, action) {
  if (!teamId || !memberId || !["accept", "reject"].includes(String(action))) return;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/teams/${teamId}/invitations/${memberId}/respond`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to respond to invitation"));
    }

    showToast(payload.json.message || "Invitation response saved", "success");
    await loadTeamInvitations();
    await loadHostTeams();
  } catch (error) {
    console.error("Respond invitation error:", error);
    showToast(error.message || "Failed to respond to invitation", "error");
  }
}

async function createReusableTeamFromForm() {
  if (!isLoggedIn()) {
    await modal.alert("Login Required", "Please login to create reusable teams");
    showPage("login");
    return;
  }

  const nameInput = document.getElementById("newReusableTeamName");
  const playersInput = document.getElementById("newReusableTeamPlayers");
  if (!nameInput || !playersInput) return;

  const teamName = String(nameInput.value || "").trim();
  const members = parseTeamPlayersField(playersInput.value);

  if (!teamName) {
    showToast("Enter reusable team name", "error");
    return;
  }
  if (members.length === 0) {
    showToast("Add at least one player to reusable team", "error");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/teams`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: teamName,
        members
      })
    });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to create reusable team"));
    }

    showToast("Reusable team created", "success");
    nameInput.value = "";
    playersInput.value = "";
    await loadHostTeams();
    await loadTeamInvitations();
  } catch (error) {
    console.error("Create reusable team error:", error);
    showToast(error.message || "Failed to create reusable team", "error");
  }
}

async function randomizeBalancedTeamsFromForm() {
  if (!isLoggedIn()) {
    await modal.alert("Login Required", "Please login to use team randomization");
    showPage("login");
    return;
  }

  const teamANameField = document.getElementById("teamAName");
  const teamBNameField = document.getElementById("teamBName");
  const teamAPlayersField = document.getElementById("teamAPlayers");
  const teamBPlayersField = document.getElementById("teamBPlayers");
  if (!teamANameField || !teamBNameField || !teamAPlayersField || !teamBPlayersField) return;

  const combinedPlayers = [
    ...parseTeamPlayersField(teamAPlayersField.value),
    ...parseTeamPlayersField(teamBPlayersField.value)
  ];

  if (combinedPlayers.length < 2) {
    showToast("Add players first, then use random distribution", "error");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/teams/randomize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        players: combinedPlayers,
        historyMatches: 3,
        teamAName: teamANameField.value.trim() || "Team A",
        teamBName: teamBNameField.value.trim() || "Team B"
      })
    });

    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to randomize teams"));
    }

    const teamA = payload.json.distribution?.teamA || {};
    const teamB = payload.json.distribution?.teamB || {};

    teamANameField.value = teamA.name || teamANameField.value || "Team A";
    teamBNameField.value = teamB.name || teamBNameField.value || "Team B";
    teamAPlayersField.value = (teamA.players || [])
      .map((player) => player.email ? `${player.name}|${player.email}` : player.name)
      .join(", ");
    teamBPlayersField.value = (teamB.players || [])
      .map((player) => player.email ? `${player.name}|${player.email}` : player.name)
      .join(", ");

    showToast(
      `Teams balanced. Rating gap: ${Number(payload.json.distribution?.ratingGap || 0).toFixed(2)}`,
      "success"
    );
  } catch (error) {
    console.error("Randomize teams error:", error);
    showToast(error.message || "Failed to randomize teams", "error");
  }
}

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
  return !!localStorage.getItem("token");
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
      const creatorAction = isCreator
        ? ((match.status === 'scheduled' || match.status === 'upcoming')
          ? `<button class="start-match-btn" data-id="${match._id}">Start Match</button>`
          : `<button class="update-score-btn" data-id="${match._id}">Update Score</button>`)
        : '';
      const reportAction = `<button class="download-report-btn" data-id="${match._id}">Report</button>`;

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

function renderBillingSummary(summary = {}, role = "") {
  const container = document.getElementById("billingSummaryCards");
  if (!container) return;

  const formatMoney = (value) => `INR ${Number(value || 0).toFixed(2)}`;
  if (role === "admin" || role === "turf_owner") {
    container.innerHTML = `
      <div class="stat-card"><h4>Booked</h4><p>${Number(summary.bookedCount || 0)}</p></div>
      <div class="stat-card"><h4>Paid</h4><p>${formatMoney(summary.totalPaid)}</p></div>
      <div class="stat-card"><h4>Pending</h4><p>${formatMoney(summary.totalPending)}</p></div>
      <div class="stat-card"><h4>Refunded</h4><p>${formatMoney(summary.totalRefunded)}</p></div>
      <div class="stat-card"><h4>Cancelled</h4><p>${Number(summary.cancelledCount || 0)}</p></div>
      <div class="stat-card"><h4>Gross</h4><p>${formatMoney(summary.grossBooked)}</p></div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="stat-card"><h4>Total Bookings</h4><p>${Number(summary.totalBookings || 0)}</p></div>
    <div class="stat-card"><h4>Total Paid</h4><p>${formatMoney(summary.totalPaid)}</p></div>
    <div class="stat-card"><h4>Pending</h4><p>${formatMoney(summary.totalPending)}</p></div>
  `;
}

function renderBillingTable(rows = [], role = "") {
  const tbody = document.getElementById("billingTableBody");
  if (!tbody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">No billing records found for this filter.</td></tr>';
    return;
  }

  const canEditPayments = role === "admin" || role === "turf_owner";

  tbody.innerHTML = rows.map((booking) => {
    const invoice = escapeHtml(booking?.billing?.invoiceNumber || "N/A");
    const turfName = escapeHtml(booking?.turf?.turfName || "N/A");
    const userName = escapeHtml(booking?.user?.name || "N/A");
    const slotText = `${escapeHtml(booking?.date || "")} ${escapeHtml(booking?.startTime || "")}-${escapeHtml(booking?.endTime || "")}`;
    const amount = `INR ${Number(booking?.totalPrice || 0).toFixed(2)}`;
    const bookingStatus = escapeHtml(booking?.status || "booked");
    const paymentStatus = String(booking?.billing?.paymentStatus || "pending").toLowerCase();
    const paymentMethod = escapeHtml(booking?.billing?.paymentMethod || "");

    const paymentCell = canEditPayments
      ? `
          <select class="billing-payment-select" data-booking-id="${booking._id}">
            <option value="pending" ${paymentStatus === "pending" ? "selected" : ""}>pending</option>
            <option value="paid" ${paymentStatus === "paid" ? "selected" : ""}>paid</option>
            <option value="refunded" ${paymentStatus === "refunded" ? "selected" : ""}>refunded</option>
            <option value="failed" ${paymentStatus === "failed" ? "selected" : ""}>failed</option>
          </select>
        `
      : `${escapeHtml(paymentStatus)} ${paymentMethod ? `(${paymentMethod})` : ""}`;

    const actionCell = canEditPayments
      ? `<button class="billing-action-btn" data-update-payment-id="${booking._id}">Update</button>`
      : "-";

    return `
      <tr>
        <td>${invoice}</td>
        <td>${turfName}</td>
        <td>${userName}</td>
        <td>${slotText}</td>
        <td>${amount}</td>
        <td>${bookingStatus}</td>
        <td>${paymentCell}</td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join("");
}

async function updateBillingPaymentStatus(bookingId) {
  const select = document.querySelector(`.billing-payment-select[data-booking-id="${bookingId}"]`);
  if (!select) return;

  const paymentStatus = String(select.value || "").toLowerCase();
  const paymentMethod = paymentStatus === "paid" ? "upi" : null;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/bookings/${bookingId}/payment`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        paymentStatus,
        paymentMethod
      })
    });

    const payload = await readResponsePayload(response);
    if (!response.ok || !payload?.json?.success) {
      throw new Error(getReadableResponseError(response, payload, "Failed to update payment status"));
    }

    showToast("Payment status updated", "success");
    await loadBillingDashboard();
  } catch (error) {
    console.error("Payment status update error:", error);
    showToast(error.message || "Failed to update payment status", "error");
  }
}

async function downloadBillingCsvForRole(role = "") {
  const token = localStorage.getItem("token");
  if (!token) return;

  const from = document.getElementById("billingFromDate")?.value || "";
  const to = document.getElementById("billingToDate")?.value || "";
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const path = (role === "admin" || role === "turf_owner")
    ? "/bookings/billing/report.csv"
    : "/bookings/mybookings/report.csv";
  const query = params.toString() ? `?${params.toString()}` : "";

  try {
    const response = await fetch(`${API_BASE}${path}${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const payload = await readResponsePayload(response);
      throw new Error(getReadableResponseError(response, payload, "Failed to download billing CSV"));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (role === "admin" || role === "turf_owner")
      ? `billing-report-${Date.now()}.csv`
      : `my-bookings-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Billing CSV download error:", error);
    showToast(error.message || "Failed to download billing CSV", "error");
  }
}

async function loadBillingDashboard() {
  const tbody = document.getElementById("billingTableBody");
  if (!tbody) return;

  if (!isLoggedIn()) {
    tbody.innerHTML = '<tr><td colspan="8">Login required to access billing dashboard.</td></tr>';
    renderBillingSummary({ totalBookings: 0, totalPaid: 0, totalPending: 0 }, "");
    return;
  }

  const role = getCurrentUserRole();
  const token = localStorage.getItem("token");
  const from = document.getElementById("billingFromDate")?.value || "";
  const to = document.getElementById("billingToDate")?.value || "";
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  tbody.innerHTML = '<tr><td colspan="8">Loading billing data...</td></tr>';

  try {
    if (role === "admin" || role === "turf_owner") {
      const response = await fetch(`${API_BASE}/bookings/billing/summary${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await readResponsePayload(response);
      if (!response.ok || !payload?.json?.success) {
        throw new Error(getReadableResponseError(response, payload, "Failed to load billing summary"));
      }

      const summary = payload.json.summary || {};
      const bookings = Array.isArray(payload.json.bookings) ? payload.json.bookings : [];
      renderBillingSummary(summary, role);
      renderBillingTable(bookings, role);
    } else {
      const response = await fetch(`${API_BASE}/bookings/mybookings${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await readResponsePayload(response);
      if (!response.ok || !payload?.json?.success) {
        throw new Error(getReadableResponseError(response, payload, "Failed to load your bookings"));
      }

      const bookings = Array.isArray(payload.json.bookings) ? payload.json.bookings : [];
      const summary = bookings.reduce((acc, booking) => {
        const amount = Number(booking?.totalPrice || 0);
        acc.totalBookings += 1;
        if (String(booking?.billing?.paymentStatus || "pending") === "paid") {
          acc.totalPaid += amount;
        } else {
          acc.totalPending += amount;
        }
        return acc;
      }, { totalBookings: 0, totalPaid: 0, totalPending: 0 });

      renderBillingSummary(summary, role);
      renderBillingTable(bookings, role);
    }

    document.querySelectorAll("[data-update-payment-id]").forEach((button) => {
      button.addEventListener("click", () => updateBillingPaymentStatus(button.getAttribute("data-update-payment-id")));
    });
  } catch (error) {
    console.error("Load billing dashboard error:", error);
    tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message || "Failed to load billing data")}</td></tr>`;
    renderBillingSummary({ totalBookings: 0, totalPaid: 0, totalPending: 0 }, role);
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
    const invoice = data?.booking?.billing?.invoiceNumber;
    const paymentStatus = data?.booking?.billing?.paymentStatus || 'pending';
    const successMessage = Number.isFinite(Number(price))
      ? `Booking confirmed. Total: INR ${Number(price).toFixed(2)} | Invoice: ${invoice || 'N/A'} | Payment: ${paymentStatus}`
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

async function fetchCurrentUserTeamsForTournament() {
  if (!isLoggedIn()) return [];

  if (Array.isArray(hostTeamsCache) && hostTeamsCache.length > 0) {
    return hostTeamsCache;
  }

  await loadHostTeams();
  return Array.isArray(hostTeamsCache) ? hostTeamsCache : [];
}

function findMyTournamentRegistration(tournament = {}) {
  const myUserId = String(getCurrentUserId() || "").trim();
  if (!myUserId || !Array.isArray(tournament.registeredTeams)) return null;

  return tournament.registeredTeams.find((entry) => {
    const registeredBy = entry?.registeredBy?._id || entry?.registeredBy || "";
    return String(registeredBy) === myUserId;
  }) || null;
}

function isTournamentRegistrationOpen(status = "") {
  const normalized = String(status || "").toLowerCase();
  return normalized === "upcoming" || normalized === "registration_open";
}

function canTournamentTeamUnregister(status = "") {
  const normalized = String(status || "").toLowerCase();
  return !["ongoing", "completed", "playoffs", "cancelled"].includes(normalized);
}

async function openTournamentJoinPanel(panel, tournament, onRegistered) {
  if (!panel) return;
  if (!isLoggedIn()) {
    await modal.alert("Login Required", "Please login to join tournament with your team.");
    showPage("login");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = '<p class="loading-text">Loading your teams...</p>';

  try {
    const myTeams = await fetchCurrentUserTeamsForTournament();
    const teamOptions = myTeams
      .map((team) => ({
        team,
        players: getAcceptedTeamMembers(team)
      }))
      .filter((entry) => entry.players.length > 0);

    if (teamOptions.length === 0) {
      panel.innerHTML = `
        <p class="join-help">No reusable team with accepted players found. Create one in Host Match first.</p>
        <div class="tournament-card-actions">
          <button type="button" class="btn-logout" data-join-close>Close</button>
        </div>
      `;
      panel.querySelector("[data-join-close]")?.addEventListener("click", () => {
        panel.classList.add("hidden");
        panel.innerHTML = "";
      });
      return;
    }

    const minPlayers = Number(tournament?.minPlayers || 11);
    const maxPlayers = Number(tournament?.maxPlayers || 15);

    panel.innerHTML = `
      <form data-tournament-join-form>
        <div class="form-group">
          <label>Select My Team</label>
          <select data-join-team-select>
            ${teamOptions.map((entry) => `<option value="${entry.team._id}">${escapeHtml(entry.team.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Choose Players</label>
          <div class="selector-actions" style="margin-bottom:0.45rem;">
            <button type="button" data-join-select="all">All</button>
            <button type="button" data-join-select="clear">Clear</button>
          </div>
          <div class="join-players" data-join-players></div>
          <p class="join-help" data-join-count></p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Captain</label>
            <select data-join-captain required></select>
          </div>
          <div class="form-group">
            <label>Vice Captain (Optional)</label>
            <select data-join-vice-captain></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Wicketkeeper (Optional)</label>
            <select data-join-wicketkeeper></select>
          </div>
          <div class="form-group">
            <label>Coach (Optional)</label>
            <input type="text" data-join-coach placeholder="Coach name" />
          </div>
        </div>
        <div class="tournament-card-actions">
          <button type="submit" class="book-btn">Register Team</button>
          <button type="button" class="btn-logout" data-join-close>Cancel</button>
        </div>
      </form>
    `;

    const form = panel.querySelector("[data-tournament-join-form]");
    const teamSelect = panel.querySelector("[data-join-team-select]");
    const playersWrap = panel.querySelector("[data-join-players]");
    const countText = panel.querySelector("[data-join-count]");
    const captainSelect = panel.querySelector("[data-join-captain]");
    const viceCaptainSelect = panel.querySelector("[data-join-vice-captain]");
    const wicketkeeperSelect = panel.querySelector("[data-join-wicketkeeper]");
    const coachInput = panel.querySelector("[data-join-coach]");
    if (!form || !teamSelect || !playersWrap || !countText || !captainSelect || !viceCaptainSelect || !wicketkeeperSelect || !coachInput) {
      throw new Error("Tournament join form could not be initialized");
    }

    let currentTeamEntry = teamOptions[0];

    const getSelectedPlayers = () => {
      const selected = [];
      playersWrap.querySelectorAll("[data-join-player-index]").forEach((checkbox) => {
        if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;
        const index = Number.parseInt(checkbox.getAttribute("data-join-player-index"), 10);
        if (!Number.isFinite(index) || !currentTeamEntry.players[index]) return;
        selected.push(currentTeamEntry.players[index]);
      });
      return selected;
    };

    const fillRoleSelect = (selectElement, players, includeBlank = false) => {
      const previous = String(selectElement.value || "");
      const options = [];
      if (includeBlank) options.push('<option value="">Not selected</option>');
      players.forEach((player) => {
        options.push(`<option value="${escapeHtml(player.name)}">${escapeHtml(player.name)}</option>`);
      });
      selectElement.innerHTML = options.join("");
      if (players.some((player) => player.name === previous)) {
        selectElement.value = previous;
      } else if (!includeBlank && players.length > 0) {
        selectElement.value = players[0].name;
      }
    };

    const syncRoleSelectors = () => {
      const selectedPlayers = getSelectedPlayers();
      countText.textContent = `Selected ${selectedPlayers.length} players (required ${minPlayers}-${maxPlayers}).`;
      fillRoleSelect(captainSelect, selectedPlayers, false);
      fillRoleSelect(viceCaptainSelect, selectedPlayers, true);
      fillRoleSelect(wicketkeeperSelect, selectedPlayers, true);
    };

    const renderPlayerChecks = () => {
      const selectedTeamId = String(teamSelect.value || "");
      currentTeamEntry = teamOptions.find((entry) => String(entry.team._id) === selectedTeamId) || teamOptions[0];
      playersWrap.innerHTML = currentTeamEntry.players.map((player, index) => `
        <label class="join-player-item">
          <input type="checkbox" data-join-player-index="${index}" checked />
          <span>${escapeHtml(player.name)}</span>
          ${player.email ? `<small>${escapeHtml(player.email)}</small>` : ""}
        </label>
      `).join("");

      playersWrap.querySelectorAll("[data-join-player-index]").forEach((checkbox) => {
        checkbox.addEventListener("change", syncRoleSelectors);
      });
      syncRoleSelectors();
    };

    panel.querySelectorAll("[data-join-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-join-select");
        playersWrap.querySelectorAll("[data-join-player-index]").forEach((checkbox) => {
          if (!(checkbox instanceof HTMLInputElement)) return;
          checkbox.checked = mode === "all";
        });
        syncRoleSelectors();
      });
    });

    teamSelect.addEventListener("change", renderPlayerChecks);
    renderPlayerChecks();

    panel.querySelector("[data-join-close]")?.addEventListener("click", () => {
      panel.classList.add("hidden");
      panel.innerHTML = "";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const selectedPlayers = getSelectedPlayers();
      if (selectedPlayers.length < minPlayers || selectedPlayers.length > maxPlayers) {
        showToast(`Select ${minPlayers}-${maxPlayers} players`, "error");
        return;
      }

      const captainName = String(captainSelect.value || "").trim();
      if (!captainName) {
        showToast("Select a captain", "error");
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/tournaments/${tournament._id}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            teamId: currentTeamEntry.team._id,
            teamName: currentTeamEntry.team.name,
            captain: captainName,
            viceCaptain: String(viceCaptainSelect.value || "").trim() || undefined,
            wicketkeeper: String(wicketkeeperSelect.value || "").trim() || undefined,
            coach: String(coachInput.value || "").trim() || undefined,
            players: selectedPlayers.map((player) => ({
              name: player.name,
              ...(player.userId ? { playerId: player.userId } : {})
            }))
          })
        });

        const payload = await readResponsePayload(response);
        if (!response.ok || !payload?.json?.success) {
          throw new Error(getReadableResponseError(response, payload, "Failed to register team"));
        }

        showToast(payload.json.message || "Team registered in tournament", "success");
        panel.classList.add("hidden");
        panel.innerHTML = "";
        if (typeof onRegistered === "function") {
          await onRegistered();
        }
      } catch (error) {
        console.error("Tournament register team error:", error);
        showToast(error.message || "Failed to register team", "error");
      }
    });
  } catch (error) {
    console.error("Open tournament join panel error:", error);
    panel.innerHTML = `<p class="join-help">${escapeHtml(error.message || "Failed to load team join form")}</p>`;
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
  const teamASelect = document.getElementById("teamASelect");
  const teamBSelect = document.getElementById("teamBSelect");
  teamASelect?.addEventListener("change", () => applySelectedReusableTeam("A"));
  teamBSelect?.addEventListener("change", () => applySelectedReusableTeam("B"));
  document.getElementById("teamAPlayers")?.addEventListener("blur", () => renderTeamPlayingSelector("A"));
  document.getElementById("teamBPlayers")?.addEventListener("blur", () => renderTeamPlayingSelector("B"));
  renderTeamPlayingSelector("A");
  renderTeamPlayingSelector("B");

  document.getElementById("createReusableTeamBtn")?.addEventListener("click", createReusableTeamFromForm);
  document.getElementById("balanceTeamsBtn")?.addEventListener("click", randomizeBalancedTeamsFromForm);
  document.getElementById("refreshBillingBtn")?.addEventListener("click", loadBillingDashboard);
  document.getElementById("downloadBillingBtn")?.addEventListener("click", () => {
    downloadBillingCsvForRole(getCurrentUserRole());
  });
  document.getElementById("searchTeamSuggestionsBtn")?.addEventListener("click", () => {
    searchTeamPlayerSuggestions();
  });
  document.getElementById("teamPlayerSuggestionQuery")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    searchTeamPlayerSuggestions();
  });

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
      teamAId: document.getElementById("teamASelect")?.value || null,
      teamAPlayers: parseTeamPlayersField(document.getElementById("teamAPlayers").value),
      teamBName: document.getElementById("teamBName").value.trim(),
      teamBId: document.getElementById("teamBSelect")?.value || null,
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
        setHostTeamSelectOptions(hostTeamsCache);
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
    btn.addEventListener('click', async () => {
      const extraType = btn.getAttribute('data-extra');
      const runs = await promptExtraRuns(extraType);
      if (runs === null) return;
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
      const response = await fetch(`${API_BASE}/tournaments`);
      const payload = await readResponsePayload(response);
      const tournaments = Array.isArray(payload?.json?.tournaments) ? payload.json.tournaments : [];

      if (response.ok && tournaments.length > 0) {
        tournamentsList.innerHTML = '<div class="tournaments-grid"></div>';
        const grid = tournamentsList.querySelector(".tournaments-grid");
        const myUserId = String(getCurrentUserId() || "").trim();

        tournaments.forEach((tournament) => {
          const status = String(tournament.status || "upcoming").toLowerCase();
          const registeredTeams = Array.isArray(tournament.registeredTeams) ? tournament.registeredTeams : [];
          const myRegisteredTeam = myUserId
            ? findMyTournamentRegistration(tournament)
            : null;
          const canRegister = isLoggedIn()
            && !myRegisteredTeam
            && isTournamentRegistrationOpen(status)
            && registeredTeams.length < Number(tournament.maxTeams || 0);
          const canUnregister = isLoggedIn()
            && Boolean(myRegisteredTeam)
            && canTournamentTeamUnregister(status);

          const card = document.createElement("div");
          card.className = "tournament-card";
          card.innerHTML = `
            <div class="tournament-icon">T</div>
            <h3>${escapeHtml(tournament.name)}</h3>
            <span class="status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span>
            <p>${escapeHtml(tournament.description || "No description")}</p>
            <p><strong>Venue:</strong> ${escapeHtml(tournament.venue)}</p>
            <p><strong>Dates:</strong> ${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()}</p>
            <p><strong>Format:</strong> ${escapeHtml(tournament.format || "T20")}</p>
            <p><strong>Teams:</strong> ${registeredTeams.length}/${tournament.maxTeams || 0}</p>
            <p><strong>Prize:</strong> ${escapeHtml(formatPrizePool(tournament.prizePool))}</p>
            ${myRegisteredTeam ? `<p><strong>My Team:</strong> ${escapeHtml(myRegisteredTeam.teamName || "Registered")}</p>` : ""}
            <div class="tournament-card-actions">
              ${canRegister ? '<button type="button" class="book-btn" data-tournament-action="join">Join With My Team</button>' : ''}
              ${canUnregister ? '<button type="button" class="team-reject-btn" data-tournament-action="unregister">Unregister My Team</button>' : ''}
            </div>
            <div class="tournament-join-panel hidden" data-join-panel></div>
          `;

          const joinPanel = card.querySelector("[data-join-panel]");
          const joinButton = card.querySelector('[data-tournament-action="join"]');
          const unregisterButton = card.querySelector('[data-tournament-action="unregister"]');

          joinButton?.addEventListener("click", async () => {
            if (!joinPanel) return;
            const isOpen = !joinPanel.classList.contains("hidden");
            if (isOpen) {
              joinPanel.classList.add("hidden");
              joinPanel.innerHTML = "";
              return;
            }
            await openTournamentJoinPanel(joinPanel, tournament, loadTournamentsList);
          });

          unregisterButton?.addEventListener("click", async () => {
            if (!myRegisteredTeam) return;
            const confirm = await modal.confirm(
              "Unregister Team",
              `Remove ${myRegisteredTeam.teamName || "your team"} from this tournament?`
            );
            if (!confirm) return;

            try {
              const token = localStorage.getItem("token");
              const responseUnregister = await fetch(`${API_BASE}/tournaments/${tournament._id}/unregister`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  teamId: myRegisteredTeam.teamId?._id || myRegisteredTeam.teamId || null,
                  teamName: myRegisteredTeam.teamName || ""
                })
              });

              const unregisterPayload = await readResponsePayload(responseUnregister);
              if (!responseUnregister.ok || !unregisterPayload?.json?.success) {
                throw new Error(getReadableResponseError(responseUnregister, unregisterPayload, "Failed to unregister team"));
              }

              showToast(unregisterPayload.json.message || "Team unregistered", "success");
              await loadTournamentsList();
            } catch (error) {
              console.error("Tournament unregister error:", error);
              showToast(error.message || "Failed to unregister team", "error");
            }
          });

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











