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
    .map((team) => `<option value="${escapeHtml(safeObjectId(team._id))}">${escapeHtml(team.name)}</option>`)
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
        <button type="button" class="team-accept-btn" data-team-action="accept" data-team-id="${escapeHtml(safeObjectId(invite.teamId))}" data-member-id="${escapeHtml(safeObjectId(invite.memberId))}">Accept</button>
        <button type="button" class="team-reject-btn" data-team-action="reject" data-team-id="${escapeHtml(safeObjectId(invite.teamId))}" data-member-id="${escapeHtml(safeObjectId(invite.memberId))}">Reject</button>
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


