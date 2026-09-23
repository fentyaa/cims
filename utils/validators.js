/**
 * Validators
 * 
 * Validasi input untuk form registrasi dan login.
 * Digunakan di frontend (client-side) dan backend (server-side).
 */

/**
 * Validasi email format standar.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validasi kompleksitas password untuk password baru:
 * - Minimal 8 karakter
 * - Minimal 1 huruf besar (uppercase [A-Z])
 * - Minimal 1 huruf kecil (lowercase [a-z])
 * - Minimal 1 angka ([0-9])
 * @param {string} password
 * @returns {boolean}
 */
export const isValidPassword = (password) => {
  if (!password || typeof password !== "string") return false;
  if (password.length < 8) return false;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUpperCase && hasLowerCase && hasNumber;
};

/**
 * Validasi nomor HP Indonesia (mulai dengan 0 atau +62, minimal 10 digit).
 * @param {string} phone
 * @returns {boolean}
 */
export const isValidPhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") return false;
  const phoneRegex = /^(0|62|\+62)[0-9]{8,13}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

/**
 * Validasi nama lengkap (minimal 3 karakter, mendukung huruf, spasi, apostrof, tanda hubung, titik gelar).
 * @param {string} name
 * @returns {boolean}
 */
export const isValidFullName = (name) => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 100) return false;

  // Hanya boleh berisi huruf, spasi, apostrof (', ’), tanda hubung (-), dan titik (.)
  if (!/^[a-zA-Z\s'’.\-]+$/.test(trimmed)) return false;

  // Wajib memiliki minimal 3 huruf alfabet
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 3) return false;

  // Mencegah pola berbahaya
  if (/(--|;|\/\*|\*\/|<|>)/.test(trimmed)) return false;

  return true;
};

