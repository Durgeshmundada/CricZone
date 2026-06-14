const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");
const publicIndexPath = path.join(projectRoot, "public", "index.html");
const publicScriptPaths = [
  "api.js",
  "ui.js",
  "teams.js",
  "matches.js",
  "bookings.js",
  "players.js",
  "turfs.js",
  "tournaments.js",
  "app.js"
].map((fileName) => path.join(projectRoot, "public", "js", fileName));
const runtimeConfigPath = path.join(projectRoot, "public", "runtime-config.js");
const publicStylesPath = path.join(projectRoot, "public", "styles.css");
const serviceWorkerPath = path.join(projectRoot, "public", "sw.js");
const expectedPublicScriptSources = [
  "runtime-config.js",
  "js/api.js",
  "js/ui.js",
  "js/teams.js",
  "js/matches.js",
  "js/bookings.js",
  "js/players.js",
  "js/turfs.js",
  "js/tournaments.js",
  "js/app.js"
];

const readPublicScripts = () => publicScriptPaths
  .map((scriptPath) => fs.readFileSync(scriptPath, "utf8"))
  .join("\n");

const DYNAMIC_IDS_CREATED_AT_RUNTIME = new Set([
  "cancelTournamentBtn",
  "newTournamentForm",
  "tournamentDesc",
  "tournamentEndDate",
  "tournamentFormat",
  "tournamentMaxTeams",
  "tournamentName",
  "tournamentPrize",
  "tournamentStartDate",
  "tournamentVenue"
]);

describe("public app shell contracts", () => {
  test("static HTML contains every literal DOM id referenced by the shipped script", () => {
    const script = readPublicScripts();
    const html = fs.readFileSync(publicIndexPath, "utf8");

    const scriptIds = new Set();
    const htmlIds = new Set();

    for (const match of script.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
      scriptIds.add(match[1]);
    }

    for (const match of html.matchAll(/id="([^"]+)"/g)) {
      htmlIds.add(match[1]);
    }

    const missingStaticIds = [...scriptIds]
      .filter((id) => !htmlIds.has(id))
      .filter((id) => !DYNAMIC_IDS_CREATED_AT_RUNTIME.has(id))
      .sort();

    expect(missingStaticIds).toEqual([]);
  });

  test("runtime config does not hardcode a deployed API URL by default", () => {
    const runtimeConfig = fs.readFileSync(runtimeConfigPath, "utf8");

    expect(runtimeConfig).toContain('window.__API_BASE__ = ""');
    expect(runtimeConfig).not.toMatch(/https?:\/\/[^\s"]+/i);
  });

  test("shipped script parses and defaults to same-origin API configuration", () => {
    const script = readPublicScripts();

    publicScriptPaths.forEach((scriptPath) => {
      expect(() => new vm.Script(fs.readFileSync(scriptPath, "utf8"), { filename: scriptPath })).not.toThrow();
    });
    expect(script).toContain('const DEFAULT_API_BASE = ""');
    expect(script).toContain("window.location.origin");
    expect(script).not.toContain("https://criczone-app.onrender.com/api");
  });

  test("loads the modular scripts in their required dependency order", () => {
    const html = fs.readFileSync(publicIndexPath, "utf8");
    const localScriptSources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((source) => !source.startsWith("https://"));

    expect(localScriptSources).toEqual(expectedPublicScriptSources);
    expect(html).not.toContain('src="script.js"');
  });

  test("does not ship inline event handlers and keeps rendering guards", () => {
    const html = fs.readFileSync(publicIndexPath, "utf8");
    const script = readPublicScripts();
    const inlineHandlerPattern = /\son(?:click|change|submit|load|error|input)\s*=/i;

    expect(html).not.toMatch(inlineHandlerPattern);
    expect(script).not.toMatch(inlineHandlerPattern);
    expect(script).toContain('.replace(/"/g, "&quot;")');
    expect(script).toContain(".replace(/'/g, \"&#39;\")");
    expect(script).toContain("function safeCssToken");
    expect(script).toContain("function safeObjectId");
    expect(script).toContain("function sanitizeImageUrl");
    expect(script).not.toMatch(/data:image\\\/svg\+xml.*return raw/);
  });

  test("associates static labels and exposes accessible navigation and dialog semantics", () => {
    const html = fs.readFileSync(publicIndexPath, "utf8");
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    const labels = [...html.matchAll(/<label\b([^>]*)>/g)];

    labels.forEach(([, attributes]) => {
      const forMatch = attributes.match(/\sfor="([^"]+)"/);
      expect(forMatch).not.toBeNull();
      expect(ids.has(forMatch[1])).toBe(true);
    });

    expect(html).toContain('nav class="navbar" aria-label="Primary navigation"');
    expect(html).toContain('href="#home" data-page="home"');
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html).toMatch(/id="customModal"[^>]*\sinert(?:\s|>)/);
    expect(html).toContain('id="modalClose" type="button" aria-label="Close dialog"');
    expect(html).toContain('id="toastContainer" class="toast-container" aria-live="polite"');
    expect(html).toContain('data-page="forgot-password"');
    expect(html).toContain('id="forgotPasswordForm"');
    expect(html).toContain('id="resetPasswordForm"');
    expect(html).toContain('id="resetPasswordStatus" class="form-status" role="status"');
  });

  test("keeps keyboard focus and reduced-motion accessibility protections", () => {
    const script = readPublicScripts();
    const styles = fs.readFileSync(publicStylesPath, "utf8");

    expect(script).toContain("handleKeydown(event)");
    expect(script).toContain("event.key === 'Escape'");
    expect(script).toContain("event.key !== 'Tab'");
    expect(script).toContain("lastFocusedElement");
    expect(script).toContain("menuToggle.focus()");
    expect(script).toContain("navMenu.toggleAttribute('inert', !active)");
    expect(script).toContain("removeAttribute('inert')");
    expect(script).toContain("setAttribute('inert', '')");
    expect(script).toContain("activeElement.blur()");
    expect(script).toContain("pageHeading.focus({ preventScroll: true })");
    expect(script).toContain("focusTarget.focus()");
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  test("ships an upgrade-safe PWA without placeholder analytics", () => {
    const html = fs.readFileSync(publicIndexPath, "utf8");
    const script = readPublicScripts();
    const styles = fs.readFileSync(publicStylesPath, "utf8");
    const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");

    expect(html).not.toContain("G-XXXXXXXXXX");
    expect(html).not.toContain("googletagmanager.com");
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
    expect(styles).not.toMatch(/input:invalid/);
    expect(script).toContain('validateStoredSession');
    expect(script).toContain('clearStoredSession');
    expect(script).toContain('window.addEventListener("hashchange"');
    expect(script).toContain('hadStoredSession && !sessionIsValid ? "login" : "home"');
    expect(script).toContain('register("/sw.js?v=7"');
    expect(script).toContain('updateViaCache: "none"');
    expect(serviceWorker).toContain('criczone-static-v7');
    expect(serviceWorker.indexOf('fetch(request)')).toBeLessThan(serviceWorker.indexOf('caches.match(request)'));
  });
});
