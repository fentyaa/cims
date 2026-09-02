/**
 * Document Controller
 *
 * Menangani semua request terkait Modul Dokumen:
 * - Mentor: Kelola Template, Generate Sertifikat, Generate Berbagai Jenis Surat (Selesai, Penerimaan, Rekomendasi), Riwayat, View/Print & Download
 * - Intern: Lihat dokumen resmi miliknya di dashboard & modul dokumen, View/Print & Download
 */

import prisma from "../config/database.js";
import documentService from "../services/documentService.js";
import { validateDocumentTemplate } from "../utils/validators.js";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const STORAGE_DOCUMENTS_DIR = path.resolve(PROJECT_ROOT, "storage", "documents");
const PUBLIC_DOCUMENTS_DIR = path.resolve(PROJECT_ROOT, "public", "uploads", "documents");

// ============================================================
// MENTOR: TEMPLATE
// ============================================================

/**
 * Menampilkan halaman daftar template.
 */
export const templatePage = async (req, res) => {
  try {
    const type = req.query.type || "";

    const templates = await documentService.getTemplates(type || null);

    res.render("pages/mentor/dokumen/template", {
      title: "Kelola Template Dokumen - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      templates,
      activeFilter: type,
    });
  } catch (error) {
    console.error("Template page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data template." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Menampilkan halaman form terpadu generate dokumen otomatis.
 * Mentor dapat memilih peserta dan template yang diinginkan.
 */
export const generatePage = async (req, res) => {
  try {
    const selectedUserId = req.query.userId || req.query.participantId || "";
    const selectedTemplateId = req.query.templateId || "";
    const selectedType = req.query.type || "";

    const [participants, templates] = await Promise.all([
      documentService.getParticipantsForDocument({ status: "ALL" }),
      documentService.getTemplates(),
    ]);

    const activeTemplates = templates.filter((t) => t.status === "ACTIVE");

    res.render("pages/mentor/dokumen/generate", {
      title: "Buat Dokumen Otomatis - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants,
      templates: activeTemplates,
      allTemplates: templates,
      selectedUserId,
      selectedTemplateId,
      selectedType,
    });
  } catch (error) {
    console.error("Generate page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat halaman buat dokumen." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Memproses generate dokumen dari form terpadu.
 */
export const generateProcess = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const {
      participantId,
      templateId,
      subtype = "SELESAI",
      nomorSurat,
      bidangMagang,
      tanggalMulai,
      tanggalSelesai,
      namaMentor,
      customNote,
    } = req.body;

    if (!participantId) {
      req.session.messages = [
        { type: "danger", text: "Silakan pilih peserta penerima dokumen." },
      ];
      return res.redirect("/mentor/dokumen/buat");
    }

    if (!templateId) {
      req.session.messages = [
        { type: "danger", text: "Silakan pilih template dokumen yang ingin digunakan." },
      ];
      return res.redirect("/mentor/dokumen/buat");
    }

    const template = await documentService.getTemplateById(templateId);
    if (!template) {
      req.session.messages = [
        { type: "danger", text: "Template yang dipilih tidak ditemukan." },
      ];
      return res.redirect("/mentor/dokumen/buat");
    }

    const doc = await documentService.generateDocument(
      participantId,
      template.documentType,
      mentorId,
      {
        templateId: template.id,
        subtype,
        nomorSurat,
        bidangMagang,
        tanggalMulai,
        tanggalSelesai,
        namaMentor,
        komentarMentor: customNote,
      }
    );

    req.session.messages = [
      {
        type: "success",
        text: `Dokumen "${template.name}" untuk ${doc.user.fullName} berhasil dibuat dan otomatis tersedia di dashboard peserta!`,
      },
    ];

    return res.redirect("/mentor/dokumen/riwayat");
  } catch (error) {
    console.error("Generate process error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat generate dokumen." },
    ];
    return res.redirect("/mentor/dokumen/buat");
  }
};

/**
 * Menampilkan halaman upload / buat template baru.
 */
export const templateUploadPage = async (req, res) => {
  try {
    res.render("pages/mentor/dokumen/template-upload", {
      title: "Upload / Buat Template - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      errors: [],
      formData: {},
    });
  } catch (error) {
    console.error("Template upload page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Proses upload / pembuatan template baru.
 */
export const templateUpload = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const formData = req.body;

    const validation = validateDocumentTemplate(formData);
    if (!validation.valid) {
      return res.render("pages/mentor/dokumen/template-upload", {
        title: "Upload / Buat Template - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        errors: validation.errors,
        formData,
      });
    }

    const filePath = req.file ? `uploads/templates/${req.file.filename}` : null;
    const templateContent = formData.templateContent || "";

    await documentService.createTemplate(formData, mentorId, filePath, templateContent);

    req.session.messages = [
      { type: "success", text: "Template dokumen berhasil disimpan dan diaktifkan." },
    ];

    return res.redirect("/mentor/dokumen/template");
  } catch (error) {
    console.error("Template upload error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat menyimpan template." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Menampilkan halaman edit template.
 */
export const templateEditPage = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await documentService.getTemplateById(id);

    if (!template) {
      req.session.messages = [
        { type: "danger", text: "Template tidak ditemukan." },
      ];
      return res.redirect("/mentor/dokumen/template");
    }

    const templateContent = await documentService.getTemplateRawContent(id);

    res.render("pages/mentor/dokumen/template-edit", {
      title: `Edit Template: ${template.name} - IMS`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      template,
      templateContent,
      errors: [],
    });
  } catch (error) {
    console.error("Template edit page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat template." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Proses update template.
 */
export const templateUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;

    const validation = validateDocumentTemplate(formData);
    if (!validation.valid) {
      const template = await documentService.getTemplateById(id);
      return res.render("pages/mentor/dokumen/template-edit", {
        title: `Edit Template - IMS`,
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        template: { ...template, ...formData },
        templateContent: formData.templateContent || "",
        errors: validation.errors,
      });
    }

    const filePath = req.file ? `uploads/templates/${req.file.filename}` : null;
    const templateContent = formData.templateContent || "";

    await documentService.updateTemplate(id, formData, filePath, templateContent);

    req.session.messages = [
      { type: "success", text: "Template dokumen berhasil diperbarui." },
    ];

    return res.redirect("/mentor/dokumen/template");
  } catch (error) {
    console.error("Template update error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat memperbarui template." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Pratinjau (Preview) Template Dokumen di browser dengan data simulasi.
 */
export const templatePreview = async (req, res) => {
  try {
    const { id } = req.params;
    const renderedHtml = await documentService.previewTemplate(id);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderedHtml);
  } catch (error) {
    console.error("Template preview error:", error);
    return res.status(500).send("Gagal memuat pratinjau template: " + error.message);
  }
};

/**
 * Live Preview Render: Merender dokumen live dengan data peserta & template terpilih.
 */
export const livePreviewRender = async (req, res) => {
  try {
    const {
      participantId,
      templateId,
      subtype = "SELESAI",
      nomorSurat,
      bidangMagang,
      tanggalMulai,
      tanggalSelesai,
      namaMentor,
      customNote,
    } = req.query;

    const renderedHtml = await documentService.renderLiveDocument(
      participantId,
      templateId,
      subtype,
      {
        nomorSurat,
        bidangMagang,
        tanggalMulai,
        tanggalSelesai,
        namaMentor,
        komentarMentor: customNote,
      }
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderedHtml);
  } catch (error) {
    console.error("Live preview error:", error);
    return res.status(500).send("Gagal merender preview: " + error.message);
  }
};

/**
 * Hapus template dokumen.
 */
export const templateDelete = async (req, res) => {
  try {
    const { id } = req.params;
    await documentService.deleteTemplate(id);

    req.session.messages = [
      { type: "success", text: "Template dokumen berhasil dihapus / dinonaktifkan." },
    ];

    return res.redirect("/mentor/dokumen/template");
  } catch (error) {
    console.error("Template delete error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Gagal menghapus template." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

/**
 * Toggle status template (Active / Inactive).
 */
export const templateDeactivate = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await documentService.toggleTemplateStatus(id);

    req.session.messages = [
      {
        type: "success",
        text: `Status template berhasil diubah menjadi ${updated.status}.`,
      },
    ];

    return res.redirect("/mentor/dokumen/template");
  } catch (error) {
    console.error("Template toggle status error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan." },
    ];
    return res.redirect("/mentor/dokumen/template");
  }
};

// ============================================================
// MENTOR: SERTIFIKAT
// ============================================================

/**
 * Menampilkan halaman generate sertifikat untuk peserta.
 */
export const sertifikatPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const type = req.query.type || "";
    const status = req.query.status || "ACTIVE";

    const participants = await documentService.getParticipantsForDocument({
      search,
      type,
      status,
    });

    const activeTemplates = await documentService.getTemplates("CERTIFICATE");

    res.render("pages/mentor/dokumen/sertifikat", {
      title: "Generate Sertifikat Magang - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants,
      templates: activeTemplates,
      filters: { search, type, status },
      hasTemplate: activeTemplates.some((t) => t.status === "ACTIVE"),
    });
  } catch (error) {
    console.error("Sertifikat page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Proses generate sertifikat untuk satu peserta.
 */
export const sertifikatGenerate = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const { participantId, templateId } = req.body;

    if (!participantId) {
      req.session.messages = [
        { type: "danger", text: "Peserta harus dipilih." },
      ];
      return res.redirect("/mentor/dokumen/sertifikat");
    }

    const doc = await documentService.generateDocument(
      participantId,
      "CERTIFICATE",
      mentorId,
      { templateId }
    );

    req.session.messages = [
      {
        type: "success",
        text: `Sertifikat untuk ${doc.user.fullName} berhasil digenerate dan otomatis tersedia di dashboard peserta!`,
      },
    ];

    return res.redirect("/mentor/dokumen/sertifikat");
  } catch (error) {
    console.error("Sertifikat generate error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat generate sertifikat." },
    ];
    return res.redirect("/mentor/dokumen/sertifikat");
  }
};

/**
 * Proses generate sertifikat untuk banyak peserta (Bulk).
 */
export const sertifikatGenerateBulk = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    let { participantIds, templateId } = req.body;

    if (!participantIds) {
      req.session.messages = [
        { type: "danger", text: "Pilih minimal satu peserta untuk generate." },
      ];
      return res.redirect("/mentor/dokumen/sertifikat");
    }

    if (!Array.isArray(participantIds)) {
      participantIds = [participantIds];
    }

    const result = await documentService.generateBulkDocuments(
      participantIds,
      "CERTIFICATE",
      mentorId,
      { templateId }
    );

    const msg = `Sertifikat berhasil digenerate: ${result.success} berhasil, ${result.failed} gagal. Dokumen siap diunduh dan langsung tersedia di akun masing-masing peserta.`;
    req.session.messages = [
      { type: result.failed > 0 ? "warning" : "success", text: msg },
    ];

    return res.redirect("/mentor/dokumen/sertifikat");
  } catch (error) {
    console.error("Sertifikat bulk generate error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan." },
    ];
    return res.redirect("/mentor/dokumen/sertifikat");
  }
};

// ============================================================
// MENTOR: SURAT (SELESAI, PENERIMAAN, REKOMENDASI)
// ============================================================

/**
 * Menampilkan halaman generate surat.
 */
export const suratPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const type = req.query.type || "";
    const status = req.query.status || "ACTIVE";
    const subtype = req.query.subtype || "SELESAI"; // SELESAI, PENERIMAAN, REKOMENDASI

    const participants = await documentService.getParticipantsForDocument({
      search,
      type,
      status,
    });

    const activeTemplates = await documentService.getTemplates("LETTER");

    res.render("pages/mentor/dokumen/surat", {
      title: "Generate Surat Magang - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants,
      templates: activeTemplates,
      filters: { search, type, status, subtype },
      hasTemplate: true,
    });
  } catch (error) {
    console.error("Surat page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Proses generate surat untuk satu peserta.
 */
export const suratGenerate = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    const { participantId, subtype = "SELESAI", templateId } = req.body;

    if (!participantId) {
      req.session.messages = [
        { type: "danger", text: "Peserta harus dipilih." },
      ];
      return res.redirect(`/mentor/dokumen/surat?subtype=${subtype}`);
    }

    const doc = await documentService.generateDocument(
      participantId,
      "LETTER",
      mentorId,
      { subtype, templateId }
    );

    const subtypeNames = {
      SELESAI: "Surat Keterangan Selesai Magang",
      PENERIMAAN: "Surat Penerimaan Magang",
      REKOMENDASI: "Surat Rekomendasi Kerja",
    };
    const letterName = subtypeNames[subtype] || "Surat Magang";

    req.session.messages = [
      {
        type: "success",
        text: `${letterName} untuk ${doc.user.fullName} berhasil digenerate dan otomatis tersedia di dashboard peserta!`,
      },
    ];

    return res.redirect(`/mentor/dokumen/surat?subtype=${subtype}`);
  } catch (error) {
    console.error("Surat generate error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan saat generate surat." },
    ];
    return res.redirect("/mentor/dokumen/surat");
  }
};

/**
 * Proses generate surat untuk banyak peserta (Bulk).
 */
export const suratGenerateBulk = async (req, res) => {
  try {
    const mentorId = req.session.user.id;
    let { participantIds, subtype = "SELESAI", templateId } = req.body;

    if (!participantIds) {
      req.session.messages = [
        { type: "danger", text: "Pilih minimal satu peserta." },
      ];
      return res.redirect(`/mentor/dokumen/surat?subtype=${subtype}`);
    }

    if (!Array.isArray(participantIds)) {
      participantIds = [participantIds];
    }

    const result = await documentService.generateBulkDocuments(
      participantIds,
      "LETTER",
      mentorId,
      { subtype, templateId }
    );

    const msg = `Surat berhasil digenerate: ${result.success} berhasil, ${result.failed} gagal. Dokumen otomatis tersinkronisasi ke dashboard peserta.`;
    req.session.messages = [
      { type: result.failed > 0 ? "warning" : "success", text: msg },
    ];

    return res.redirect(`/mentor/dokumen/surat?subtype=${subtype}`);
  } catch (error) {
    console.error("Surat bulk generate error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan." },
    ];
    return res.redirect("/mentor/dokumen/surat");
  }
};

