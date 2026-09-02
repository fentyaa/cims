/**
 * Logbook Service
 *
 * Business logic untuk fitur Daily Logbook.
 * Dipisahkan dari controller agar lebih modular dan testable.
 */

import prisma from "../config/database.js";

/**
 * Mendapatkan logbook milik peserta tertentu.
 * @param {string} userId - ID peserta
 * @param {Object} options - { page, limit }
 * @returns {Object} { data, pagination }
 */
export const getInternLogbooks = async (userId, { page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.logbook.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.logbook.count({ where: { userId } }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Mendapatkan logbook hari ini untuk peserta.
 * @param {string} userId
 * @param {Date} date
 * @returns {Object|null}
 */
export const getTodayLogbook = async (userId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.logbook.findUnique({
    where: {
      userId_date: {
        userId,
        date: startOfDay,
      },
    },
  });
};

/**
 * Membuat logbook baru.
 * @param {string} userId
 * @param {Object} data - { activity, obstacle, nextPlan }
 * @returns {Object} Logbook yang dibuat
 */
export const createLogbook = async (userId, data) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cek apakah sudah ada logbook hari ini
  const existing = await getTodayLogbook(userId, today);
  if (existing) {
    throw new Error("Anda sudah membuat logbook hari ini. Silakan edit logbook yang sudah ada.");
  }

  return prisma.logbook.create({
    data: {
      userId,
      date: today,
      activity: data.activity,
      obstacle: data.obstacle || null,
      nextPlan: data.nextPlan || null,
    },
  });
};

/**
 * Mengupdate logbook (hanya jika status masih PENDING).
 * @param {string} logbookId
 * @param {string} userId
 * @param {Object} data - { activity, obstacle, nextPlan }
 * @returns {Object} Logbook yang diupdate
 */
export const updateLogbook = async (logbookId, userId, data) => {
  const logbook = await prisma.logbook.findFirst({
    where: { id: logbookId, userId },
  });

  if (!logbook) {
    throw new Error("Logbook tidak ditemukan.");
  }

  if (logbook.status === "REVIEWED") {
    throw new Error("Logbook sudah direview mentor. Tidak dapat diedit lagi.");
  }

  return prisma.logbook.update({
    where: { id: logbookId },
    data: {
      activity: data.activity,
      obstacle: data.obstacle || null,
      nextPlan: data.nextPlan || null,
    },
  });
};

/**
 * Mendapatkan semua logbook untuk mentor (dengan filter).
 * @param {Object} options
 * @returns {Object} { data, pagination }
 */
export const getAllLogbooks = async ({
  page = 1,
  limit = 10,
  search = "",
  filter = "all",
} = {}) => {
  const skip = (page - 1) * limit;

  // Date range filter
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dateFilter = {};

  if (filter === "today") {
    dateFilter = {
      gte: today,
      lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  } else if (filter === "week") {
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as start
    startOfWeek.setDate(today.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    dateFilter = { gte: startOfWeek };
  } else if (filter === "month") {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    dateFilter = { gte: startOfMonth };
  }

  // Build where clause
  const where = {
    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    ...(search && {
      user: {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { university: { contains: search, mode: "insensitive" } },
          { schoolName: { contains: search, mode: "insensitive" } },
        ],
      },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.logbook.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePhoto: true,
            participantType: true,
            university: true,
            schoolName: true,
            studyProgram: true,
            major: true,
          },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.logbook.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Mendapatkan detail logbook by ID.
 * @param {string} id
 * @returns {Object|null}
 */
export const getLogbookById = async (id) => {
  return prisma.logbook.findUnique({
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
          schoolName: true,
          studyProgram: true,
          major: true,
          classGrade: true,
          studentId: true,
        },
      },
    },
  });
};

/**
 * Mentor memberikan komentar dan menandai sebagai direview.
 * @param {string} logbookId
 * @param {string} comment
 * @returns {Object}
 */
export const reviewLogbook = async (logbookId, comment) => {
  const logbook = await prisma.logbook.findUnique({
    where: { id: logbookId },
  });

  if (!logbook) {
    throw new Error("Logbook tidak ditemukan.");
  }

  if (logbook.status === "REVIEWED") {
    throw new Error("Logbook sudah direview sebelumnya.");
  }

  return prisma.logbook.update({
    where: { id: logbookId },
    data: {
      mentorComment: comment || null,
      status: "REVIEWED",
    },
  });
};

/**
 * Mendapatkan statistik logbook untuk dashboard mentor.
 * @returns {Object}
 */
export const getMentorDashboardStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayLogbooks, pendingReview, reviewed] = await Promise.all([
    prisma.logbook.count({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.logbook.count({
      where: { status: "PENDING" },
    }),
    prisma.logbook.count({
      where: { status: "REVIEWED" },
    }),
  ]);

  return { todayLogbooks, pendingReview, reviewed };
};

/**
 * Mendapatkan statistik logbook untuk dashboard intern.
 * @param {string} userId
 * @returns {Object}
 */
export const getInternDashboardStats = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayLogbook, totalThisMonth] = await Promise.all([
    getTodayLogbook(userId, today),
    prisma.logbook.count({
      where: {
        userId,
        date: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    hasTodayLogbook: !!todayLogbook,
    todayStatus: todayLogbook ? todayLogbook.status : null,
    totalThisMonth,
  };
};

/**
 * Alias: getLogbookStats - statistik untuk dashboard mentor.
 * @returns {Object} { total, pending, reviewed, today }
 */
export const getLogbookStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [total, pending, reviewed, todayCount] = await Promise.all([
    prisma.logbook.count(),
    prisma.logbook.count({ where: { status: "PENDING" } }),
    prisma.logbook.count({ where: { status: "REVIEWED" } }),
    prisma.logbook.count({
      where: {
        date: { gte: today, lt: endOfToday },
      },
    }),
  ]);

  return { total, pending, reviewed, today: todayCount };
};

/**
 * Alias: getInternLogbookStats - statistik logbook untuk dashboard intern.
 * @param {string} userId
 * @returns {Object} { total, pending, reviewed }
 */
export const getInternLogbookStats = async (userId) => {
  const [total, pending, reviewed] = await Promise.all([
    prisma.logbook.count({ where: { userId } }),
    prisma.logbook.count({ where: { userId, status: "PENDING" } }),
    prisma.logbook.count({ where: { userId, status: "REVIEWED" } }),
  ]);

  return { total, pending, reviewed };
};

export default {
  getInternLogbooks,
  getTodayLogbook,
  createLogbook,
  updateLogbook,
  getAllLogbooks,
  getLogbookById,
  reviewLogbook,
  getMentorDashboardStats,
  getInternDashboardStats,
  getLogbookStats,
  getInternLogbookStats,
};
