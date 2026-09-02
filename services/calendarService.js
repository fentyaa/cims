/**
 * Calendar Service
 *
 * Business logic untuk fitur Internship Calendar.
 * - Menggabungkan data Presence dan Logbook dalam satu date range per bulan.
 * - Menerapkan aturan hari kerja CIMS: Senin-Sabtu (Minggu = Libur).
 * - Menilai batasan rentang magang menggunakan internshipStartDate & internshipEndDate.
 */

import prisma from "../config/database.js";
import { getIndonesianHoliday, checkRedDate } from "../utils/holidayHelper.js";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

/**
 * Validasi dan normalisasi tahun & bulan.
 */
export const sanitizeYearMonth = (yearInput, monthInput) => {
  const now = new Date();
  let year = parseInt(yearInput, 10);
  let month = parseInt(monthInput, 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    year = now.getFullYear();
  }

  if (isNaN(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }

  return { year, month };
};

/**
 * Mengambil data kalender lengkap untuk peserta dalam satu bulan tertentu.
 * @param {string} userId - ID peserta magang
 * @param {number|string} yearInput - Tahun (contoh: 2026)
 * @param {number|string} monthInput - Bulan (1-12)
 * @returns {Object} Data kalender lengkap (grid, user, navigasi, statistik)
 */
export const getInternCalendarData = async (userId, yearInput, monthInput) => {
  const { year, month } = sanitizeYearMonth(yearInput, monthInput);

  // 1. Ambil data User beserta structured internship dates
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      internshipPeriod: true,
      internshipStartDate: true,
      internshipEndDate: true,
    },
  });

  if (!user) {
    throw new Error("Peserta tidak ditemukan.");
  }

  // 2. Hitung rentang tanggal bulan yang diminta
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const endOfMonth = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);

  // 3. Ambil Presence dan Logbook dalam date range (Maksimal 1 query masing-masing)
  const [presences, logbooks] = await Promise.all([
    prisma.presence.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.logbook.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // 4. Buat lookup Map untuk pencocokan cepat O(1)
  const presenceMap = new Map();
  presences.forEach((p) => {
    const dStr = new Date(p.date).toISOString().split("T")[0];
    presenceMap.set(dStr, p);
  });

  const logbookMap = new Map();
  logbooks.forEach((l) => {
    const dStr = new Date(l.date).toISOString().split("T")[0];
    logbookMap.set(dStr, l);
  });

  // 5. Normalisasi structured internship dates
  const hasStructuredDates = Boolean(user.internshipStartDate && user.internshipEndDate);
  let startDate = null;
  let endDate = null;

  if (hasStructuredDates) {
    startDate = new Date(user.internshipStartDate);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(user.internshipEndDate);
    endDate.setHours(23, 59, 59, 999);
  }

  // Hari ini
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // 6. Hitung statistik bulanan
  let wfoCount = 0;
  let wfhCount = 0;
  let izinCount = 0;
  let sakitCount = 0;
  let logbookCount = 0;
  let sundayCount = 0;
  let holidayCount = 0;
  let unrecordedCount = 0;

  // 7. Bangun array hari untuk seluruh tanggal di bulan ini
  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    const isSunday = dayOfWeek === 0;
    const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6; // Senin - Sabtu

    // Cek Hari Libur Nasional
    const holidayName = getIndonesianHoliday(dateStr);
    const isHoliday = Boolean(holidayName);

    // Cek apakah tanggal berada dalam rentang magang terstruktur
    let inPeriod = true;
    if (hasStructuredDates) {
      inPeriod = dateObj >= startDate && dateObj <= endDate;
    }

    const presence = presenceMap.get(dateStr) || null;
    const logbook = logbookMap.get(dateStr) || null;

    if (logbook) {
      logbookCount++;
    }

    // Tentukan Status Harian
    let status = "NONE";
    let statusLabel = "Belum Ada Presensi";
    let isActiveDay = false;

    if (hasStructuredDates && !inPeriod) {
      status = "OUT_OF_PERIOD";
      statusLabel = "Di Luar Periode Magang";
    } else if (isSunday) {
      status = "SUNDAY";
      statusLabel = "Minggu (Hari Libur)";
      sundayCount++;
    } else if (isHoliday) {
      holidayCount++;
      if (presence) {
        status = presence.status;
        if (presence.status === "WFO") {
          statusLabel = `WFO (Hari Libur: ${holidayName})`;
          isActiveDay = true;
          wfoCount++;
        } else if (presence.status === "WFH") {
          statusLabel = `WFH (Hari Libur: ${holidayName})`;
          isActiveDay = true;
          wfhCount++;
        } else if (presence.status === "IZIN") {
          statusLabel = `Izin (${holidayName})`;
          izinCount++;
        } else if (presence.status === "SAKIT") {
          statusLabel = `Sakit (${holidayName})`;
          sakitCount++;
        }
      } else {
        status = "HOLIDAY";
        statusLabel = `Libur Nasional: ${holidayName}`;
      }
    } else if (presence) {
      status = presence.status; // WFO / WFH / IZIN / SAKIT
      if (presence.status === "WFO") {
        statusLabel = "WFO (Hari Aktif)";
        isActiveDay = true;
        wfoCount++;
      } else if (presence.status === "WFH") {
        statusLabel = "WFH (Hari Aktif)";
        isActiveDay = true;
        wfhCount++;
      } else if (presence.status === "IZIN") {
        statusLabel = "Izin (Bukan Hari Aktif)";
        izinCount++;
      } else if (presence.status === "SAKIT") {
        statusLabel = "Sakit (Bukan Hari Aktif)";
        sakitCount++;
      }
    } else if (dateObj <= today) {
      status = "BELUM_ADA_AKTIVITAS";
      statusLabel = "Belum Ada Presensi";
      unrecordedCount++;
    } else {
      status = "UPCOMING";
      statusLabel = "Akan Datang";
    }

    days.push({
      day,
      dateStr,
      dateFormatted: `${DAY_NAMES[dayOfWeek]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`,
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      isSunday,
      isWorkDay,
      isHoliday,
      holidayName: holidayName || null,
      inPeriod,
      isToday: dateStr === todayStr,
      isPastOrToday: dateObj <= today,
      status,
      statusLabel,
      isActiveDay,
      hasPresence: Boolean(presence),
      presenceNotes: presence?.notes || null,
      hasLogbook: Boolean(logbook),
      logbook: logbook
        ? {
            id: logbook.id,
            activity: logbook.activity,
            obstacle: logbook.obstacle || null,
            nextPlan: logbook.nextPlan || null,
            mentorComment: logbook.mentorComment || null,
            status: logbook.status,
          }
        : null,
    });
  }

  // 8. Hitung offset hari pertama (Senin sebagai kolom pertama = index 0)
  // getDay(): 0 = Min, 1 = Sen, 2 = Sel, 3 = Rab, 4 = Kam, 5 = Jum, 6 = Sab
  // Konversi agar Senin = 0, Selasa = 1, ..., Minggu = 6
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const leadingBlanks = (firstDayOfMonth + 6) % 7;

  // 9. Navigasi Bulan
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    user,
    year,
    month,
    monthName: MONTH_NAMES[month - 1],
    daysInMonth,
    leadingBlanks,
    days,
    hasStructuredDates,
    startDate: user.internshipStartDate,
    endDate: user.internshipEndDate,
    navigation: {
      prevYear,
      prevMonth,
      nextYear,
      nextMonth,
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1,
    },
    stats: {
      wfoCount,
      wfhCount,
      activeDaysCount: wfoCount + wfhCount,
      izinCount,
      sakitCount,
      inactiveDaysCount: izinCount + sakitCount,
      logbookCount,
      sundayCount,
      unrecordedCount,
    },
  };
};

export default {
  sanitizeYearMonth,
  getInternCalendarData,
};
