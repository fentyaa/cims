/**
 * Intern Controller
 *
 * Menangani halaman-halaman khusus Intern (Peserta Magang):
 * - Dashboard
 * - Presensi (placeholder)
 * - Logbook (placeholder)
 * - Nilai (placeholder)
 * - Dokumen (placeholder)
 * - Profil (view & update)
 */

import prisma from "../config/database.js";
import participantService from "../services/participantService.js";
import presenceService from "../services/presenceService.js";
import logbookService from "../services/logbookService.js";
import evaluationService from "../services/evaluationService.js";
import gamificationService from "../services/gamificationService.js";
import documentService from "../services/documentService.js";
import { isValidPassword, isValidFullName } from "../utils/validators.js";

/**
 * Dashboard Intern
 */
export const dashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [
      user,
      presensiStats,
      logbookStats,
      evalStatus,
      gamificationStats,
      documents,
      absenceInfo,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, status: true, participantType: true },
      }),
      presenceService.getInternDashboardStats(userId),
      logbookService.getInternLogbookStats(userId),
      evaluationService.getInternEvaluationStatus(userId),
      gamificationService.getInternGamificationStats(userId),
      documentService.getDocumentsByUser(userId),
      presenceService.checkConsecutiveUnexcusedAbsences(userId).catch(() => ({ consecutiveDays: 0, isDropout: false, unexcusedDates: [] })),
    ]);

    let currentStatus = user?.status || "ACTIVE";
    if (absenceInfo?.isDropout && currentStatus === "ACTIVE") {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "ARCHIVED" },
      });
      currentStatus = "ARCHIVED";
    }

    res.render("pages/intern/dashboard", {
      title: "Dashboard Peserta Magang - Internship Management System",
      layout: "layouts/dashboard",
      userName: user?.fullName || req.session.user.fullName,
      status: currentStatus,
      participantType: user?.participantType || null,
      presensiStats,
      logbookStats,
      evalStatus,
      gamificationStats,
      absenceInfo,
      documents: documents || [],
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat dashboard." },
    ];
    return res.redirect("/auth/login");
  }
};

// ============================================================
// PROFIL PESERTA
// ============================================================

/**
 * Menampilkan halaman profil peserta.
 */
export const profil = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await participantService.getParticipantById(userId);

    if (!user) {
      req.session.messages = [
        { type: "danger", text: "Data pengguna tidak ditemukan." },
      ];
      return res.redirect("/auth/login");
    }

    res.render("pages/intern/profil", {
      title: "Profil Saya - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      user,
      errors: [],
      success: false,
    });
  } catch (error) {
    console.error("Profil error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat profil." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

/**
 * Proses update profil peserta (Self-Service).
 * Memungkinkan koreksi typo mandiri: Nama Lengkap, Institusi, NIM/NIS, Prodi/Jurusan, Nomor HP, Foto, Password.
 */
export const profilUpdate = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const formData = req.body;
    const photoFile = req.file;

    // Validasi
    const errors = [];

    // Nama Lengkap
    if (formData.fullName !== undefined) {
      if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
        errors.push("Nama lengkap harus diisi minimal 3 karakter.");
      } else if (!isValidFullName(formData.fullName)) {
        errors.push("Nama lengkap hanya boleh berisi huruf, spasi, tanda petik ('), titik, atau tanda hubung (-).");
      }
    }

    // Nomor HP
    if (formData.phoneNumber) {
      const phoneRegex = /^(0|62|\+62)[0-9]{8,13}$/;
      if (!phoneRegex.test(formData.phoneNumber.replace(/\s/g, ""))) {
        errors.push("Nomor HP tidak valid. Gunakan format 08xx atau +62xx.");
      }
    }

    // Password (opsional - hanya jika diisi)
    if (formData.password && formData.password.length > 0) {
      if (!isValidPassword(formData.password)) {
        errors.push("Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.");
      }
      if (formData.password !== formData.confirmPassword) {
        errors.push("Konfirmasi password tidak cocok.");
      }
    }

    if (errors.length > 0) {
      const user = await participantService.getParticipantById(userId);
      return res.render("pages/intern/profil", {
        title: "Profil Saya - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        user,
        errors,
        success: false,
      });
    }

    // Simpan perubahan
    const photoFilename = photoFile ? photoFile.filename : null;
    const updated = await participantService.updateOwnProfile(userId, formData, photoFilename);

    // Sinkronkan data sesi pengguna
    if (updated.fullName) req.session.user.fullName = updated.fullName;
    if (updated.profilePhoto) req.session.user.profilePhoto = updated.profilePhoto;

    req.session.messages = [
      { type: "success", text: "Profil berhasil diperbarui." },
    ];

    return res.redirect("/intern/profil");
  } catch (error) {
    console.error("Profil update error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memperbarui profil." },
    ];
    return res.redirect("/intern/profil");
  }
};

// ============================================================
// HALAMAN LAINNYA (PLACEHOLDER)
// ============================================================

/**
 * Helper untuk render halaman dengan data bersama
 */
const renderPage = (res, page, title, userName) => {
  res.render(page, {
    title,
    layout: "layouts/dashboard",
    userName,
  });
};

export const logbook = (req, res) => {
  renderPage(res, "pages/intern/logbook", "Logbook - Internship Management System", req.session.user.fullName);
};

export const dokumen = (req, res) => {
  renderPage(res, "pages/intern/dokumen", "Dokumen - Internship Management System", req.session.user.fullName);
};

export default {
  dashboard,
  logbook,
  dokumen,
  profil,
  profilUpdate,
};
