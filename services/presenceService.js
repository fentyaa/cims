/**
 * Presence Service
 *
 * Business logic untuk modul Presensi Harian (FASE 2):
 * - Status: WFO, WFH, IZIN, SAKIT
 * - Hari Aktif: WFO, WFH
 * - Bukan Hari Aktif: IZIN, SAKIT
 * - 1 record per user per tanggal (@@unique([userId, date]))
 */

import prisma from "../config/database.js";
import { checkRedDate } from "../utils/holidayHelper.js";

export const VALID_STATUSES = ["WFO", "WFH", "IZIN", "SAKIT"];
export const ACTIVE_STATUSES = ["WFO", "WFH"];
export const INACTIVE_STATUSES = ["IZIN", "SAKIT"];

/**
 * Memeriksa apakah status tergolong hari aktif.
 * @param {string} status
 * @returns {boolean}
 */
export const isActiveDay = (status) => ACTIVE_STATUSES.includes(status);

/**
 * Mencatat/membuat presensi harian untuk peserta.
 *
 * @param {string} userId - ID peserta dari session terautentikasi
 * @param {Object} data - Data input
 * @param {string} data.status - 'WFO', 'WFH', 'IZIN', atau 'SAKIT'
 * @param {string} [data.notes] - Keterangan/alasan (opsional)
 * @param {string|Date} [data.date] - Tanggal presensi (default: hari ini)
 * @returns {Promise<Object>} Data Presence yang dibuat
 * @throws {Error} Jika status tidak valid atau sudah absen pada tanggal tersebut
 */
export const submitPresence = async (userId, { status, notes = null, date = null }) => {
  // 1. Validasi status
  const normalizedStatus = (status || "").toUpperCase().trim();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    throw new Error("Status presensi tidak valid. Pilih WFO, WFH, Izin, atau Sakit.");
  }

  // 2. Validasi User & Tipe Peserta
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, participantType: true, internshipPeriod: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new Error("Akun peserta tidak aktif atau tidak ditemukan.");
  }

  // Aturan WFH: Hanya diperbolehkan untuk mahasiswa kuliah (UNIVERSITY)
  if (normalizedStatus === "WFH" && user.participantType === "SMK") {
    throw new Error(
      "Peserta PKL SMK tidak diperkenankan untuk WFH (Work From Home). Jika berhalangan hadir di kantor atau ada kendala, disarankan untuk mengajukan status Izin atau Sakit."
    );
  }

  // 3. Normalisasi Tanggal ke midnight (00:00:00.000)
  const targetDate = date ? new Date(date) : new Date();
  if (isNaN(targetDate.getTime())) {
    throw new Error("Format tanggal tidak valid.");
  }
  targetDate.setHours(0, 0, 0, 0);

  // 4. Periksa apakah sudah ada presensi pada tanggal target (Mencegah Duplikasi)
  const existing = await prisma.presence.findUnique({
    where: {
      userId_date: {
        userId,
        date: targetDate,
      },
    },
  });

  if (existing) {
    throw new Error("Presensi untuk tanggal ini sudah tercatat.");
  }

  // 5. Simpan Presensi baru
  const cleanNotes = notes && typeof notes === "string" ? notes.trim() : null;

  const presence = await prisma.presence.create({
    data: {
      userId,
      date: targetDate,
      status: normalizedStatus,
      notes: cleanNotes,
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
    },
  });

  return presence;
};

/**
 * Mendapatkan data presensi hari ini untuk peserta.
 *
 * @param {string} userId - ID peserta
 * @returns {Promise<Object|null>}
 */
export const getTodayPresence = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.presence.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });
};

/**
 * Mendapatkan riwayat presensi peserta dengan filter rentang waktu.
 *
 * @param {string} userId - ID peserta
 * @param {string} filter - 'today', 'week', 'month', 'all'
 * @returns {Promise<Array>} Daftar presensi
 */
export const getPresenceHistory = async (userId, filter = "month") => {
  const now = new Date();
  let startDate = null;

  switch (filter) {
    case "today":
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "all":
    default:
      startDate = null;
      break;
  }

  const where = { userId };
  if (startDate) {
    where.date = { gte: startDate };
  }

  const presences = await prisma.presence.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return presences;
};

