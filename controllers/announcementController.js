/**
 * Announcement Controller
 *
 * Menangani semua request terkait modul Pengumuman.
 * - Mentor: CRUD + arsip
 * - Intern: read only
 */

import prisma from "../config/database.js";
import announcementService from "../services/announcementService.js";
import { validateAnnouncement } from "../utils/validators.js";

// ============================================================
// MENTOR CONTROLLERS
// ============================================================

/**
 * Menampilkan daftar semua pengumuman (Mentor).
 */
export const mentorList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const status = req.query.status || "";

    const result = await announcementService.getAllAnnouncements({
      page,
      limit,
      search,
      category,
      status,
    });

    res.render("pages/mentor/pengumuman", {
      title: "Pengumuman - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      announcements: result.data,
      pagination: result.pagination,
      filters: { search, category, status },
    });
  } catch (error) {
    console.error("Mentor announcement list error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat pengumuman." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Menampilkan form buat pengumuman baru.
 */
export const mentorCreateForm = (req, res) => {
  res.render("pages/mentor/pengumuman-buat", {
    title: "Buat Pengumuman - Internship Management System",
    layout: "layouts/dashboard",
    userName: req.session.user.fullName,
    formData: {},
    errors: [],
  });
};

/**
 * Proses membuat pengumuman baru.
 */
export const mentorCreate = async (req, res) => {
  try {
    const formData = {
      title: req.body.title?.trim(),
      content: req.body.content?.trim(),
      category: req.body.category,
      targetType: req.body.targetType,
      publishDate: req.body.publishDate,
      expireDate: req.body.expireDate || null,
      status: req.body.status || "DRAFT",
    };

    // Validasi
    const validation = validateAnnouncement(formData);
    if (!validation.valid) {
      return res.render("pages/mentor/pengumuman-buat", {
        title: "Buat Pengumuman - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        formData,
        errors: validation.errors,
      });
    }

    // Lampiran (opsional)
    if (req.file) {
      formData.attachment = req.file.filename;
    }

    await announcementService.createAnnouncement(formData, req.session.user.id);

    req.session.messages = [
      { type: "success", text: "Pengumuman berhasil dibuat." },
    ];

    return res.redirect("/mentor/pengumuman");
  } catch (error) {
    console.error("Mentor create announcement error:", error);
    return res.render("pages/mentor/pengumuman-buat", {
      title: "Buat Pengumuman - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      formData: req.body,
      errors: ["Terjadi kesalahan server. Silakan coba lagi."],
    });
  }
};

/**
 * Menampilkan form edit pengumuman.
 */
export const mentorEditForm = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await announcementService.getAnnouncementById(id);

    if (!announcement) {
      req.session.messages = [
        { type: "danger", text: "Pengumuman tidak ditemukan." },
      ];
      return res.redirect("/mentor/pengumuman");
    }

    res.render("pages/mentor/pengumuman-edit", {
      title: "Edit Pengumuman - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      announcement,
      errors: [],
    });
  } catch (error) {
    console.error("Mentor edit form error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat form edit." },
    ];
    return res.redirect("/mentor/pengumuman");
  }
};

/**
 * Proses update pengumuman.
 */
export const mentorUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = {
      title: req.body.title?.trim(),
      content: req.body.content?.trim(),
      category: req.body.category,
      targetType: req.body.targetType,
      publishDate: req.body.publishDate,
      expireDate: req.body.expireDate || null,
      status: req.body.status || "DRAFT",
    };

    // Validasi
    const validation = validateAnnouncement(formData);
    if (!validation.valid) {
      const announcement = await announcementService.getAnnouncementById(id);
      return res.render("pages/mentor/pengumuman-edit", {
        title: "Edit Pengumuman - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        announcement,
        errors: validation.errors,
      });
    }

    // Lampiran baru (opsional)
    if (req.file) {
      formData.attachment = req.file.filename;
    }

    await announcementService.updateAnnouncement(id, formData);

    req.session.messages = [
      { type: "success", text: "Pengumuman berhasil diperbarui." },
    ];

    return res.redirect("/mentor/pengumuman");
  } catch (error) {
    console.error("Mentor update announcement error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memperbarui pengumuman." },
    ];
    return res.redirect(`/mentor/pengumuman/edit/${req.params.id}`);
  }
};

/**
 * Proses hapus pengumuman.
 */
export const mentorDelete = async (req, res) => {
  try {
    const { id } = req.params;
    await announcementService.deleteAnnouncement(id);

    req.session.messages = [
      { type: "success", text: "Pengumuman berhasil dihapus." },
    ];

    return res.redirect("/mentor/pengumuman");
  } catch (error) {
    console.error("Mentor delete announcement error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat menghapus pengumuman." },
    ];
    return res.redirect("/mentor/pengumuman");
  }
};

/**
 * Proses mengubah status pengumuman (DRAFT / PUBLISHED / ARCHIVED).
 */
export const mentorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await announcementService.updateAnnouncementStatus(id, status);

    const statusLabels = {
      DRAFT: "disimpan sebagai draft",
      PUBLISHED: "dipublikasikan",
      ARCHIVED: "diarsipkan",
    };

    req.session.messages = [
      { type: "success", text: `Pengumuman berhasil ${statusLabels[status] || "diubah statusnya"}.` },
    ];

    return res.redirect("/mentor/pengumuman");
  } catch (error) {
    console.error("Mentor status announcement error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat mengubah status." },
    ];
    return res.redirect("/mentor/pengumuman");
  }
};

// ============================================================
// INTERN CONTROLLERS
// ============================================================

/**
 * Menampilkan daftar pengumuman untuk peserta (hanya Published).
 */
export const internList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Dapatkan tipe peserta dari session atau database
    let participantType = req.session.user?.participantType || null;
    if (!participantType) {
      const user = await prisma.user.findUnique({
        where: { id: req.session.user.id },
        select: { participantType: true },
      });
      participantType = user?.participantType || null;
      // Update session for future requests
      if (user) {
        req.session.user.participantType = user.participantType;
      }
    }

    const result = await announcementService.getPublishedAnnouncements(participantType, { page, limit });

    res.render("pages/intern/pengumuman", {
      title: "Pengumuman - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      announcements: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Intern announcement list error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat pengumuman." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

/**
 * Menampilkan detail pengumuman untuk peserta.
 */
export const internDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await announcementService.getAnnouncementById(id);

    if (!announcement) {
      req.session.messages = [
        { type: "danger", text: "Pengumuman tidak ditemukan." },
      ];
      return res.redirect("/intern/pengumuman");
    }

    // Pastikan hanya Published yang bisa dilihat peserta
    if (announcement.status !== "PUBLISHED") {
      req.session.messages = [
        { type: "danger", text: "Pengumuman tidak ditemukan." },
      ];
      return res.redirect("/intern/pengumuman");
    }

    // Pastikan sesuai target
    const participantType = req.session.user.participantType || null;
    if (
      announcement.targetType !== "ALL" &&
      announcement.targetType !== participantType
    ) {
      req.session.messages = [
        { type: "danger", text: "Pengumuman tidak ditemukan." },
      ];
      return res.redirect("/intern/pengumuman");
    }

    res.render("pages/intern/pengumuman-detail", {
      title: `${announcement.title} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      announcement,
    });
  } catch (error) {
    console.error("Intern announcement detail error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat detail pengumuman." },
    ];
    return res.redirect("/intern/pengumuman");
  }
};

export default {
  mentorList,
  mentorCreateForm,
  mentorCreate,
  mentorEditForm,
  mentorUpdate,
  mentorDelete,
  mentorStatus,
  internList,
  internDetail,
};
