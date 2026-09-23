/**
 * Participant Service
 *
 * Business logic untuk modul Manajemen Peserta.
 * Digunakan oleh Mentor Controller dan Intern Controller.
 */

import prisma from "../config/database.js";
import bcrypt from "bcrypt";
import { formatInternshipPeriod } from "../utils/helpers.js";

const SALT_ROUNDS = 10;

// ============================================================
// MENTOR: Daftar Peserta dengan Pagination, Search, Filter
// ============================================================

/**
 * Mendapatkan daftar peserta (INTERN) dengan pagination, search, dan filter.
 *
 * @param {Object} options
 * @param {number} options.page - Halaman saat ini (default: 1)
 * @param {number} options.limit - Jumlah data per halaman (default: 10)
 * @param {string} options.search - Kata kunci pencarian (nama, email, universitas, sekolah, NIM)
 * @param {string} options.type - Filter jenis peserta (UNIVERSITY / SMK / null = semua)
 * @param {string} options.status - Filter status akun (PENDING / ACTIVE / REJECTED / ARCHIVED / null = semua)
 * @returns {Object} { data, pagination }
 */
export const getParticipants = async ({
  page = 1,
  limit = 10,
  search = "",
  type = "",
  status = "",
} = {}) => {
  const skip = (page - 1) * limit;

  // Build where clause
  const where = { role: "INTERN" };

  // Filter jenis peserta
  if (type && ["UNIVERSITY", "SMK"].includes(type)) {
    where.participantType = type;
  }

  // Filter status
  if (status && ["PENDING", "ACTIVE", "REJECTED", "ARCHIVED"].includes(status)) {
    where.status = status;
  }

  // Pencarian
  if (search && search.trim()) {
    const keyword = search.trim();
    where.OR = [
      { fullName: { contains: keyword, mode: "insensitive" } },
      { email: { contains: keyword, mode: "insensitive" } },
      { university: { contains: keyword, mode: "insensitive" } },
      { schoolName: { contains: keyword, mode: "insensitive" } },
      { studentId: { contains: keyword, mode: "insensitive" } },
    ];
  }

  // Ambil total dan data dengan pagination secara paralel
  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
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
      hasPrev: page > 1,
      hasNext: page < Math.ceil(total / limit),
    },
  };
};

// ============================================================
// MENTOR: Detail Peserta
// ============================================================

/**
 * Mendapatkan detail peserta berdasarkan ID.
 * @param {string} id - ID peserta
 * @returns {Object|null} Data peserta atau null jika tidak ditemukan
 */
export const getParticipantById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      mentor: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  // Hanya return jika role INTERN
  if (!user || user.role !== "INTERN") return null;

  // Jika mentor belum terhubung tetapi ada mentor di sistem (karena mentor tunggal di CIMS), fallback otomatis
  if (!user.mentor) {
    const defaultMentor = await prisma.user.findFirst({
      where: { role: "MENTOR" },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });
    if (defaultMentor) {
      user.mentor = defaultMentor;
      user.mentorId = defaultMentor.id;
      // Sinkronkan ke database
      await prisma.user.update({
        where: { id },
        data: { mentorId: defaultMentor.id },
      }).catch((err) => console.warn("Auto-assign mentor warning:", err));
    }
  }

  return user;
};

// ============================================================
// MENTOR: Update Data Peserta
// ============================================================

/**
 * Update data peserta.
 * Email tidak boleh diubah.
 *
 * @param {string} id - ID peserta
 * @param {Object} data - Data yang akan diupdate
 * @returns {Object} User yang sudah diupdate
 */
