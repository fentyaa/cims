/**
 * Gamification & Streak Service
 *
 * Menghitung metrik gamifikasi ringan untuk peserta magang:
 * - Active Days: Jumlah kehadiran WFO / WFH dalam periode magang
 * - Current Streak: Rangkaian hari aktif beruntun (Senin-Sabtu; Minggu dilewati tanpa memutus streak)
 * - Best Streak: Rekor streak terpanjang selama magang
 * - Internship Progress: Persentase hari kerja (Senin-Sabtu) yang telah berjalan
 * - Achievements: Lencana pencapaian derived (First Logbook, First Week, Streak 7, Halfway, Complete)
 */

import prisma from "../config/database.js";
import { checkRedDate } from "../utils/holidayHelper.js";

/**
 * Menghitung jumlah hari kerja (Senin-Sabtu di luar Libur Nasional) di antara dua tanggal inklusif.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
export const calculateWorkDaysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) return 0;

  let workDays = 0;
  const curr = new Date(start);

  while (curr <= end) {
    const redInfo = checkRedDate(curr);
    if (!redInfo.isRedDate) {
      workDays++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  return workDays;
};

/**
 * Menghitung progress persentase masa magang berdasarkan hari kerja (Senin-Sabtu).
 * @param {Date|null} startDate
 * @param {Date|null} endDate
 * @param {Date} [asOfDate=new Date()]
 * @returns {Object|null} { totalWorkDays, elapsedWorkDays, progressPercent }
 */
export const calculateInternshipProgress = (startDate, endDate, asOfDate = new Date()) => {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) {
    return null;
  }

  const today = new Date(asOfDate);
  today.setHours(0, 0, 0, 0);

  const totalWorkDays = calculateWorkDaysBetween(start, end);
  if (totalWorkDays === 0) {
    return {
      totalWorkDays: 0,
      elapsedWorkDays: 0,
      remainingWorkDays: 0,
      currentDay: 0,
      progressPercent: 100,
      status: "COMPLETED",
    };
  }

  if (today < start) {
    return {
      totalWorkDays,
      elapsedWorkDays: 0,
      remainingWorkDays: totalWorkDays,
      currentDay: 0,
      progressPercent: 0,
      status: "NOT_STARTED",
    };
  }

  if (today >= end) {
    return {
      totalWorkDays,
      elapsedWorkDays: totalWorkDays,
      remainingWorkDays: 0,
      currentDay: totalWorkDays,
      progressPercent: 100,
      status: "COMPLETED",
    };
  }

  const elapsedWorkDays = calculateWorkDaysBetween(start, today);
  const remainingWorkDays = Math.max(0, totalWorkDays - elapsedWorkDays);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedWorkDays / totalWorkDays) * 100)));

  return {
    totalWorkDays,
    elapsedWorkDays,
    remainingWorkDays,
    currentDay: elapsedWorkDays,
    progressPercent,
    status: "ONGOING",
  };
};

/**
 * Helper untuk normalisasi tanggal ke format lokal YYYY-MM-DD secara aman dari offset timezone.
 * @param {string|Date} dateInput
 * @returns {string} Format YYYY-MM-DD
 */
