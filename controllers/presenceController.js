/**
 * Presence Controller
 *
 * Menangani semua operasi Presensi Harian (FASE 2):
 * - Intern: Submit status harian (WFO, WFH, IZIN, SAKIT), Riwayat presensi
 * - Mentor: Lihat rekap presensi seluruh peserta dengan filter
 */

import presenceService from "../services/presenceService.js";
import { checkRedDate } from "../utils/holidayHelper.js";

// ============================================================
// INTERN: SUBMIT PRESENSI HARIAN
// ============================================================

/**
 * Proses pencatatan presensi harian peserta.
 * POST /intern/presensi
 */
export const submitPresence = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status, notes } = req.body;

    const presence = await presenceService.submitPresence(userId, {
      status,
      notes,
    });

    const statusLabels = {
      WFO: "🏢 WFO (Work From Office)",
      WFH: "🏠 WFH (Work From Home)",
      IZIN: "📋 Izin",
      SAKIT: "🏥 Sakit",
    };

    const label = statusLabels[presence.status] || presence.status;

    req.session.messages = [
      {
        type: "success",
        text: `Presensi berhasil dicatat sebagai: ${label}!`,
      },
    ];

    return res.redirect("/intern/presensi");
  } catch (error) {
    req.session.messages = [
      {
        type: "danger",
        text: error.message || "Gagal mencatat presensi.",
      },
    ];
    return res.redirect("/intern/presensi");
  }
};

// ============================================================
// INTERN: HALAMAN PRESENSI
// ============================================================

/**
 * Menampilkan halaman presensi peserta.
 * GET /intern/presensi
 */
export const internPresensiPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const filter = req.query.filter || "month";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 6; // 6 catatan per halaman agar pas dan tidak terlalu panjang di HP

    // Dapatkan presensi hari ini
    const todayPresence = await presenceService.getTodayPresence(userId);

    // Dapatkan riwayat presensi
    const allHistory = await presenceService.getPresenceHistory(userId, filter);
    const total = allHistory.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const history = allHistory.slice(startIndex, startIndex + limit);

    const pagination = {
      page: safePage,
      limit,
      total,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    };

    // Dapatkan data user untuk participantType
    const user = req.session.user;
    const participantType = user ? user.participantType : "UNIVERSITY";

    // Pengecekan Tanggal Merah Hari Ini (Libur Nasional / Minggu)
    const todayRedDate = checkRedDate(new Date());

    res.render("pages/intern/presensi", {
      title: "Presensi Harian - Internship Management System",
      layout: "layouts/dashboard",
      userName: user ? user.fullName : "Peserta",
      participantType,
      todayPresence,
      todayRedDate,
      history,
      currentFilter: filter,
      pagination,
    });
  } catch (error) {
    console.error("Presensi page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat halaman presensi." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

// ============================================================
// MENTOR: HALAMAN REKAP PRESENSI
// ============================================================

/**
 * Menampilkan halaman rekap presensi untuk mentor.
 * GET /mentor/presensi
 */
export const mentorPresensiPage = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    // Default to today if date query is not provided, or support "all"
    const date = req.query.date !== undefined ? req.query.date : todayStr;
    const type = req.query.type || "";
    const status = req.query.status || "";

    const presences = await presenceService.getAllPresences({ date, type, status });

    // Hitung ringkasan statistik dari data yang difilter
    const wfoCount = presences.filter((p) => p.status === "WFO").length;
    const wfhCount = presences.filter((p) => p.status === "WFH").length;
    const izinCount = presences.filter((p) => p.status === "IZIN").length;
    const sakitCount = presences.filter((p) => p.status === "SAKIT").length;
    const activeDaysCount = wfoCount + wfhCount;
    const inactiveDaysCount = izinCount + sakitCount;

    res.render("pages/mentor/presensi", {
      title: "Rekap Presensi Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      presences,
      filters: { date, type, status },
      todayStr,
      stats: {
        total: presences.length,
        wfoCount,
        wfhCount,
        izinCount,
        sakitCount,
        activeDaysCount,
        inactiveDaysCount,
      },
    });
  } catch (error) {
    console.error("Mentor presensi error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data presensi." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

export default {
  submitPresence,
  internPresensiPage,
  mentorPresensiPage,
};
