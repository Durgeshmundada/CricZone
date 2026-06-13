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
      <p class="player-sub">${escapeHtml(type)} â€¢ ${escapeHtml(location)}</p>
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

