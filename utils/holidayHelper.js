/**
 * Indonesian National Holidays Helper (utils/holidayHelper.js)
 *
 * Menyediakan database dan helper resmi untuk mendeteksi Hari Libur Nasional di Indonesia:
 * - Database tahun 2024, 2025, 2026, 2027
 * - Fallback tanggal libur nasional tetap (Fixed Holidays)
 * - Fungsi pengecekan hari libur / tanggal merah (Minggu & Libur Nasional)
 */

export const INDONESIAN_HOLIDAYS = {
  // 2024
  "2024-01-01": "Tahun Baru 2024 Masehi",
  "2024-02-08": "Isra Mi'raj Nabi Muhammad SAW",
  "2024-02-10": "Tahun Baru Imlek 2575",
  "2024-03-11": "Hari Suci Nyepi (Saka 1946)",
  "2024-03-29": "Wafat Isa Al Masih",
  "2024-03-31": "Hari Paskah",
  "2024-04-10": "Hari Raya Idul Fitri 1445 H",
  "2024-04-11": "Hari Raya Idul Fitri 1445 H",
  "2024-05-01": "Hari Buruh Internasional",
  "2024-05-09": "Kenaikan Isa Al Masih",
  "2024-05-23": "Hari Raya Waisak 2568 BE",
  "2024-06-01": "Hari Lahir Pancasila",
  "2024-06-17": "Hari Raya Idul Adha 1445 H",
  "2024-07-07": "Tahun Baru Islam 1446 H",
  "2024-08-17": "Hari Kemerdekaan RI",
  "2024-09-16": "Maulid Nabi Muhammad SAW",
  "2024-12-25": "Hari Raya Natal",

  // 2025
  "2025-01-01": "Tahun Baru 2025 Masehi",
  "2025-01-27": "Isra Mi'raj Nabi Muhammad SAW",
  "2025-01-29": "Tahun Baru Imlek 2576",
  "2025-03-29": "Hari Suci Nyepi (Saka 1947)",
  "2025-03-31": "Hari Raya Idul Fitri 1446 H",
  "2025-04-01": "Hari Raya Idul Fitri 1446 H",
  "2025-04-18": "Wafat Yesus Kristus",
  "2025-04-20": "Kebangkitan Yesus Kristus (Paskah)",
  "2025-05-01": "Hari Buruh Internasional",
  "2025-05-12": "Hari Raya Waisak 2569 BE",
  "2025-05-29": "Kenaikan Yesus Kristus",
  "2025-06-01": "Hari Lahir Pancasila",
  "2025-06-06": "Hari Raya Idul Adha 1446 H",
  "2025-06-27": "1 Muharam / Tahun Baru Islam 1447 H",
  "2025-08-17": "Hari Kemerdekaan RI",
  "2025-09-05": "Maulid Nabi Muhammad SAW",
  "2025-12-25": "Hari Raya Natal",

  // 2026
  "2026-01-01": "Tahun Baru 2026 Masehi",
  "2026-01-16": "Isra Mi'raj Nabi Muhammad SAW",
  "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
  "2026-03-19": "Hari Suci Nyepi (Saka 1948)",
  "2026-03-20": "Hari Raya Idul Fitri 1447 H",
  "2026-03-21": "Hari Raya Idul Fitri 1447 H",
  "2026-04-03": "Wafat Yesus Kristus (Jumat Agung)",
  "2026-04-05": "Hari Paskah",
  "2026-05-01": "Hari Buruh Internasional",
  "2026-05-14": "Kenaikan Yesus Kristus",
  "2026-05-27": "Hari Raya Idul Adha 1447 H",
  "2026-05-31": "Hari Raya Waisak 2570 BE",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "1 Muharam / Tahun Baru Islam 1448 H",
  "2026-08-17": "Hari Kemerdekaan RI",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-25": "Hari Raya Natal",

  // 2027
  "2027-01-01": "Tahun Baru 2027 Masehi",
  "2027-01-05": "Isra Mi'raj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-09": "Hari Suci Nyepi (Saka 1949)",
  "2027-03-10": "Hari Raya Idul Fitri 1448 H",
  "2027-03-11": "Hari Raya Idul Fitri 1448 H",
  "2027-03-26": "Wafat Yesus Kristus",
  "2027-05-01": "Hari Buruh Internasional",
  "2027-05-06": "Kenaikan Yesus Kristus",
  "2027-05-16": "Hari Raya Idul Adha 1448 H",
  "2027-05-20": "Hari Raya Waisak 2571 BE",
  "2027-06-01": "Hari Lahir Pancasila",
  "2027-06-06": "1 Muharam / Tahun Baru Islam 1449 H",
  "2027-08-15": "Maulid Nabi Muhammad SAW",
  "2027-08-17": "Hari Kemerdekaan RI",
  "2027-12-25": "Hari Raya Natal",
};

/**
 * Mencari nama Hari Libur Nasional berdasarkan tanggal (YYYY-MM-DD atau Date).
 * @param {string|Date} dateInput
 * @returns {string|null} Nama hari libur atau null jika bukan libur nasional
 */
export const getIndonesianHoliday = (dateInput) => {
  if (!dateInput) return null;
  let dateStr = "";

  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    dateStr = dateInput;
  } else {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dateStr = `${year}-${month}-${day}`;
  }

  if (INDONESIAN_HOLIDAYS[dateStr]) {
    return INDONESIAN_HOLIDAYS[dateStr];
  }

  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const monthDay = `${parts[1]}-${parts[2]}`;
    const fixedHolidays = {
      "01-01": "Tahun Baru Masehi",
      "05-01": "Hari Buruh Internasional",
      "06-01": "Hari Lahir Pancasila",
      "08-17": "Hari Kemerdekaan RI",
      "12-25": "Hari Raya Natal",
    };
    if (fixedHolidays[monthDay]) {
      return fixedHolidays[monthDay];
    }
  }

  return null;
};

/**
 * Memeriksa apakah suatu tanggal adalah "Tanggal Merah" (Minggu atau Libur Nasional).
 * @param {string|Date} dateInput
 * @returns {Object} { isRedDate, isSunday, isNationalHoliday, holidayName, label }
 */
export const checkRedDate = (dateInput) => {
  if (!dateInput) {
    return { isRedDate: false, isSunday: false, isNationalHoliday: false, holidayName: null, label: "Hari Kerja" };
  }

  let d;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split("-").map(Number);
    d = new Date(y, m - 1, day, 0, 0, 0, 0);
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) {
    return { isRedDate: false, isSunday: false, isNationalHoliday: false, holidayName: null, label: "Hari Kerja" };
  }

  const dayOfWeek = d.getDay(); // 0 = Minggu
  const isSunday = dayOfWeek === 0;
  const holidayName = getIndonesianHoliday(d);
  const isNationalHoliday = Boolean(holidayName);
  const isRedDate = isSunday || isNationalHoliday;

  let label = "Hari Kerja";
  if (isNationalHoliday) {
    label = `Libur Nasional: ${holidayName}`;
  } else if (isSunday) {
    label = "Minggu (Hari Libur)";
  }

  return {
    isRedDate,
    isSunday,
    isNationalHoliday,
    holidayName: holidayName || (isSunday ? "Hari Minggu" : null),
    label,
  };
};

export default {
  INDONESIAN_HOLIDAYS,
  getIndonesianHoliday,
  checkRedDate,
};
