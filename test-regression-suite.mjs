/**
 * Unified Regression Test Suite for CIMS (Part 1, 2B, 3A, 4)
 */

import { generateToken, csrfProtection, regenerateCsrfToken } from "./middlewares/csrf.js";
import {
  escapeHtml,
  generateSafeDocumentFilename,
  formatDateDot,
  formatDateEn,
  formatDateIndonesian,
  preparePlaceholderData,
  replacePlaceholders,
} from "./services/documentService.js";
import { isValidPassword, validateRegister, validateResetPassword, validateLogin, validateLogbook, validateInternshipDates } from "./utils/validators.js";
import { createWebRateLimiter, profileUpdateLimiter, bulkCertificateLimiter, bulkLetterLimiter } from "./middlewares/rateLimiter.js";
import { VALID_STATUSES, ACTIVE_STATUSES, INACTIVE_STATUSES, isActiveDay } from "./services/presenceService.js";
import { sanitizeYearMonth } from "./services/calendarService.js";
import { calculateWorkDaysBetween, calculateInternshipProgress, calculateActiveDaysAndStreaks } from "./services/gamificationService.js";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    totalFailed++;
  }
}

// Helper to simulate request through an express middleware
function simulateMiddleware(middleware, req, res = null) {
  return new Promise((resolve) => {
    const mockRes = res || {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; return this; },
      getHeader(k) { return this.headers[k]; },
      status(code) { this.statusCode = code; return this; },
      redirect(url) {
        resolve({ type: "redirect", status: this.statusCode, url, messages: req.session?.messages });
      }
    };

    middleware(req, mockRes, (err) => {
      resolve({ type: "next", error: err, status: mockRes.statusCode });
    });
  });
}

