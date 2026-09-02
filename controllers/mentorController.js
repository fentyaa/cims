/**
 * Mentor Controller
 *
 * Menangani halaman-halaman khusus Mentor:
 * - Dashboard
 * - Manajemen Peserta (list, detail, edit, status, arsip)
 * - Presensi (placeholder)
 * - Logbook Review (placeholder)
 * - Penilaian (placeholder)
 * - Dokumen (placeholder)
 * - Pengumuman (placeholder)
 * - Laporan (placeholder)
 * - Profil (placeholder)
 */

import prisma from "../config/database.js";
import participantService from "../services/participantService.js";
import { validateParticipantUpdate } from "../utils/validators.js";
import presenceService from "../services/presenceService.js";
import logbookService from "../services/logbookService.js";
import evaluationService from "../services/evaluationService.js";
import gamificationService from "../services/gamificationService.js";

/**
 * Dashboard Mentor
 */
export const dashboard = async (req, res) => {
  try {
    const [
      totalInterns,
      pendingApprovals,
      activeInterns,
      archivedInterns,
      presensiStats,
      logbookStats,
      evalStats,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "INTERN" } }),
      prisma.user.count({ where: { role: "INTERN", status: "PENDING" } }),
      prisma.user.count({ where: { role: "INTERN", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "INTERN", status: "ARCHIVED" } }),
      presenceService.getMentorDashboardStats(),
      logbookService.getLogbookStats(),
      evaluationService.getMentorEvaluationStats(),
    ]);

    res.render("pages/mentor/dashboard", {
      title: "Dashboard Mentor - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      totalInterns,
      pendingApprovals,
      activeInterns,
      archivedInterns,
      presensiStats,
      logbookStats,
      evalStats,
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
// MANAJEMEN PESERTA
// ============================================================

/**
 * Menampilkan daftar peserta dengan pagination, search, dan filter.
 */
export const pesertaList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const type = req.query.type || "";
    const status = req.query.status || "";

    const result = await participantService.getParticipants({
      page,
      limit,
      search,
      type,
      status,
    });

    res.render("pages/mentor/peserta", {
      title: "Manajemen Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants: result.data,
      pagination: result.pagination,
      filters: { search, type, status },
    });
  } catch (error) {
    console.error("Peserta list error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data peserta." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Menampilkan detail peserta.
 */
export const pesertaDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const [participant, gamificationStats] = await Promise.all([
      participantService.getParticipantById(id),
      gamificationService.getInternGamificationStats(id).catch(() => null),
    ]);

    if (!participant) {
      req.session.messages = [
        { type: "danger", text: "Peserta tidak ditemukan." },
      ];
      return res.redirect("/mentor/peserta");
    }

    res.render("pages/mentor/peserta-detail", {
      title: `Detail Peserta - ${participant.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participant,
      gamificationStats,
    });
  } catch (error) {
    console.error("Peserta detail error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat detail peserta." },
    ];
    return res.redirect("/mentor/peserta");
  }
};

/**
 * Menampilkan halaman edit peserta.
 */
export const pesertaEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await participantService.getParticipantById(id);

    if (!participant) {
      req.session.messages = [
        { type: "danger", text: "Peserta tidak ditemukan." },
      ];
      return res.redirect("/mentor/peserta");
    }

    const mentors = await participantService.getMentorList();

    res.render("pages/mentor/peserta-edit", {
      title: `Edit Peserta - ${participant.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participant,
      mentors,
      errors: [],
    });
  } catch (error) {
    console.error("Peserta edit error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat form edit." },
    ];
    return res.redirect("/mentor/peserta");
  }
};

/**
 * Proses update data peserta.
 */
export const pesertaUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;

    // Validasi
    const validation = validateParticipantUpdate(formData);
    if (!validation.valid) {
      const participant = await participantService.getParticipantById(id);
      const mentors = await participantService.getMentorList();
      return res.render("pages/mentor/peserta-edit", {
        title: `Edit Peserta - ${participant.fullName} - Internship Management System`,
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        participant,
        mentors,
        errors: validation.errors,
      });
    }

    await participantService.updateParticipant(id, formData);

    req.session.messages = [
      { type: "success", text: "Data peserta berhasil diperbarui." },
    ];

    return res.redirect(`/mentor/peserta/${id}`);
  } catch (error) {
    console.error("Peserta update error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat memperbarui data." },
    ];
    return res.redirect(`/mentor/peserta/${req.params.id}/edit`);
  }
};

/**
 * Proses update status peserta (ACTIVE / ARCHIVED).
 */
export const pesertaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await participantService.updateParticipantStatus(id, status);

    const statusLabel = status === "ACTIVE" ? "diaktifkan" : "diarsipkan";
    req.session.messages = [
      { type: "success", text: `Status peserta berhasil ${statusLabel}.` },
    ];

    return res.redirect("/mentor/peserta");
  } catch (error) {
    console.error("Peserta status error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat mengubah status." },
    ];
    return res.redirect("/mentor/peserta");
  }
};

// ============================================================
// ARSIP
// ============================================================

/**
 * Menampilkan daftar peserta yang diarsipkan.
 */
export const arsipList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const result = await participantService.getArchivedParticipants({
      page,
      limit,
      search,
    });

    res.render("pages/mentor/arsip", {
      title: "Arsip Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants: result.data,
      pagination: result.pagination,
      filters: { search },
    });
  } catch (error) {
    console.error("Arsip list error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat arsip." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Proses restore peserta dari arsip.
 */
export const arsipRestore = async (req, res) => {
  try {
    const { id } = req.params;
    await participantService.restoreParticipant(id);

    req.session.messages = [
      { type: "success", text: "Peserta berhasil dikembalikan dari arsip." },
    ];

    return res.redirect("/mentor/arsip");
  } catch (error) {
    console.error("Arsip restore error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat merestore peserta." },
    ];
    return res.redirect("/mentor/arsip");
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
  renderPage(res, "pages/mentor/logbook", "Review Logbook - Internship Management System", req.session.user.fullName);
};

export const dokumen = (req, res) => {
  renderPage(res, "pages/mentor/dokumen", "Dokumen - Internship Management System", req.session.user.fullName);
};

export const pengumuman = (req, res) => {
  renderPage(res, "pages/mentor/pengumuman", "Pengumuman - Internship Management System", req.session.user.fullName);
};

export const laporan = (req, res) => {
  renderPage(res, "pages/mentor/laporan", "Laporan - Internship Management System", req.session.user.fullName);
};

export const profil = (req, res) => {
  renderPage(res, "pages/mentor/profil", "Profil - Internship Management System", req.session.user.fullName);
};

export default {
  dashboard,
  pesertaList,
  pesertaDetail,
  pesertaEdit,
  pesertaUpdate,
  pesertaStatus,
  arsipList,
  arsipRestore,
  logbook,
  dokumen,
  pengumuman,
  laporan,
  profil,
};
