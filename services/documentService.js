/**
 * Document Service
 *
 * Business logic untuk modul Dokumen:
 * - Kelola Template Sertifikat, Surat Selesai Magang, Surat Penerimaan, & Surat Rekomendasi
 * - Template Engine Dinamis (Penggantian Placeholder {{NAMA_LENGKAP}}, {{INSTANSI}}, dll)
 * - Auto-Populasi Data dari Database (tanpa perlu input manual)
 * - Generate Dokumen Satuan & Bulk untuk peserta mana pun
 * - Cetak & Preview langsung di browser dengan styling print-ready
 * - Otomatis terkirim dan tersedia di Dashboard & Halaman Dokumen Peserta
 */

import prisma from "../config/database.js";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// CONSTANTS & PRIVATE STORAGE
// ============================================================

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DOCUMENTS_DIR = path.join(PROJECT_ROOT, "storage", "documents");
const TEMPLATES_DIR = path.join(PROJECT_ROOT, "storage", "templates");

// Pastikan direktori storage tersedia
if (!existsSync(DOCUMENTS_DIR)) {
  mkdirSync(DOCUMENTS_DIR, { recursive: true });
}
if (!existsSync(TEMPLATES_DIR)) {
  mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// ============================================================
// SECURITY HELPERS (HTML Escaping & Safe Filename)
// ============================================================

/**
 * Escape HTML special characters untuk mencegah XSS.
 * @param {*} str
 * @returns {string}
 */
export const escapeHtml = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * Format tanggal ke bahasa Indonesia (contoh: 31 Agustus 2026).
 */
export const formatDateIndonesian = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * Format tanggal ke format titik (contoh: 31.07.2026).
 */
export const formatDateDot = (date) => {
  if (!date) return "31.07.2026";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "31.07.2026";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Format tanggal ke bahasa Inggris (contoh: July 31, 2026).
 */
export const formatDateEn = (date) => {
  if (!date) return "July 31, 2026";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "July 31, 2026";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Generate safe filename untuk dokumen.
 */
export const generateSafeDocumentFilename = (documentType, fullName, dateStr, subtype = "doc") => {
  const typePrefix = documentType === "CERTIFICATE" ? "sertifikat" : `surat-${subtype}`;
  
  const rawSlug = (fullName || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase()
    .slice(0, 30);
  const safeSlug = rawSlug || "peserta";
  
  const safeDate = String(dateStr || "").replace(/[^0-9-]/g, "").slice(0, 10);
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  
  const filename = `${typePrefix}-${safeSlug}-${safeDate}-${randomSuffix}.html`;
  
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    throw new Error("Filename hasil generate tidak valid.");
  }
  
  return filename;
};

// ============================================================
// TEMPLATE MANAGEMENT
// ============================================================

/**
 * Mendapatkan semua template dokumen.
 * @param {string} documentType - "CERTIFICATE" | "LETTER" | null
 * @returns {Array}
 */
export const getTemplates = async (documentType = null) => {
  const where = {};
  if (documentType) {
    where.documentType = documentType;
  }

  let templates = await prisma.documentTemplate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: {
        select: { id: true, fullName: true, email: true },
      },
      _count: {
        select: { documents: true },
      },
    },
  });

  // Jika belum ada template sama sekali, inisialisasi template resmi PT. CIKARA BAKTI NUSANTARA
  if (templates.length === 0 && !documentType) {
    const mentor = await prisma.user.findFirst({ where: { role: "MENTOR" } });
    const mentorId = mentor ? mentor.id : null;

    try {
      await prisma.documentTemplate.createMany({
        data: [
          {
            name: "Surat Keterangan Selesai Magang PT. Cikara Bakti Nusantara",
            documentType: "LETTER",
            version: "1.0",
            filePath: "storage/templates/surat-keterangan-cikara.html",
            status: "ACTIVE",
            uploadedById: mentorId,
          },
          {
            name: "Surat Balasan Kerja Magang PT. Cikara Bakti Nusantara",
            documentType: "LETTER",
            version: "1.0",
            filePath: "storage/templates/surat-balasan-magang-cikara.html",
            status: "ACTIVE",
            uploadedById: mentorId,
          },
          {
            name: "Sertifikat Kelulusan Magang Resmi PT. Cikara Bakti Nusantara",
            documentType: "CERTIFICATE",
            version: "1.0",
            filePath: "storage/templates/default-certificate.html",
            status: "ACTIVE",
            uploadedById: mentorId,
          },
        ],
        skipDuplicates: true,
      });

      templates = await prisma.documentTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, email: true },
          },
          _count: {
            select: { documents: true },
          },
        },
      });
    } catch (e) {
      console.warn("Auto-provision template warning:", e.message);
    }
  }

  return templates;
};

/**
 * Mendapatkan template berdasarkan ID.
 */
export const getTemplateById = async (id) => {
  return prisma.documentTemplate.findUnique({
    where: { id },
    include: {
      uploadedBy: {
        select: { id: true, fullName: true, email: true },
      },
      _count: {
        select: { documents: true },
      },
    },
  });
};

/**
 * Mendapatkan template aktif berdasarkan jenis dokumen atau ID spesifik.
 */