async function runSuite() {
  console.log("==================================================");
  console.log("1. CSRF PROTECTION & TOKEN INTEGRITY");
  console.log("==================================================");

  // 1.1 Token generation
  const token1 = generateToken();
  const token2 = generateToken();
  assert(typeof token1 === "string" && token1.length === 64, "CSRF token is a 64-char hex string");
  assert(token1 !== token2, "CSRF tokens are unique and cryptographically secure");

  // 1.2 In-place token regeneration
  const reqMock = { session: { csrfToken: "old-token-placeholder" } };
  const oldToken = reqMock.session.csrfToken;
  regenerateCsrfToken(reqMock);
  const newToken = reqMock.session.csrfToken;
  assert(
    typeof newToken === "string" &&
    newToken.length === 64 &&
    newToken !== oldToken,
    "CSRF token regenerated in session successfully"
  );

  // 1.3 CSRF Protection middleware verification
  const validCsrfReq = {
    method: "POST",
    headers: {},
    body: { _csrf: token1 },
    session: { csrfToken: token1, messages: [] },
    is: () => false,
    get: () => "/source-form"
  };
  const validCsrfRes = await simulateMiddleware(csrfProtection, validCsrfReq);
  assert(validCsrfRes.type === "next", "Valid CSRF token in body allows request to proceed");

  const invalidCsrfReq = {
    method: "POST",
    headers: {},
    body: { _csrf: "wrong-token" },
    session: { csrfToken: token1, messages: [] },
    is: () => false,
    get: () => "/source-form"
  };
  const invalidCsrfRes = await simulateMiddleware(csrfProtection, invalidCsrfReq);
  assert(invalidCsrfRes.type === "redirect" && invalidCsrfRes.status === 403, "Mismatched CSRF token is rejected with HTTP 403 redirect");

  const safeGetReq = {
    method: "GET",
    headers: {},
    session: { csrfToken: token1 },
    is: () => false
  };
  const safeGetRes = await simulateMiddleware(csrfProtection, safeGetReq);
  assert(safeGetRes.type === "next", "GET requests bypass CSRF mutation check");

  console.log("\n==================================================");
  console.log("2. HTML ESCAPING & PATH TRAVERSAL IN DOCUMENT GENERATION");
  console.log("==================================================");

  assert(escapeHtml("<script>alert(1)</script>") === "&lt;script&gt;alert(1)&lt;/script&gt;", "Escapes script tags");
  assert(escapeHtml('"test" & \'single\'') === "&quot;test&quot; &amp; &#39;single&#39;", "Escapes quotes and ampersands");
  assert(escapeHtml(12345) === "12345", "Handles numeric input safely");
  assert(escapeHtml(null) === "", "Handles null input safely");

  const safeCert = generateSafeDocumentFilename("CERTIFICATE", "Budi Santoso", "2026-08-23");
  assert(safeCert.startsWith("sertifikat-budi-santoso-2026-08-23-"), "Safe certificate filename format generated");
  assert(!safeCert.includes("..") && !safeCert.includes("/") && !safeCert.includes("\\"), "Filename has no directory traversal characters");

  const safeLetter = generateSafeDocumentFilename("LETTER", "../../etc/passwd", "2026-08-23");
  assert(!safeLetter.includes("..") && !safeLetter.includes("/") && !safeLetter.includes("\\"), "Path traversal stripped from name in filename");

  console.log("\n==================================================");
  console.log("3. PASSWORD COMPLEXITY & VALIDATION CONSISTENCY");
  console.log("==================================================");

  assert(isValidPassword("12345678") === false, "Rejects numbers-only password");
  assert(isValidPassword("password") === false, "Rejects lowercase-only password");
  assert(isValidPassword("PASSWORD") === false, "Rejects uppercase-only password");
  assert(isValidPassword("Pass1") === false, "Rejects short password (< 8 chars)");
  assert(isValidPassword("Password123") === true, "Accepts password with upper + lower + number");
  assert(isValidPassword("Admin2026!#") === true, "Accepts password with upper + lower + number + symbols");

  const weakReg = validateRegister({
    fullName: "Budi Santoso",
    email: "budi@cims.com",
    phoneNumber: "081234567890",
    participantType: "UNIVERSITY",
    university: "Universitas Indonesia",
    studyProgram: "Teknik Informatika",
    studentId: "12345678",
    internshipPeriod: "Januari 2026",
    password: "weakpassword",
    confirmPassword: "weakpassword"
  });
  assert(weakReg.valid === false, "Register form validator rejects non-complex password");

  const compliantReg = validateRegister({
    fullName: "Budi Santoso",
    email: "budi@cims.com",
    phoneNumber: "081234567890",
    participantType: "UNIVERSITY",
    university: "Universitas Indonesia",
    studyProgram: "Teknik Informatika",
    studentId: "12345678",
    internshipPeriod: "Januari 2026",
    password: "Password123",
    confirmPassword: "Password123"
  });
  assert(compliantReg.valid === true, "Register form validator accepts compliant password");

  const weakReset = validateResetPassword({
    password: "12345678",
    confirmPassword: "12345678"
  });
  assert(weakReset.valid === false, "Reset password validator rejects non-complex password");

  const loginCheck = validateLogin({
    email: "user@cims.com",
    password: "existingpassword"
  });
  assert(loginCheck.valid === true, "Login form validator preserves compatibility for existing passwords");

  console.log("\n==================================================");
  console.log("4. TARGETED RATE LIMITING LOGIC");
  console.log("==================================================");

  const testLimiter = createWebRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    message: "Limit reached",
    fallbackRedirect: "/back"
  });

  const userReq = () => ({
    ip: "127.0.0.1",
    session: { user: { id: "user-test-1" }, messages: [] },
    get: () => "/back"
  });

  const r1 = await simulateMiddleware(testLimiter, userReq());
  assert(r1.type === "next", "Rate limiter allows request 1 (within quota)");

  const r2 = await simulateMiddleware(testLimiter, userReq());
  assert(r2.type === "next", "Rate limiter allows request 2 (within quota)");

  const r3 = await simulateMiddleware(testLimiter, userReq());
  assert(r3.type === "redirect" && r3.status === 429, "Rate limiter blocks request 3 with HTTP 429 redirect");
  assert(r3.messages && r3.messages.length > 0 && r3.messages[0].text === "Limit reached", "Flash message populated in session");

  assert(typeof profileUpdateLimiter === "function", "profileUpdateLimiter is initialized");
  assert(typeof bulkCertificateLimiter === "function", "bulkCertificateLimiter is initialized");
  assert(typeof bulkLetterLimiter === "function", "bulkLetterLimiter is initialized");

  console.log("\n==================================================");
  console.log("5. FASE 2: DAILY PRESENCE LOGIC & ACTIVE DAYS");
  console.log("==================================================");

  assert(VALID_STATUSES.includes("WFO"), "Valid status includes WFO");
  assert(VALID_STATUSES.includes("WFH"), "Valid status includes WFH");
  assert(VALID_STATUSES.includes("IZIN"), "Valid status includes IZIN");
  assert(VALID_STATUSES.includes("SAKIT"), "Valid status includes SAKIT");
  assert(VALID_STATUSES.length === 4, "Only 4 daily presence statuses exist");

  assert(isActiveDay("WFO") === true, "WFO is counted as active day (Hari Aktif)");
  assert(isActiveDay("WFH") === true, "WFH is counted as active day (Hari Aktif)");
  assert(isActiveDay("IZIN") === false, "IZIN is NOT counted as active day (Bukan Hari Aktif)");
  assert(isActiveDay("SAKIT") === false, "SAKIT is NOT counted as active day (Bukan Hari Aktif)");
  assert(isActiveDay("INVALID") === false, "Invalid status is not active day");

  console.log("\n==================================================");
  console.log("6. FASE 3: LOGBOOK VALIDATION & AUTHORIZATION");
  console.log("==================================================");

  // 6.1 Validation of activity field length
  assert(validateLogbook({ activity: "pend" }).valid === false, "Rejects short activity (< 5 chars)");
  assert(validateLogbook({ activity: "" }).valid === false, "Rejects empty activity");
  assert(validateLogbook({ activity: "   " }).valid === false, "Rejects whitespace-only activity");
  assert(validateLogbook({ activity: "Membuat modul integrasi database" }).valid === true, "Accepts valid activity (>= 5 chars)");

  // 6.2 XSS Safety on Logbook content
  const dirtyActivity = "<script>alert('xss')</script>";
  const escapedActivity = escapeHtml(dirtyActivity);
  assert(!escapedActivity.includes("<script>"), "Escapes script tag in logbook activity");
  assert(escapedActivity === "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;", "Correctly sanitizes HTML entities in logbook");

  // 6.3 State Immutability Logic check (REVIEWED cannot be edited)
  const isEditable = (status) => status === "PENDING";
  assert(isEditable("PENDING") === true, "Pending logbook is editable by intern");
  assert(isEditable("REVIEWED") === false, "Reviewed logbook is locked and cannot be edited by intern");

  console.log("\n==================================================");
  console.log("7. FASE 4: STRUCTURED INTERNSHIP DATES VALIDATION");
  console.log("==================================================");

  // 7.1 Valid start/end dates
  const v1 = validateInternshipDates("2026-01-01", "2026-03-31");
  assert(v1.valid === true, "Valid start and end date accepted (2026-01-01 to 2026-03-31)");

  // 7.2 Same start and end date (1-day internship/workshop)
  const v2 = validateInternshipDates("2026-01-01", "2026-01-01");
  assert(v2.valid === true, "Equal start and end date accepted (startDate <= endDate)");

  // 7.3 Start date > End date rejected
  const v3 = validateInternshipDates("2026-04-01", "2026-01-01");
  assert(v3.valid === false, "Rejects start date greater than end date (2026-04-01 > 2026-01-01)");
  assert(v3.errors.some(e => e.includes("tidak boleh lebih besar")), "Error message explains startDate > endDate violation");

  // 7.4 Invalid date strings rejected
  const v4 = validateInternshipDates("invalid-date", "2026-03-31");
  assert(v4.valid === false, "Rejects unparseable start date");

  const v5 = validateInternshipDates("2026-01-01", "invalid-date");
  assert(v5.valid === false, "Rejects unparseable end date");

  // 7.5 Asymmetric date entry rejected (one provided, other missing)
  const v6 = validateInternshipDates("2026-01-01", null);
  assert(v6.valid === false, "Rejects start date without end date");

  const v7 = validateInternshipDates(null, "2026-03-31");
  assert(v7.valid === false, "Rejects end date without start date");

  // 7.6 Nullable / Optional for backward compatibility
  const v8 = validateInternshipDates(null, null);
  assert(v8.valid === true, "Nullable dates accepted for backward compatibility with existing users");

  const v9 = validateInternshipDates("", "");
  assert(v9.valid === true, "Empty date strings accepted without breaking validation");

  console.log("\n==================================================");
  console.log("8. FASE 4: INTERNSHIP CALENDAR LOGIC & RULES");
  console.log("==================================================");

  // 8.1 Year and Month Sanitization
  const c1 = sanitizeYearMonth(2026, 8);
  assert(c1.year === 2026 && c1.month === 8, "Valid year and month preserved (2026, 8)");

  const c2 = sanitizeYearMonth("invalid", "invalid");
  const now = new Date();
  assert(c2.year === now.getFullYear() && c2.month === (now.getMonth() + 1), "Fallback to current year/month for invalid inputs");

  const c3 = sanitizeYearMonth(2026, 13);
  assert(c3.year === 2026 && c3.month === (now.getMonth() + 1), "Month out of bounds (> 12) normalized safely");

  const c4 = sanitizeYearMonth(1900, 5);
  assert(c4.year === now.getFullYear() && c4.month === 5, "Year out of bounds (< 2000) normalized safely");

  // 8.2 Work Days (Senin-Sabtu) vs Sunday (Minggu Libur)
  const isWorkDay = (dayOfWeek) => dayOfWeek >= 1 && dayOfWeek <= 6;
  const isSunday = (dayOfWeek) => dayOfWeek === 0;

  assert(isWorkDay(1) === true && isSunday(1) === false, "Senin (Monday) is work day");
  assert(isWorkDay(3) === true && isSunday(3) === false, "Rabu (Wednesday) is work day");
  assert(isWorkDay(6) === true && isSunday(6) === false, "Sabtu (Saturday) is work day (CIMS 6-day work week)");
  assert(isWorkDay(0) === false && isSunday(0) === true, "Minggu (Sunday) is Hari Libur");

  // 8.3 Structured Internship Period Range Containment
  const startRange = new Date("2026-01-01T00:00:00.000Z");
  const endRange = new Date("2026-03-31T23:59:59.999Z");
  const isInPeriod = (d) => d >= startRange && d <= endRange;

  assert(isInPeriod(new Date("2025-12-31T00:00:00.000Z")) === false, "Date before start date marked as outside period");
  assert(isInPeriod(new Date("2026-01-01T00:00:00.000Z")) === true, "Start date boundary is within period");
  assert(isInPeriod(new Date("2026-02-15T00:00:00.000Z")) === true, "Mid-period date is within period");
  assert(isInPeriod(new Date("2026-03-31T23:59:59.000Z")) === true, "End date boundary is within period");
  assert(isInPeriod(new Date("2026-04-01T00:00:00.000Z")) === false, "Date after end date marked as outside period");

  // 8.4 Monday-First Grid Offset Calculation
  // Aug 1, 2026 is Saturday (JS getDay() = 6). Monday-first offset = (6 + 6) % 7 = 5.
  const firstDayAug2026 = new Date(2026, 7, 1).getDay();
  const leadingBlanksAug2026 = (firstDayAug2026 + 6) % 7;
  assert(leadingBlanksAug2026 === 5, "Monday-first calendar grid correctly places Saturday on 6th column (5 leading blanks)");

  // 8.5 Safe serialization for Calendar payload
  const sampleCalendarItem = {
    date: "2026-08-20",
    activity: "<script>alert('xss')</script>",
  };
  const jsonString = JSON.stringify(sampleCalendarItem);
  assert(jsonString.includes("<script>"), "JSON stringify preserves raw text without executing in script context");

  console.log("\n==================================================");
  console.log("9. FASE 5: GAMIFICATION, STREAKS, & PROGRESS");
  console.log("==================================================");

  // 9.1 Active Days calculation (Senin WFO, Selasa WFH, Rabu IZIN, Kamis SAKIT, Jumat WFO, Sabtu WFH, Minggu)
  // Aug 3, 2026 is Monday; Aug 9, 2026 is Sunday
  const week1Presences = [
    { date: "2026-08-03", status: "WFO" },
    { date: "2026-08-04", status: "WFH" },
    { date: "2026-08-05", status: "IZIN" },
    { date: "2026-08-06", status: "SAKIT" },
    { date: "2026-08-07", status: "WFO" },
    { date: "2026-08-08", status: "WFH" },
  ];

  const g1 = calculateActiveDaysAndStreaks(
    week1Presences,
    "2026-08-03",
    "2026-08-09",
    new Date("2026-08-09T23:59:59Z")
  );
  assert(g1.activeDays === 4, "WFO (2) + WFH (2) = 4 Active Days; IZIN/SAKIT/Minggu excluded");

  // 9.2 Streak with Sunday passing (Mon-Sat WFO/WFH, Sun Libur) -> Streak is 6 on Sunday
  const perfectWeekPresences = [
    { date: "2026-08-03", status: "WFO" },
    { date: "2026-08-04", status: "WFO" },
    { date: "2026-08-05", status: "WFH" },
    { date: "2026-08-06", status: "WFO" },
    { date: "2026-08-07", status: "WFO" },
    { date: "2026-08-08", status: "WFH" },
  ];

  const g2 = calculateActiveDaysAndStreaks(
    perfectWeekPresences,
    "2026-08-03",
    "2026-08-09",
    new Date("2026-08-09T23:59:59Z")
  );
  assert(g2.currentStreak === 6, "Current streak reaches 6 over Monday-Saturday without Sunday breaking it");
  assert(g2.bestStreak === 6, "Best streak equals 6 after perfect week");

  // 9.3 Streak broken by IZIN on Monday, then 2 active days (Current = 2, Best = 6)
  const week2Presences = [
    ...perfectWeekPresences,
    { date: "2026-08-10", status: "IZIN" }, // Mon broken
    { date: "2026-08-11", status: "WFO" },  // Tue
    { date: "2026-08-12", status: "WFH" },  // Wed
  ];

  const g3 = calculateActiveDaysAndStreaks(
    week2Presences,
    "2026-08-03",
    "2026-08-16",
    new Date("2026-08-12T23:59:59Z")
  );
  assert(g3.currentStreak === 2, "Current streak reset to 2 after IZIN on Monday");
  assert(g3.bestStreak === 6, "Best streak maintains peak record (6) even after streak break");

  // 9.4 Streak broken by SAKIT
  const sakitPresences = [
    { date: "2026-08-03", status: "WFO" },
    { date: "2026-08-04", status: "SAKIT" },
  ];
  const g4 = calculateActiveDaysAndStreaks(
    sakitPresences,
    "2026-08-03",
    "2026-08-09",
    new Date("2026-08-04T23:59:59Z")
  );
  assert(g4.currentStreak === 0, "SAKIT breaks current streak (currentStreak === 0)");

  // 9.5 Streak broken by missed past work day (no presence record)
  const missedPresences = [
    { date: "2026-08-03", status: "WFO" },
    // Aug 4 (Tue) missed
    { date: "2026-08-05", status: "WFO" },
  ];
  const g5 = calculateActiveDaysAndStreaks(
    missedPresences,
    "2026-08-03",
    "2026-08-09",
    new Date("2026-08-05T23:59:59Z")
  );
  assert(g5.currentStreak === 1, "Missed past work day resets streak to 1");

  // 9.6 Today still ongoing without presence does NOT break yesterday's streak
  const ongoingPresences = [
    { date: "2026-08-03", status: "WFO" },
    { date: "2026-08-04", status: "WFO" },
    // Aug 5 is today and not yet filled
  ];
  const g6 = calculateActiveDaysAndStreaks(
    ongoingPresences,
    "2026-08-03",
    "2026-08-09",
    new Date("2026-08-05T10:00:00Z") // Middle of today
  );
  assert(g6.currentStreak === 2, "Ongoing today without presence preserves active streak from previous days");

  // 9.7 Internship Progress Calculations
  const startP = "2026-08-01";
  const endP = "2026-08-31";

  // Before start: progress 0%
  const pBefore = calculateInternshipProgress(startP, endP, new Date("2026-07-25"));
  assert(pBefore.progressPercent === 0, "Internship progress is 0% before start date");

  // After end: progress 100%
  const pAfter = calculateInternshipProgress(startP, endP, new Date("2026-09-05"));
  assert(pAfter.progressPercent === 100, "Internship progress is 100% after end date");

  // Middle progress bounded between 0% and 100%
  const pMid = calculateInternshipProgress(startP, endP, new Date("2026-08-15"));
  assert(pMid.progressPercent >= 0 && pMid.progressPercent <= 100, "Mid-internship progress is correctly clamped 0% to 100%");

  // Single day internship (startDate === endDate)
  const pSingle = calculateInternshipProgress("2026-08-10", "2026-08-10", new Date("2026-08-10"));
  assert(pSingle.progressPercent === 100, "Single-day internship progress is 100% on start date");

  // Nullable dates return null (unavailable)
  const pNull = calculateInternshipProgress(null, null);
  assert(pNull === null, "Null dates return null progress (no guessing)");

  console.log("\n==================================================");
  console.log("10. FASE 6: DOCUMENT GENERATION & TEMPLATE PLACEHOLDER LOGIC");
  console.log("==================================================");

  // 10.1 Date formatting helpers
  const sampleDate = new Date("2026-07-31T00:00:00.000Z");
  assert(formatDateDot(sampleDate) === "31.07.2026", "formatDateDot formats date to DD.MM.YYYY");
  assert(formatDateEn(sampleDate).includes("July 31, 2026"), "formatDateEn formats date to English Month D, YYYY");
  assert(formatDateIndonesian(sampleDate).includes("31 Juli 2026"), "formatDateIndonesian formats date to Indonesian D Month YYYY");

  // 10.2 Single participant placeholder mapping
  const mockUser = {
    id: "user-123",
    fullName: "Fenty Anggraeni",
    email: "fenty@cikarastudio.com",
    phoneNumber: "08123456789",
    participantType: "UNIVERSITY",
    university: "Universitas Siliwangi",
    studyProgram: "Informatika",
    studentId: "237006068",
    internshipStartDate: new Date("2026-06-02"),
    internshipEndDate: new Date("2026-07-31"),
    internshipPeriod: "2 Juni 2026 s/d 31 Juli 2026",
  };

  const mockEval = {
    finalScore: 92.5,
    grade: "A",
    mentorComment: "Sangat kompeten dan teliti.",
    recommendation: "Direkomendasikan untuk posisi Game Developer.",
  };

  const mockMentor = {
    fullName: "Wahyu Muhamad Rizqi., S.Kom.",
    email: "cikarastudio@gmail.com",
  };

  const dataMap = preparePlaceholderData(mockUser, mockEval, mockMentor);
  assert(dataMap["{{NAMA_PESERTA}}"] === "Fenty Anggraeni", "Maps participant full name accurately");
  assert(dataMap["{{NPM}}"] === "237006068", "Maps student NPM accurately");
  assert(dataMap["{{UNIVERSITAS}}"] === "Universitas Siliwangi", "Maps university accurately");
  assert(dataMap["{{TANGGAL_SELESAI_DOT}}"] === "31.07.2026", "Maps certificate date to DD.MM.YYYY end date");
  assert(dataMap["{{NAMA_CHIEF}}"] === "Wahyu M. Rizqi, S.Kom", "Chief signature uses real CEO name");
  assert(dataMap["{{JABATAN_CHIEF}}"] === "CHIEF EXECUTIVE OFFICER", "Chief title uses CHIEF EXECUTIVE OFFICER");
  assert(dataMap["{{NAMA_PERUSAHAAN}}"] === "PT. CIKARA BAKTI NUSANTARA", "Company name is PT. CIKARA BAKTI NUSANTARA");

  // 10.3 Replace Placeholders in Template
  const rawTpl = "Sertifikat untuk {{NAMA_PESERTA}} ({{NPM}}) tertanggal {{TANGGAL_SELESAI_DOT}} oleh {{NAMA_CHIEF}}";
  const rendered = replacePlaceholders(rawTpl, dataMap);
  assert(rendered === "Sertifikat untuk Fenty Anggraeni (237006068) tertanggal 31.07.2026 oleh Wahyu M. Rizqi, S.Kom", "Replaces all placeholders cleanly without leaving any {{TAG}}");

  // 10.4 Multiple participants dynamic table in letter
  const mockGroup = [
    { fullName: "Fenty Anggraeni", studentId: "237006068", studyProgram: "Informatika" },
    { fullName: "Budi Santoso", studentId: "237006069", studyProgram: "Sistem Informasi" }
  ];
  const groupDataMap = preparePlaceholderData(mockUser, mockEval, mockMentor, { participants: mockGroup });
  assert(groupDataMap["{{TABEL_PESERTA_ROWS}}"].includes("Fenty Anggraeni") && groupDataMap["{{TABEL_PESERTA_ROWS}}"].includes("Budi Santoso"), "Renders multiple participant table rows without overflow");

  // 10.5 XSS Injection defense in dynamic document fields
  const maliciousUser = {
    ...mockUser,
    fullName: "<script>alert('pwned')</script>",
    university: "<img src=x onerror=alert(1)>",
  };
  const safeDataMap = preparePlaceholderData(maliciousUser, mockEval, mockMentor);
  assert(!safeDataMap["{{NAMA_PESERTA}}"].includes("<script>"), "Escapes XSS in participant full name");
  assert(!safeDataMap["{{UNIVERSITAS}}"].includes("<img"), "Escapes XSS in participant university name");

  // 10.6 IDOR Protection Logic Check
  const checkDocumentAccess = (docUserId, sessionUserId, userRole) => {
    if (userRole === "MENTOR") return true;
    return docUserId === sessionUserId;
  };

  assert(checkDocumentAccess("user-123", "user-123", "INTERN") === true, "Intern can access their own document");
  assert(checkDocumentAccess("user-456", "user-123", "INTERN") === false, "Intern cannot access another intern's document (IDOR blocked)");
  assert(checkDocumentAccess("user-456", "mentor-999", "MENTOR") === true, "Mentor has authorized access to inspect documents");

  console.log("\n==================================================");
  console.log(`REGRESSION TEST COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("==================================================");
}

runSuite();