/**
 * Validasi registrasi untuk peserta magang.
 * @param {Object} data - Data form registrasi
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateRegister = (data) => {
  const errors = [];

  // Nama Lengkap
  if (!data.fullName || !isValidFullName(data.fullName)) {
    errors.push("Nama lengkap minimal 3 karakter dan hanya boleh berisi huruf.");
  }

  // Email
  if (!data.email || !isValidEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }

  // Nomor HP
  if (!data.phoneNumber || !isValidPhoneNumber(data.phoneNumber)) {
    errors.push("Nomor HP tidak valid. Gunakan format 08xx atau +62xx.");
  }

  // Jenis Peserta
  if (!data.participantType || !["UNIVERSITY", "SMK"].includes(data.participantType)) {
    errors.push("Jenis peserta harus Mahasiswa atau PKL SMK.");
  }

  // Validasi field berdasarkan jenis peserta
  if (data.participantType === "UNIVERSITY") {
    if (!data.university || data.university.trim().length < 3) {
      errors.push("Nama universitas harus diisi minimal 3 karakter.");
    }
    if (!data.studyProgram || data.studyProgram.trim().length < 3) {
      errors.push("Program studi harus diisi minimal 3 karakter.");
    }
    if (!data.studentId || data.studentId.trim().length < 5) {
      errors.push("NIM harus diisi minimal 5 karakter.");
    }
  } else if (data.participantType === "SMK") {
    if (!data.schoolName || data.schoolName.trim().length < 3) {
      errors.push("Nama sekolah harus diisi minimal 3 karakter.");
    }
    if (!data.major || data.major.trim().length < 3) {
      errors.push("Jurusan harus diisi minimal 3 karakter.");
    }
    if (!data.classGrade || data.classGrade.trim().length < 1) {
      errors.push("Kelas harus diisi.");
    }
  }

  // Periode Magang (wajib jika tanggal magang terstruktur tidak diberikan lengkap)
  const hasStructuredDates = Boolean(data.internshipStartDate && data.internshipEndDate);
  if (!hasStructuredDates && (!data.internshipPeriod || data.internshipPeriod.trim().length < 5)) {
    errors.push("Periode magang harus diisi.");
  }

  // Validasi Structured Dates jika diberikan
  if (data.internshipStartDate || data.internshipEndDate) {
    const dateValidation = validateInternshipDates(data.internshipStartDate, data.internshipEndDate);
    if (!dateValidation.valid) {
      errors.push(...dateValidation.errors);
    }
  }

  // Password
  if (!data.password || !isValidPassword(data.password)) {
    errors.push("Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.");
  }

  // Konfirmasi Password
  if (data.password !== data.confirmPassword) {
    errors.push("Konfirmasi password tidak cocok.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi login.
 * @param {Object} data - Data form login
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateLogin = (data) => {
  const errors = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }

  if (!data.password || data.password.length < 1) {
    errors.push("Password harus diisi.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi request forgot password.
 * @param {Object} data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateForgotPassword = (data) => {
  const errors = [];

  if (!data.email || !isValidEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi reset password.
 * @param {Object} data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateResetPassword = (data) => {
  const errors = [];

  if (!data.password || !isValidPassword(data.password)) {
    errors.push("Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.");
  }

  if (data.password !== data.confirmPassword) {
    errors.push("Konfirmasi password tidak cocok.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi update data peserta (oleh Mentor).
 * @param {Object} data - Data form edit peserta
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateParticipantUpdate = (data) => {
  const errors = [];

  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.push("Nama lengkap minimal 3 karakter.");
  }

  if (!data.phoneNumber || !isValidPhoneNumber(data.phoneNumber)) {
    errors.push("Nomor HP tidak valid. Gunakan format 08xx atau +62xx.");
  }

  if (!data.internshipPeriod || data.internshipPeriod.trim().length < 5) {
    errors.push("Periode magang harus diisi.");
  }

  // Validasi Structured Dates jika diberikan
  if (data.internshipStartDate || data.internshipEndDate) {
    const dateValidation = validateInternshipDates(data.internshipStartDate, data.internshipEndDate);
    if (!dateValidation.valid) {
      errors.push(...dateValidation.errors);
    }
  }

  if (data.participantType === "UNIVERSITY") {
    if (!data.university || data.university.trim().length < 3) {
      errors.push("Nama universitas harus diisi minimal 3 karakter.");
    }
    if (!data.studyProgram || data.studyProgram.trim().length < 3) {
      errors.push("Program studi harus diisi minimal 3 karakter.");
    }
    if (!data.studentId || data.studentId.trim().length < 5) {
      errors.push("NIM harus diisi minimal 5 karakter.");
    }
  } else if (data.participantType === "SMK") {
    if (!data.schoolName || data.schoolName.trim().length < 3) {
      errors.push("Nama sekolah harus diisi minimal 3 karakter.");
    }
    if (!data.major || data.major.trim().length < 3) {
      errors.push("Jurusan harus diisi minimal 3 karakter.");
    }
    if (!data.classGrade || data.classGrade.trim().length < 1) {
      errors.push("Kelas harus diisi.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi rentang tanggal magang terstruktur.
 * @param {string|Date|null} startDate
 * @param {string|Date|null} endDate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateInternshipDates = (startDate, endDate) => {
  const errors = [];

  // Jika keduanya kosong/null, dianggap valid (opsional / backward compatible)
  if (!startDate && !endDate) {
    return { valid: true, errors: [] };
  }

  // Jika salah satu diisi, keduanya harus diisi
  if ((startDate && !endDate) || (!startDate && endDate)) {
    errors.push("Tanggal mulai dan tanggal selesai magang harus keduanya diisi.");
    return { valid: false, errors };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    errors.push("Tanggal mulai magang tidak valid.");
  }
  if (isNaN(end.getTime())) {
    errors.push("Tanggal selesai magang tidak valid.");
  }

  if (errors.length === 0 && start > end) {
    errors.push("Tanggal mulai magang tidak boleh lebih besar dari tanggal selesai magang.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi logbook harian.
 * @param {Object} data - { activity, obstacle, nextPlan }
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateLogbook = (data) => {
  const errors = [];

  if (!data.activity || data.activity.trim().length < 5) {
    errors.push("Aktivitas hari ini harus diisi minimal 5 karakter.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi pengumuman.
 * @param {Object} data - Data form pengumuman
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateAnnouncement = (data) => {
  const errors = [];

  // Judul wajib
  if (!data.title || data.title.trim().length < 3) {
    errors.push("Judul pengumuman minimal 3 karakter.");
  }

  // Isi wajib
  if (!data.content || data.content.trim().length < 10) {
    errors.push("Isi pengumuman minimal 10 karakter.");
  }

  // Kategori wajib
  const validCategories = ["INFORMASI", "JADWAL", "TUGAS", "LIBUR", "PENTING", "LAINNYA"];
  if (!data.category || !validCategories.includes(data.category)) {
    errors.push("Kategori pengumuman harus dipilih.");
  }

  // Target wajib
  const validTargets = ["ALL", "UNIVERSITY", "SMK"];
  if (!data.targetType || !validTargets.includes(data.targetType)) {
    errors.push("Target peserta harus dipilih.");
  }

  // Tanggal publikasi wajib
  if (!data.publishDate) {
    errors.push("Tanggal publikasi harus diisi.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Normalisasi dan parsing nilai angka evaluasi (mendukung format desimal koma lokal maupun titik).
 * @param {string|number} val
 * @returns {number}
 */
