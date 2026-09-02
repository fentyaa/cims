/**
 * Internship Management System (IMS) - Main JavaScript
 * Berisi fungsi-fungsi global yang digunakan di seluruh aplikasi.
 * Ditulis dalam Vanilla JavaScript (tanpa framework/library frontend).
 */

"use strict";

// ============================================================
// Inisialisasi saat DOM siap
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  // Aktifkan tooltip Bootstrap
  initializeTooltips();

  // Aktifkan popover Bootstrap
  initializePopovers();

  // Tutup alert secara otomatis setelah 5 detik
  autoDismissAlerts();

  // Inisialisasi form validation Bootstrap
  initializeFormValidation();

  // Inisialisasi toggle password visibility
  initializePasswordToggle();

  // Inisialisasi participant type toggle
  initializeParticipantTypeToggle();

  // Inisialisasi password match checker
  initializePasswordMatchChecker();

  // Inisialisasi profile photo preview
  initializePhotoPreview();

  // Inisialisasi current date display
  initializeCurrentDate();

  // Inisialisasi sidebar active state
  initializeSidebarActive();

  // Inisialisasi collapse sidebar desktop
  initializeSidebarCollapse();

  // Inisialisasi sidebar overlay (Mobile)
  initializeSidebarOverlay();

  // Inisialisasi Dark/Light Theme Toggle
  initializeThemeToggle();

  // Inisialisasi Instant Action Feedback (mencegah double-submit dan memberi visual respon instan)
  initializeFormSubmitFeedback();

  // Inisialisasi Top Progress Bar (0ms visual feedback saat klik link/tombol)
  initializeTopLoader();

  // Inisialisasi Smart Link Prefetching (pre-loading di background saat kursor hover)
  initializeInstantPrefetch();
});

// ============================================================
// Tooltips
// ============================================================

function initializeTooltips() {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  if (tooltipTriggerList.length > 0) {
    [...tooltipTriggerList].map(
      (el) => new bootstrap.Tooltip(el)
    );
  }
}

// ============================================================
// Popovers
// ============================================================

function initializePopovers() {
  const popoverTriggerList = document.querySelectorAll(
    '[data-bs-toggle="popover"]'
  );
  if (popoverTriggerList.length > 0) {
    [...popoverTriggerList].map(
      (el) => new bootstrap.Popover(el)
    );
  }
}

// ============================================================
// Auto-dismiss Alerts
// ============================================================

function autoDismissAlerts() {
  const alerts = document.querySelectorAll(".alert-auto-dismiss");
  if (alerts.length > 0) {
    alerts.forEach((alert) => {
      setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }, 5000);
    });
  }
}

// ============================================================
// Bootstrap Form Validation
// ============================================================

function initializeFormValidation() {
  const forms = document.querySelectorAll(".needs-validation");

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }

      form.classList.add("was-validated");
    });
  });
}

// ============================================================
// Toggle Password Visibility
// ============================================================

function initializePasswordToggle() {
  const toggleButtons = document.querySelectorAll(".toggle-password");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      const passwordInput = document.getElementById(targetId);

      if (passwordInput) {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);

        // Toggle icon
        const icon = this.querySelector("i");
        if (icon) {
          icon.classList.toggle("bi-eye");
          icon.classList.toggle("bi-eye-slash");
        }
      }
    });
  });
}

// ============================================================
// Participant Type Toggle (Show/Hide Fields)
// ============================================================

function initializeParticipantTypeToggle() {
  const universityRadio = document.getElementById("typeUniversity");
  const smkRadio = document.getElementById("typeSMK");
  const universityFields = document.getElementById("universityFields");
  const smkFields = document.getElementById("smkFields");

  if (universityRadio && smkRadio && universityFields && smkFields) {
    function toggleFields() {
      const uCard = universityRadio.closest(".auth-selection-card");
      const sCard = smkRadio.closest(".auth-selection-card");

      if (universityRadio.checked) {
        universityFields.style.display = "block";
        smkFields.style.display = "none";
        setFieldsRequired(universityFields, true);
        setFieldsRequired(smkFields, false);
        if (uCard) uCard.classList.add("active");
        if (sCard) sCard.classList.remove("active");
      } else if (smkRadio.checked) {
        universityFields.style.display = "none";
        smkFields.style.display = "block";
        setFieldsRequired(universityFields, false);
        setFieldsRequired(smkFields, true);
        if (uCard) uCard.classList.remove("active");
        if (sCard) sCard.classList.add("active");
      }
    }

    universityRadio.addEventListener("change", toggleFields);
    smkRadio.addEventListener("change", toggleFields);
    toggleFields();
  }
}

