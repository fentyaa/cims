/**
 * Evaluation Service
 *
 * Business logic untuk modul Penilaian Peserta (Evaluation).
 * Mentor: CRUD, publish, archive
 * Intern: read only (PUBLISHED evaluation miliknya)
 */

import prisma from "../config/database.js";

// ============================================================
// CONSTANTS
// ============================================================

const EVALUATION_CATEGORIES = [
  "discipline",
  "responsibility",
  "communication",
  "teamwork",
  "initiative",
  "technicalSkill",
];

/**
 * Melakukan parsing nilai angka dengan dukungan pemisah desimal koma (format lokal ID) maupun titik.
 * Contoh: "85,5" -> 85.5, "90.25" -> 90.25, 85 -> 85
 * @param {string|number} val
 * @returns {number}
 */
export const parseScore = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const normalized = String(val).trim().replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
};

/**
 * Memvalidasi batas rentang skor penilaian (0 - 100).
 * Melempar error jika nilai di luar rentang atau tidak valid.
 * @param {string|number} val
 * @param {string} fieldName
 * @returns {number}
 */
export const validateScoreBounds = (val, fieldName) => {
  if (val === null || val === undefined || String(val).trim() === "") {
    throw new Error(`Nilai ${fieldName} wajib diisi dan harus berada dalam rentang 0 sampai 100.`);
  }
  const normalized = typeof val === "number" ? val : parseFloat(String(val).trim().replace(",", "."));
  if (isNaN(normalized) || normalized < 0 || normalized > 100) {
    throw new Error(`Nilai ${fieldName} harus berada dalam rentang 0 sampai 100.`);
  }
  return Math.round(normalized * 100) / 100;
};

/**
 * Menghitung nilai akhir (rata-rata dari semua kategori).
 * @param {Object} scores - { discipline, responsibility, communication, teamwork, initiative, technicalSkill }
 * @returns {number} Nilai akhir (0-100)
 */
export const calculateFinalScore = (scores) => {
  const total = EVALUATION_CATEGORIES.reduce((sum, cat) => sum + (parseScore(scores[cat]) || 0), 0);
  return Math.round((total / EVALUATION_CATEGORIES.length) * 10) / 10;
};

/**
 * Mengkonversi nilai akhir ke grade huruf.
 * @param {number} score - Nilai akhir (0-100)
 * @returns {string} Grade (A, B, C, D, atau E)
 */
export const convertToGrade = (score) => {
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "E";
};

// ============================================================
// MENTOR: Daftar Penilaian dengan Filter
// ============================================================

/**
 * Mendapatkan daftar penilaian (untuk mentor) dengan pagination, search, dan filter.
 * @param {Object} options
 * @returns {Object} { data, pagination }
 */
export const getEvaluations = async ({
  page = 1,
  limit = 10,
  search = "",
  type = "",
  status = "",
} = {}) => {
  const skip = (page - 1) * limit;

  // Build where clause - ambil semua intern beserta evaluasinya
  const where = { role: "INTERN" };

  // Filter status evaluasi
  if (status === "UNEVALUATED") {
    // Intern yang belum punya evaluasi
    where.evaluations = null;
  } else if (status === "DRAFT") {
    where.evaluations = { is: { status: "DRAFT" } };
  } else if (status === "PUBLISHED") {
    where.evaluations = { is: { status: "PUBLISHED" } };
  } else if (status === "ARCHIVED") {
    where.evaluations = { is: { status: "ARCHIVED" } };
  }

  // Filter jenis peserta
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

  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip,
      take: limit,
      include: {
        evaluations: {
          include: {
            mentor: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    }),
  ]);

  // Transform data: flatten evaluation
  const transformed = data.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    profilePhoto: user.profilePhoto,
    participantType: user.participantType,
    university: user.university,
    studyProgram: user.studyProgram,
    schoolName: user.schoolName,
    major: user.major,
    internshipPeriod: user.internshipPeriod,
    evaluation: Array.isArray(user.evaluations)
      ? (user.evaluations[0] || null)
      : (user.evaluations || null),
  }));

  return {
    data: transformed,
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

// ============================================================
// MENTOR: Detail Evaluasi
// ============================================================

/**
 * Mendapatkan detail evaluasi berdasarkan ID evaluasi.
 * @param {string} id - ID evaluasi
 * @returns {Object|null}
 */
export const getEvaluationById = async (id) => {
  return prisma.evaluation.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePhoto: true,
          participantType: true,
          university: true,
          studyProgram: true,
          studentId: true,
          schoolName: true,
          major: true,
          classGrade: true,
          internshipPeriod: true,
        },
      },
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Mendapatkan evaluasi berdasarkan userId (untuk cek duplikasi).
 * @param {string} userId
 * @returns {Object|null}
 */
