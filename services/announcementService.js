/**
 * Announcement Service
 *
 * Business logic untuk modul Pengumuman (Announcement).
 * Mentor: CRUD + arsip
 * Intern: read only (Published, sesuai target)
 */

import prisma from "../config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// MENTOR SERVICES
// ============================================================

/**
 * Mendapatkan daftar semua pengumuman (untuk mentor).
 * @param {Object} options - { page, limit, search, category, status }
 * @returns {Object} { data, pagination }
 */
export const getAllAnnouncements = async ({ page = 1, limit = 10, search = "", category = "", status = "" }) => {
  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    }),
    prisma.announcement.count({ where }),
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
 * Mendapatkan detail pengumuman berdasarkan ID.
 * @param {string} id
 * @returns {Object|null}
 */
export const getAnnouncementById = async (id) => {
  return prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

/**
 * Membuat pengumuman baru.
 * @param {Object} data - Data pengumuman
 * @param {string} createdById - ID mentor yang membuat
 * @returns {Object}
 */
export const createAnnouncement = async (data, createdById) => {
  const announcementData = {
    title: data.title.trim(),
    content: data.content.trim(),
    category: data.category,
    targetType: data.targetType || "ALL",
    publishDate: new Date(data.publishDate),
    status: data.status || "DRAFT",
    createdById,
  };

  // Lampiran opsional
  if (data.attachment) {
    announcementData.attachment = data.attachment;
  }

  // Tanggal berakhir opsional
  if (data.expireDate) {
    announcementData.expireDate = new Date(data.expireDate);
  }

  return prisma.announcement.create({ data: announcementData });
};

/**
 * Mengupdate pengumuman.
 * @param {string} id
 * @param {Object} data
 * @returns {Object}
 */
export const updateAnnouncement = async (id, data) => {
  const updateData = {
    title: data.title.trim(),
    content: data.content.trim(),
    category: data.category,
    targetType: data.targetType || "ALL",
    publishDate: new Date(data.publishDate),
    status: data.status || "DRAFT",
  };

  // Lampiran baru (jika ada)
  if (data.attachment) {
    // Hapus lampiran lama jika ada
    const old = await prisma.announcement.findUnique({ where: { id } });
    if (old && old.attachment && data.attachment !== old.attachment) {
      deleteAttachmentFile(old.attachment);
    }
    updateData.attachment = data.attachment;
  }

  // Tanggal berakhir opsional
  if (data.expireDate) {
    updateData.expireDate = new Date(data.expireDate);
  } else {
    updateData.expireDate = null;
  }

  return prisma.announcement.update({
    where: { id },
    data: updateData,
  });
};

/**
 * Menghapus pengumuman beserta lampirannya.
 * @param {string} id
 */
export const deleteAnnouncement = async (id) => {
  const announcement = await prisma.announcement.findUnique({ where: { id } });

  if (!announcement) {
    throw new Error("Pengumuman tidak ditemukan.");
  }

  // Hapus file lampiran jika ada
  if (announcement.attachment) {
    deleteAttachmentFile(announcement.attachment);
  }

  return prisma.announcement.delete({ where: { id } });
};

/**
 * Mengubah status pengumuman (DRAFT / PUBLISHED / ARCHIVED).
 * @param {string} id
 * @param {string} status
 * @returns {Object}
 */
export const updateAnnouncementStatus = async (id, status) => {
  const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Status tidak valid.");
  }

  return prisma.announcement.update({
    where: { id },
    data: { status },
  });
};

// ============================================================
// INTERN SERVICES
// ============================================================

/**
 * Mendapatkan daftar pengumuman Published untuk peserta.
 * Hanya menampilkan yang sesuai target peserta.
 * @param {string} participantType - "UNIVERSITY" | "SMK" | null
 * @param {Object} options - { page, limit }
 * @returns {Object} { data, pagination }
 */
export const getPublishedAnnouncements = async (participantType, { page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const now = new Date();

  const where = {
    status: "PUBLISHED",
    publishDate: { lte: now },
    OR: [
      { expireDate: null },
      { expireDate: { gte: now } },
    ],
  };

  // Filter berdasarkan target
  if (participantType === "UNIVERSITY") {
    where.OR = [
      { targetType: "ALL" },
      { targetType: "UNIVERSITY" },
    ];
  } else if (participantType === "SMK") {
    where.OR = [
      { targetType: "ALL" },
      { targetType: "SMK" },
    ];
  } else {
    where.targetType = "ALL";
  }

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { publishDate: "desc" },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
    }),
    prisma.announcement.count({ where }),
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
 * Mendapatkan pengumuman terbaru untuk widget dashboard (max 5).
 * @param {string} participantType - "UNIVERSITY" | "SMK" | null
 * @returns {Array}
 */
export const getLatestAnnouncements = async (participantType, limit = 5) => {
  const now = new Date();

  const where = {
    status: "PUBLISHED",
    publishDate: { lte: now },
  };

  // Filter berdasarkan target
  if (participantType === "UNIVERSITY") {
    where.OR = [
      { targetType: "ALL" },
      { targetType: "UNIVERSITY" },
    ];
  } else if (participantType === "SMK") {
    where.OR = [
      { targetType: "ALL" },
      { targetType: "SMK" },
    ];
  } else {
    where.targetType = "ALL";
  }

  // Filter expireDate
  where.AND = [
    {
      OR: [
        { expireDate: null },
        { expireDate: { gte: now } },
      ],
    },
  ];

  return prisma.announcement.findMany({
    where,
    take: limit,
    orderBy: { publishDate: "desc" },
    include: {
      createdBy: {
        select: { id: true, fullName: true },
      },
    },
  });
};

/**
 * Mendapatkan statistik pengumuman untuk mentor dashboard.
 * @returns {Object} { total, draft, published, archived }
 */
export const getAnnouncementStats = async () => {
  const [total, draft, published, archived] = await Promise.all([
    prisma.announcement.count(),
    prisma.announcement.count({ where: { status: "DRAFT" } }),
    prisma.announcement.count({ where: { status: "PUBLISHED" } }),
    prisma.announcement.count({ where: { status: "ARCHIVED" } }),
  ]);

  return { total, draft, published, archived };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Menghapus file lampiran dari disk.
 * @param {string} filename
 */
const deleteAttachmentFile = (filename) => {
  try {
    const filePath = path.join(__dirname, "..", "public", "uploads", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Gagal menghapus file lampiran:", error.message);
  }
};

export default {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus,
  getPublishedAnnouncements,
  getLatestAnnouncements,
  getAnnouncementStats,
};
