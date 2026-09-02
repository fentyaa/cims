/**
 * Authentication Middleware
 * 
 * Middleware untuk melindungi route berdasarkan status autentikasi dan role.
 * 
 * - isAuthenticated: User harus login
 * - mentorOnly: User harus login dan role MENTOR
 * - internOnly: User harus login dan role INTERN
 * - redirectIfAuthenticated: Jika sudah login, redirect ke dashboard masing-masing
 */

/**
 * Middleware: Memastikan user sudah login.
 * Jika belum login, redirect ke halaman login dengan pesan error.
 */
export const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }

  req.session.messages = [
    { type: "danger", text: "Silakan login terlebih dahulu untuk mengakses halaman tersebut." },
  ];
  return res.redirect("/auth/login");
};

/**
 * Middleware: Memastikan user adalah MENTOR.
 * Harus dipanggil setelah isAuthenticated.
 */
export const mentorOnly = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === "MENTOR") {
    return next();
  }

  req.session.messages = [
    { type: "danger", text: "Anda tidak memiliki akses ke halaman ini." },
  ];

  // Redirect ke dashboard sesuai role
  if (req.session.user) {
    const redirectPath =
      req.session.user.role === "INTERN" ? "/intern/dashboard" : "/mentor/dashboard";
    return res.redirect(redirectPath);
  }

  return res.redirect("/auth/login");
};

/**
 * Middleware: Memastikan user adalah INTERN.
 * Harus dipanggil setelah isAuthenticated.
 */
export const internOnly = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === "INTERN") {
    return next();
  }

  req.session.messages = [
    { type: "danger", text: "Anda tidak memiliki akses ke halaman ini." },
  ];

  // Redirect ke dashboard sesuai role
  if (req.session.user) {
    const redirectPath =
      req.session.user.role === "MENTOR" ? "/mentor/dashboard" : "/intern/dashboard";
    return res.redirect(redirectPath);
  }

  return res.redirect("/auth/login");
};

/**
 * Middleware: Redirect user yang sudah login ke dashboard masing-masing.
 * Berguna untuk halaman login/register.
 */
export const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    const redirectPath =
      req.session.user.role === "MENTOR" ? "/mentor/dashboard" : "/intern/dashboard";
    return res.redirect(redirectPath);
  }

  return next();
};

export default {
  isAuthenticated,
  mentorOnly,
  internOnly,
  redirectIfAuthenticated,
};

