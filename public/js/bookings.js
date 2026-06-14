function renderBillingSummary(summary = {}, role = "") {
  const container = document.getElementById("billingSummaryCards");
  if (!container) return;

  const formatMoney = (value) => `INR ${Number(value || 0).toFixed(2)}`;
  if (role === "admin" || role === "turf_owner") {
    container.innerHTML = `
      <div class="stat-card"><p class="stat-label">Booked</p><p>${Number(summary.bookedCount || 0)}</p></div>
      <div class="stat-card"><p class="stat-label">Paid</p><p>${formatMoney(summary.totalPaid)}</p></div>
      <div class="stat-card"><p class="stat-label">Pending</p><p>${formatMoney(summary.totalPending)}</p></div>
      <div class="stat-card"><p class="stat-label">Refunded</p><p>${formatMoney(summary.totalRefunded)}</p></div>
      <div class="stat-card"><p class="stat-label">Cancelled</p><p>${Number(summary.cancelledCount || 0)}</p></div>
      <div class="stat-card"><p class="stat-label">Gross</p><p>${formatMoney(summary.grossBooked)}</p></div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="stat-card"><p class="stat-label">Total Bookings</p><p>${Number(summary.totalBookings || 0)}</p></div>
    <div class="stat-card"><p class="stat-label">Total Paid</p><p>${formatMoney(summary.totalPaid)}</p></div>
    <div class="stat-card"><p class="stat-label">Pending</p><p>${formatMoney(summary.totalPending)}</p></div>
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
          <select class="billing-payment-select" aria-label="Payment status for ${invoice}" data-booking-id="${escapeHtml(safeObjectId(booking._id))}">
            <option value="pending" ${paymentStatus === "pending" ? "selected" : ""}>pending</option>
            <option value="paid" ${paymentStatus === "paid" ? "selected" : ""}>paid</option>
            <option value="refunded" ${paymentStatus === "refunded" ? "selected" : ""}>refunded</option>
            <option value="failed" ${paymentStatus === "failed" ? "selected" : ""}>failed</option>
          </select>
        `
      : `${escapeHtml(paymentStatus)} ${paymentMethod ? `(${paymentMethod})` : ""}`;

    const actionCell = canEditPayments
      ? `<button type="button" class="billing-action-btn" data-update-payment-id="${escapeHtml(safeObjectId(booking._id))}">Update</button>`
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
  const normalizedBookingId = safeObjectId(bookingId);
  if (!normalizedBookingId) return;
  const select = document.querySelector(`.billing-payment-select[data-booking-id="${normalizedBookingId}"]`);
  if (!select) return;

  const paymentStatus = String(select.value || "").toLowerCase();
  const paymentMethod = paymentStatus === "paid" ? "upi" : null;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/bookings/${normalizedBookingId}/payment`, {
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