export const toLocalDateStr = (dateInput) => {
  if (!dateInput) return "";
  if (
    typeof dateInput === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
  ) {
    return dateInput;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Helper internal untuk membuat objek Date lokal pada pukul 00:00:00.
 */
const parseLocalDate = (dateInput) => {
  const str = toLocalDateStr(dateInput);
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

/**
 * Menghitung Active Days, Current Streak, dan Best Streak secara aman di memori.
 * @param {Array} presences - Daftar Presence [{ date, status }]
 * @param {Date|null} startDate - Tanggal mulai magang
 * @param {Date|null} endDate - Tanggal selesai magang
 * @param {Date} [asOfDate=new Date()] - Tanggal referensi (default hari ini)
 * @returns {Object} { activeDays, currentStreak, bestStreak }
 */
export const calculateActiveDaysAndStreaks = (presences = [], startDate = null, endDate = null, asOfDate = new Date()) => {
  // 1. Buat lookup map untuk presensi menggunakan toLocalDateStr
  const presenceMap = new Map();
  presences.forEach((p) => {
    const dStr = toLocalDateStr(p.date);
    if (dStr) {
      presenceMap.set(dStr, p.status);
    }
  });

  const todayStr = toLocalDateStr(asOfDate);
  const todayDate = parseLocalDate(asOfDate) || new Date();

  // 2. Tentukan batas awal dan akhir evaluasi
  let evalStart = null;
  if (startDate) {
    evalStart = parseLocalDate(startDate);
  } else if (presences.length > 0) {
    evalStart = parseLocalDate(presences[0].date);
  } else {
    evalStart = new Date(todayDate);
  }

  let evalEnd = new Date(todayDate);
  if (endDate) {
    const limitEnd = parseLocalDate(endDate);
    if (limitEnd && evalEnd > limitEnd) {
      evalEnd = limitEnd;
    }
  }

  if (!evalStart || !evalEnd || evalStart > evalEnd) {
    return { activeDays: 0, currentStreak: 0, bestStreak: 0 };
  }

  // 3. Iterasi kronologis untuk menghitung Active Days dan Best Streak
  let activeDays = 0;
  let runningStreak = 0;
  let bestStreak = 0;
  const history = [];

  const curr = new Date(evalStart);
  while (curr <= evalEnd) {
    const dStr = toLocalDateStr(curr);
    const redInfo = checkRedDate(curr);
    const isRedDate = redInfo.isRedDate; // Minggu atau Libur Nasional
    const isTodayDay = dStr === todayStr;
    const status = presenceMap.get(dStr);
    const isWfoWfh = status === "WFO" || status === "WFH";

    if (isWfoWfh) {
      // Hadir (WFO/WFH) baik pada hari kerja maupun pada hari libur
      activeDays++;
      runningStreak++;
      if (runningStreak > bestStreak) {
        bestStreak = runningStreak;
      }
      history.push({ dateStr: dStr, status, active: true, isRedDate, isToday: isTodayDay });
    } else if (isRedDate) {
      // Tanggal Merah (Minggu / Libur Nasional) tanpa presensi: hari libur resmi, tidak memutus streak!
      history.push({ dateStr: dStr, status: redInfo.label, active: false, isRedDate: true, isToday: isTodayDay });
    } else {
      // Hari kerja biasa
      if (isTodayDay && !status) {
        // Hari ini masih berjalan dan belum absen: jangan memutus streak yang sudah dicapai kemarin
        history.push({ dateStr: dStr, status: "ONGOING_EMPTY", active: false, isRedDate: false, isToday: true });
      } else {
        // Hari kerja sebelumnya tidak absen atau IZIN/SAKIT: streak terputus
        runningStreak = 0;
        history.push({ dateStr: dStr, status: status || "MISSED", active: false, isRedDate: false, isToday: isTodayDay });
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  // 4. Hitung Current Streak dengan menelusuri mundur dari hari terakhir
  let currentStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];

    if (item.isRedDate && !item.active) {
      // Tanggal Merah (Libur Nasional / Minggu) tanpa presensi dilewati tanpa memutus streak
      continue;
    }

    if (item.isToday && item.status === "ONGOING_EMPTY") {
      // Hari ini masih berjalan: lanjutkan cek hari kerja sebelumnya
      continue;
    }

    if (item.active) {
      currentStreak++;
    } else {
      // Bertemu hari kerja tidak aktif / izin / sakit / terlewat: hitungan streak berakhir
      break;
    }
  }

  return {
    activeDays,
    currentStreak,
    bestStreak,
  };
};

/**
 * Menghasilkan lencana pencapaian (Achievements) secara derived tanpa tabel terpisah.
 */
export const calculateAchievements = (activeDays, currentStreak, bestStreak, progressPercent, totalLogbooks) => {
  return [
    {
      id: "first_logbook",
      title: "First Logbook",
      icon: "🥇",
      description: "Mengisi catatan logbook pertama",
      unlocked: totalLogbooks >= 1,
    },
    {
      id: "first_week",
      title: "First Week",
      icon: "📅",
      description: "Menyelesaikan 6 hari aktif magang",
      unlocked: activeDays >= 6,
    },
    {
      id: "streak_7",
      title: "7-Day Streak",
      icon: "🔥",
      description: "Mencapai 7 hari kerja aktif berturut-turut",
      unlocked: bestStreak >= 7,
    },
    {
      id: "halfway",
      title: "Halfway There",
      icon: "🎯",
      description: "Mencapai 50% periode magang",
      unlocked: progressPercent !== null && progressPercent >= 50,
    },
    {
      id: "complete",
      title: "Complete",
      icon: "🏆",
      description: "Menyelesaikan 100% masa magang",
      unlocked: progressPercent !== null && progressPercent >= 100,
    },
  ];
};

/**
 * Mengambil seluruh statistik gamifikasi peserta magang.
 * @param {string} userId
 * @returns {Object}
 */
export const getInternGamificationStats = async (userId) => {
  // 1. Ambil data User beserta structured dates
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      internshipStartDate: true,
      internshipEndDate: true,
    },
  });

  if (!user) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  // 2. Ambil seluruh presence dan total logbook peserta dalam query terpadu
  const [presences, totalLogbooks] = await Promise.all([
    prisma.presence.findMany({
      where: {
        userId,
        ...(user.internshipStartDate && user.internshipEndDate
          ? {
              date: {
                gte: user.internshipStartDate,
                lte: user.internshipEndDate,
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    }),
    prisma.logbook.count({ where: { userId } }),
  ]);

  // 3. Hitung progress magang
  const progressData = calculateInternshipProgress(user.internshipStartDate, user.internshipEndDate);

  // 4. Hitung Active Days dan Streaks
  const streakData = calculateActiveDaysAndStreaks(
    presences,
    user.internshipStartDate,
    user.internshipEndDate
  );

  // 5. Hitung Achievements
  const achievements = calculateAchievements(
    streakData.activeDays,
    streakData.currentStreak,
    streakData.bestStreak,
    progressData ? progressData.progressPercent : null,
    totalLogbooks
  );

  return {
    hasStructuredDates: Boolean(user.internshipStartDate && user.internshipEndDate),
    startDate: user.internshipStartDate,
    endDate: user.internshipEndDate,
    activeDays: streakData.activeDays,
    currentStreak: streakData.currentStreak,
    bestStreak: streakData.bestStreak,
    progress: progressData,
    totalLogbooks,
    achievements,
  };
};

export default {
  calculateWorkDaysBetween,
  calculateInternshipProgress,
  calculateActiveDaysAndStreaks,
  calculateAchievements,
  getInternGamificationStats,
};
