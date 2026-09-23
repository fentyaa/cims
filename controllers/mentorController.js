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
import { validateParticipantUpdate, isValidPassword, isValidPhoneNumber } from "../utils/validators.js";
import presenceService from "../services/presenceService.js";
import logbookService from "../services/logbookService.js";
import evaluationService from "../services/evaluationService.js";
import gamificationService from "../services/gamificationService.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

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
    // 1. Terapkan aturan drop out: periksa peserta aktif yang mangkir 3 hari kerja tanpa kabar
    await presenceService.enforceDropoutPolicy();

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

    // 2. Hitung status absensi berturut-turut untuk setiap peserta di halaman ini
    const absenceMap = {};
    await Promise.all(
      result.data.map(async (p) => {
        try {
          const abs = await presenceService.checkConsecutiveUnexcusedAbsences(p.id);
          absenceMap[p.id] = abs;
        } catch (e) {
          absenceMap[p.id] = { consecutiveDays: 0, isDropout: false, unexcusedDates: [] };
        }
      })
    );

    // 3. Hitung progres hari magang (hari keberapa & sisa hari) untuk setiap peserta
    const progressMap = {};
    for (const p of result.data) {
      if (p.internshipStartDate && p.internshipEndDate) {
        progressMap[p.id] = gamificationService.calculateInternshipProgress(
          p.internshipStartDate,
          p.internshipEndDate
        );
      } else {
        progressMap[p.id] = null;
      }
    }

    res.render("pages/mentor/peserta", {
      title: "Manajemen Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants: result.data,
      pagination: result.pagination,
      filters: { search, type, status },
      absenceMap,
      progressMap,
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
    const [participant, gamificationStats, absenceInfo] = await Promise.all([
      participantService.getParticipantById(id),
      gamificationService.getInternGamificationStats(id).catch(() => null),
      presenceService.checkConsecutiveUnexcusedAbsences(id).catch(() => ({ consecutiveDays: 0, isDropout: false, unexcusedDates: [] })),
    ]);

    if (!participant) {
      req.session.messages = [
        { type: "danger", text: "Peserta tidak ditemukan." },
      ];
      return res.redirect("/mentor/peserta");
    }

    const internshipProgress = (participant.internshipStartDate && participant.internshipEndDate)
      ? gamificationService.calculateInternshipProgress(participant.internshipStartDate, participant.internshipEndDate)
      : null;

    res.render("pages/mentor/peserta-detail", {
      title: `Detail Peserta - ${participant.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participant,
      gamificationStats,
      absenceInfo,
      internshipProgress,
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

/**
 * Laporan Perkembangan Peserta Magang (Agregat & Analitik)
 */
export const laporan = async (req, res) => {
  try {
    let filterType = req.query.type || "ALL"; // ALL, UNIVERSITY, SMK
    const filterStatus = req.query.status || "ALL"; // ALL, ACTIVE, ARCHIVED

    // Normalisasi jika query mengirim VOCATIONAL agar sesuai enum Prisma (SMK)
    if (filterType === "VOCATIONAL") {
      filterType = "SMK";
    }

    const where = { role: "INTERN" };
    if (filterType !== "ALL" && (filterType === "UNIVERSITY" || filterType === "SMK")) {
      where.participantType = filterType;
    }
    if (filterStatus !== "ALL" && (filterStatus === "ACTIVE" || filterStatus === "ARCHIVED")) {
      where.status = filterStatus;
    }

    const interns = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        participantType: true,
        status: true,
        university: true,
        studyProgram: true,
        studentId: true,
        schoolName: true,
        major: true,
        internshipPeriod: true,
        internshipStartDate: true,
        internshipEndDate: true,
        profilePhoto: true,
        presences: {
          select: { status: true, date: true },
        },
        logbooks: {
          select: { status: true, date: true },
        },
        evaluations: {
          select: { grade: true, finalScore: true, status: true },
        },
        documents: {
          select: { id: true, documentType: true },
        },
      },
      orderBy: { fullName: "asc" },
    });

    const internReports = interns.map((intern) => {
      const wfoCount = intern.presences.filter((p) => p.status === "WFO").length;
      const wfhCount = intern.presences.filter((p) => p.status === "WFH").length;
      const izinCount = intern.presences.filter((p) => p.status === "IZIN").length;
      const sakitCount = intern.presences.filter((p) => p.status === "SAKIT").length;
      const totalHadir = wfoCount + wfhCount;
      const totalSubmittedPresence = intern.presences.length;

      const logbookTotal = intern.logbooks.length;
      const logbookReviewed = intern.logbooks.filter((l) => l.status === "REVIEWED").length;
      const logbookPending = intern.logbooks.filter((l) => l.status === "PENDING").length;

      const evalData = intern.evaluations;
      const certificateDoc = intern.documents.find((d) => d.documentType === "CERTIFICATE");

      return {
        id: intern.id,
        fullName: intern.fullName,
        email: intern.email,
        institution:
          intern.participantType === "UNIVERSITY"
            ? intern.university || "-"
            : intern.schoolName || "-",
        idNumber: intern.participantType === "UNIVERSITY" ? intern.studentId || "-" : "-",
        major:
          intern.participantType === "UNIVERSITY"
            ? intern.studyProgram || "-"
            : intern.major || "-",
        participantType: intern.participantType,
        status: intern.status,
        wfoCount,
        wfhCount,
        izinCount,
        sakitCount,
        totalHadir,
        totalSubmittedPresence,
        presenceRate:
          totalSubmittedPresence > 0
            ? Math.round((totalHadir / totalSubmittedPresence) * 100)
            : 0,
        logbookTotal,
        logbookReviewed,
        logbookPending,
        logbookRate:
          logbookTotal > 0 ? Math.round((logbookReviewed / logbookTotal) * 100) : 0,
        evalGrade: evalData ? evalData.grade : "-",
        evalScore: evalData ? evalData.finalScore : null,
        evalStatus: evalData ? evalData.status : "NONE",
        hasCertificate: Boolean(certificateDoc),
        certificateId: certificateDoc ? certificateDoc.id : null,
      };
    });

    const totalInterns = internReports.length;
    const avgPresenceRate =
      totalInterns > 0
        ? Math.round(
            internReports.reduce((acc, curr) => acc + curr.presenceRate, 0) / totalInterns
          )
        : 0;
    const totalLogbooks = internReports.reduce((acc, curr) => acc + curr.logbookTotal, 0);
    const totalReviewedLogbooks = internReports.reduce(
      (acc, curr) => acc + curr.logbookReviewed,
      0
    );
    const completedEvaluations = internReports.filter(
      (i) => i.evalStatus === "PUBLISHED"
    ).length;

    res.render("pages/mentor/laporan", {
      title: "Laporan Perkembangan Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      internReports,
      summary: {
        totalInterns,
        avgPresenceRate,
        totalLogbooks,
        totalReviewedLogbooks,
        completedEvaluations,
      },
      currentType: filterType,
      currentStatus: filterStatus,
    });
  } catch (error) {
    console.error("Mentor laporan error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat laporan." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Halaman Profil Mentor
 */
export const profil = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePhoto: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!mentor) {
      req.session.messages = [
        { type: "danger", text: "Data pengguna tidak ditemukan." },
      ];
      return res.redirect("/auth/login");
    }

    res.render("pages/mentor/profil", {
      title: "Profil Mentor - Internship Management System",
      layout: "layouts/dashboard",
      userName: mentor.fullName || req.session.user.fullName,
      user: mentor,
      errors: [],
      success: false,
    });
  } catch (error) {
    console.error("Mentor profil error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat profil mentor." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Update Profil Mentor (Nama, No HP, Password, Foto Profil)
 */
export const profilUpdate = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const { fullName, phoneNumber, currentPassword, newPassword, confirmPassword } = req.body;
    const photoFile = req.file;

    const errors = [];

    // Validasi Nama
    if (!fullName || fullName.trim().length < 3) {
      errors.push("Nama lengkap minimal 3 karakter.");
    }

    // Validasi Nomor HP
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      errors.push("Nomor HP tidak valid. Gunakan format 08xx atau +62xx.");
    }

    const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      req.session.messages = [{ type: "danger", text: "User tidak ditemukan." }];
      return res.redirect("/auth/login");
    }

    const updateData = {};

    // Validasi & Update Password jika diisi
    if (newPassword && newPassword.length > 0) {
      if (!currentPassword) {
        errors.push("Kata sandi saat ini harus diisi untuk mengubah kata sandi.");
      } else {
        const isPasswordMatch = await bcrypt.compare(currentPassword, mentor.password);
        if (!isPasswordMatch) {
          errors.push("Kata sandi saat ini salah.");
        }
      }

      if (!isValidPassword(newPassword)) {
        errors.push("Password baru minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.");
      }

      if (newPassword !== confirmPassword) {
        errors.push("Konfirmasi password baru tidak cocok.");
      }

      if (errors.length === 0) {
        updateData.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
      }
    }

    if (errors.length > 0) {
      return res.render("pages/mentor/profil", {
        title: "Profil Mentor - Internship Management System",
        layout: "layouts/dashboard",
        userName: mentor.fullName,
        user: { ...mentor, fullName, phoneNumber },
        errors,
        success: false,
      });
    }

    updateData.fullName = fullName.trim();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.trim();
    if (photoFile) updateData.profilePhoto = photoFile.filename;

    const updated = await prisma.user.update({
      where: { id: mentorId },
      data: updateData,
    });

    // Perbarui data sesi user
    req.session.user.fullName = updated.fullName;
    if (updated.profilePhoto) req.session.user.profilePhoto = updated.profilePhoto;

    req.session.messages = [
      { type: "success", text: "Profil mentor berhasil diperbarui!" },
    ];

    return res.redirect("/mentor/profil");
  } catch (error) {
    console.error("Mentor profil update error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memperbarui profil." },
    ];
    return res.redirect("/mentor/profil");
  }
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
  profilUpdate,
};