export const getEvaluationByUserId = async (userId) => {
  return prisma.evaluation.findUnique({
    where: { userId },
    include: {
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

// ============================================================
// MENTOR: CRUD Evaluasi
// ============================================================

/**
 * Membuat evaluasi baru untuk peserta.
 * @param {Object} data - Data evaluasi
 * @param {string} mentorId - ID mentor yang membuat
 * @returns {Object} Evaluasi yang dibuat
 */
export const createEvaluation = async (data, mentorId) => {
  // Cek apakah sudah ada evaluasi untuk user ini
  const existing = await prisma.evaluation.findUnique({
    where: { userId: data.userId },
  });

  if (existing) {
    throw new Error("Peserta ini sudah memiliki penilaian. Silakan edit penilaian yang sudah ada.");
  }

  // Validasi user adalah INTERN
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user || user.role !== "INTERN") {
    throw new Error("Peserta tidak ditemukan.");
  }

  // Validasi batas nilai 0 - 100 untuk setiap aspek kompetensi
  const discipline = validateScoreBounds(data.discipline, "kedisiplinan");
  const responsibility = validateScoreBounds(data.responsibility, "tanggung jawab");
  const communication = validateScoreBounds(data.communication, "komunikasi");
  const teamwork = validateScoreBounds(data.teamwork, "kerjasama tim");
  const initiative = validateScoreBounds(data.initiative, "inisiatif");
  const technicalSkill = validateScoreBounds(data.technicalSkill, "keterampilan teknis");

  // Hitung nilai akhir
  const finalScore = calculateFinalScore({
    discipline,
    responsibility,
    communication,
    teamwork,
    initiative,
    technicalSkill,
  });
  const grade = convertToGrade(finalScore);

  return prisma.evaluation.create({
    data: {
      userId: data.userId,
      discipline,
      responsibility,
      communication,
      teamwork,
      initiative,
      technicalSkill,
      finalScore,
      grade,
      mentorComment: data.mentorComment?.trim() || null,
      recommendation: data.recommendation?.trim() || null,
      status: "DRAFT",
      mentorId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePhoto: true,
          participantType: true,
        },
      },
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Mengupdate evaluasi yang sudah ada (hanya jika status DRAFT).
 * @param {string} id - ID evaluasi
 * @param {Object} data - Data evaluasi yang diupdate
 * @returns {Object} Evaluasi yang diupdate
 */
export const updateEvaluation = async (id, data) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });

  if (!evaluation) {
    throw new Error("Penilaian tidak ditemukan.");
  }

  if (evaluation.status === "PUBLISHED") {
    throw new Error("Penilaian yang sudah dipublikasikan tidak dapat diedit.");
  }

  if (evaluation.status === "ARCHIVED") {
    throw new Error("Penilaian yang sudah diarsipkan tidak dapat diedit.");
  }

  // Validasi batas nilai 0 - 100 untuk setiap aspek kompetensi
  const discipline = validateScoreBounds(data.discipline, "kedisiplinan");
  const responsibility = validateScoreBounds(data.responsibility, "tanggung jawab");
  const communication = validateScoreBounds(data.communication, "komunikasi");
  const teamwork = validateScoreBounds(data.teamwork, "kerjasama tim");
  const initiative = validateScoreBounds(data.initiative, "inisiatif");
  const technicalSkill = validateScoreBounds(data.technicalSkill, "keterampilan teknis");

  // Hitung ulang nilai akhir
  const finalScore = calculateFinalScore({
    discipline,
    responsibility,
    communication,
    teamwork,
    initiative,
    technicalSkill,
  });
  const grade = convertToGrade(finalScore);

  return prisma.evaluation.update({
    where: { id },
    data: {
      discipline,
      responsibility,
      communication,
      teamwork,
      initiative,
      technicalSkill,
      finalScore,
      grade,
      mentorComment: data.mentorComment?.trim() || null,
      recommendation: data.recommendation?.trim() || null,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePhoto: true,
          participantType: true,
          university: true,
          studyProgram: true,
          studentId: true,
          schoolName: true,
          major: true,
        },
      },
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Mempublikasikan evaluasi (draft -> published).
 * @param {string} id - ID evaluasi
 * @returns {Object} Evaluasi yang diupdate
 */
export const publishEvaluation = async (id) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });

  if (!evaluation) {
    throw new Error("Penilaian tidak ditemukan.");
  }

  if (evaluation.status === "PUBLISHED") {
    throw new Error("Penilaian sudah dipublikasikan.");
  }

  if (evaluation.status === "ARCHIVED") {
    throw new Error("Penilaian yang sudah diarsipkan tidak dapat dipublikasikan.");
  }

  return prisma.evaluation.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Mengarsipkan evaluasi.
 * @param {string} id - ID evaluasi
 * @returns {Object} Evaluasi yang diupdate
 */
export const archiveEvaluation = async (id) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });

  if (!evaluation) {
    throw new Error("Penilaian tidak ditemukan.");
  }

  return prisma.evaluation.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
};

