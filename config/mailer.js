/**
 * Mailer Configuration (Nodemailer)
 * 
 * Konfigurasi untuk pengiriman email.
 * Digunakan untuk:
 * - Reset password
 * - Notifikasi persetujuan akun
 * - Notifikasi sistem lainnya
 */

import nodemailer from "nodemailer";

/**
 * Memeriksa apakah konfigurasi SMTP lengkap dan siap digunakan.
 * @returns {boolean} true jika SMTP_HOST, SMTP_USER, dan SMTP_PASS terisi
 */
export const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_HOST.trim() !== "" &&
    process.env.SMTP_USER &&
    process.env.SMTP_USER.trim() !== "" &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PASS.trim() !== ""
  );
};

/**
 * Membuat transporter Nodemailer berdasarkan konfigurasi environment.
 * @returns {nodemailer.Transporter|null} Transporter yang siap digunakan atau null jika belum dikonfigurasi
 */
export const createTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Template email dasar.
 * @param {Object} options - Opsi email
 * @param {string} options.to - Penerima email
 * @param {string} options.subject - Subjek email
 * @param {string} options.html - Konten HTML email
 * @returns {Object} Mail options
 */
export const createMailOptions = ({ to, subject, html }) => {
  const fromAddress = (process.env.SMTP_USER && process.env.SMTP_USER.trim()) || "noreply@cims.com";
  return {
    from: `"Internship Management System" <${fromAddress}>`,
    to,
    subject,
    html,
  };
};

/**
 * Mengirim email (wrapper).
 * @param {Object} options - Opsi email
 * @returns {Promise<Object>}
 */
export const sendEmail = async (options) => {
  if (!isSmtpConfigured()) {
    const errorMsg = "SMTP is not configured: SMTP_USER or SMTP_PASS is missing in environment.";
    console.warn(`⚠️ [MAILER] ${errorMsg}`);
    const error = new Error(errorMsg);
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  try {
    const transporter = createTransporter();
    const mailOptions = createMailOptions(options);
    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 [MAILER] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ [MAILER] Failed to send email via SMTP:", error.message);
    throw error;
  }
};

export default {
  isSmtpConfigured,
  createTransporter,
  createMailOptions,
  sendEmail,
};