// ============================================================
// VIEW & PRINT DOKUMEN LANGSUNG DI BROWSER
// ============================================================

/**
 * View & Cetak Dokumen di browser (Mentor).
 */
export const viewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id);

    if (!document) {
      return res.status(404).send("Dokumen tidak ditemukan.");
    }

    const safeFilename = path.basename(document.filePath);
    let resolvedPath = path.resolve(STORAGE_DOCUMENTS_DIR, safeFilename);

    if (!existsSync(resolvedPath)) {
      resolvedPath = path.resolve(PUBLIC_DOCUMENTS_DIR, safeFilename);
    }

    if (!existsSync(resolvedPath)) {
      return res.status(404).send("File fisik dokumen tidak ditemukan.");
    }

    const htmlContent = readFileSync(resolvedPath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(htmlContent);
  } catch (error) {
    console.error("View document error:", error);
    return res.status(500).send("Terjadi kesalahan saat memuat dokumen.");
  }
};

/**
 * View & Cetak Dokumen di browser (Intern).
 */
export const internViewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    const document = await documentService.getDocumentById(id);

    if (!document || document.userId !== userId) {
      return res.status(403).send("Anda tidak memiliki akses ke dokumen ini.");
    }

    const safeFilename = path.basename(document.filePath);
    let resolvedPath = path.resolve(STORAGE_DOCUMENTS_DIR, safeFilename);

    if (!existsSync(resolvedPath)) {
      resolvedPath = path.resolve(PUBLIC_DOCUMENTS_DIR, safeFilename);
    }

    if (!existsSync(resolvedPath)) {
      return res.status(404).send("File fisik dokumen tidak ditemukan.");
    }

    const htmlContent = readFileSync(resolvedPath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(htmlContent);
  } catch (error) {
    console.error("Intern view document error:", error);
    return res.status(500).send("Terjadi kesalahan saat memuat dokumen.");
  }
};