function setFieldsRequired(container, required) {
  const inputs = container.querySelectorAll("input");
  inputs.forEach((input) => {
    if (required) {
      input.setAttribute("required", "");
    } else {
      input.removeAttribute("required");
    }
  });
}

// ============================================================
// Password Match Checker
// ============================================================

function initializePasswordMatchChecker() {
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirmPassword");
  const matchIcon = document.getElementById("passwordMatchIcon");
  const matchText = document.getElementById("passwordMatchText");

  if (password && confirmPassword && matchIcon && matchText) {
    function checkMatch() {
      if (confirmPassword.value.length === 0) {
        matchIcon.className = "bi bi-info-circle me-1";
        matchText.textContent = "Masukkan ulang password yang sama.";
        matchText.className = "text-muted";
      } else if (password.value === confirmPassword.value) {
        matchIcon.className = "bi bi-check-circle-fill me-1 text-success";
        matchText.textContent = "Password cocok!";
        matchText.className = "text-success";
        confirmPassword.setCustomValidity("");
      } else {
        matchIcon.className = "bi bi-x-circle-fill me-1 text-danger";
        matchText.textContent = "Password tidak cocok.";
        matchText.className = "text-danger";
        confirmPassword.setCustomValidity("Password tidak cocok");
      }
    }

    password.addEventListener("input", checkMatch);
    confirmPassword.addEventListener("input", checkMatch);
  }
}

// ============================================================
// Profile Photo Preview
// ============================================================

function initializePhotoPreview() {
  const photoInput = document.getElementById("profilePhoto");
  const photoPreview = document.getElementById("photoPreview");

  if (photoInput && photoPreview) {
    photoInput.addEventListener("change", function (event) {
      const file = event.target.files[0];

      if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
          photoPreview.innerHTML = `<img src="${e.target.result}" alt="Profile Photo" class="rounded-circle w-100 h-100" style="object-fit: cover;" />`;
          photoPreview.classList.remove("bg-light");
        };

        reader.readAsDataURL(file);
      } else {
        photoPreview.innerHTML = `<i class="bi bi-camera text-muted" style="font-size: 2rem;"></i>`;
        photoPreview.classList.add("bg-light");
      }
    });

    photoPreview.addEventListener("click", function () {
      photoInput.click();
    });
  }
}

// ============================================================
// Current Date Display
// ============================================================

function initializeCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('id-ID', options);
  }
}

// ============================================================
// Sidebar Active State
// ============================================================

function initializeSidebarActive() {
  // Highlight the current page link in both desktop and mobile sidebars
  const currentPath = window.location.pathname;
  const sidebarLinks = document.querySelectorAll('.sidebar-nav a, .sidebar-nav-mobile a');

  sidebarLinks.forEach(function (link) {
    // Remove active class from non-matching links
    if (link.getAttribute('href') !== currentPath) {
      link.classList.remove('active');
    }
  });
}

// ============================================================
// Desktop Sidebar Collapse
// ============================================================

function initializeSidebarCollapse() {
  const wrapper = document.querySelector('.dashboard-wrapper');
  const desktopToggle = document.getElementById('desktopSidebarNavbarToggle');

  if (!wrapper || !desktopToggle) return;

  // Restore saved collapse state on desktop (>= 992px)
  if (window.innerWidth >= 992) {
    try {
      const isCollapsed = localStorage.getItem('cims_sidebar_collapsed') === 'true';
      if (isCollapsed) {
        wrapper.classList.add('sidebar-collapsed');
      }
    } catch (e) {
      console.warn('localStorage not accessible:', e);
    }
  }

  desktopToggle.addEventListener('click', function () {
    const collapsed = wrapper.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('cims_sidebar_collapsed', collapsed ? 'true' : 'false');
    } catch (e) {
      console.warn('localStorage not accessible:', e);
    }
  });
}

// ============================================================
// Sidebar Overlay (Mobile)
// ============================================================

