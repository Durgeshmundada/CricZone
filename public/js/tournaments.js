async function loadTournamentOptions() {
  const tournamentSelect = document.getElementById("tournamentSelect");
  if (!tournamentSelect) return;
  
  try {
    tournamentSelect.innerHTML = '<option value="">Loading...</option>';
    const tournamentsGrid = document.getElementById('tournamentsGrid');
    if (tournamentsGrid) {
      tournamentsGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    }
    const res = await fetch(`${API_BASE}/tournaments`);
    const data = await res.json();
    if (res.ok && data.tournaments) {
      tournamentSelect.replaceChildren(new Option("Not part of tournament", ""));
      data.tournaments.forEach(t => {
        if (["upcoming", "ongoing", "registration_open", "registration_closed", "playoffs"].includes(t.status)) {
          const tournamentId = safeObjectId(t._id);
          if (tournamentId) tournamentSelect.add(new Option(String(t.name || "Tournament"), tournamentId));
        }
      });
      hideErrorBanner();
      if (tournamentsGrid) tournamentsGrid.innerHTML = '';
    } else {
      showErrorBanner("Failed to load tournaments from server.");
      if (tournamentsGrid) tournamentsGrid.innerHTML = '<p class="loading-text">Failed to load tournaments.</p>';
    }
  } catch (err) {
    showErrorBanner("Network error: Unable to load tournaments.");
    const tournamentsGrid = document.getElementById('tournamentsGrid');
    if (tournamentsGrid) tournamentsGrid.innerHTML = '<p class="loading-text">Network error.</p>';
    console.error("Failed to load tournaments:", err);
  }
}

async function fetchCurrentUserTeamsForTournament() {
  if (!isLoggedIn()) return [];

  if (Array.isArray(hostTeamsCache) && hostTeamsCache.length > 0) {
    hideErrorBanner();
    return hostTeamsCache;
  }

  try {
    await loadHostTeams();
    hideErrorBanner();
  } catch (err) {
    showErrorBanner("Network error: Unable to load your teams.");
  }
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
    const joinIdSuffix = safeObjectId(tournament?._id) || "current";

    panel.innerHTML = `
      <form data-tournament-join-form>
        <div class="form-group">
          <label for="joinTeam-${joinIdSuffix}">Select My Team</label>
          <select id="joinTeam-${joinIdSuffix}" data-join-team-select>
            ${teamOptions.map((entry) => `<option value="${escapeHtml(safeObjectId(entry.team._id))}">${escapeHtml(entry.team.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <p class="selector-label">Choose Players</p>
          <div class="selector-actions" style="margin-bottom:0.45rem;">
            <button type="button" data-join-select="all">All</button>
            <button type="button" data-join-select="clear">Clear</button>
          </div>
          <div class="join-players" data-join-players></div>
          <p class="join-help" data-join-count></p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="joinCaptain-${joinIdSuffix}">Captain</label>
            <select id="joinCaptain-${joinIdSuffix}" data-join-captain required></select>
          </div>
          <div class="form-group">
            <label for="joinViceCaptain-${joinIdSuffix}">Vice Captain (Optional)</label>
            <select id="joinViceCaptain-${joinIdSuffix}" data-join-vice-captain></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="joinWicketkeeper-${joinIdSuffix}">Wicketkeeper (Optional)</label>
            <select id="joinWicketkeeper-${joinIdSuffix}" data-join-wicketkeeper></select>
          </div>
          <div class="form-group">
            <label for="joinCoach-${joinIdSuffix}">Coach (Optional)</label>
            <input id="joinCoach-${joinIdSuffix}" type="text" data-join-coach placeholder="Coach name" />
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
