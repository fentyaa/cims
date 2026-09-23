/**
 * Router utama untuk aplikasi IMS.
 * Semua route dikelompokkan di sini.
 */

import { Router } from "express";
import { getHome } from "../controllers/homeController.js";
import {
  isAuthenticated,
  mentorOnly,
  internOnly,
} from "../middlewares/authMiddleware.js";
import {
  upload,
  uploadAttachment,
  uploadTemplate,
  handleUploadError,
} from "../middlewares/upload.js";
import { csrfProtection } from "../middlewares/csrf.js";

import mentorController from "../controllers/mentorController.js";
import internController from "../controllers/internController.js";
import presenceController from "../controllers/presenceController.js";
import logbookController from "../controllers/logbookController.js";
import announcementController from "../controllers/announcementController.js";
import evaluationController from "../controllers/evaluationController.js";
import documentController from "../controllers/documentController.js";
import calendarController from "../controllers/calendarController.js";
import {
  profileUpdateLimiter,
  bulkCertificateLimiter,
  bulkLetterLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();

// ============================================================
// ROUTE UTAMA
// ============================================================

router.get("/", getHome);

// ============================================================
// DASHBOARD & HALAMAN MENTOR
// ============================================================

// Dashboard
router.get("/mentor/dashboard", isAuthenticated, mentorOnly, mentorController.dashboard);

// Manajemen Peserta
router.get("/mentor/peserta", isAuthenticated, mentorOnly, mentorController.pesertaList);
router.get("/mentor/peserta/:id", isAuthenticated, mentorOnly, mentorController.pesertaDetail);
router.get("/mentor/peserta/:id/edit", isAuthenticated, mentorOnly, (req, res) => {
  req.session.messages = [
    { type: "info", text: "Data profil peserta (nama, institusi, NIM) dikelola secara mandiri oleh masing-masing peserta magang." },
  ];
  return res.redirect(`/mentor/peserta/${req.params.id}`);
});
router.post("/mentor/peserta/:id/edit", isAuthenticated, mentorOnly, (req, res) => {
  return res.redirect(`/mentor/peserta/${req.params.id}`);
});
router.post("/mentor/peserta/:id/status", isAuthenticated, mentorOnly, mentorController.pesertaStatus);

// Arsip
router.get("/mentor/arsip", isAuthenticated, mentorOnly, mentorController.arsipList);
router.post("/mentor/arsip/:id/restore", isAuthenticated, mentorOnly, mentorController.arsipRestore);

// Presensi (real implementation)
router.get("/mentor/presensi", isAuthenticated, mentorOnly, presenceController.mentorPresensiPage);

// Kalender Magang (Mentor)
router.get("/mentor/kalender", isAuthenticated, mentorOnly, calendarController.mentorCalendarPage);

// Logbook (real implementation)
router.get("/mentor/logbook", isAuthenticated, mentorOnly, logbookController.mentorLogbookPage);
router.get("/mentor/logbook/:id", isAuthenticated, mentorOnly, logbookController.mentorLogbookDetail);
router.post("/mentor/logbook/:id/review", isAuthenticated, mentorOnly, logbookController.mentorReviewLogbook);

// Pengumuman (Mentor)
router.get("/mentor/pengumuman", isAuthenticated, mentorOnly, announcementController.mentorList);
router.get("/mentor/pengumuman/buat", isAuthenticated, mentorOnly, announcementController.mentorCreateForm);
router.post(
  "/mentor/pengumuman/buat",
  isAuthenticated,
  mentorOnly,
  uploadAttachment.single("attachment"),
  handleUploadError,
  csrfProtection,
  announcementController.mentorCreate
);
router.get("/mentor/pengumuman/edit/:id", isAuthenticated, mentorOnly, announcementController.mentorEditForm);
router.post(
  "/mentor/pengumuman/edit/:id",
  isAuthenticated,
  mentorOnly,
  uploadAttachment.single("attachment"),
  handleUploadError,
  csrfProtection,
  announcementController.mentorUpdate
);
router.post("/mentor/pengumuman/:id/delete", isAuthenticated, mentorOnly, announcementController.mentorDelete);
router.post("/mentor/pengumuman/:id/status", isAuthenticated, mentorOnly, announcementController.mentorStatus);

// Penilaian (Evaluation)
router.get("/mentor/penilaian", isAuthenticated, mentorOnly, evaluationController.mentorList);
router.get("/mentor/penilaian/buat/:userId", isAuthenticated, mentorOnly, evaluationController.mentorCreateForm);
router.post("/mentor/penilaian/buat/:userId", isAuthenticated, mentorOnly, evaluationController.mentorCreate);
router.get("/mentor/penilaian/edit/:id", isAuthenticated, mentorOnly, evaluationController.mentorEditForm);
router.post("/mentor/penilaian/edit/:id", isAuthenticated, mentorOnly, evaluationController.mentorUpdate);
router.get("/mentor/penilaian/:id", isAuthenticated, mentorOnly, evaluationController.mentorDetail);
router.post("/mentor/penilaian/:id/publish", isAuthenticated, mentorOnly, evaluationController.mentorPublish);
router.post("/mentor/penilaian/:id/archive", isAuthenticated, mentorOnly, evaluationController.mentorArchive);

// Dokumen (Mentor) - Dinonaktifkan sesuai kebutuhan lingkup proyek
router.use("/mentor/dokumen", isAuthenticated, mentorOnly, (req, res) => res.redirect("/mentor/dashboard"));

// Laporan (Mentor)
router.get("/mentor/laporan", isAuthenticated, mentorOnly, mentorController.laporan);

// Profil (Mentor)
router.get("/mentor/profil", isAuthenticated, mentorOnly, mentorController.profil);
router.post(
  "/mentor/profil",
  isAuthenticated,
  mentorOnly,
  upload.single("profilePhoto"),
  handleUploadError,
  csrfProtection,
  profileUpdateLimiter,
  mentorController.profilUpdate
);

// ============================================================
// DASHBOARD & HALAMAN INTERN
// ============================================================

// Dashboard
router.get("/intern/dashboard", isAuthenticated, internOnly, internController.dashboard);

// Profil
router.get("/intern/profil", isAuthenticated, internOnly, internController.profil);
router.post(
  "/intern/profil",
  isAuthenticated,
  internOnly,
  upload.single("profilePhoto"),
  handleUploadError,
  csrfProtection,
  profileUpdateLimiter,
  internController.profilUpdate
);

// Presensi (real implementation)
router.get("/intern/presensi", isAuthenticated, internOnly, presenceController.internPresensiPage);
router.post("/intern/presensi", isAuthenticated, internOnly, presenceController.submitPresence);

// Kalender Magang (Intern)
router.get("/intern/kalender", isAuthenticated, internOnly, calendarController.internCalendarPage);

// Logbook (real implementation)
router.get("/intern/logbook", isAuthenticated, internOnly, logbookController.internLogbookPage);
router.post("/intern/logbook/create", isAuthenticated, internOnly, logbookController.internCreateLogbook);
router.post("/intern/logbook/:id/update", isAuthenticated, internOnly, logbookController.internUpdateLogbook);

// Pengumuman (Intern)
router.get("/intern/pengumuman", isAuthenticated, internOnly, announcementController.internList);
router.get("/intern/pengumuman/:id", isAuthenticated, internOnly, announcementController.internDetail);

// Nilai (Evaluation)
router.get("/intern/nilai", isAuthenticated, internOnly, evaluationController.internNilai);

// Dokumen (Intern) - Dinonaktifkan sesuai kebutuhan lingkup proyek
router.use("/intern/dokumen", isAuthenticated, internOnly, (req, res) => res.redirect("/intern/dashboard"));

// ============================================================
// DEVELOPMENT SEED ENDPOINT (Hanya aktif di mode development)
// ============================================================

if (process.env.NODE_ENV !== "production") {
  // Dev endpoints: seed & verify-dates
  router.get("/dev/seed", async (req, res) => {
    try {
      console.log(">>> [DEV SEED] Route called at:", new Date().toISOString());
      const { runSeed } = await import(`../seed.js?t=${Date.now()}`);
      const summary = await runSeed();
      return res.json({
        success: true,
        message: "Seeding peserta magang Tasikmalaya & Ciamis berhasil!",
        summary,
        credentials: {
          mentor: "mentor.cims@gmail.com (Password: Mentor123!)",
          internsPassword: "Intern123! (untuk semua akun intern)",
          sampleInterns: [
            "fenty.anggraeni@gmail.com (Mahasiswa UNSIL Tasikmalaya - Active Ongoing + Draft Mid-term)",
            "ahmad.fauzi@gmail.com (Mahasiswa UNSIL Tasikmalaya - Senior Intern + Published Grade A)",
            "siti.nurhaliza@gmail.com (Mahasiswa UNIGAL Ciamis - Active Ongoing + Draft Mid-term)",
            "rizky.pratama@gmail.com (Siswa SMKN 1 Tasikmalaya - Active Ongoing)",
            "dewi.lestari@gmail.com (Mahasiswa UPI Tasikmalaya - Active Ongoing)",
            "bayu.nugroho@gmail.com (Siswa SMKN 2 Ciamis - Active Ongoing)",
            "anisa.rahmawati@gmail.com (Mahasiswa BSI Tasikmalaya - Active Ongoing)",
            "dimas.arya@gmail.com (Siswa SMKN 4 Tasikmalaya - Active Ongoing)",
            "kevin.sanjaya@gmail.com (UNPER Tasikmalaya - Pending Approval)",
            "maya.putri@gmail.com (SMKN 1 Ciamis - Archived Alumni)",
            "fajar.ramadhan@gmail.com (STMIK DCI Tasikmalaya - Rejected)",
          ],
        },
      });
    } catch (error) {
      console.error("Dev seed error:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  router.get("/dev/check-fridays", async (req, res) => {
    try {
      const { default: prisma } = await import("../config/database.js");
      const presences = await prisma.presence.findMany({
        include: { user: { select: { fullName: true, email: true, participantType: true } } },
        orderBy: { date: "asc" },
      });
      const byDate = {};
      for (const p of presences) {
        const dStr = p.date.toISOString().split("T")[0];
        const dayOfWeek = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][new Date(p.date).getUTCDay()];
        if (!byDate[dStr]) {
          byDate[dStr] = { date: dStr, dayOfWeek, count: 0, statuses: {} };
        }
        byDate[dStr].statuses[p.status] = (byDate[dStr].statuses[p.status] || 0) + 1;
      }
      return res.json({
        totalPresences: presences.length,
        dates: Object.values(byDate),
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}

export default router;