/**
 * Mendapatkan seluruh presensi untuk Mentor dengan opsi filter.
 *
 * @param {Object} options - Filter options
 * @param {string} [options.date] - Tanggal YYYY-MM-DD
 * @param {string} [options.type] - Jenis peserta (UNIVERSITY / SMK)
 * @param {string} [options.status] - Status presensi (WFO / WFH / IZIN / SAKIT)
 * @returns {Promise<Array>}
 */
export const getAllPresences = async ({ date, type, status } = {}) => {
  const where = {};

  // Filter tanggal
  if (date && date !== "all" && date.trim() !== "") {
    const selectedDate = new Date(date);
    if (!isNaN(selectedDate.getTime())) {
      selectedDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);

      where.date = {
        gte: selectedDate,
        lt: nextDate,
      };
    }
  }

  // Filter jenis peserta
  if (type && ["UNIVERSITY", "SMK"].includes(type)) {
    where.user = { participantType: type };
  }

  // Filter status presensi
  if (status && VALID_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  const presences = await prisma.presence.findMany({
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
    orderBy: [{ date: "desc" }, { user: { fullName: "asc" } }],
  });

  return presences;
};

/**
 * Statistik presensi untuk Dashboard Mentor.
 * Menghitung hari aktif (WFO, WFH), bukan hari aktif (Izin, Sakit), dan belum absen.
 *
 * @returns {Promise<Object>}
 */
export const getMentorDashboardStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Ambil presensi hari ini dan total peserta aktif secara paralel
  const [todayPresences, totalActiveInterns] = await Promise.all([
    prisma.presence.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: { id: true, role: true, status: true },
        },
      },
    }),
    prisma.user.count({
      where: { role: "INTERN", status: "ACTIVE" },
    }),
  ]);

  // Filter hanya INTERN yang ACTIVE
  const internPresences = todayPresences.filter(
    (p) => p.user.role === "INTERN" && p.user.status === "ACTIVE"
  );

  const wfoCount = internPresences.filter((p) => p.status === "WFO").length;
  const wfhCount = internPresences.filter((p) => p.status === "WFH").length;
  const izinCount = internPresences.filter((p) => p.status === "IZIN").length;
  const sakitCount = internPresences.filter((p) => p.status === "SAKIT").length;

  const activeDaysCount = wfoCount + wfhCount; // WFO + WFH = Hari Aktif
  const inactiveDaysCount = izinCount + sakitCount; // Izin + Sakit = Bukan Hari Aktif
  const totalSubmitted = internPresences.length;

  const belumAbsen = Math.max(0, totalActiveInterns - totalSubmitted);

  // Informasi Hari Libur / Tanggal Merah Hari Ini
  const redInfo = checkRedDate(today);

  return {
    wfoCount,
    wfhCount,
    izinCount,
    sakitCount,
    activeDaysCount,
    inactiveDaysCount,
    totalSubmitted,
    totalActiveInterns,
    belumAbsen,
    isRedDate: redInfo.isRedDate,
    isSunday: redInfo.isSunday,
    isHoliday: redInfo.isNationalHoliday,
    holidayName: redInfo.holidayName,
    holidayLabel: redInfo.label,
  };
};

/**
 * Statistik presensi untuk Dashboard Intern.
 *
 * @param {string} userId - ID peserta
 * @returns {Promise<Object>}
 */
export const getInternDashboardStats = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const presence = await prisma.presence.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  const hasPresence = !!presence;
  const status = presence ? presence.status : null;
  const isActive = status ? isActiveDay(status) : false;

  // Informasi Hari Libur / Tanggal Merah Hari Ini
  const redInfo = checkRedDate(today);

  return {
    hasPresence,
    status,
    isActiveDay: isActive,
    notes: presence?.notes || null,
    date: presence?.date || today,
    presence,
    isRedDate: redInfo.isRedDate,
    isSunday: redInfo.isSunday,
    isHoliday: redInfo.isNationalHoliday,
    holidayName: redInfo.holidayName,
    holidayLabel: redInfo.label,
  };
};

export default {
  VALID_STATUSES,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  isActiveDay,
  submitPresence,
  getTodayPresence,
  getPresenceHistory,
  getAllPresences,
  getMentorDashboardStats,
  getInternDashboardStats,
};