// ============================================================
// INTERN: Melihat Nilai Sendiri (Hanya Ketika Magang Selesai / Hari Terakhir)
// ============================================================

/**
 * Mendapatkan evaluasi milik peserta (hanya PUBLISHED dan jika masa magang telah selesai / hari terakhir).
 * @param {string} userId - ID peserta
 * @returns {Object} { evaluation, isLockedUntilEnd, isPublished, isInternshipEnded, endDate, period }
 */
export const getInternEvaluation = async (userId) => {
  const [evaluation, user] = await Promise.all([
    prisma.evaluation.findUnique({
      where: { userId },
      include: {
        mentor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        internshipStartDate: true,
        internshipEndDate: true,
        internshipPeriod: true,
      },
    }),
  ]);

  // Jika belum ada penilaian atau belum PUBLISHED
  if (!evaluation || evaluation.status !== "PUBLISHED") {
    return {
      evaluation: null,
      isLockedUntilEnd: false,
      isPublished: Boolean(evaluation && evaluation.status === "PUBLISHED"),
      isInternshipEnded: true,
      endDate: user?.internshipEndDate || null,
      period: user?.internshipPeriod || "-",
    };
  }

  // Cek apakah hari ini sudah mencapai atau melewati tanggal selesai magang
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isInternshipEnded = true;
  if (user?.internshipEndDate) {
    const endDate = new Date(user.internshipEndDate);
    endDate.setHours(0, 0, 0, 0);
    isInternshipEnded = today >= endDate;
  }

  if (!isInternshipEnded) {
    // Penilaian sudah dibuat & dipublish mentor, tapi peserta belum selesai magang -> kunci tampilan nilai
    return {
      evaluation: null,
      isLockedUntilEnd: true,
      isPublished: true,
      isInternshipEnded: false,
      endDate: user.internshipEndDate,
      period: user.internshipPeriod,
    };
  }

  // Magang sudah selesai / hari terakhir: izinkan melihat nilai lengkap
  return {
    evaluation,
    isLockedUntilEnd: false,
    isPublished: true,
    isInternshipEnded: true,
    endDate: user?.internshipEndDate || null,
    period: user?.internshipPeriod || "-",
  };
};

// ============================================================
// STATISTIK UNTUK DASHBOARD
// ============================================================

/**
 * Mendapatkan statistik penilaian untuk dashboard mentor.
 * @returns {Object} { total, draft, published, archived, unevaluated }
 */
export const getMentorEvaluationStats = async () => {
  const [totalInterns, evaluated, draft, published, archived] = await Promise.all([
    prisma.user.count({ where: { role: "INTERN" } }),
    prisma.evaluation.count(),
    prisma.evaluation.count({ where: { status: "DRAFT" } }),
    prisma.evaluation.count({ where: { status: "PUBLISHED" } }),
    prisma.evaluation.count({ where: { status: "ARCHIVED" } }),
  ]);

  return {
    total: evaluated,
    draft,
    published,
    archived,
    unevaluated: Math.max(0, totalInterns - evaluated),
    totalInterns,
  };
};

/**
 * Mendapatkan status evaluasi untuk dashboard intern.
 * @param {string} userId - ID peserta
 * @returns {Object} { hasEvaluation, status, grade, finalScore, isLockedUntilEnd, isInternshipEnded, endDate, period }
 */
export const getInternEvaluationStatus = async (userId) => {
  const [evaluation, user] = await Promise.all([
    prisma.evaluation.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        finalScore: true,
        grade: true,
        publishedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        internshipStartDate: true,
        internshipEndDate: true,
        internshipPeriod: true,
      },
    }),
  ]);

  if (!evaluation) {
    return {
      hasEvaluation: false,
      status: null,
      grade: null,
      finalScore: null,
      isLockedUntilEnd: false,
      isInternshipEnded: true,
      endDate: user?.internshipEndDate || null,
      period: user?.internshipPeriod || "-",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isInternshipEnded = true;
  if (user?.internshipEndDate) {
    const endDate = new Date(user.internshipEndDate);
    endDate.setHours(0, 0, 0, 0);
    isInternshipEnded = today >= endDate;
  }

  const isLockedUntilEnd = !isInternshipEnded;

  return {
    hasEvaluation: true,
    status: evaluation.status,
    grade: isLockedUntilEnd ? null : evaluation.grade,
    finalScore: isLockedUntilEnd ? null : evaluation.finalScore,
    publishedAt: evaluation.publishedAt,
    isLockedUntilEnd,
    isInternshipEnded,
    endDate: user?.internshipEndDate || null,
    period: user?.internshipPeriod || "-",
  };
};

export default {
  calculateFinalScore,
  convertToGrade,
  getEvaluations,
  getEvaluationById,
  getEvaluationByUserId,
  createEvaluation,
  updateEvaluation,
  publishEvaluation,
  archiveEvaluation,
  getInternEvaluation,
  getMentorEvaluationStats,
  getInternEvaluationStatus,
};