export const getActiveTemplate = async (documentType, templateId = null) => {
  if (templateId) {
    const tpl = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    if (tpl && tpl.status === "ACTIVE") return tpl;
  }

  // Fallback ke template aktif pertama berdasarkan tipe
  return prisma.documentTemplate.findFirst({
    where: { documentType, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Mengambil konten HTML raw dari template.
 */
export const getTemplateRawContent = async (id) => {
  const template = await getTemplateById(id);
  if (!template) return "";

  if (template.filePath) {
    const candidatePaths = [
      path.resolve(PROJECT_ROOT, template.filePath),
      path.resolve(TEMPLATES_DIR, path.basename(template.filePath)),
      path.resolve(PROJECT_ROOT, "public", template.filePath),
      path.resolve(PROJECT_ROOT, "public", "uploads", "templates", path.basename(template.filePath)),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          return readFileSync(p, "utf-8");
        } catch (e) {
          console.error("Error reading template file:", p, e);
        }
      }
    }
  }

  // Fallback ke boilerplate default
  const sampleMap = {
    "{{NAMA_LENGKAP}}": "{{NAMA_LENGKAP}}",
    "{{NAMA_PESERTA}}": "{{NAMA_PESERTA}}",
    "{{EMAIL}}": "{{EMAIL}}",
    "{{NO_HP}}": "{{NO_HP}}",
    "{{JENIS_PESERTA}}": "{{JENIS_PESERTA}}",
    "{{INSTANSI}}": "{{INSTANSI}}",
    "{{UNIVERSITAS}}": "{{UNIVERSITAS}}",
    "{{SEKOLAH}}": "{{SEKOLAH}}",
    "{{JURUSAN}}": "{{JURUSAN}}",
    "{{PROGRAM_STUDI}}": "{{PROGRAM_STUDI}}",
    "{{NIM_NIS}}": "{{NIM_NIS}}",
    "{{NIM}}": "{{NIM}}",
    "{{NIS}}": "{{NIS}}",
    "{{STUDENT_ID}}": "{{STUDENT_ID}}",
    "{{KELAS}}": "{{KELAS}}",
    "{{PERIODE_MAGANG}}": "{{PERIODE_MAGANG}}",
    "{{TANGGAL_MULAI}}": "{{TANGGAL_MULAI}}",
    "{{TANGGAL_SELESAI}}": "{{TANGGAL_SELESAI}}",
    "{{NILAI_AKHIR}}": "{{NILAI_AKHIR}}",
    "{{GRADE}}": "{{GRADE}}",
    "{{PREDIKAT}}": "{{PREDIKAT}}",
    "{{KOMENTAR_MENTOR}}": "{{KOMENTAR_MENTOR}}",
    "{{CATATAN_EVALUASI}}": "{{CATATAN_EVALUASI}}",
    "{{REKOMENDASI}}": "{{REKOMENDASI}}",
    "{{NAMA_MENTOR}}": "{{NAMA_MENTOR}}",
    "{{EMAIL_MENTOR}}": "{{EMAIL_MENTOR}}",
    "{{TANGGAL_CETAK}}": "{{TANGGAL_CETAK}}",
    "{{NOMOR_SURAT}}": "{{NOMOR_SURAT}}",
    "{{KOTA_PENERBITAN}}": "{{KOTA_PENERBITAN}}",
  };

  if (template.documentType === "CERTIFICATE") {
    return buildCertificateHtml(sampleMap);
  } else {
    const tName = (template.name || "").toUpperCase();
    if (tName.includes("PENERIMAAN")) return buildAcceptanceLetterHtml(sampleMap);
    if (tName.includes("REKOMENDASI")) return buildRecommendationLetterHtml(sampleMap);
    return buildCompletionLetterHtml(sampleMap);
  }
};

/**
 * Membuat template baru.
 */
export const createTemplate = async (data, mentorId, filePath = null, templateContent = "") => {
  let resolvedFilePath = filePath;

  // Jika mentor memasukkan konten HTML langsung via web form
  if (templateContent && templateContent.trim().length > 0) {
    const slug = (data.name || "template")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30);
    const filename = `custom-${slug}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.html`;
    const fullPath = path.resolve(TEMPLATES_DIR, filename);
    writeFileSync(fullPath, templateContent.trim(), "utf-8");
    resolvedFilePath = `storage/templates/${filename}`;
  } else if (!resolvedFilePath) {
    resolvedFilePath = "storage/templates/default.html";
  }

  return prisma.documentTemplate.create({
    data: {
      name: data.name.trim(),
      documentType: data.documentType,
      version: data.version ? data.version.trim() : "1.0",
      filePath: resolvedFilePath,
      status: "ACTIVE",
      uploadedById: mentorId,
    },
    include: {
      uploadedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Update template dokumen yang sudah ada.
 */
export const updateTemplate = async (id, data, filePath = null, templateContent = "") => {
  const existing = await getTemplateById(id);
  if (!existing) {
    throw new Error("Template tidak ditemukan.");
  }

  let resolvedFilePath = existing.filePath;

  if (filePath) {
    resolvedFilePath = filePath;
  } else if (templateContent && templateContent.trim().length > 0) {
    // Simpan konten HTML baru ke file template
    let targetFilename;
    if (existing.filePath && existing.filePath.startsWith("storage/templates/")) {
      targetFilename = path.basename(existing.filePath);
    } else {
      const slug = (data.name || "template")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30);
      targetFilename = `custom-${slug}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.html`;
      resolvedFilePath = `storage/templates/${targetFilename}`;
    }
    const fullPath = path.resolve(TEMPLATES_DIR, targetFilename);
    writeFileSync(fullPath, templateContent.trim(), "utf-8");
  }

  return prisma.documentTemplate.update({
    where: { id },
    data: {
      name: data.name ? data.name.trim() : existing.name,
      documentType: data.documentType || existing.documentType,
      version: data.version ? data.version.trim() : existing.version,
      filePath: resolvedFilePath,
      status: data.status || existing.status,
    },
  });
};

/**
 * Hapus template dokumen.
 */
export const deleteTemplate = async (id) => {
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });

  if (!template) {
    throw new Error("Template tidak ditemukan.");
  }

  if (template._count.documents > 0) {
    // Jika sudah pernah dipakai membuat dokumen resmi, nonaktifkan saja untuk integritas audit
    return prisma.documentTemplate.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  }

  return prisma.documentTemplate.delete({ where: { id } });
};

/**
 * Menonaktifkan atau mengaktifkan template.
 */
export const toggleTemplateStatus = async (id) => {
  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    throw new Error("Template tidak ditemukan.");
  }

  const newStatus = template.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  return prisma.documentTemplate.update({
    where: { id },
    data: { status: newStatus },
  });
};

export const deactivateTemplate = async (id) => {
  return prisma.documentTemplate.update({
    where: { id },
    data: { status: "INACTIVE" },
  });
};

// ============================================================
// UNIVERSAL PARTICIPANT DATA GATHERING (DARI DATABASE)
// ============================================================

/**
 * Mendapatkan daftar peserta untuk generate dokumen.
 * Fleksibel untuk siapa saja (Active, Pending, Archived, ada/tidaknya nilai).
 *
 * @param {Object} options - { search, type, status }
 * @returns {Array}
 */
export const getParticipantsForDocument = async ({
  search = "",
  type = "",
  status = "ACTIVE",
} = {}) => {
  const where = {
    role: "INTERN",
  };

  // Filter status akun (default ACTIVE, tapi mentor bisa pilih ALL / ARCHIVED / PENDING)
  if (status && status !== "ALL") {
    where.status = status;
  }

  // Filter jenis peserta (UNIVERSITY / SMK)
  if (type && ["UNIVERSITY", "SMK"].includes(type)) {
    where.participantType = type;
  }

  // Pencarian
  if (search && search.trim()) {
    const keyword = search.trim();
    where.OR = [
      { fullName: { contains: keyword, mode: "insensitive" } },
      { email: { contains: keyword, mode: "insensitive" } },
      { university: { contains: keyword, mode: "insensitive" } },
      { schoolName: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const participants = await prisma.user.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      evaluations: {
        include: {
          mentor: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
      documents: {
        select: {
          id: true,
          documentType: true,
          filePath: true,
          createdAt: true,
        },
      },
    },
  });

  return participants.map((p) => {
    const evalData = Array.isArray(p.evaluations) ? p.evaluations[0] : p.evaluations;
    const certDoc = p.documents.find((d) => d.documentType === "CERTIFICATE");
    const letterDocs = p.documents.filter((d) => d.documentType === "LETTER");

    return {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      phoneNumber: p.phoneNumber,
      profilePhoto: p.profilePhoto,
      participantType: p.participantType,
      status: p.status,
      university: p.university,
      studyProgram: p.studyProgram,
      studentId: p.studentId,
      schoolName: p.schoolName,
      major: p.major,
      classGrade: p.classGrade,
      internshipPeriod: p.internshipPeriod,
      internshipStartDate: p.internshipStartDate,
      internshipEndDate: p.internshipEndDate,
      mentor: evalData?.mentor || null,
      finalScore: evalData?.finalScore || null,
      grade: evalData?.grade || null,
      evalStatus: evalData?.status || "NONE",
      publishedAt: evalData?.publishedAt || null,
      hasCertificate: !!certDoc,
      hasLetter: letterDocs.length > 0,
      certificateDocId: certDoc?.id || null,
      totalDocuments: p.documents.length,
    };
  });
};

// Aliases for compatibility
export const getEligibleParticipants = getParticipantsForDocument;

// ============================================================
// TEMPLATE PLACEHOLDER ENGINE & DATA INJECTION
// ============================================================

/**
 * Menyiapkan dictionary placeholder otomatis dari data peserta di database.
 */
export const preparePlaceholderData = (participant, evaluation, mentor, customOptions = {}) => {
  const now = new Date();
  const dateStr = formatDateIndonesian(now);

  const isUniv = participant.participantType === "UNIVERSITY";
  const instansi = isUniv ? (participant.university || "-") : (participant.schoolName || "-");
  const jurusan = isUniv ? (participant.studyProgram || "-") : (participant.major || "-");
  const nimNis = participant.studentId || "-";
  const kelas = participant.classGrade || "-";
  const jenisPeserta = isUniv ? "Mahasiswa" : "Siswa PKL SMK";

  const tglMulai = participant.internshipStartDate ? formatDateIndonesian(participant.internshipStartDate) : "2 Juni 2026";
  const tglSelesai = participant.internshipEndDate ? formatDateIndonesian(participant.internshipEndDate) : "31 Juli 2026";
  const tglMulaiEn = participant.internshipStartDate ? formatDateEn(participant.internshipStartDate) : "June 2, 2026";
  const tglSelesaiEn = participant.internshipEndDate ? formatDateEn(participant.internshipEndDate) : "July 31, 2026";
  const tglSelesaiDot = participant.internshipEndDate ? formatDateDot(participant.internshipEndDate) : "31.07.2026";
  const periode = participant.internshipPeriod || `${tglMulai} s/d ${tglSelesai}`;

  const finalScore = evaluation && evaluation.finalScore ? String(evaluation.finalScore) : "-";
  const grade = evaluation && evaluation.grade ? String(evaluation.grade) : "-";

  let predikat = "Memuaskan";
  if (grade === "A" || grade === "A-") predikat = "Sangat Memuaskan";
  else if (grade === "B" || grade === "B+") predikat = "Memuaskan";
  else if (grade === "C") predikat = "Cukup";
  else if (grade === "D") predikat = "Kurang";

  const mentorName = mentor?.fullName || "Wahyu Muhamad Rizqi., S.Kom.";
  const mentorEmail = mentor?.email || "cikarastudio@gmail.com";
  const chiefName = "Wahyu M. Rizqi, S.Kom";
  const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const romanMonth = romanMonths[now.getMonth()];
  const defaultLetterNumber = customOptions.nomorSurat || `31. 33127/CBN/${romanMonth}/${now.getFullYear()}`;
  const defaultReplyNumber = customOptions.nomorSuratBalasan || customOptions.nomorSurat || `31. 33127/CBN/${romanMonth}/${now.getFullYear()}`;
  let tabelRows = `<tr>
    <td style="text-align: center;">${escapeHtml(customOptions.nimNis || nimNis)}</td>
    <td><strong>${escapeHtml(customOptions.namaPeserta || participant.fullName)}</strong></td>
    <td>${escapeHtml(customOptions.jurusan || jurusan)}</td>
  </tr>`;

  if (Array.isArray(customOptions.participants) && customOptions.participants.length > 0) {
    tabelRows = customOptions.participants
      .map(
        (p) => `<tr>
          <td style="text-align: center;">${escapeHtml(p.studentId || p.nim || "-")}</td>
          <td><strong>${escapeHtml(p.fullName || p.name || "-")}</strong></td>
          <td>${escapeHtml(p.studyProgram || p.major || p.jurusan || jurusan)}</td>
        </tr>`
      )
      .join("\n");
  }

  return {
    "{{NAMA_LENGKAP}}": escapeHtml(customOptions.namaPeserta || participant.fullName),
    "{{NAMA_PESERTA}}": escapeHtml(customOptions.namaPeserta || participant.fullName),
    "{{EMAIL}}": escapeHtml(participant.email),
    "{{NO_HP}}": escapeHtml(participant.phoneNumber || "-"),
    "{{JENIS_PESERTA}}": escapeHtml(jenisPeserta),
    "{{INSTANSI}}": escapeHtml(customOptions.instansi || instansi),
    "{{UNIVERSITAS}}": escapeHtml(customOptions.instansi || participant.university || "-"),
    "{{SEKOLAH}}": escapeHtml(customOptions.instansi || participant.schoolName || "-"),
    "{{JURUSAN}}": escapeHtml(customOptions.jurusan || jurusan),
    "{{PROGRAM_STUDI}}": escapeHtml(customOptions.jurusan || jurusan),
    "{{NIM_NIS}}": escapeHtml(customOptions.nimNis || nimNis),
    "{{NIM}}": escapeHtml(customOptions.nimNis || nimNis),
    "{{NIS}}": escapeHtml(customOptions.nimNis || nimNis),
    "{{NPM}}": escapeHtml(customOptions.nimNis || nimNis),
    "{{STUDENT_ID}}": escapeHtml(customOptions.nimNis || nimNis),
    "{{KELAS}}": escapeHtml(kelas),
    "{{PERIODE_MAGANG}}": escapeHtml(customOptions.periode || periode),
    "{{TANGGAL_MULAI}}": escapeHtml(customOptions.tanggalMulai || tglMulai),
    "{{TANGGAL_SELESAI}}": escapeHtml(customOptions.tanggalSelesai || tglSelesai),
    "{{TANGGAL_MULAI_EN}}": escapeHtml(customOptions.tanggalMulaiEn || tglMulaiEn),
    "{{TANGGAL_SELESAI_EN}}": escapeHtml(customOptions.tanggalSelesaiEn || tglSelesaiEn),
    "{{TANGGAL_SELESAI_DOT}}": escapeHtml(customOptions.tanggalSelesaiDot || tglSelesaiDot),
    "{{NILAI_AKHIR}}": escapeHtml(customOptions.nilaiAkhir || finalScore),
    "{{GRADE}}": escapeHtml(customOptions.grade || grade),
    "{{PREDIKAT}}": escapeHtml(customOptions.predikat || predikat),
    "{{KOMENTAR_MENTOR}}": escapeHtml(customOptions.komentarMentor || evaluation?.mentorComment || "Telah menunjukkan dedikasi dan performa yang baik selama masa magang."),
    "{{CATATAN_EVALUASI}}": escapeHtml(customOptions.komentarMentor || evaluation?.mentorComment || "-"),
    "{{REKOMENDASI}}": escapeHtml(customOptions.rekomendasi || evaluation?.recommendation || "Direkomendasikan untuk pengembangan karir profesional di bidang terkait."),
    "{{NAMA_MENTOR}}": escapeHtml(customOptions.namaMentor || mentorName),
    "{{EMAIL_MENTOR}}": escapeHtml(mentorEmail),
    "{{NAMA_CHIEF}}": escapeHtml(customOptions.namaChief || chiefName),
    "{{JABATAN_CHIEF}}": "CHIEF EXECUTIVE OFFICER",
    "{{NAMA_DIREKTUR}}": escapeHtml(customOptions.namaDirektur || "Wahyu Muhamad Rizqi., S.Kom."),
    "{{JABATAN_MENTOR}}": escapeHtml(customOptions.jabatanMentor || "Direktur"),
    "{{BIDANG_MAGANG}}": escapeHtml(customOptions.bidangMagang || "Game And Apps Development"),
    "{{ALAMAT_INSTANSI}}": escapeHtml(customOptions.alamatInstansi || "Jalan Siliwangi No.24"),
    "{{KOTA_INSTANSI}}": escapeHtml(customOptions.kotaInstansi || "Tasikmalaya"),
    "{{TOTAL_HARI_KERJA}}": escapeHtml(customOptions.totalHariKerja || "40"),
    "{{NOMOR_SURAT_PERMOHONAN}}": escapeHtml(customOptions.nomorSuratPermohonan || `1286/UN58.13/KM/${now.getFullYear()}`),
    "{{TANGGAL_SURAT_PERMOHONAN}}": escapeHtml(customOptions.tanggalSuratPermohonan || `11 Mei ${now.getFullYear()}`),
    "{{NAMA_PERUSAHAAN}}": "PT. CIKARA BAKTI NUSANTARA",
    "{{ALAMAT_PERUSAHAAN}}": "Perum Cipta Graha Mandiri, Blok A, No. 23, Sukarindik, Bungursari, Tasikmalaya, Jawa Barat (46151)",
    "{{TELP_PERUSAHAAN}}": "085317563748",
    "{{EMAIL_PERUSAHAAN}}": "cikarastudio@gmail.com",
    "{{WEBSITE_PERUSAHAAN}}": "www.cikarastudio.com",
    "{{TANGGAL_CETAK}}": escapeHtml(customOptions.tanggalCetak || dateStr),
    "{{NOMOR_SURAT}}": defaultLetterNumber,
    "{{NOMOR_SURAT_BALASAN}}": defaultReplyNumber,
    "{{KOTA_PENERBITAN}}": escapeHtml(customOptions.kotaPenerbitan || "Tasikmalaya"),
    "{{TABEL_PESERTA_ROWS}}": tabelRows,
  };
};

/**
 * Mengganti semua placeholder dalam template teks/HTML.
 */
export const replacePlaceholders = (templateContent, placeholderData) => {
  let result = templateContent;
  for (const [tag, val] of Object.entries(placeholderData)) {
    result = result.replaceAll(tag, val);
  }
  return result;
};

/**
 * Merender HTML template dokumen dengan mengganti placeholder.
 * Prioritas: File template custom di storage -> Fallback built-in builder.
 */
export const resolveTemplateHtml = (template, placeholderMap, fallbackSubtype = "SELESAI") => {
  if (template && template.filePath) {
    const candidatePaths = [
      path.resolve(PROJECT_ROOT, template.filePath),
      path.resolve(TEMPLATES_DIR, path.basename(template.filePath)),
      path.resolve(PROJECT_ROOT, "public", template.filePath),
      path.resolve(PROJECT_ROOT, "public", "uploads", "templates", path.basename(template.filePath)),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          const raw = readFileSync(p, "utf-8");
          if (raw && raw.trim().length > 0) {
            return replacePlaceholders(raw, placeholderMap);
          }
        } catch (e) {
          console.error("Error reading template file:", p, e);
        }
      }
    }
  }

  // Fallback ke built-in builder berdasarkan tipe & nama
  const docType = template?.documentType || "CERTIFICATE";
  if (docType === "CERTIFICATE") {
    return buildCertificateHtml(placeholderMap);
  }

  const tName = (template?.name || "").toUpperCase();
  if (tName.includes("PENERIMAAN") || fallbackSubtype === "PENERIMAAN") {
    return buildAcceptanceLetterHtml(placeholderMap);
  } else if (tName.includes("REKOMENDASI") || fallbackSubtype === "REKOMENDASI") {
    return buildRecommendationLetterHtml(placeholderMap);
  } else {
    return buildCompletionLetterHtml(placeholderMap);
  }
};

/**
 * Preview template dengan data dummy/simulasi.
 */
export const previewTemplate = async (id) => {
  const template = await getTemplateById(id);
  if (!template) {
    throw new Error("Template tidak ditemukan.");
  }

  const sampleParticipant = {
    fullName: "Budi Santoso, S.Kom",
    email: "budi.santoso@example.com",
    phoneNumber: "081234567890",
    participantType: "UNIVERSITY",
    university: "Universitas Indonesia",
    studyProgram: "Teknik Informatika",
    studentId: "2106721001",
    internshipPeriod: "1 Juli 2026 - 30 September 2026",
    internshipStartDate: new Date("2026-07-01"),
    internshipEndDate: new Date("2026-09-30"),
  };

  const sampleEvaluation = {
    finalScore: 92.5,
    grade: "A",
    mentorComment: "Menunjukkan dedikasi dan performa yang luar biasa dalam seluruh proyek magang.",
    recommendation: "Sangat direkomendasikan untuk bergabung sebagai software engineer profesional.",
  };

  const sampleMentor = {
    fullName: "Admin Mentor CIMS",
    email: "mentor.cims@gmail.com",
  };

  const placeholderMap = preparePlaceholderData(sampleParticipant, sampleEvaluation, sampleMentor);
  return resolveTemplateHtml(template, placeholderMap);
};

// ============================================================
// DOCUMENT GENERATION CORE
// ============================================================

/**
 * Generate dokumen untuk satu peserta dengan auto-populasi data database.
 *
 * @param {string} participantId - ID peserta
 * @param {string} documentType - "CERTIFICATE" | "LETTER"
 * @param {string} mentorId - ID mentor
 * @param {Object} options - { subtype: "SELESAI"|"PENERIMAAN"|"REKOMENDASI", templateId }
 * @returns {Object} Data Document yang tersimpan
 */
export const generateDocument = async (
  participantId,
  documentType,
  mentorId,
  options = {}
) => {
  const { subtype = "SELESAI", templateId = null } = options;

  // 1. Ambil data lengkap peserta dari database
  const participant = await prisma.user.findUnique({
    where: { id: participantId },
    include: {
      evaluations: {
        include: {
          mentor: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  if (!participant || participant.role !== "INTERN") {
    throw new Error("Peserta tidak ditemukan.");
  }

  // 2. Ambil data mentor yang generate
  const mentorUser = await prisma.user.findUnique({
    where: { id: mentorId },
    select: { id: true, fullName: true, email: true },
  });

  const mentor = mentorUser || participant.mentor || { fullName: "Mentor Pembimbing", email: "mentor.cims@gmail.com" };
  const evaluation = Array.isArray(participant.evaluations)
    ? participant.evaluations[0]
    : participant.evaluations;

  // 3. Ambil template aktif atau default
  let template = await getActiveTemplate(documentType, templateId);
  if (!template) {
    template = await prisma.documentTemplate.findFirst({
      where: { documentType },
      orderBy: { createdAt: "desc" },
    });
  }

  // Jika belum ada template sama sekali di DB, buatkan default
  if (!template) {
    template = await prisma.documentTemplate.create({
      data: {
        name: documentType === "CERTIFICATE" ? "Template Sertifikat Standar" : `Template Surat ${subtype}`,
        documentType,
        version: "1.0",
        filePath: "templates/default.html",
        status: "ACTIVE",
        uploadedById: mentorId,
      },
    });
  }

  // 4. Siapkan data placeholder
  const placeholderMap = preparePlaceholderData(participant, evaluation, mentor);

  // 5. Build HTML Dokumen (Dinamis dari template yang dipilih atau template custom)
  const htmlContent = resolveTemplateHtml(template, placeholderMap, subtype);

  // 6. Simpan file HTML fisik ke private storage
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = generateSafeDocumentFilename(documentType, participant.fullName, dateStr, subtype.toLowerCase());
  const resolvedPath = path.resolve(DOCUMENTS_DIR, filename);

  writeFileSync(resolvedPath, htmlContent, "utf-8");

  // 7. Simpan record Dokumen ke database
  const relativePath = `storage/documents/${filename}`;
  const document = await prisma.document.create({
    data: {
      userId: participantId,
      documentType,
      templateId: template.id,
      filePath: relativePath,
      generatedById: mentorId,
    },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      generatedBy: {
        select: { id: true, fullName: true },
      },
      template: {
        select: { id: true, name: true, version: true },
      },
    },
  });

  // 8. Catat ke Generation History
  await prisma.generationHistory.create({
    data: {
      userId: participantId,
      documentType,
      templateId: template.id,
      generatedById: mentorId,
      status: "SUCCESS",
    },
  });

  return document;
};

/**
 * Generate dokumen untuk banyak peserta (Bulk).
 */
export const generateBulkDocuments = async (
  participantIds,
  documentType,
  mentorId,
  options = {}
) => {
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const pid of participantIds) {
    try {
      await generateDocument(pid, documentType, mentorId, options);
      success++;
    } catch (error) {
      failed++;
      errors.push(`Gagal generate untuk peserta ID ${pid}: ${error.message}`);
    }
  }

  return { success, failed, errors };
};

// ============================================================
// HTML TEMPLATE BUILDERS (PRINT-READY WITH MODERN STYLING)
// ============================================================

/**
 * Template HTML Sertifikat Kelulusan Magang (Format Resmi PT. CIKARA BAKTI NUSANTARA)
 */
export const buildCertificateHtml = (data) => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate - ${data["{{NAMA_PESERTA}}"]}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Great+Vibes&family=Montserrat:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #f1f5f9;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    }
    .print-bar {
      position: fixed;
      top: 15px;
      right: 15px;
      display: flex;
      gap: 10px;
      z-index: 999;
    }
    .btn-print {
      background: #1e3a8a;
      color: #fff;
      border: none;
      padding: 10px 22px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30,58,138,0.3);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: sans-serif;
    }
    .btn-print:hover { background: #172554; }

    /* A4 Landscape Container */
    .cert-container {
      width: 1060px;
      height: 748px;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px 70px 40px;
    }

    /* Outer Gold Thin Border */
    .cert-border {
      position: absolute;
      top: 18px;
      left: 18px;
      right: 18px;
      bottom: 18px;
      border: 1.5px solid #d99b26;
      pointer-events: none;
      z-index: 10;
    }

    /* Background Geometric Vector Layers */
    .bg-graphics {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    /* Top Left Company Logo & Text */
    .company-brand {
      position: absolute;
      top: 30px;
      left: 35px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 20;
    }
    .company-logo-svg {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }
    .company-text {
      color: #ffffff;
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Top Right Gold Ribbon Badge */
    .ribbon-badge {
      position: absolute;
      top: 24px;
      right: 50px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .badge-starburst {
      width: 66px;
      height: 66px;
      background: radial-gradient(circle, #fcd34d 0%, #e5a823 60%, #b47b16 100%);
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2), inset 0 0 0 2px #fef08a, inset 0 0 0 4px #b47b16;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
    }
    .badge-star {
      color: #ffffff;
      font-size: 16px;
      margin-bottom: -1px;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
    }
    .badge-text {
      color: #ffffff;
      font-family: 'Montserrat', sans-serif;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
    }
    .ribbon-tails {
      display: flex;
      gap: 4px;
      margin-top: -12px;
      z-index: 1;
    }
    .ribbon-tail {
      width: 18px;
      height: 28px;
      background: linear-gradient(180deg, #d99b26 0%, #b47b16 100%);
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    /* Main Certificate Content */
    .cert-content {
      position: relative;
      z-index: 15;
      text-align: center;
      width: 100%;
      max-width: 820px;
      margin-top: 15px;
    }

    .cert-main-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 44px;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 4px;
      line-height: 1;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .cert-sub-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: #0369a1;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 22px;
    }
    .cert-presented-to {
      font-family: 'Montserrat', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      color: #0369a1;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    /* Recipient Name in Elegant Calligraphy */
    .cert-recipient-name {
      font-family: 'Great Vibes', 'Alex Brush', cursive;
      font-size: 50px;
      color: #0f172a;
      line-height: 1.25;
      padding: 0 30px;
      display: inline-block;
      margin-bottom: 6px;
    }
    .recipient-divider {
      width: 280px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #94a3b8, transparent);
      margin: 0 auto 16px;
    }

    /* Body Description (Neat & Balanced) */
    .cert-body-desc {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12.5px;
      color: #0369a1;
      line-height: 1.65;
      max-width: 760px;
      margin: 0 auto 28px;
    }
    .cert-body-desc p {
      margin-bottom: 3px;
    }
    .cert-body-desc strong {
      color: #0f172a;
      font-weight: 600;
    }

    /* Signature & Date Footer */
    .cert-footer-row {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
    }
    .footer-col {
      text-align: center;
      width: 260px;
    }
    .footer-value {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .footer-line {
      width: 100%;
      height: 2px;
      background: #38bdf8;
      margin-bottom: 8px;
    }
    .footer-label {
      font-family: 'Montserrat', sans-serif;
      font-size: 11.5px;
      font-weight: 600;
      color: #0369a1;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    @media print {
      body { background: transparent; padding: 0; }
      .print-bar { display: none !important; }
      .cert-container { box-shadow: none; width: 100vw; height: 100vh; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="cert-container">
    <!-- Thin Gold Frame Border -->
    <div class="cert-border"></div>

    <!-- Background Geometric Vector Layers (Top & Bottom Corners) -->
    <svg class="bg-graphics" viewBox="0 0 1060 748" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <!-- TOP LEFT CORNER GEOMETRY -->
      <!-- 1. Grey Accent Slice -->
      <polygon points="0,0 480,0 260,260 0,180" fill="#cbd5e1" opacity="0.6"/>
      <!-- 2. Yellow/Gold Slice -->
      <polygon points="0,0 450,0 210,250 0,225" fill="#d99b26"/>
      <!-- 3. Royal Blue Mid Layer -->
      <polygon points="0,0 420,0 180,240 0,140" fill="#2572ca"/>
      <!-- 4. Dark Navy Base Layer with Curve -->
      <polygon points="0,0 350,0 0,150" fill="#132b50"/>

      <!-- TOP RIGHT CORNER GEOMETRY -->
      <polygon points="620,0 1060,0 1060,85 700,45" fill="#2572ca"/>
      <polygon points="760,0 1060,0 1060,50" fill="#132b50"/>

      <!-- BOTTOM LEFT CORNER GEOMETRY -->
      <polygon points="0,620 480,700 0,748" fill="#2572ca"/>
      <polygon points="0,675 320,748 0,748" fill="#132b50"/>

      <!-- BOTTOM RIGHT CORNER GEOMETRY -->
      <!-- 1. Grey Accent Slice -->
      <polygon points="600,748 1060,530 1060,748" fill="#cbd5e1" opacity="0.5"/>
      <!-- 2. Royal Blue Layer -->
      <polygon points="660,748 1060,560 1060,748" fill="#2572ca"/>
      <!-- 3. Gold/Yellow Slice -->
      <polygon points="700,748 1060,600 1060,748" fill="#d99b26"/>
      <!-- 4. Dark Navy Base Corner -->
      <polygon points="780,748 1060,670 1060,748" fill="#132b50"/>
    </svg>

    <!-- Top Left Brand (Logo & Company Name) -->
    <div class="company-brand">
      <div class="company-logo-svg">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 6C25.7 6 6 25.7 6 50C6 74.3 25.7 94 50 94C63.8 94 76.1 87.7 84.1 77.8L50 50L84.1 22.2C76.1 12.3 63.8 6 50 6Z" fill="#ffffff"/>
          <circle cx="50" cy="50" r="14" fill="#132b50"/>
        </svg>
      </div>
      <div class="company-text">
        PT. CIKARA<br>BAKTI NUSANTARA
      </div>
    </div>

    <!-- Top Right Gold Scallop Badge with Ribbon -->
    <div class="ribbon-badge">
      <div class="badge-starburst">
        <span class="badge-star">★</span>
        <span class="badge-text">INTERNSHIP</span>
      </div>
      <div class="ribbon-tails">
        <div class="ribbon-tail"></div>
        <div class="ribbon-tail"></div>
      </div>
    </div>

    <!-- Certificate Typography & Content -->
    <div class="cert-content">
      <h1 class="cert-main-title">CERTIFICATE</h1>
      <h2 class="cert-sub-title">OF APPRECIATION</h2>
      
      <p class="cert-presented-to">IS PROUDLY PRESENTED TO</p>

      <!-- Recipient Name -->
      <div class="cert-recipient-name">${data["{{NAMA_PESERTA}}"]}</div>
      <div class="recipient-divider"></div>

      <!-- Tidy & Polished Description Paragraphs (Exact Match with Cikara Official Certificate) -->
      <div class="cert-body-desc">
        <p>
          Has participated in the Vocational Apprenticeship Program in the field of <strong>${data["{{BIDANG_MAGANG}}"]}</strong> at <strong>PT. Cikara Bakti Nusantara</strong>.
        </p>
        <p>
          The apprenticeship program was conducted from <strong>${data["{{TANGGAL_MULAI_EN}}"] || data["{{TANGGAL_MULAI}}"]}</strong> to <strong>${data["{{TANGGAL_SELESAI_EN}}"] || data["{{TANGGAL_SELESAI}}"]}</strong>.
        </p>
        <p>
          During the program, the participant has been declared competent as a Junior Game Developer in accordance with the competency standards of Cikara.
        </p>
      </div>

      <!-- Footer Signatures & Date -->
      <div class="cert-footer-row">
        <div class="footer-col">
          <div class="footer-value">${data["{{TANGGAL_SELESAI_DOT}}"] || data["{{TANGGAL_CETAK}}"]}</div>
          <div class="footer-line"></div>
          <div class="footer-label">DATE</div>
        </div>

        <div class="footer-col">
          <div class="footer-value">${data["{{NAMA_CHIEF}}"] || "Wahyu M. Rizqi, S.Kom"}</div>
          <div class="footer-line"></div>
          <div class="footer-label">${data["{{JABATAN_CHIEF}}"] || "CHIEF EXECUTIVE OFFICER"}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Template HTML Surat Keterangan Selesai Magang (Format Resmi PT. CIKARA BAKTI NUSANTARA)
 */
export const buildCompletionLetterHtml = (data) => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Surat Keterangan - ${data["{{NAMA_PESERTA}}"]}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9;
      color: #000000;
      padding: 30px 15px;
      display: flex;
      justify-content: center;
    }
    .print-bar { position: fixed; top: 15px; right: 15px; z-index: 999; }
    .btn-print {
      background: #1e3a8a; color: #fff; border: none; padding: 10px 22px;
      font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(30,58,138,0.3); font-family: sans-serif;
    }
    .btn-print:hover { background: #172554; }
    .letter-sheet {
      width: 780px;
      min-height: 1080px;
      background: #ffffff;
      padding: 50px 65px 60px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      line-height: 1.65;
      font-size: 14.5px;
      color: #000000;
    }
    .kop-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 8px;
    }
    .kop-logo { flex-shrink: 0; width: 85px; }
    .kop-text { flex-grow: 1; text-align: left; }
    .comp-title {
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      color: #000000;
    }
    .comp-desc {
      font-size: 12.5px;
      line-height: 1.35;
      color: #000000;
      margin-bottom: 2px;
    }
    .kop-line {
      margin-top: 6px;
      margin-bottom: 35px;
    }
    .line-thick { height: 3.5px; background: #000000; margin-bottom: 2px; }
    .line-thin { height: 1px; background: #000000; }
    
    .letter-heading { text-align: center; margin-bottom: 35px; }
    .title-text { font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-bottom: 4px; }
    .number-text { font-size: 14px; font-weight: normal; }
    
    .intro-p { margin-bottom: 12px; }
    .table-info { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
    .table-info td { padding: 2px 4px; vertical-align: top; font-size: 14.5px; }
    .table-info td:first-child { width: 120px; }
    
    .content-p { margin-bottom: 18px; text-align: justify; }
    
    .signature-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 45px;
    }
    .sign-block {
      width: 290px;
      text-align: center;
      position: relative;
    }
    .sign-date { margin-bottom: 25px; }
    .sign-role { line-height: 1.4; margin-bottom: 10px; }
    .stamp-sign-area {
      height: 110px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .official-stamp {
      position: absolute;
      left: 15px;
      top: 0px;
      z-index: 2;
    }
    .signature-svg {
      position: absolute;
      right: 40px;
      top: 25px;
      z-index: 1;
    }
    .sign-name {
      font-weight: normal;
      margin-top: 5px;
    }

    @media print {
      body { background: transparent; padding: 0; }
      .print-bar { display: none !important; }
      .letter-sheet { box-shadow: none; width: 100%; padding: 40px 50px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="letter-sheet">
    <!-- KOP SURAT PT. CIKARA BAKTI NUSANTARA -->
    <div class="kop-container">
      <div class="kop-logo">
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C63.2 92 74.9 85.9 82.6 76.4L50 50L82.6 23.6C74.9 14.1 63.2 8 50 8Z" fill="#111827"/>
          <path d="M50 22C34.5 22 22 34.5 22 50C22 65.5 34.5 78 50 78C58.8 78 66.5 74 71.7 67.8L50 50L71.7 32.2C66.5 26 58.8 22 50 22Z" fill="#ffffff"/>
          <circle cx="50" cy="50" r="13" fill="#111827"/>
        </svg>
      </div>
      <div class="kop-text">
        <h1 class="comp-title">PT. CIKARA BAKTI NUSANTARA</h1>
        <p class="comp-desc">Alamat Kantor Sekertariat: Perum Cipta Graha Mandiri, Blok A, No. 23,<br>Sukarindik, Bungursari, Tasikmalaya, Jawa Barat (46151)</p>
        <p class="comp-desc">Nomor Telepon : 085317563748 Web-Site : <span style="text-decoration: underline; color: #0000EE;">www.cikarastudio.com</span></p>
        <p class="comp-desc">E-Mail : <span style="text-decoration: underline; color: #0000EE;">cikarastudio@gmail.com</span></p>
      </div>
    </div>
    <div class="kop-line">
      <div class="line-thick"></div>
      <div class="line-thin"></div>
    </div>

    <!-- JUDUL SURAT -->
    <div class="letter-heading">
      <h2 class="title-text">SURAT KETERANGAN</h2>
      <p class="number-text">No: ${data["{{NOMOR_SURAT}}"]}</p>
    </div>

    <!-- ISI SURAT -->
    <p class="intro-p">Yang bertanda tangan dibawah ini :</p>
    <table class="table-info">
      <tr><td>Nama</td><td>: ${data["{{NAMA_MENTOR}}"]}</td></tr>
      <tr><td>Jabatan</td><td>: ${data["{{JABATAN_MENTOR}}"]}</td></tr>
    </table>

    <p class="intro-p">Menerangkan bahwa :</p>
    <table class="table-info">
      <tr><td>Nama</td><td>: ${data["{{NAMA_PESERTA}}"]}</td></tr>
      <tr><td>NPM</td><td>: ${data["{{NIM_NIS}}"]}</td></tr>
    </table>

    <p class="content-p">
      Telah melaksanakan Praktek Kerja mengenai <em>${data["{{BIDANG_MAGANG}}"]}</em> di PT. CIKARA BAKTI NUSANTARA.
    </p>

    <p class="content-p">
      Pelaksanaan Praktek Kerja di PT. CIKARA BAKTI NUSANTARA terhitung mulai tanggal ${data["{{TANGGAL_MULAI}}"]} - ${data["{{TANGGAL_SELESAI}}"]}.
    </p>

    <p class="content-p">
      Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan seperlunya,<br>
      Atas kerjasama yang baik, kami ucapkan terima kasih.
    </p>

    <!-- TANDA TANGAN & STEMPEL RESMI -->
    <div class="signature-wrapper">
      <div class="sign-block">
        <p class="sign-date">${data["{{KOTA_PENERBITAN}}"]}, ${data["{{TANGGAL_CETAK}}"]}</p>
        <p class="sign-role">Pembimbing Lapangan<br><strong>PT. CIKARA BAKTI NUSANTARA</strong></p>
        <div class="stamp-sign-area">
          <!-- STEMPEL BULAT BIRU CIKARA BAKTI NUSANTARA -->
          <svg width="120" height="120" viewBox="0 0 200 200" class="official-stamp">
            <g transform="rotate(-8 100 100)">
              <circle cx="100" cy="100" r="92" stroke="#1d4ed8" stroke-width="4" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="85" stroke="#1d4ed8" stroke-width="1.6" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="54" stroke="#1d4ed8" stroke-width="1.8" fill="none" opacity="0.88"/>
              <path d="M100 68 C82 68 68 82 68 100 C68 118 82 132 100 132 C110 132 119 127 125 120 L100 100 L125 80 C119 73 110 68 100 68 Z" fill="#1d4ed8" opacity="0.85"/>
              <circle cx="100" cy="100" r="9" fill="#ffffff"/>
              <circle cx="100" cy="100" r="5" fill="#1d4ed8" opacity="0.85"/>
              <path id="stampPathTop1" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14.5" font-weight="bold" letter-spacing="2.2" opacity="0.9">
                <textPath href="#stampPathTop1" startOffset="50%" text-anchor="middle">PT. CIKARA BAKTI NUSANTARA</textPath>
              </text>
              <path id="stampPathBottom1" d="M 170,105 A 72,72 0 0,1 30,105" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14" font-weight="bold" letter-spacing="3" opacity="0.9">
                <textPath href="#stampPathBottom1" startOffset="50%" text-anchor="middle">TASIKMALAYA</textPath>
              </text>
            </g>
          </svg>
          <!-- TANDA TANGAN -->
          <svg width="120" height="70" viewBox="0 0 160 90" class="signature-svg">
            <path d="M20 65 Q45 15 70 50 T120 40 Q135 30 145 60" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
            <path d="M50 45 Q70 65 95 35" stroke="#000000" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>
          </svg>
        </div>
        <p class="sign-name">${data["{{NAMA_MENTOR}}"]}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Template HTML Surat Balasan / Penerimaan Kerja Magang (Format Resmi PT. CIKARA BAKTI NUSANTARA)
 */
export const buildAcceptanceLetterHtml = (data) => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Balasan Kerja Magang - ${data["{{NAMA_PESERTA}}"]}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9;
      color: #000000;
      padding: 30px 15px;
      display: flex;
      justify-content: center;
    }
    .print-bar { position: fixed; top: 15px; right: 15px; z-index: 999; }
    .btn-print {
      background: #1e3a8a; color: #fff; border: none; padding: 10px 22px;
      font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(30,58,138,0.3); font-family: sans-serif;
    }
    .btn-print:hover { background: #172554; }
    .letter-sheet {
      width: 780px;
      min-height: 1080px;
      background: #ffffff;
      padding: 50px 65px 60px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      line-height: 1.6;
      font-size: 14.5px;
      color: #000000;
    }
    .kop-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 8px;
    }
    .kop-logo { flex-shrink: 0; width: 85px; }
    .kop-text { flex-grow: 1; text-align: left; }
    .comp-title {
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      color: #000000;
    }
    .comp-desc {
      font-size: 12.5px;
      line-height: 1.35;
      color: #000000;
      margin-bottom: 2px;
    }
    .kop-line {
      margin-top: 6px;
      margin-bottom: 30px;
    }
    .line-thick { height: 3.5px; background: #000000; margin-bottom: 2px; }
    .line-thin { height: 1px; background: #000000; }
    
    .letter-heading { text-align: center; margin-bottom: 25px; }
    .title-text { font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-bottom: 4px; }
    .number-text { font-size: 14px; font-weight: normal; }
    
    .top-date { text-align: right; margin-bottom: 25px; font-size: 14.5px; }
    .recipient-box { margin-bottom: 25px; font-size: 14.5px; line-height: 1.45; }
    
    .content-p { margin-bottom: 14px; text-align: justify; font-size: 14.5px; }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0 20px;
      font-size: 14px;
    }
    .data-table th, .data-table td {
      border: 1px solid #000000;
      padding: 6px 10px;
      text-align: left;
    }
    .data-table th { font-weight: bold; text-align: center; background: #fafafa; }
    
    .terms-list {
      margin: 10px 0 16px 20px;
      padding-left: 10px;
    }
    .terms-list li {
      margin-bottom: 8px;
      text-align: justify;
      font-size: 14.5px;
    }
    
    .signature-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 40px;
    }
    .sign-block {
      width: 290px;
      text-align: center;
      position: relative;
    }
    .sign-role { line-height: 1.4; margin-bottom: 10px; }
    .stamp-sign-area {
      height: 110px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .official-stamp {
      position: absolute;
      left: 15px;
      top: 0px;
      z-index: 2;
    }
    .signature-svg {
      position: absolute;
      right: 40px;
      top: 25px;
      z-index: 1;
    }
    .sign-name {
      font-weight: normal;
      margin-top: 5px;
    }

    @media print {
      body { background: transparent; padding: 0; }
      .print-bar { display: none !important; }
      .letter-sheet { box-shadow: none; width: 100%; padding: 40px 50px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="letter-sheet">
    <!-- KOP SURAT PT. CIKARA BAKTI NUSANTARA -->
    <div class="kop-container">
      <div class="kop-logo">
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C63.2 92 74.9 85.9 82.6 76.4L50 50L82.6 23.6C74.9 14.1 63.2 8 50 8Z" fill="#111827"/>
          <path d="M50 22C34.5 22 22 34.5 22 50C22 65.5 34.5 78 50 78C58.8 78 66.5 74 71.7 67.8L50 50L71.7 32.2C66.5 26 58.8 22 50 22Z" fill="#ffffff"/>
          <circle cx="50" cy="50" r="13" fill="#111827"/>
        </svg>
      </div>
      <div class="kop-text">
        <h1 class="comp-title">PT. CIKARA BAKTI NUSANTARA</h1>
        <p class="comp-desc">Alamat Kantor Sekertariat: Perum Cipta Graha Mandiri, Blok A, No. 23,<br>Sukarindik, Bungursari, Tasikmalaya, Jawa Barat (46151)</p>
        <p class="comp-desc">Nomor Telepon : 085317563748 E-Mail : <span style="text-decoration: underline; color: #0000EE;">cikarastudio@gmail.com</span></p>
      </div>
    </div>
    <div class="kop-line">
      <div class="line-thick"></div>
      <div class="line-thin"></div>
    </div>

    <!-- JUDUL SURAT -->
    <div class="letter-heading">
      <h2 class="title-text">BALASAN KERJA MAGANG</h2>
      <p class="number-text">No: ${data["{{NOMOR_SURAT_BALASAN}}"] || data["{{NOMOR_SURAT}}"]}</p>
    </div>

    <p class="top-date">${data["{{KOTA_PENERBITAN}}"]}, ${data["{{TANGGAL_CETAK}}"]}</p>

    <div class="recipient-box">
      <p>Yang terhormat,</p>
      <p style="margin-top: 5px;"><strong>${data["{{INSTANSI}}"]}</strong><br>${data["{{ALAMAT_INSTANSI}}"]}<br>${data["{{KOTA_INSTANSI}}"]}</p>
    </div>

    <p class="content-p">
      Menjawab surat Wakil Dekan Bidang Akademik dan Kemahasiswaan Fakultas Teknik ${data["{{INSTANSI}}"]} No. ${data["{{NOMOR_SURAT_PERMOHONAN}}"]}, tanggal ${data["{{TANGGAL_SURAT_PERMOHONAN}}"]} perihal : Permohonan Kerja Praktek / Magang, untuk mahasiswa :
    </p>

    <!-- TABEL MAHASISWA -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 140px;">NPM</th>
          <th>Nama</th>
          <th style="width: 160px;">Jurusan</th>
        </tr>
      </thead>
      <tbody>
        ${data["{{TABEL_PESERTA_ROWS}}"] || `<tr><td style="text-align: center;">${data["{{NIM_NIS}}"]}</td><td><strong>${data["{{NAMA_PESERTA}}"]}</strong></td><td>${data["{{JURUSAN}}"]}</td></tr>`}
      </tbody>
    </table>

    <p class="content-p">
      Bersama ini disampaikan bahwa PT. Cikara Bakti Nusantara menyampaikan ucapan terima kasih atas kepercayaan menjadi tempat kegiatan penelitian Kerja Praktek Akademisi ${data["{{INSTANSI}}"]} dan menyetujui permohonan dengan syarat dan ketentuan sebagai berikut :
    </p>

    <ol class="terms-list">
      <li>Pelaksanaan kegiatan Magang/Kerja Praktek Berlaku tmt. ${data["{{TANGGAL_MULAI}}"]} s/d ${data["{{TANGGAL_SELESAI}}"]} (${data["{{TOTAL_HARI_KERJA}}"]} Hari Kerja), waktu jam kerja kantor PT. Cikara Bakti Nusantara.</li>
      <li>Selama melakukan kegiatan Magang/Praktek Kerja Lapangan mahasiswa wajib mematuhi tata tertib yang berlaku di kantor PT. Cikara Bakti Nusantara.</li>
      <li>Membuat laporan (topik/tema) dan mempresentasikan serta memberi masukan untuk perbaikan PT. Cikara Bakti Nusantara selama kegiatan magang kepada pembimbing dan segala biaya yang timbul menjadi beban mahasiswa yang bersangkutan.</li>
    </ol>

    <p class="content-p">
      Demikian surat balasan ini disampaikan, atas perhatian dan kepercayaan Bapak/Ibu kami ucapkan terima kasih.
    </p>

    <!-- TANDA TANGAN & STEMPEL RESMI -->
    <div class="signature-wrapper">
      <div class="sign-block">
        <p class="sign-role">Direktur<br><strong>PT. Cikara Bakti Nusantara</strong></p>
        <div class="stamp-sign-area">
          <!-- STEMPEL BULAT BIRU CIKARA BAKTI NUSANTARA -->
          <svg width="120" height="120" viewBox="0 0 200 200" class="official-stamp">
            <g transform="rotate(-8 100 100)">
              <circle cx="100" cy="100" r="92" stroke="#1d4ed8" stroke-width="4" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="85" stroke="#1d4ed8" stroke-width="1.6" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="54" stroke="#1d4ed8" stroke-width="1.8" fill="none" opacity="0.88"/>
              <path d="M100 68 C82 68 68 82 68 100 C68 118 82 132 100 132 C110 132 119 127 125 120 L100 100 L125 80 C119 73 110 68 100 68 Z" fill="#1d4ed8" opacity="0.85"/>
              <circle cx="100" cy="100" r="9" fill="#ffffff"/>
              <circle cx="100" cy="100" r="5" fill="#1d4ed8" opacity="0.85"/>
              <path id="stampPathTop2" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14.5" font-weight="bold" letter-spacing="2.2" opacity="0.9">
                <textPath href="#stampPathTop2" startOffset="50%" text-anchor="middle">PT. CIKARA BAKTI NUSANTARA</textPath>
              </text>
              <path id="stampPathBottom2" d="M 170,105 A 72,72 0 0,1 30,105" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14" font-weight="bold" letter-spacing="3" opacity="0.9">
                <textPath href="#stampPathBottom2" startOffset="50%" text-anchor="middle">TASIKMALAYA</textPath>
              </text>
            </g>
          </svg>
          <!-- TANDA TANGAN -->
          <svg width="120" height="70" viewBox="0 0 160 90" class="signature-svg">
            <path d="M20 65 Q45 15 70 50 T120 40 Q135 30 145 60" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
            <path d="M50 45 Q70 65 95 35" stroke="#000000" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>
          </svg>
        </div>
        <p class="sign-name">${data["{{NAMA_MENTOR}}"]}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Template HTML Surat Rekomendasi Magang
 */
export const buildRecommendationLetterHtml = (data) => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Surat Rekomendasi - ${data["{{NAMA_PESERTA}}"]}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9; color: #000000; padding: 30px 15px; display: flex; justify-content: center;
    }
    .print-bar { position: fixed; top: 15px; right: 15px; z-index: 999; }
    .btn-print {
      background: #1e3a8a; color: #fff; border: none; padding: 10px 22px;
      font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(30,58,138,0.3); font-family: sans-serif;
    }
    .letter-sheet {
      width: 780px; min-height: 1080px; background: #ffffff; padding: 50px 65px 60px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12); line-height: 1.65; font-size: 14.5px;
    }
    .kop-container { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
    .kop-logo { flex-shrink: 0; width: 85px; }
    .comp-title { font-size: 21px; font-weight: bold; margin-bottom: 3px; }
    .comp-desc { font-size: 12.5px; line-height: 1.35; margin-bottom: 2px; }
    .kop-line { margin-top: 6px; margin-bottom: 35px; }
    .line-thick { height: 3.5px; background: #000; margin-bottom: 2px; }
    .line-thin { height: 1px; background: #000; }
    .letter-heading { text-align: center; margin-bottom: 35px; }
    .title-text { font-size: 16px; font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .table-info { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
    .table-info td { padding: 3px 4px; vertical-align: top; font-size: 14.5px; }
    .table-info td:first-child { width: 130px; }
    .content-p { margin-bottom: 16px; text-align: justify; }
    .signature-wrapper { display: flex; justify-content: flex-end; margin-top: 45px; }
    .sign-block { width: 290px; text-align: center; position: relative; }
    .sign-role { line-height: 1.4; margin-bottom: 10px; }
    .stamp-sign-area { height: 110px; position: relative; display: flex; align-items: center; justify-content: center; }
    .official-stamp { position: absolute; left: 15px; top: 0px; z-index: 2; }
    .signature-svg { position: absolute; right: 40px; top: 25px; z-index: 1; }
    @media print {
      body { background: transparent; padding: 0; }
      .print-bar { display: none !important; }
      .letter-sheet { box-shadow: none; width: 100%; padding: 40px 50px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="letter-sheet">
    <div class="kop-container">
      <div class="kop-logo">
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C63.2 92 74.9 85.9 82.6 76.4L50 50L82.6 23.6C74.9 14.1 63.2 8 50 8Z" fill="#111827"/>
          <path d="M50 22C34.5 22 22 34.5 22 50C22 65.5 34.5 78 50 78C58.8 78 66.5 74 71.7 67.8L50 50L71.7 32.2C66.5 26 58.8 22 50 22Z" fill="#ffffff"/>
          <circle cx="50" cy="50" r="13" fill="#111827"/>
        </svg>
      </div>
      <div class="kop-text">
        <h1 class="comp-title">PT. CIKARA BAKTI NUSANTARA</h1>
        <p class="comp-desc">Alamat Kantor Sekertariat: Perum Cipta Graha Mandiri, Blok A, No. 23,<br>Sukarindik, Bungursari, Tasikmalaya, Jawa Barat (46151)</p>
        <p class="comp-desc">Nomor Telepon : 085317563748 E-Mail : <span style="text-decoration: underline; color: #0000EE;">cikarastudio@gmail.com</span></p>
      </div>
    </div>
    <div class="kop-line">
      <div class="line-thick"></div>
      <div class="line-thin"></div>
    </div>

    <div class="letter-heading">
      <h2 class="title-text">SURAT REKOMENDASI KERJA</h2>
      <p class="number-text">No: ${data["{{NOMOR_SURAT}}"]}</p>
    </div>

    <p class="intro-p">Saya yang bertanda tangan di bawah ini:</p>
    <table class="table-info">
      <tr><td>Nama</td><td>: ${data["{{NAMA_MENTOR}}"]}</td></tr>
      <tr><td>Jabatan</td><td>: ${data["{{JABATAN_MENTOR}}"]}</td></tr>
      <tr><td>Instansi</td><td>: PT. CIKARA BAKTI NUSANTARA</td></tr>
    </table>

    <p class="intro-p">Dengan ini memberikan rekomendasi kerja kepada:</p>
    <table class="table-info">
      <tr><td>Nama</td><td>: <strong>${data["{{NAMA_PESERTA}}"]}</strong></td></tr>
      <tr><td>NPM / NIS</td><td>: ${data["{{NIM_NIS}}"]}</td></tr>
      <tr><td>Instansi Asal</td><td>: ${data["{{INSTANSI}}"]}</td></tr>
      <tr><td>Jurusan</td><td>: ${data["{{JURUSAN}}"]}</td></tr>
      <tr><td>Nilai Akhir</td><td>: <strong>${data["{{NILAI_AKHIR}}"]} (${data["{{GRADE}}"]}) - ${data["{{PREDIKAT}}"]}</strong></td></tr>
    </table>

    <p class="content-p">
      Selama melaksanakan Praktek Kerja Magang di bidang <em>${data["{{BIDANG_MAGANG}}"]}</em> pada PT. CIKARA BAKTI NUSANTARA, yang bersangkutan telah menunjukkan dedikasi, kedisiplinan, serta kompetensi teknis yang sangat baik.
    </p>

    <p class="content-p">
      Catatan Evaluasi: <em>"${data["{{KOMENTAR_MENTOR}}"]}"</em>
    </p>

    <p class="content-p">
      Rekomendasi: <strong>${data["{{REKOMENDASI}}"]}</strong>
    </p>

    <div class="signature-wrapper">
      <div class="sign-block">
        <p class="sign-date">${data["{{KOTA_PENERBITAN}}"]}, ${data["{{TANGGAL_CETAK}}"]}</p>
        <p class="sign-role">Pembimbing Lapangan<br><strong>PT. CIKARA BAKTI NUSANTARA</strong></p>
        <div class="stamp-sign-area">
          <svg width="120" height="120" viewBox="0 0 200 200" class="official-stamp">
            <g transform="rotate(-8 100 100)">
              <circle cx="100" cy="100" r="92" stroke="#1d4ed8" stroke-width="4" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="85" stroke="#1d4ed8" stroke-width="1.6" fill="none" opacity="0.88"/>
              <circle cx="100" cy="100" r="54" stroke="#1d4ed8" stroke-width="1.8" fill="none" opacity="0.88"/>
              <path d="M100 68 C82 68 68 82 68 100 C68 118 82 132 100 132 C110 132 119 127 125 120 L100 100 L125 80 C119 73 110 68 100 68 Z" fill="#1d4ed8" opacity="0.85"/>
              <circle cx="100" cy="100" r="9" fill="#ffffff"/>
              <circle cx="100" cy="100" r="5" fill="#1d4ed8" opacity="0.85"/>
              <path id="stampPathTop3" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14.5" font-weight="bold" letter-spacing="2.2" opacity="0.9">
                <textPath href="#stampPathTop3" startOffset="50%" text-anchor="middle">PT. CIKARA BAKTI NUSANTARA</textPath>
              </text>
              <path id="stampPathBottom3" d="M 170,105 A 72,72 0 0,1 30,105" fill="none" />
              <text fill="#1d4ed8" font-family="'Times New Roman', serif" font-size="14" font-weight="bold" letter-spacing="3" opacity="0.9">
                <textPath href="#stampPathBottom3" startOffset="50%" text-anchor="middle">TASIKMALAYA</textPath>
              </text>
            </g>
          </svg>
          <svg width="120" height="70" viewBox="0 0 160 90" class="signature-svg">
            <path d="M20 65 Q45 15 70 50 T120 40 Q135 30 145 60" stroke="#000000" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
            <path d="M50 45 Q70 65 95 35" stroke="#000000" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>
          </svg>
        </div>
        <p class="sign-name">${data["{{NAMA_MENTOR}}"]}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

// ============================================================
// DOCUMENT RETRIEVAL & HISTORY
// ============================================================

/**
 * Mendapatkan semua dokumen milik peserta.
 */
export const getDocumentsByUser = async (userId) => {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      template: {
        select: { id: true, name: true, version: true },
      },
      generatedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Mendapatkan detail dokumen berdasarkan ID.
 */
export const getDocumentById = async (id) => {
  let doc = await prisma.document.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          participantType: true,
          university: true,
          schoolName: true,
        },
      },
      template: {
        select: { id: true, name: true, version: true, documentType: true },
      },
      generatedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  // Fallback jika ID yang dipass adalah ID dari GenerationHistory
  if (!doc) {
    const history = await prisma.generationHistory.findUnique({
      where: { id },
    });
    if (history) {
      doc = await prisma.document.findFirst({
        where: {
          userId: history.userId,
          documentType: history.documentType,
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              participantType: true,
              university: true,
              schoolName: true,
            },
          },
          template: {
            select: { id: true, name: true, version: true, documentType: true },
          },
          generatedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    }
  }

  return doc;
};

/**
 * Mendapatkan riwayat pembuatan dokumen.
 */
export const getGenerationHistory = async ({
  page = 1,
  limit = 10,
  search = "",
  documentType = "",
} = {}) => {
  const skip = (page - 1) * limit;
  const where = {};

  if (documentType && ["CERTIFICATE", "LETTER"].includes(documentType)) {
    where.documentType = documentType;
  }

  if (search && search.trim()) {
    const keyword = search.trim();
    where.OR = [
      { user: { fullName: { contains: keyword, mode: "insensitive" } } },
      { user: { email: { contains: keyword, mode: "insensitive" } } },
      { template: { name: { contains: keyword, mode: "insensitive" } } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.generationHistory.count({ where }),
    prisma.generationHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            participantType: true,
          },
        },
        template: {
          select: { id: true, name: true, version: true },
        },
        generatedBy: {
          select: { id: true, fullName: true },
        },
      },
    }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Merender dokumen secara live untuk preview interaktif di formulir pembuatan dokumen.
 */
export const renderLiveDocument = async (participantId, templateId, subtype = "SELESAI", customOptions = {}) => {
  let participant = null;
  if (participantId && participantId !== "dummy") {
    participant = await prisma.user.findUnique({
      where: { id: participantId },
    });
  }

  // Fallback data peserta dummy jika belum ada peserta yang dipilih
  if (!participant) {
    participant = {
      id: "dummy",
      fullName: "Fenty Anggraeni",
      email: "fenty@cikarastudio.com",
      studentId: "237006068",
      university: "Universitas Siliwangi",
      studyProgram: "Informatika",
      participantType: "UNIVERSITY",
      internshipPeriod: "2 Juni 2026 s/d 31 Juli 2026",
      internshipStartDate: new Date("2026-06-02"),
      internshipEndDate: new Date("2026-07-31"),
    };
  }

  let evaluation = null;
  if (participant.id !== "dummy") {
    evaluation = await prisma.evaluation.findFirst({
      where: { userId: participant.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    });
  }

  let template = null;
  if (templateId) {
    template = await getTemplateById(templateId);
  }

  if (!template) {
    template = {
      name: "Sertifikat Kelulusan Magang Resmi PT. Cikara Bakti Nusantara",
      documentType: "CERTIFICATE",
      filePath: "storage/templates/sertifikat-cikara.html",
    };
  }

  const mentor = await prisma.user.findFirst({ where: { role: "MENTOR" } });
  const placeholderMap = preparePlaceholderData(participant, evaluation, mentor, customOptions);
  return resolveTemplateHtml(template, placeholderMap, subtype);
};

export default {
  escapeHtml,
  formatDateIndonesian,
  formatDateDot,
  formatDateEn,
  generateSafeDocumentFilename,
  getTemplates,
  getTemplateById,
  getTemplateRawContent,
  getActiveTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus,
  deactivateTemplate,
  previewTemplate,
  resolveTemplateHtml,
  renderLiveDocument,
  getParticipantsForDocument,
  getEligibleParticipants,
  preparePlaceholderData,
  replacePlaceholders,
  generateDocument,
  generateBulkDocuments,
  buildCertificateHtml,
  buildCompletionLetterHtml,
  buildAcceptanceLetterHtml,
  buildRecommendationLetterHtml,
  getDocumentsByUser,
  getDocumentById,
  getGenerationHistory,
};