// ============================================================
// MENTOR: RIWAYAT GENERATE
// ============================================================

/**
 * Menampilkan riwayat generate dokumen.
 */
export const riwayatPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const documentType = req.query.documentType || "";

    const result = await documentService.getGenerationHistory({
      page,
      limit,
      search,
      documentType,
    });

    res.render("pages/mentor/dokumen/riwayat", {
      title: "Riwayat Generate Dokumen - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      histories: result.data,
      pagination: result.pagination,
      filters: { search, documentType },
    });
  } catch (error) {
    console.error("Riwayat page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat riwayat." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

// ============================================================
// DOWNLOAD DOKUMEN
// ============================================================

/**
 * Download dokumen (Mentor).
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id);

    if (!document) {
      req.session.messages = [
        { type: "danger", text: "Dokumen tidak ditemukan." },
      ];
      return res.redirect("/mentor/dokumen/riwayat");
    }

    const safeFilename = path.basename(document.filePath);
    let resolvedPath = path.resolve(STORAGE_DOCUMENTS_DIR, safeFilename);

    if (!existsSync(resolvedPath)) {
      resolvedPath = path.resolve(PUBLIC_DOCUMENTS_DIR, safeFilename);
    }

    if (!existsSync(resolvedPath)) {
      req.session.messages = [
        { type: "danger", text: "File dokumen fisik tidak ditemukan." },
      ];
      return res.redirect("/mentor/dokumen/riwayat");
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.download(resolvedPath, safeFilename);
  } catch (error) {
    console.error("Download error:", error);
    req.session.messages = [
      { type: "danger", text: "Gagal mengunduh dokumen." },
    ];
    return res.redirect("/mentor/dokumen/riwayat");
  }
};

/**
 * Menampilkan halaman dokumen untuk peserta.
 */
export const internDokumenPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const documents = await documentService.getDocumentsByUser(userId);

    const certificates = documents.filter((d) => d.documentType === "CERTIFICATE");
    const letters = documents.filter((d) => d.documentType === "LETTER");

    res.render("pages/intern/dokumen", {
      title: "Dokumen Resmi Saya - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      documents,
      certificates,
      letters,
      hasDocuments: documents.length > 0,
    });
  } catch (error) {
    console.error("Intern dokumen page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat dokumen." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

/**
 * Download dokumen milik peserta.
 */
export const internDownloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    const document = await documentService.getDocumentById(id);

    if (!document || document.userId !== userId) {
      req.session.messages = [
        { type: "danger", text: "Anda tidak memiliki akses ke dokumen ini." },
      ];
      return res.redirect("/intern/dokumen");
    }

    const safeFilename = path.basename(document.filePath);
    let resolvedPath = path.resolve(STORAGE_DOCUMENTS_DIR, safeFilename);

    if (!existsSync(resolvedPath)) {
      resolvedPath = path.resolve(PUBLIC_DOCUMENTS_DIR, safeFilename);
    }

    if (!existsSync(resolvedPath)) {
      req.session.messages = [
        { type: "danger", text: "File dokumen fisik tidak ditemukan." },
      ];
      return res.redirect("/intern/dokumen");
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.download(resolvedPath, safeFilename);
  } catch (error) {
    console.error("Intern download error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat mengunduh dokumen." },
    ];
    return res.redirect("/intern/dokumen");
  }
};

export default {
  generatePage,
  generateProcess,
  templatePage,
  templateUploadPage,
  templateUpload,
  templateEditPage,
  templateUpdate,
  templatePreview,
  livePreviewRender,
  templateDelete,
  templateDeactivate,
  sertifikatPage,
  sertifikatGenerate,
  sertifikatGenerateBulk,
  suratPage,
  suratGenerate,
  suratGenerateBulk,
  viewDocument,
  internViewDocument,
  riwayatPage,
  downloadDocument,
  internDokumenPage,
  internDownloadDocument,
};
