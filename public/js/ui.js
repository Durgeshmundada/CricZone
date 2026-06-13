class CustomModal {
  constructor() {
    this.modal = document.getElementById('customModal');
    this.title = document.getElementById('modalTitle');
    this.message = document.getElementById('modalMessage');
    this.input = document.getElementById('modalInput');
    this.confirmBtn = document.getElementById('modalConfirm');
    this.cancelBtn = document.getElementById('modalCancel');
    this.closeBtn = document.getElementById('modalClose');
    this.overlay = this.modal.querySelector('.modal-overlay');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    this.cancelBtn.addEventListener('click', () => this.close());
  }

  open() {
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.input.value = '';
  }

  alert(title, message) {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.add('hidden');
      this.cancelBtn.classList.add('hidden');
      this.confirmBtn.textContent = 'OK';
      
      this.open();
      
      const handleConfirm = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.close();
        resolve(true);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
    });
  }

  confirm(title, message) {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.add('hidden');
      this.cancelBtn.classList.remove('hidden');
      this.confirmBtn.textContent = 'Confirm';
      
      this.open();
      
      const handleConfirm = () => {
        cleanup();
        this.close();
        resolve(true);
      };
      
      const handleCancel = () => {
        cleanup();
        this.close();
        resolve(false);
      };
      
      const cleanup = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.cancelBtn.removeEventListener('click', handleCancel);
        this.closeBtn.removeEventListener('click', handleCancel);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
      this.cancelBtn.addEventListener('click', handleCancel);
      this.closeBtn.addEventListener('click', handleCancel);
    });
  }

  prompt(title, message, placeholder = '') {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.input.classList.remove('hidden');
      this.input.placeholder = placeholder;
      this.input.value = '';
      this.cancelBtn.classList.remove('hidden');
      this.confirmBtn.textContent = 'OK';
      
      this.open();
      
      setTimeout(() => this.input.focus(), 100);
      
      const handleConfirm = () => {
        const value = this.input.value.trim();
        cleanup();
        this.close();
        resolve(value || null);
      };
      
      const handleCancel = () => {
        cleanup();
        this.close();
        resolve(null);
      };
      
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          handleConfirm();
        }
      };
      
      const cleanup = () => {
        this.confirmBtn.removeEventListener('click', handleConfirm);
        this.cancelBtn.removeEventListener('click', handleCancel);
        this.closeBtn.removeEventListener('click', handleCancel);
        this.input.removeEventListener('keypress', handleEnter);
      };
      
      this.confirmBtn.addEventListener('click', handleConfirm);
      this.cancelBtn.addEventListener('click', handleCancel);
      this.closeBtn.addEventListener('click', handleCancel);
      this.input.addEventListener('keypress', handleEnter);
    });
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

