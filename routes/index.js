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
router.get("/mentor/peserta/:id/edit", isAuthenticated, mentorOnly, mentorController.pesertaEdit);
router.post("/mentor/peserta/:id/edit", isAuthenticated, mentorOnly, mentorController.pesertaUpdate);
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

// Dokumen (Mentor)
router.get("/mentor/dokumen", isAuthenticated, mentorOnly, documentController.templatePage);
router.get("/mentor/dokumen/buat", isAuthenticated, mentorOnly, documentController.generatePage);
router.post("/mentor/dokumen/buat", isAuthenticated, mentorOnly, csrfProtection, documentController.generateProcess);
router.get("/mentor/dokumen/live-preview", isAuthenticated, mentorOnly, documentController.livePreviewRender);
router.get("/mentor/dokumen/template", isAuthenticated, mentorOnly, documentController.templatePage);
router.get("/mentor/dokumen/template/upload", isAuthenticated, mentorOnly, documentController.templateUploadPage);
router.post(
  "/mentor/dokumen/template/upload",
  isAuthenticated,
  mentorOnly,
  uploadTemplate.single("templateFile"),
  handleUploadError,
  csrfProtection,
  documentController.templateUpload
);
router.get("/mentor/dokumen/template/edit/:id", isAuthenticated, mentorOnly, documentController.templateEditPage);
router.post(
  "/mentor/dokumen/template/edit/:id",
  isAuthenticated,
  mentorOnly,
  uploadTemplate.single("templateFile"),
  handleUploadError,
  csrfProtection,
  documentController.templateUpdate
);
router.get("/mentor/dokumen/template/preview/:id", isAuthenticated, mentorOnly, documentController.templatePreview);
router.post("/mentor/dokumen/template/:id/delete", isAuthenticated, mentorOnly, csrfProtection, documentController.templateDelete);
router.post("/mentor/dokumen/template/:id/deactivate", isAuthenticated, mentorOnly, csrfProtection, documentController.templateDeactivate);
router.get("/mentor/dokumen/sertifikat", isAuthenticated, mentorOnly, documentController.sertifikatPage);
router.post("/mentor/dokumen/sertifikat/generate", isAuthenticated, mentorOnly, csrfProtection, documentController.sertifikatGenerate);
router.post(
  "/mentor/dokumen/sertifikat/generate-bulk",
  isAuthenticated,
  mentorOnly,
  bulkCertificateLimiter,
  csrfProtection,
  documentController.sertifikatGenerateBulk
);
router.get("/mentor/dokumen/surat", isAuthenticated, mentorOnly, documentController.suratPage);
router.post("/mentor/dokumen/surat/generate", isAuthenticated, mentorOnly, csrfProtection, documentController.suratGenerate);
router.post(
  "/mentor/dokumen/surat/generate-bulk",
  isAuthenticated,
  mentorOnly,
  bulkLetterLimiter,
  csrfProtection,
  documentController.suratGenerateBulk
);
router.get("/mentor/dokumen/riwayat", isAuthenticated, mentorOnly, documentController.riwayatPage);
router.get("/mentor/dokumen/view/:id", isAuthenticated, mentorOnly, documentController.viewDocument);
router.get("/mentor/dokumen/download/:id", isAuthenticated, mentorOnly, documentController.downloadDocument);

// Placeholder routes
router.get("/mentor/laporan", isAuthenticated, mentorOnly, mentorController.laporan);
router.get("/mentor/profil", isAuthenticated, mentorOnly, mentorController.profil);

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

// Dokumen (Intern)
router.get("/intern/dokumen", isAuthenticated, internOnly, documentController.internDokumenPage);
router.get("/intern/dokumen/view/:id", isAuthenticated, internOnly, documentController.internViewDocument);
router.get("/intern/dokumen/download/:id", isAuthenticated, internOnly, documentController.internDownloadDocument);

// ============================================================
// DEVELOPMENT SEED ENDPOINT (Hanya aktif di mode development)
// ============================================================

if (process.env.NODE_ENV !== "production") {
  router.get("/dev/seed", async (req, res) => {
    try {
      const { runSeed } = await import("../seed.js");
      const summary = await runSeed();
      return res.json({
        success: true,
        message: "Seeding 10 peserta magang dan data dummy berhasil!",
        summary,
        credentials: {
          mentor: "mentor@cims.com (Password: Mentor123!)",
          internsPassword: "Intern123! (untuk semua akun intern)",
          sampleInterns: [
            "ahmad.fauzi@cims.com (Mahasiswa UI - Active + Published Grade A)",
            "siti.nurhaliza@cims.com (Mahasiswa ITB - Active + Draft Grade A)",
            "rizky.pratama@cims.com (Siswa SMKN 1 - Active)",
            "dewi.lestari@cims.com (Mahasiswa UGM - Active)",
            "bayu.nugroho@cims.com (Siswa SMKN 2 - Active)",
            "anisa.rahmawati@cims.com (Telkom Univ - Active)",
            "dimas.arya@cims.com (Siswa SMKN 4 - Active)",
            "kevin.sanjaya@cims.com (BINUS - Pending Approval)",
            "maya.putri@cims.com (SMKN 1 Cibinong - Archived)",
            "fajar.ramadhan@cims.com (UNPAD - Rejected)",
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
}

export default router;
