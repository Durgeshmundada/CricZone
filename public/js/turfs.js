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
      const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'180\'%3E%3Crect fill=\'%23e8efe7\' width=\'300\' height=\'180\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'18\' fill=\'%23677f75\'%3ETurf%3C/text%3E%3C/svg%3E';
      const imageUrl = sanitizeImageUrl(turf.images?.[0], fallbackImage);
      const turfId = safeObjectId(turf._id);

      const turfCard = document.createElement('div');
      turfCard.className = 'turf-card';
      turfCard.innerHTML = `
        <div class="turf-image">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(turf.turfName || 'Turf')}" />
        </div>
        <div class="turf-details">
          <h3>${escapeHtml(turf.turfName || 'Unnamed Turf')}</h3>
          <p><strong>Location:</strong> ${escapeHtml(city)}${state ? `, ${escapeHtml(state)}` : ''}</p>
          <p><strong>Sports:</strong> ${escapeHtml(sports)}</p>
          <p><strong>Surface:</strong> ${escapeHtml(surfaceType)}</p>
          <p><strong>Price:</strong> INR ${escapeHtml(pricePerSlot)}</p>
          <p><strong>Owner:</strong> ${escapeHtml(ownerName)}</p>
          <button type="button" class="book-btn" data-book-turf-id="${escapeHtml(turfId)}">Book Now</button>
        </div>
      `;
      turfCard.querySelector("[data-book-turf-id]")?.addEventListener("click", () => bookTurf(turfId));
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
