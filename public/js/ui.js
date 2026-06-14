class CustomModal {
  constructor() {
    this.modal = document.getElementById('customModal');
    this.content = this.modal.querySelector('.modal-content');
    this.title = document.getElementById('modalTitle');
    this.message = document.getElementById('modalMessage');
    this.input = document.getElementById('modalInput');
    this.confirmBtn = document.getElementById('modalConfirm');
    this.cancelBtn = document.getElementById('modalCancel');
    this.closeBtn = document.getElementById('modalClose');
    this.overlay = this.modal.querySelector('.modal-overlay');
    this.currentDialog = null;
    this.lastFocusedElement = null;
    this.handleKeydown = this.handleKeydown.bind(this);

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.closeBtn.addEventListener('click', () => this.finish(false));
    this.overlay.addEventListener('click', () => this.finish(false));
    this.cancelBtn.addEventListener('click', () => this.finish(false));
    this.confirmBtn.addEventListener('click', () => this.finish(true));
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.finish(true);
      }
    });
  }

  open() {
    this.lastFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.modal.classList.add('active');
    this.modal.removeAttribute('inert');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', this.handleKeydown);

    const initialFocus = this.input.classList.contains('hidden') ? this.confirmBtn : this.input;
    requestAnimationFrame(() => initialFocus.focus());
  }

  close() {
    this.modal.classList.remove('active');
    this.modal.setAttribute('aria-hidden', 'true');
    this.modal.setAttribute('inert', '');
    document.body.style.overflow = '';
    this.input.value = '';
    document.removeEventListener('keydown', this.handleKeydown);

    const focusTarget = this.lastFocusedElement;
    this.lastFocusedElement = null;
    if (focusTarget && document.contains(focusTarget)) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  getFocusableElements() {
    return [...this.content.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.classList.contains('hidden') && element.offsetParent !== null);
  }

  handleKeydown(event) {
    if (!this.currentDialog) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.finish(false);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      this.content.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!this.content.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  show(type, title, message, placeholder = '') {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.toggle('hidden', type !== 'prompt');
      this.input.placeholder = placeholder;
      this.input.value = '';
      this.cancelBtn.classList.toggle('hidden', type === 'alert');
      this.confirmBtn.textContent = type === 'confirm' ? 'Confirm' : 'OK';
      this.currentDialog = { type, resolve };
      this.open();
    });
  }

  finish(confirmed) {
    if (!this.currentDialog) return;

    const { type, resolve } = this.currentDialog;
    this.currentDialog = null;
    const result = type === 'prompt'
      ? (confirmed ? this.input.value.trim() || null : null)
      : type === 'confirm'
        ? Boolean(confirmed)
        : true;

    this.close();
    resolve(result);
  }

  alert(title, message) {
    return this.show('alert', title, message);
  }

  confirm(title, message) {
    return this.show('confirm', title, message);
  }

  prompt(title, message, placeholder = '') {
    return this.show('prompt', title, message, placeholder);
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeCssToken(value = "", fallback = "default") {
  const token = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(token) ? token : fallback;
}

function safeObjectId(value = "") {
  const id = String(value || "").trim();
  return /^[a-f\d]{24}$/i.test(id) ? id : "";
}

function sanitizeImageUrl(value = "", fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^data:image\/(?:png|gif|jpe?g|webp);/i.test(raw)) return raw;

  try {
    const parsed = new URL(raw, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : fallback;
  } catch (_error) {
    return fallback;
  }
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
