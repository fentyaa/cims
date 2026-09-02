/**
 * Utility helpers untuk Internship Management System (IMS)
 * Berisi fungsi-fungsi pembantu yang digunakan di seluruh aplikasi.
 */

/**
 * Mendapatkan tahun saat ini.
 * @returns {number} Tahun saat ini (YYYY)
 */
export const getCurrentYear = () => {
  return new Date().getFullYear();
};

/**
 * Mendapatkan timestamp saat ini dalam format ISO.
 * @returns {string} Timestamp ISO string
 */
export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Memformat tanggal ke format Indonesia (DD/MM/YYYY).
 * @param {Date|string} date - Tanggal yang akan diformat
 * @returns {string} Tanggal dalam format DD/MM/YYYY
 */
export const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Memformat tanggal ke format Indonesia lengkap (Hari, DD Bulan YYYY).
 * @param {Date|string} date - Tanggal yang akan diformat
 * @returns {string} Tanggal dalam format Indonesia lengkap
 */
export const formatDateLong = (date) => {
  const d = new Date(date);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const days = [
    "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
  ];
  const dayName = days[d.getDay()];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
};

/**
 * Memotong teks jika melebihi batas maksimal karakter.
 * @param {string} text - Teks yang akan dipotong
 * @param {number} maxLength - Batas maksimal karakter (default: 100)
 * @returns {string} Teks yang sudah dipotong (dengan elipsis jika perlu)
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trimEnd() + "...";
};

/**
 * Membersihkan input string dari karakter berbahaya (XSS prevention).
 * @param {string} str - String yang akan dibersihkan
 * @returns {string} String yang sudah dibersihkan
 */
export const sanitizeInput = (str) => {
  if (!str) return "";
  const htmlEntities = {
    "&": "&" + "amp;",
    "<": "&" + "lt;",
    ">": "&" + "gt;",
    '"': "&" + "quot;",
    "'": "&#" + "x27;",
  };
  const regex = /[&<>"']/g;
  return str.replace(regex, (match) => htmlEntities[match]);
};

/**
 * Menghasilkan nomor induk peserta magang secara otomatis.
 * Format: IMS-YYYYMM-XXXX (XXXX = nomor urut 4 digit)
 * @param {number} sequence - Nomor urut
 * @returns {string} Nomor induk peserta magang
 */
export const generateParticipantId = (sequence) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `IMS-${year}${month}-${seq}`;
};

/**
 * Menunda eksekusi selama waktu tertentu (async/await).
 * @param {number} ms - Waktu tunda dalam milidetik
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Membuat slug dari string (untuk URL).
 * @param {string} text - Teks yang akan di-slug
 * @returns {string} Slug URL
 */
export const slugify = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default {
  getCurrentYear,
  getCurrentTimestamp,
  formatDate,
  formatDateLong,
  truncateText,
  sanitizeInput,
  generateParticipantId,
  sleep,
  slugify,
};

