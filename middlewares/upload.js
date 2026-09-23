/**
 * Upload Middleware
 *
 * Menangani upload file menggunakan multer dengan validasi keamanan ketat:
 * - Whitelist extension dan MIME type (logical AND)
 * - Server-generated unique filename (mencegah path traversal / overwrite)
 * - Larangan file executable, script, SVG, HTML
 * - Limit ukuran file per kategori
 */

import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { mkdirSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// WHITELIST KONFIGURASI TIPE FILE
// ============================================================

// Foto profil: hanya JPG, JPEG, PNG (max 2 MB)
const PROFILE_ALLOWED_TYPES = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

// Lampiran pengumuman: PDF, DOCX, XLSX, JPG, JPEG, PNG (max 10 MB)
const ATTACHMENT_ALLOWED_TYPES = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

// Template dokumen: HTML, HTM, PDF, DOCX, DOC, JPG, JPEG, PNG (max 10 MB)
const TEMPLATE_ALLOWED_TYPES = {
  ".html": ["text/html"],
  ".htm": ["text/html"],
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".doc": ["application/msword", "application/vnd.ms-word"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

// Ekstensi terlarang yang berpotensi mengeksekusi script / binary berbahaya
const DANGEROUS_EXTENSIONS = new Set([
  ".xhtml", ".shtml", ".svg", ".xml",
  ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
  ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs",
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phps",
  ".py", ".pl", ".cgi", ".jar", ".war", ".jsp", ".asp", ".aspx"
]);

/**
 * Validasi ketat extension dan MIME type secara bersamaan (logical AND).
 */
const validateFile = (file, allowedMap, errorMessage, cb) => {
  if (!file || !file.originalname) {
    return cb(new Error("File tidak valid."), false);
  }

  const rawExt = path.extname(file.originalname).toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9.]/g, "");

  // Tolak langsung jika ekstensi berbahaya
  if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
    return cb(new Error("Format file berbahaya atau tidak didukung."), false);
  }

  // Cek apakah ekstensi ada dalam whitelist
  const allowedMimeTypes = allowedMap[ext];
  if (!allowedMimeTypes) {
    return cb(new Error(errorMessage), false);
  }

  // Cek apakah MIME type cocok dengan ekstensi yang diizinkan (Logical AND)
  const mimeType = (file.mimetype || "").toLowerCase().trim();
  if (!allowedMimeTypes.includes(mimeType)) {
    return cb(new Error(errorMessage), false);
  }

  cb(null, true);
};

// ============================================================
// STORAGE CONFIGURATION
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    if (file.fieldname === "templateFile") {
      uploadPath = path.join(__dirname, "..", "public", "uploads", "templates");
    } else {
      uploadPath = path.join(__dirname, "..", "public", "uploads");
    }

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate nama file server-side: timestamp + random hex + sanitized extension
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = rawExt.replace(/[^a-z0-9.]/g, "");
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    
    const prefixMap = {
      profilePhoto: "profile",
      attachment: "attachment",
      templateFile: "template",
    };
    const prefix = prefixMap[file.fieldname] || "file";
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

// ============================================================
// FILE FILTERS
// ============================================================

const profileFileFilter = (req, file, cb) => {
  validateFile(
    file,
    PROFILE_ALLOWED_TYPES,
    "Format file foto profil tidak didukung. Gunakan JPG, JPEG, atau PNG.",
    cb
  );
};

const templateFileFilter = (req, file, cb) => {
  validateFile(
    file,
    TEMPLATE_ALLOWED_TYPES,
    "Format file template tidak didukung. Gunakan PDF, DOCX, DOC, JPG, JPEG, atau PNG.",
    cb
  );
};

const attachmentFileFilter = (req, file, cb) => {
  validateFile(
    file,
    ATTACHMENT_ALLOWED_TYPES,
    "Format file lampiran tidak didukung. Gunakan PDF, DOCX, XLSX, JPG, JPEG, atau PNG.",
    cb
  );
};

const dynamicFileFilter = (req, file, cb) => {
  if (file.fieldname === "profilePhoto") {
    profileFileFilter(req, file, cb);
  } else if (file.fieldname === "attachment") {
    attachmentFileFilter(req, file, cb);
  } else {
    cb(new Error("Field upload file tidak dikenal."), false);
  }
};

// ============================================================
// MULTER INSTANCES
// ============================================================

// Upload foto profil (max 2 MB)
export const upload = multer({
  storage,
  fileFilter: dynamicFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
});

// Upload lampiran pengumuman (max 10 MB)
export const uploadAttachment = multer({
  storage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Upload template dokumen (max 10 MB)
export const uploadTemplate = multer({
  storage,
  fileFilter: templateFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

export const handleUploadError = (err, req, res, next) => {
  let errorMessage = null;

  if (err && (err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE")) {
    if (err.code === "LIMIT_FILE_SIZE") {
      if (err.field === "profilePhoto") {
        errorMessage = "Ukuran foto profil melebihi batas maksimal 2 MB. Silakan pilih berkas foto dengan ukuran lebih kecil (maksimal 2 MB, format JPG/JPEG/PNG).";
      } else if (err.field === "attachment") {
        errorMessage = "Ukuran berkas lampiran melebihi batas maksimal 10 MB. Silakan gunakan berkas dengan ukuran lebih kecil.";
      } else if (err.field === "templateFile") {
        errorMessage = "Ukuran berkas template dokumen melebihi batas maksimal 10 MB.";
      } else {
        errorMessage = "Ukuran berkas yang diunggah melebihi batas maksimal 2 MB. Silakan pilih berkas dengan ukuran lebih kecil.";
      }
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      errorMessage = "Field unggahan berkas tidak sesuai atau jumlah berkas melebihi ketentuan.";
    } else {
      errorMessage = `Terjadi kesalahan saat mengunggah berkas: ${err.message}`;
    }
  } else if (err) {
    errorMessage = err.message || "Berkas yang diunggah tidak valid atau format tidak didukung.";
  }

  if (errorMessage) {
    if (req.session) {
      req.session.messages = [{ type: "danger", text: errorMessage }];
    }
    const redirectUrl = req.get("Referrer") || (req.baseUrl + req.path) || "/";
    return res.redirect(redirectUrl);
  }

  next();
};

export default upload;