export const updateParticipant = async (id, data) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.role !== "INTERN") {
    throw new Error("Peserta tidak ditemukan.");
  }

  const updateData = {};

  // Field yang bisa diubah
  if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber.trim();
  if (data.internshipStartDate !== undefined) {
    updateData.internshipStartDate = data.internshipStartDate ? new Date(data.internshipStartDate) : null;
  }
  if (data.internshipEndDate !== undefined) {
    updateData.internshipEndDate = data.internshipEndDate ? new Date(data.internshipEndDate) : null;
  }

  // Otomatis turunkan periode magang dari tanggal mulai dan selesai
  const finalStartDate = updateData.internshipStartDate !== undefined ? updateData.internshipStartDate : user.internshipStartDate;
  const finalEndDate = updateData.internshipEndDate !== undefined ? updateData.internshipEndDate : user.internshipEndDate;

  if (finalStartDate && finalEndDate) {
    updateData.internshipPeriod = formatInternshipPeriod(finalStartDate, finalEndDate);
  } else if (data.internshipPeriod !== undefined) {
    updateData.internshipPeriod = data.internshipPeriod.trim();
  }

  // Field berdasarkan jenis peserta
  if (user.participantType === "UNIVERSITY") {
    if (data.university !== undefined) updateData.university = data.university.trim();
    if (data.studyProgram !== undefined) updateData.studyProgram = data.studyProgram.trim();
    if (data.studentId !== undefined) updateData.studentId = data.studentId.trim();
  } else if (user.participantType === "SMK") {
    if (data.schoolName !== undefined) updateData.schoolName = data.schoolName.trim();
    if (data.major !== undefined) updateData.major = data.major.trim();
    if (data.classGrade !== undefined) updateData.classGrade = data.classGrade.trim();
  }

  // Mentor (relasi)
  if (data.mentorId !== undefined) {
    // Validasi mentor exists dan role-nya MENTOR
    if (data.mentorId) {
      const mentor = await prisma.user.findUnique({ where: { id: data.mentorId } });
      if (!mentor || mentor.role !== "MENTOR") {
        throw new Error("Mentor tidak valid.");
      }
    }
    updateData.mentorId = data.mentorId || null;
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

// ============================================================
// MENTOR: Update Status Peserta
// ============================================================

/**
 * Update status peserta (ACTIVE / ARCHIVED).
 * @param {string} id - ID peserta
 * @param {string} status - Status baru (ACTIVE / ARCHIVED)
 * @returns {Object} User yang sudah diupdate
 */
export const updateParticipantStatus = async (id, status) => {
  const validStatuses = ["ACTIVE", "ARCHIVED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Status tidak valid.");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "INTERN") {
    throw new Error("Peserta tidak ditemukan.");
  }

  return prisma.user.update({
    where: { id },
    data: { status },
    include: {
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

// ============================================================
// MENTOR: Daftar Arsip (Peserta ARCHIVED)
// ============================================================

/**
 * Mendapatkan daftar peserta yang diarsipkan.
 * @param {Object} options - { page, limit, search }
 * @returns {Object} { data, pagination }
 */
export const getArchivedParticipants = async ({
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const skip = (page - 1) * limit;
  const where = { role: "INTERN", status: "ARCHIVED" };

  if (search && search.trim()) {
    const keyword = search.trim();
    where.OR = [
      { fullName: { contains: keyword, mode: "insensitive" } },
      { email: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: {
          select: { id: true, fullName: true, email: true },
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
      hasPrev: page > 1,
      hasNext: page < Math.ceil(total / limit),
    },
  };
};

// ============================================================
// MENTOR: Restore dari Arsip
// ============================================================

/**
 * Mengembalikan peserta dari ARCHIVED menjadi ACTIVE.
 * @param {string} id - ID peserta
 * @returns {Object} User yang sudah direstore
 */
export const restoreParticipant = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.role !== "INTERN") {
    throw new Error("Peserta tidak ditemukan.");
  }

  if (user.status !== "ARCHIVED") {
    throw new Error("Peserta tidak dalam status arsip.");
  }

  return prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" },
    include: {
      mentor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

// ============================================================
// INTERN: Update Profil Sendiri
// ============================================================

/**
 * Update profil peserta (untuk INTERN).
 * Hanya bisa mengubah: foto profil, nomor HP, password.
 *
 * @param {string} id - ID peserta
 * @param {Object} data - Data yang akan diupdate
 * @param {string|null} photoFilename - Nama file foto baru (atau null jika tidak ada)
 * @returns {Object} User yang sudah diupdate
 */
export const updateOwnProfile = async (id, data, photoFilename = null) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User tidak ditemukan.");

  const updateData = {};

  // Nama Lengkap (koreksi typo mandiri)
  if (data.fullName !== undefined && data.fullName.trim().length >= 3) {
    updateData.fullName = data.fullName.trim();
  }

  // Data Akademik & Institusi (koreksi typo mandiri)
  if (user.participantType === "UNIVERSITY") {
    if (data.university !== undefined && data.university.trim()) {
      updateData.university = data.university.trim();
    }
    if (data.studyProgram !== undefined && data.studyProgram.trim()) {
      updateData.studyProgram = data.studyProgram.trim();
    }
    if (data.studentId !== undefined && data.studentId.trim()) {
      updateData.studentId = data.studentId.trim();
    }
  } else if (user.participantType === "SMK") {
    if (data.schoolName !== undefined && data.schoolName.trim()) {
      updateData.schoolName = data.schoolName.trim();
    }
    if (data.major !== undefined && data.major.trim()) {
      updateData.major = data.major.trim();
    }
    if (data.classGrade !== undefined && data.classGrade.trim()) {
      updateData.classGrade = data.classGrade.trim();
    }
  }

  // Foto profil
  if (photoFilename) {
    updateData.profilePhoto = photoFilename;
  }

  // Nomor HP
  if (data.phoneNumber !== undefined && data.phoneNumber.trim()) {
    updateData.phoneNumber = data.phoneNumber.trim();
  }

  // Password
  if (data.password && data.password.length >= 8) {
    updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      profilePhoto: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      participantType: true,
      status: true,
      university: true,
      studyProgram: true,
      studentId: true,
      schoolName: true,
      major: true,
      classGrade: true,
      internshipPeriod: true,
      mentorId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Mendapatkan daftar mentor (untuk dropdown di form edit).
 * @returns {Array} Daftar mentor
 */
export const getMentorList = async () => {
  return prisma.user.findMany({
    where: { role: "MENTOR" },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
};

export default {
  getParticipants,
  getParticipantById,
  updateParticipant,
  updateParticipantStatus,
  getArchivedParticipants,
  restoreParticipant,
  updateOwnProfile,
  getMentorList,
};
