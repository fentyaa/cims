/**
 * CSRF Protection Middleware
 *
 * Implementasi CSRF protection menggunakan double-submit cookie pattern
 * tanpa library pihak ketiga (lightweight, kompatibel dengan Express 5).
 *
 * Cara kerja:
 * 1. Setiap request GET ke halaman dengan form akan menyertakan token CSRF
 * 2. Setiap form menyertakan hidden input _csrf dengan token tersebut
 * 3. Setiap request POST/PUT/DELETE akan divalidasi tokennya
 */

import crypto from "crypto";
import { unlinkSync, existsSync } from "fs";

/**
 * Helper untuk menghapus file yang terlanjur terupload jika CSRF gagal
 */
const cleanupUploadedFile = (req) => {
  if (req.file && req.file.path && existsSync(req.file.path)) {
    try {
      unlinkSync(req.file.path);
    } catch (err) {
      console.error("Gagal menghapus file saat validasi CSRF gagal:", err);
    }
  }
};

/**
 * Generate token CSRF unik.
 * @returns {string} Token CSRF 64 karakter hex (32 bytes)
 */
export const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Middleware: Menyediakan token CSRF untuk semua view.
 * Token disimpan di session jika belum ada.
 * Token tersedia sebagai `csrfToken` di semua EJS template.
 */
export const csrfMiddleware = (req, res, next) => {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = "";
  }

  next();
};

/**
 * Middleware: Validasi CSRF token untuk method POST/PUT/DELETE/PATCH.
 * Membandingkan token dari session dengan token dari body (atau header x-csrf-token).
 * Query string token TIDAK diperbolehkan untuk alasan keamanan.
 */
export const csrfProtection = (req, res, next) => {
  // Metode yang aman (tidak perlu CSRF)
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Jika request berupa multipart dan body belum diparsing oleh Multer (misal pada middleware global),
  // lewati pengecekan global agar dapat divalidasi setelah Multer memparsing body pada route terkait.
  const isMultipart = req.is("multipart/form-data");
  const isBodyParsed = req.body && Object.keys(req.body).length > 0;
  if (isMultipart && !isBodyParsed && !req._csrfDeferredChecked) {
    req._csrfDeferred = true;
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const requestToken = req.body?._csrf || req.headers["x-csrf-token"];

  if (!sessionToken || !requestToken) {
    cleanupUploadedFile(req);
    req.session.messages = [
      {
        type: "danger",
        text: "Token CSRF tidak valid. Silakan muat ulang halaman dan coba lagi.",
      },
    ];
    return res.status(403).redirect(req.get("Referrer") || "/");
  }

  // Time-constant comparison untuk mencegah timing attack
  try {
    if (sessionToken.length !== requestToken.length) {
      throw new Error("Token length mismatch");
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(sessionToken),
      Buffer.from(requestToken)
    );

    if (!valid) {
      throw new Error("Token mismatch");
    }
  } catch (error) {
    cleanupUploadedFile(req);
    req.session.messages = [
      {
        type: "danger",
        text: "Token CSRF tidak valid. Silakan muat ulang halaman dan coba lagi.",
      },
    ];
    return res.status(403).redirect(req.get("Referrer") || "/");
  }

  req._csrfChecked = true;
  next();
};

/**
 * Regenerasi token CSRF (panggil setelah login/logout untuk keamanan ekstra).
 * @param {Object} req - Express request object
 */
export const regenerateCsrfToken = (req) => {
  if (req.session) {
    req.session.csrfToken = generateToken();
  }
};

export default { csrfMiddleware, csrfProtection, regenerateCsrfToken, generateToken };


