/**
 * Rate Limiter Middleware
 *
 * Middleware pembatasan laju request berbasis express-rate-limit yang disesuaikan
 * untuk aplikasi Web / EJS server-rendered:
 * - Menggunakan authenticated User ID sebagai key (tidak memblokir shared NAT IP)
 * - Fallback ke IP address jika user belum terautentikasi
 * - Merespon dengan status HTTP 429 dan flash message session + redirect (tanpa JSON mentah)
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Factory untuk membuat rate limiter yang kompatibel dengan UI EJS.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Durasi window rate limit dalam milidetik
 * @param {number} options.max - Jumlah maksimal request yang diizinkan dalam window
 * @param {string} options.message - Pesan error flash saat limit tercapai
 * @param {string} options.fallbackRedirect - URL fallback untuk redirect jika Referrer tidak ada
 * @param {boolean} options.includeIpInUserKey - Apakah menyertakan IP bersama User ID dalam key
 * @returns {Function} Express middleware
 */
export const createWebRateLimiter = ({
  windowMs,
  max,
  message = "Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi.",
  fallbackRedirect = "/",
  includeIpInUserKey = false,
}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const userId = req.session?.user?.id;
      const clientIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || "127.0.0.1");
      if (userId) {
        return includeIpInUserKey
          ? `user_${userId}_ip_${clientIp}`
          : `user_${userId}`;
      }
      return `ip_${clientIp}`;
    },
    handler: (req, res) => {
      if (req.session) {
        req.session.messages = [
          {
            type: "danger",
            text: message,
          },
        ];
      }
      const redirectUrl = req.get("Referrer") || fallbackRedirect;
      return res.status(429).redirect(redirectUrl);
    },
  });
};

// ============================================================
// TARGETED RATE LIMITERS
// ============================================================

/**
 * 1. Profile Update Limiter
 * Melindungi komputasi bcrypt hashing dan flood upload foto profil.
 * Kuota: 15 request per 15 menit per user+IP.
 */
export const profileUpdateLimiter = createWebRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15,
  message: "Terlalu banyak pembaruan profil. Silakan coba lagi setelah 15 menit.",
  fallbackRedirect: "/intern/profil",
  includeIpInUserKey: true,
});

/**
 * 2. Bulk Certificate Generation Limiter
 * Melindungi dari disk I/O flood dan transaksi database massal berulang.
 * Kuota: 10 request per 5 menit per mentor.
 */
export const bulkCertificateLimiter = createWebRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 10,
  message: "Terlalu banyak permintaan generate sertifikat massal. Silakan tunggu 5 menit.",
  fallbackRedirect: "/mentor/dokumen/sertifikat",
  includeIpInUserKey: false,
});

/**
 * 3. Bulk Letter Generation Limiter
 * Melindungi dari disk I/O flood dan transaksi database massal berulang.
 * Kuota: 10 request per 5 menit per mentor.
 */
export const bulkLetterLimiter = createWebRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 10,
  message: "Terlalu banyak permintaan generate surat massal. Silakan tunggu 5 menit.",
  fallbackRedirect: "/mentor/dokumen/surat",
  includeIpInUserKey: false,
});

export default {
  createWebRateLimiter,
  profileUpdateLimiter,
  bulkCertificateLimiter,
  bulkLetterLimiter,
};
