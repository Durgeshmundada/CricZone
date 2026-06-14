// Google Analytics event tracking utility
function trackEvent(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

// Persistent error banner utility
function showErrorBanner(message) {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  banner.textContent = message;
  banner.style.display = 'block';
}

function hideErrorBanner() {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  banner.style.display = 'none';
}

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

const DEFAULT_API_BASE = "";
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

const getSameOriginApiBase = () => {
  try {
    if (typeof window === "undefined" || !window.location || !window.location.origin) {
      return "";
    }
    return normalizeApiBase(`${window.location.origin}/api`);
  } catch (_error) {
    return "";
  }
};

const getCurrentApiBase = () =>
  normalizeApiBase(window.__API_BASE__) ||
  readStoredApiBase() ||
  getSameOriginApiBase() ||
  normalizeApiBase(DEFAULT_API_BASE);

const API_BASE = getCurrentApiBase();
const nativeFetch = window.fetch.bind(window);
const REFRESH_SESSION_MARKER = 'criczone_refresh_session';
let sessionInvalidationHandled = false;

const markStoredSessionActive = () => {
  try {
    localStorage.setItem(REFRESH_SESSION_MARKER, '1');
  } catch (_error) {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  sessionInvalidationHandled = false;
  hideErrorBanner();
};

const hasRefreshSessionMarker = () => {
  try {
    return localStorage.getItem(REFRESH_SESSION_MARKER) === '1';
  } catch (_error) {
    return false;
  }
};

const readJwtExpiry = (token) => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    return Number(decoded.exp) || null;
  } catch (_error) {
    return null;
  }
};

const clearStoredSession = (message = "Your session is no longer valid. Please log in again.") => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(REFRESH_SESSION_MARKER);
  } catch (_error) {
    // Storage can be unavailable in privacy-restricted contexts.
  }

  if (sessionInvalidationHandled) return;
  sessionInvalidationHandled = true;
  if (typeof setUserFromStorage === 'function') setUserFromStorage();
  showErrorBanner(message);
  if (typeof showPage === 'function') showPage('login');
};

const refreshStoredSession = async () => {
  try {
    const response = await nativeFetch(`${API_BASE}/users/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!response.ok) return false;

    const data = await response.json().catch(() => null);
    if (!data?.token) return false;
    localStorage.setItem('token', data.token);
    markStoredSessionActive();
    return true;
  } catch (_error) {
    return false;
  }
};

const validateStoredSession = async () => {
  const token = localStorage.getItem('token');
  if (!token) return false;

  const expiry = readJwtExpiry(token);
  if (expiry && expiry * 1000 <= Date.now()) {
    if (hasRefreshSessionMarker() && await refreshStoredSession()) return true;
    clearStoredSession('Your session expired. Please log in again.');
    return false;
  }

  try {
    const response = await nativeFetch(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) return true;
    if (
      response.status === 401 &&
      hasRefreshSessionMarker() &&
      await refreshStoredSession()
    ) {
      return true;
    }
    if (response.status === 401) clearStoredSession();
    return false;
  } catch (_error) {
    // Keep the local session during temporary network outages.
    return true;
  }
};

const requestHasBearerToken = (input, options = {}) => {
  try {
    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(options.headers || requestHeaders);
    return /^Bearer\s+\S+/i.test(headers.get('Authorization') || '');
  } catch (_error) {
    return false;
  }
};

window.fetch = async (input, options = {}) => {
  const response = await nativeFetch(input, options);
  if (response.status === 401 && requestHasBearerToken(input, options)) {
    clearStoredSession();
  }
  return response;
};

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
    <button type="button" class="book-btn" style="margin-top: 10px;" data-open-api-settings>
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
    const json = JSON.parse(text);
    return { text, json };
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
      const registration = await navigator.serviceWorker.register("/sw.js?v=8", {
        updateViaCache: "none"
      });
      await registration.update();
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
  // No-op: always return true, API base is hardcoded
  return true;
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
