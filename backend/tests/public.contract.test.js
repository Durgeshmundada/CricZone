const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const publicIndexPath = path.join(projectRoot, "public", "index.html");
const publicScriptPath = path.join(projectRoot, "public", "script.js");
const runtimeConfigPath = path.join(projectRoot, "public", "runtime-config.js");

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
    const script = fs.readFileSync(publicScriptPath, "utf8");
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
});