export const parseEvaluationScore = (val) => {
  if (val === null || val === undefined || String(val).trim() === "") return NaN;
  if (typeof val === "number") return isNaN(val) ? NaN : val;
  const normalized = String(val).trim().replace(",", ".");
  return parseFloat(normalized);
};

/**
 * Validasi penilaian peserta.
 * @param {Object} data - { discipline, responsibility, communication, teamwork, initiative, technicalSkill, mentorComment }
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateEvaluation = (data) => {
  const errors = [];

  // Fungsi validasi nilai 0-100 (mendukung angka bulat dan desimal dengan titik atau koma)
  const isValidScore = (val) => {
    if (val === null || val === undefined || String(val).trim() === "") return false;
    const num = parseEvaluationScore(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  };

  if (data.discipline === undefined || !isValidScore(data.discipline)) {
    errors.push("Nilai kedisiplinan harus antara 0-100.");
  }

  if (data.responsibility === undefined || !isValidScore(data.responsibility)) {
    errors.push("Nilai tanggung jawab harus antara 0-100.");
  }

  if (data.communication === undefined || !isValidScore(data.communication)) {
    errors.push("Nilai komunikasi harus antara 0-100.");
  }

  if (data.teamwork === undefined || !isValidScore(data.teamwork)) {
    errors.push("Nilai kerjasama tim harus antara 0-100.");
  }

  if (data.initiative === undefined || !isValidScore(data.initiative)) {
    errors.push("Nilai inisiatif harus antara 0-100.");
  }

  if (data.technicalSkill === undefined || !isValidScore(data.technicalSkill)) {
    errors.push("Nilai keterampilan teknis harus antara 0-100.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validasi upload template dokumen.
 * @param {Object} data - { name, documentType }
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateDocumentTemplate = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 3) {
    errors.push("Nama template minimal 3 karakter.");
  }

  const validTypes = ["CERTIFICATE", "LETTER"];
  if (!data.documentType || !validTypes.includes(data.documentType)) {
    errors.push("Jenis dokumen harus Sertifikat atau Surat Selesai Magang.");
  }

  if (!data.version || data.version.trim().length < 1) {
    errors.push("Versi template harus diisi.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  isValidEmail,
  isValidPassword,
  isValidPhoneNumber,
  isValidFullName,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateParticipantUpdate,
  validateLogbook,
  validateAnnouncement,
  parseEvaluationScore,
  validateEvaluation,
  validateDocumentTemplate,
};

