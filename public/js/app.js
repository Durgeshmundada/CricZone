// MAIN INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  registerServiceWorker();
  setupInstallPrompt();

  document.addEventListener("click", (event) => {
    const apiSettingsButton = event.target instanceof Element
      ? event.target.closest("[data-open-api-settings]")
      : null;
    if (apiSettingsButton) openApiSettings();
  });

  const canContinue = await ensureNativeApiBaseConfigured();
  if (!canContinue) return;

  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  setupMobileNavigation();
  const readAuthHashRoute = () => {
    const [page, query = ""] = window.location.hash.slice(1).split("?");
    return {
      page,
      token: page === "reset-password"
        ? new URLSearchParams(query).get("token") || ""
        : ""
    };
  };
  const initialAuthRoute = readAuthHashRoute();
  const requestedPage = initialAuthRoute.page;
  const publicAuthPages = new Set(["login", "signup", "forgot-password", "reset-password"]);
  const requestedAuthPage = publicAuthPages.has(requestedPage) ? requestedPage : "";
  let resetToken = initialAuthRoute.token;
  const hadStoredSession = Boolean(localStorage.getItem('token'));
  const sessionIsValid = await validateStoredSession();
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

  const initialPage = requestedAuthPage === "reset-password" && !resetToken
    ? "forgot-password"
    : requestedAuthPage || (hadStoredSession && !sessionIsValid ? "login" : "home");
  showPage(initialPage);

  if (isNativePlatform() && !isLoggedIn() && !requestedAuthPage) {
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
        if (page) {
          if (window.location.hash.startsWith("#reset-password")) {
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${page}`);
          }
          showPage(page);
        }
      });
    }
  });

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", async () => {
    const confirmed = await modal.confirm("Logout", "Are you sure you want to log out?");
    if (!confirmed) return;
    try {
      await fetch(`${API_BASE}/users/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    } catch (_error) {
      // Local logout still completes when the API is unavailable.
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem(REFRESH_SESSION_MARKER);
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
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const submitBtn = loginForm.querySelector('.submit-btn');

      // Remove previous invalid highlights
      emailInput.classList.remove('invalid');
      passwordInput.classList.remove('invalid');

      let hasError = false;
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        emailInput.classList.add('invalid');
        hasError = true;
      }
      if (!password || password.length < 6) {
        passwordInput.classList.add('invalid');
        hasError = true;
      }
      if (hasError) {
        showToast('Please enter a valid email and password (min 6 chars)', 'error');
        return;
      }

      try {
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        const response = await fetch(`${API_BASE}/users/login`, {
          method: 'POST',
          credentials: 'include',
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
          markStoredSessionActive();

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

  // FORGOT PASSWORD FORM
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  forgotPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailInput = document.getElementById("forgotPasswordEmail");
    const status = document.getElementById("forgotPasswordStatus");
    const submitBtn = forgotPasswordForm.querySelector(".submit-btn");
    const email = emailInput.value.trim();

    emailInput.classList.remove("invalid");
    status.className = "form-status";
    status.textContent = "";

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      emailInput.classList.add("invalid");
      status.classList.add("error");
      status.textContent = "Enter a valid email address.";
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      const response = await fetch(`${API_BASE}/users/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(getReadableResponseError(response, payload, "Unable to request a reset link"));
      }

      status.classList.add("success");
      status.textContent = payload.json?.message ||
        "If an account exists for that email, a password reset link has been sent.";
      forgotPasswordForm.reset();
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message || "Unable to request a reset link. Please try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Reset Link";
    }
  });

  // RESET PASSWORD FORM
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const resetPasswordStatus = document.getElementById("resetPasswordStatus");
  const resetSubmitBtn = resetPasswordForm?.querySelector(".submit-btn");
  let hasValidResetToken = /^[a-f0-9]{64}$/i.test(resetToken);

  const updateResetTokenState = () => {
    hasValidResetToken = /^[a-f0-9]{64}$/i.test(resetToken);
    resetPasswordStatus.className = "form-status";
    resetPasswordStatus.textContent = "";
    resetSubmitBtn.disabled = !hasValidResetToken;

    if (resetToken && !hasValidResetToken) {
      resetPasswordStatus.classList.add("error");
      resetPasswordStatus.textContent = "This password reset link is invalid. Request a new link.";
    }
  };

  if (resetPasswordForm && requestedPage === "reset-password" && !hasValidResetToken) {
    resetPasswordStatus.classList.add("error");
    resetPasswordStatus.textContent = "This password reset link is invalid. Request a new link.";
    resetSubmitBtn.disabled = true;
  }

  window.addEventListener("hashchange", () => {
    const route = readAuthHashRoute();
    if (!publicAuthPages.has(route.page)) return;

    if (route.page === "reset-password") {
      resetToken = route.token;
      updateResetTokenState();
      showPage(resetToken ? "reset-password" : "forgot-password");
      return;
    }

    showPage(route.page);
  });

  resetPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const passwordInput = document.getElementById("resetPassword");
    const confirmInput = document.getElementById("resetPasswordConfirm");
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    passwordInput.classList.remove("invalid");
    confirmInput.classList.remove("invalid");
    resetPasswordStatus.className = "form-status";
    resetPasswordStatus.textContent = "";

    if (!hasValidResetToken) {
      resetPasswordStatus.classList.add("error");
      resetPasswordStatus.textContent = "This password reset link is invalid. Request a new link.";
      return;
    }

    if (password.length < 8 || password.length > 128) {
      passwordInput.classList.add("invalid");
      resetPasswordStatus.classList.add("error");
      resetPasswordStatus.textContent = "Password must be between 8 and 128 characters.";
      return;
    }

    if (password !== confirmPassword) {
      confirmInput.classList.add("invalid");
      resetPasswordStatus.classList.add("error");
      resetPasswordStatus.textContent = "Passwords do not match.";
      return;
    }

    try {
      resetSubmitBtn.disabled = true;
      resetSubmitBtn.textContent = "Resetting...";
      const response = await fetch(
        `${API_BASE}/users/reset-password/${encodeURIComponent(resetToken)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ password, confirmPassword })
        }
      );
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(getReadableResponseError(response, payload, "Unable to reset password"));
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem(REFRESH_SESSION_MARKER);
      setUserFromStorage();
      resetPasswordForm.reset();
      resetPasswordStatus.classList.add("success");
      resetPasswordStatus.textContent = payload.json?.message || "Password reset successfully.";
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#login`
      );
      setTimeout(() => showPage("login"), 1200);
    } catch (error) {
      resetPasswordStatus.classList.add("error");
      resetPasswordStatus.textContent = error.message || "Unable to reset password. Please try again.";
    } finally {
      resetSubmitBtn.disabled = false;
      resetSubmitBtn.textContent = "Reset Password";
    }
  });

  // SIGNUP FORM
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('signupName');
      const emailInput = document.getElementById('signupEmail');
      const phoneInput = document.getElementById('signupPhone');
      const passwordInput = document.getElementById('signupPassword');
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value.trim();
      const submitBtn = signupForm.querySelector('.submit-btn');

      // Remove previous invalid highlights
      nameInput.classList.remove('invalid');
      emailInput.classList.remove('invalid');
      phoneInput.classList.remove('invalid');
      passwordInput.classList.remove('invalid');

      let hasError = false;
      if (!name) {
        nameInput.classList.add('invalid');
        hasError = true;
      }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        emailInput.classList.add('invalid');
        hasError = true;
      }
      if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
        phoneInput.classList.add('invalid');
        hasError = true;
      }
      if (!password || password.length < 6) {
        passwordInput.classList.add('invalid');
        hasError = true;
      }
      if (hasError) {
        showToast('Please fill all fields correctly.', 'error');
        return;
      }

      try {
        submitBtn.textContent = 'Signing up...';
        submitBtn.disabled = true;

        const response = await fetch(`${API_BASE}/users/signup`, {
          method: 'POST',
          credentials: 'include',
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
          markStoredSessionActive();
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
  document.getElementById('endInningsBtn')?.addEventListener('click', endCurrentInnings);
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
            <label for="tournamentName">Tournament Name</label>
            <input type="text" id="tournamentName" required />
          </div>
          <div class="form-group">
            <label for="tournamentDesc">Description</label>
            <textarea id="tournamentDesc" rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="tournamentStartDate">Start Date</label>
              <input type="date" id="tournamentStartDate" required />
            </div>
            <div class="form-group">
              <label for="tournamentEndDate">End Date</label>
              <input type="date" id="tournamentEndDate" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="tournamentVenue">Venue</label>
              <input type="text" id="tournamentVenue" required />
            </div>
            <div class="form-group">
              <label for="tournamentFormat">Format</label>
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
              <label for="tournamentMaxTeams">Max Teams</label>
              <input type="number" id="tournamentMaxTeams" value="8" min="2" max="32" />
            </div>
            <div class="form-group">
              <label for="tournamentPrize">Prize Pool</label>
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
            <span class="status-badge ${safeCssToken(status, "upcoming")}">${escapeHtml(status)}</span>
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
                }
              });
              const unregisterPayload = await readResponsePayload(responseUnregister);
              if (!responseUnregister.ok || !unregisterPayload?.json?.success) {
                throw new Error(
                  getReadableResponseError(responseUnregister, unregisterPayload, "Failed to unregister team")
                );
              }
              showToast(unregisterPayload.json.message || "Team unregistered", "success");
              loadTournamentsList();
            } catch (error) {
              showToast(error.message || "Failed to unregister team", "error");
            }
          });

          grid.appendChild(card);
        });
      } else {
        tournamentsList.innerHTML = '<p class="loading-text">No tournaments found.</p>';
      }
    } catch (err) {
      tournamentsList.innerHTML = '<p class="loading-text">Failed to load tournaments.</p>';
    }
  }
});
