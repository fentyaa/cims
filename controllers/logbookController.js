/**
 * Logbook Controller
 *
 * Menangani semua request terkait Daily Logbook:
 * - Intern: create, edit, view history
 * - Mentor: list all, detail, review
 */

import logbookService from "../services/logbookService.js";
import presenceService from "../services/presenceService.js";
import { validateLogbook } from "../utils/validators.js";

// ============================================================
// INTERN: HALAMAN LOGBOOK
// ============================================================

/**
 * Menampilkan halaman logbook peserta.
 * Menampilkan form create/edit dan riwayat logbook.
 */
export const internLogbookPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;

    // Cek logbook hari ini
    const todayLogbook = await logbookService.getTodayLogbook(userId, new Date());

    // Cek status presensi hari ini
    const todayPresence = await presenceService.getTodayPresence(userId);

    // Riwayat logbook (5 per halaman agar ringkas di HP)
    const { data: logbooks, pagination } = await logbookService.getInternLogbooks(userId, { page, limit: 5 });
    pagination.hasPrev = pagination.page > 1;
    pagination.hasNext = pagination.page < pagination.totalPages;

    res.render("pages/intern/logbook", {
      title: "Logbook Harian - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      todayLogbook,
      todayPresence,
      logbooks,
      pagination,
      formData: {},
      errors: [],
    });
  } catch (error) {
    console.error("Intern logbook page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat halaman logbook." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

/**
 * Proses membuat logbook baru.
 */
export const internCreateLogbook = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Cek status presensi hari ini sebelum memproses: tolak jika IZIN atau SAKIT
    const todayPresence = await presenceService.getTodayPresence(userId).catch(() => null);
    if (todayPresence && (todayPresence.status === "IZIN" || todayPresence.status === "SAKIT")) {
      const statusLabel = todayPresence.status === "IZIN" ? "Izin" : "Sakit";
      req.session.messages = [
        { type: "warning", text: `Pengisian logbook ditolak karena status kehadiran Anda hari ini tercatat ${statusLabel}.` },
      ];
      return res.redirect("/intern/logbook");
    }

    const formData = {
      activity: req.body.activity?.trim(),
      obstacle: req.body.obstacle?.trim(),
      nextPlan: req.body.nextPlan?.trim(),
    };

    // Validasi
    const validation = validateLogbook(formData);
    if (!validation.valid) {
      const todayLogbook = null;
      const { data: logbooks, pagination } = await logbookService.getInternLogbooks(userId);

      return res.render("pages/intern/logbook", {
        title: "Logbook Harian - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        todayLogbook,
        todayPresence,
        logbooks,
        pagination,
        formData,
        errors: validation.errors,
      });
    }

    await logbookService.createLogbook(userId, formData);

    req.session.messages = [
      { type: "success", text: "Logbook berhasil dibuat." },
    ];

    return res.redirect("/intern/logbook");
  } catch (error) {
    console.error("Create logbook error:", error);
    const userId = req.session.user.id;
    const todayLogbook = await logbookService.getTodayLogbook(userId, new Date()).catch(() => null);
    const todayPresence = await presenceService.getTodayPresence(userId).catch(() => null);
    const { data: logbooks, pagination } = await logbookService.getInternLogbooks(userId).catch(() => ({ data: [], pagination: {} }));

    return res.render("pages/intern/logbook", {
      title: "Logbook Harian - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      todayLogbook,
      todayPresence,
      logbooks,
      pagination,
      formData: req.body,
      errors: [error.message || "Terjadi kesalahan server."],
    });
  }
};

/**
 * Proses mengupdate logbook (hanya jika belum direview).
 */
export const internUpdateLogbook = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;
    const formData = {
      activity: req.body.activity?.trim(),
      obstacle: req.body.obstacle?.trim(),
      nextPlan: req.body.nextPlan?.trim(),
    };

    // Validasi
    const validation = validateLogbook(formData);
    if (!validation.valid) {
      const todayLogbook = await logbookService.getTodayLogbook(userId, new Date()).catch(() => null);
      const todayPresence = await presenceService.getTodayPresence(userId).catch(() => null);
      const { data: logbooks, pagination } = await logbookService.getInternLogbooks(userId);

      return res.render("pages/intern/logbook", {
        title: "Logbook Harian - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        todayLogbook,
        todayPresence,
        logbooks,
        pagination,
        formData,
        errors: validation.errors,
      });
    }

    await logbookService.updateLogbook(id, userId, formData);

    req.session.messages = [
      { type: "success", text: "Logbook berhasil diperbarui." },
    ];

    return res.redirect("/intern/logbook");
  } catch (error) {
    console.error("Update logbook error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect("/intern/logbook");
  }
};

// ============================================================
// MENTOR: HALAMAN LOGBOOK
// ============================================================

/**
 * Menampilkan halaman review logbook untuk mentor.
 */
export const mentorLogbookPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const filter = req.query.filter || "all";

    const { data: logbooks, pagination } = await logbookService.getAllLogbooks({
      page,
      limit: 10,
      search,
      filter,
    });

    res.render("pages/mentor/logbook", {
      title: "Review Logbook - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      logbooks,
      pagination,
      filters: { search, filter },
    });
  } catch (error) {
    console.error("Mentor logbook page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data logbook." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Menampilkan detail logbook (untuk mentor).
 */
export const mentorLogbookDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const logbook = await logbookService.getLogbookById(id);

    if (!logbook) {
      req.session.messages = [
        { type: "danger", text: "Logbook tidak ditemukan." },
      ];
      return res.redirect("/mentor/logbook");
    }

    res.render("pages/mentor/logbook-detail", {
      title: `Detail Logbook - ${logbook.user.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      logbook,
      errors: [],
    });
  } catch (error) {
    console.error("Mentor logbook detail error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat detail logbook." },
    ];
    return res.redirect("/mentor/logbook");
  }
};

/**
 * Proses review logbook (memberi komentar dan menandai sebagai direview).
 */
export const mentorReviewLogbook = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = req.body.mentorComment?.trim() || "";

    if (!comment) {
      const logbook = await logbookService.getLogbookById(id);
      return res.render("pages/mentor/logbook-detail", {
        title: `Detail Logbook - ${logbook.user.fullName} - Internship Management System`,
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        logbook,
        errors: ["Komentar harus diisi sebelum menandai sebagai direview."],
      });
    }

    await logbookService.reviewLogbook(id, comment);

    req.session.messages = [
      { type: "success", text: "Logbook berhasil direview." },
    ];

    return res.redirect("/mentor/logbook");
  } catch (error) {
    console.error("Review logbook error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect("/mentor/logbook");
  }
};

export default {
  internLogbookPage,
  internCreateLogbook,
  internUpdateLogbook,
  mentorLogbookPage,
  mentorLogbookDetail,
  mentorReviewLogbook,
};