function initializeSidebarOverlay() {
  const offcanvasEl = document.getElementById('sidebarOffcanvas');
  const overlay = document.getElementById('sidebarOverlay');

  if (offcanvasEl && overlay) {
    offcanvasEl.addEventListener('show.bs.offcanvas', function () {
      overlay.classList.add('show');
    });

    offcanvasEl.addEventListener('hide.bs.offcanvas', function () {
      overlay.classList.remove('show');
    });

    overlay.addEventListener('click', function () {
      const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (offcanvas) {
        offcanvas.hide();
      }
    });
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Format tanggal ke format Indonesia (DD/MM/YYYY)
 */
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Tampilkan loading spinner
 */
function showLoading(containerId, message = "Memuat data...") {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">${message}</p>
      </div>
    `;
  }
}

// ============================================================
// Dark/Light Mode Theme Toggle
// ============================================================

function initializeThemeToggle() {
  const toggleBtns = document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn');
  const themeIcons = document.querySelectorAll('#themeIcon, .theme-icon');

  function updateIcons(theme) {
    themeIcons.forEach(icon => {
      if (theme === 'dark') {
        icon.className = 'bi bi-sun fs-5';
      } else {
        icon.className = 'bi bi-moon-stars fs-5';
      }
    });
  }

  // Get current active theme
  const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
  updateIcons(currentTheme);

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-bs-theme', nextTheme);
      updateIcons(nextTheme);

      try {
        localStorage.setItem('cims_theme', nextTheme);
      } catch (err) {
        console.warn('localStorage not accessible:', err);
      }
    });
  });

  // Listen to system preference changes if user hasn't set an explicit preference
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', e => {
        if (!localStorage.getItem('cims_theme')) {
          const newTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-bs-theme', newTheme);
          updateIcons(newTheme);
        }
      });
    }
  } catch (err) {}
}

// ============================================================
// Form Submit Instant Feedback & Prevent Double Submit
// ============================================================

function initializeFormSubmitFeedback() {
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      if (form.checkValidity && !form.checkValidity()) {
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]:not(.no-spin)');
      if (submitBtn && !submitBtn.disabled) {
        // Beri jeda 10ms agar event submit FormData ter-capture dengan benar sebelum tombol disabled
        setTimeout(() => {
          submitBtn.disabled = true;
          const originalText = submitBtn.innerText.trim();
          submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${originalText || 'Memproses...'}`;
        }, 10);
      }
    });
  });
}

// ============================================================
// Instant Top Progress Bar (0ms Visual Click Feedback)
// ============================================================

function initializeTopLoader() {
  let loader = document.getElementById("cims-top-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "cims-top-loader";
    document.body.appendChild(loader);
  }

  let progressTimer = null;

  function startLoader() {
    if (!loader) return;
    clearInterval(progressTimer);
    loader.classList.add("active");
    loader.style.width = "35%";

    progressTimer = setTimeout(() => {
      loader.style.width = "75%";
      progressTimer = setTimeout(() => {
        loader.style.width = "90%";
      }, 300);
    }, 150);
  }

  function finishLoader() {
    if (!loader) return;
    clearInterval(progressTimer);
    loader.style.width = "100%";
    setTimeout(() => {
      loader.classList.remove("active");
      setTimeout(() => {
        loader.style.width = "0%";
      }, 250);
    }, 150);
  }

  // Intercept click on internal links
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a");
    if (!link || !link.href) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.getAttribute("href")?.startsWith("#")) return;
    if (link.getAttribute("data-bs-toggle")) return;

    try {
      const url = new URL(link.href, window.location.href);
      if (url.host === window.location.host && !url.pathname.startsWith("javascript:")) {
        startLoader();
      }
    } catch (err) {}
  });

  // Intercept form submissions
  document.addEventListener("submit", function () {
    startLoader();
  });

  // Finish on page load / back-forward navigation
  window.addEventListener("pageshow", function () {
    finishLoader();
  });
}

// ============================================================
// Smart Instant Link Pre-fetching (Preloads Page on Hover)
// ============================================================

function initializeInstantPrefetch() {
  const prefetchedUrls = new Set();
  const currentHost = window.location.host;

  function prefetchUrl(urlStr) {
    try {
      const url = new URL(urlStr, window.location.href);
      if (url.host !== currentHost) return;
      if (url.pathname.startsWith("/auth/logout")) return;
      if (url.pathname.includes("delete") || url.pathname.includes("hapus")) return;

      const cacheKey = url.pathname + url.search;
      if (prefetchedUrls.has(cacheKey)) return;
      prefetchedUrls.add(cacheKey);

      // Create prefetch link element
      const prefetchTag = document.createElement("link");
      prefetchTag.rel = "prefetch";
      prefetchTag.href = url.href;
      document.head.appendChild(prefetchTag);
    } catch (err) {}
  }

  // Hover on desktop
  document.addEventListener("mouseover", function (e) {
    const link = e.target.closest("a");
    if (!link || !link.href) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.getAttribute("href")?.startsWith("#")) return;
    if (link.getAttribute("data-bs-toggle")) return;

    prefetchUrl(link.href);
  }, { passive: true });

  // Touch on mobile
  document.addEventListener("touchstart", function (e) {
    const link = e.target.closest("a");
    if (!link || !link.href) return;
    prefetchUrl(link.href);
  }, { passive: true });
}

// NOTE: Fungsi formatDate dan showLoading tersedia secara global
// Untuk menggunakannya di halaman lain, panggil langsung formatDate() atau showLoading()


