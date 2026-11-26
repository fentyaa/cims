/**
 * Seed Script - Internship Management System (IMS) / CIMS
 * 
 * Data Dummy Realistis Wilayah Tasikmalaya & Ciamis
 * dengan Periode Magang yang Beragam, Proporsional & Sinkron:
 * 
 * 1. Default Mentor: mentor.cims@gmail.com (Password: Mentor123!)
 * 
 * 2. Keragaman Periode & Status Magang:
 *    - PESERTA LULUS (ARCHIVED / ALUMNI):
 *      * Maya Putri (SMKN 1 Ciamis): 1 Juni 2026 - 31 Agustus 2026 (3 Bulan PKL).
 *        Nilai: PUBLISHED (92.5 A) & Surat Keterangan / Sertifikat Magang TERBIT.
 *    - PESERTA AKTIF (ACTIVE) - Periode Beragam:
 *      * Fenty Anggraeni (UNSIL)     : 1 Agustus 2026 - 30 November 2026 (4 Bulan Magang Industri)
 *      * Ahmad Fauzi (UNSIL)         : 1 Juli 2026 - 31 Desember 2026 (6 Bulan Program MBKM)
 *      * Siti Nurhaliza (UNIGAL)     : 1 September 2026 - 30 November 2026 (3 Bulan Kerja Praktik)
 *      * Rizky Pratama (SMKN 1)      : 1 September 2026 - 31 Desember 2026 (4 Bulan PKL SMK Semester Ganjil)
 *      * Dewi Lestari (UPI)          : 15 Agustus 2026 - 15 Desember 2026 (4 Bulan Magang Desain Kreatif)
 *      * Bayu Nugroho (SMKN 2)       : 1 Juli 2026 - 30 November 2026 (5 Bulan PKL Industri SMK)
 *      * Anisa Rahmawati (BSI)       : 1 Oktober 2026 - 31 Desember 2026 (3 Bulan Magang Reguler)
 *      * Dimas Arya Saputra (SMKN 4) : 15 Juli 2026 - 30 November 2026 (4.5 Bulan PKL SMK)
 *    - CALON PESERTA BARU (PENDING APPROVAL) - Periode Beragam:
 *      * Kevin Sanjaya (UNPER)       : 1 Desember 2026 - 28 Februari 2027 (3 Bulan)
 *      * Dini Nurlaila (SMKN 1)      : 15 Desember 2026 - 15 April 2027 (4 Bulan PKL Semester Genap)
 *    - PENDAFTARAN DITOLAK (REJECTED):
 *      * Fajar Ramadhan (STMIK DCI)  : 1 Januari 2027 - 31 Maret 2027 (3 Bulan, ditolak verifikasi berkas)
 * 
 * 3. Logika Presensi & Logbook yang Menyesuaikan Tanggal Mulai Masing-Masing:
 *    - Presensi peserta HANYA tercatat sejak tanggal mulai magang masing-masing s.d. 26 November 2026.
 *    - Siswa SMK: 100% WFO di kantor (tidak pernah WFH).
 *    - Mahasiswa: Kombinasi WFO dan WFH (maks. 2 hari WFH/minggu).
 *    - Hari Libur Resmi / Minggu: Libur dan tidak ada presensi.
 *    - Hari IZIN / SAKIT: TIDAK MENGISI logbook.
 *    - Status Logbook:
 *      * Tanggal lampau (s.d. 23 Nov 2026): REVIEWED dengan catatan mentor.
 *      * Tanggal terkini (24, 25, 26 Nov 2026): PENDING menunggu review mentor.
 */

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import prisma from "./config/database.js";
import { checkRedDate } from "./utils/holidayHelper.js";

const SALT_ROUNDS = 10;

// Helper membuat tanggal UTC midnight (00:00:00.000)
const createDate = (year, month, day) => {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

export async function runSeed() {
  console.log("🌱 Memulai proses seeding data CIMS (Periode Magang Beragam & Realistis)...\n");

  // ============================================================
  // 0. RESET DATA LAMA (RESET BERSIH)
  // ============================================================
  console.log("🧹 Mereset data lama...");
  await prisma.presence.deleteMany();
  await prisma.logbook.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.announcement.deleteMany();

  // Putus relasi mentor-mentee sebelum delete user
  await prisma.user.updateMany({
    data: { mentorId: null },
  });

  // Hapus semua akun intern lama agar data bersih
  await prisma.user.deleteMany({
    where: { role: "INTERN" },
  });

  // Hapus akun mentor lama atau akun berdomain @cims.com
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: "mentor@cims.com" },
        { email: { contains: "@cims.com" } },
      ],
    },
  });
  console.log("   ✅ Data lama berhasil dibersihkan.\n");

  // ============================================================
  // 1. DEFAULT MENTOR ACCOUNT (@gmail.com)
  // ============================================================
  const mentorEmail = process.env.DEFAULT_MENTOR_EMAIL || "mentor.cims@gmail.com";
  const mentorPassword = process.env.DEFAULT_MENTOR_PASSWORD || "Mentor123!";
  const mentorName = process.env.DEFAULT_MENTOR_NAME || "Admin Mentor";
  const mentorPhone = process.env.DEFAULT_MENTOR_PHONE || "081234567890";

  const hashedMentorPassword = await bcrypt.hash(mentorPassword, SALT_ROUNDS);

  let mentor = await prisma.user.findUnique({
    where: { email: mentorEmail },
  });

  if (mentor) {
    mentor = await prisma.user.update({
      where: { email: mentorEmail },
      data: {
        fullName: mentorName,
        phoneNumber: mentorPhone,
        password: hashedMentorPassword,
        role: "MENTOR",
        status: "ACTIVE",
      },
    });
    console.log(`✅ Mentor terverifikasi/diperbarui: ${mentor.email}`);
  } else {
    mentor = await prisma.user.create({
      data: {
        fullName: mentorName,
        email: mentorEmail,
        phoneNumber: mentorPhone,
        password: hashedMentorPassword,
        role: "MENTOR",
        status: "ACTIVE",
        internshipPeriod: "-",
      },
    });
    console.log(`✅ Mentor baru dibuat: ${mentor.email} (Password: ${mentorPassword})`);
  }

  // Hash password standar untuk seluruh intern: Intern123!
  const hashedInternPassword = await bcrypt.hash("Intern123!", SALT_ROUNDS);

  // ============================================================
  // 2. DAFTAR PESERTA DENGAN PERIODE MAGANG YANG SANGAT BERAGAM
  // ============================================================
  const dummyInterns = [
    // ------------------------------------------------------------
    // A. PESERTA AKTIF (ACTIVE: Tanggal Mulai & Durasi Beragam)
    // ------------------------------------------------------------
    {
      fullName: "Fenty Anggraeni",
      email: "fenty.anggraeni@gmail.com",
      phoneNumber: "081234567800",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Siliwangi (UNSIL) Tasikmalaya",
      studyProgram: "Informatika",
      studentId: "237006068",
      internshipPeriod: "1 Agustus 2026 - 30 November 2026", // 4 Bulan
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 11, 30),
      mentorId: mentor.id,
      evaluation: {
        discipline: 95,
        responsibility: 94,
        communication: 93,
        teamwork: 92,
        initiative: 95,
        technicalSkill: 95,
        finalScore: 94.0,
        grade: "A",
        mentorComment: "Fenty menunjukkan dedikasi, inisiatif, dan kapabilitas teknis luar biasa dalam perancangan serta implementasi sistem web CIMS di Cikara Studio.",
        recommendation: "Sangat direkomendasikan untuk posisi Junior Full Stack Web Developer.",
        status: "DRAFT", // DRAFT: Menjelang akhir periode, belum dipublikasikan
      },
    },
    {
      fullName: "Ahmad Fauzi",
      email: "ahmad.fauzi@gmail.com",
      phoneNumber: "081234567801",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Siliwangi (UNSIL) Tasikmalaya",
      studyProgram: "Informatika",
      studentId: "217006001",
      internshipPeriod: "1 Juli 2026 - 31 Desember 2026", // 6 Bulan (Program MBKM)
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 12, 31),
      mentorId: mentor.id,
      // Belum dinilai: Masih aktif sampai akhir Desember
    },
    {
      fullName: "Siti Nurhaliza",
      email: "siti.nurhaliza@gmail.com",
      phoneNumber: "081234567802",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Galuh (UNIGAL) Ciamis",
      studyProgram: "Sistem Informasi",
      studentId: "210321045",
      internshipPeriod: "1 September 2026 - 30 November 2026", // 3 Bulan (Kerja Praktik Reguler)
      internshipStartDate: createDate(2026, 9, 1),
      internshipEndDate: createDate(2026, 11, 30),
      mentorId: mentor.id,
      // Belum dinilai
    },
    {
      fullName: "Rizky Pratama",
      email: "rizky.pratama@gmail.com",
      phoneNumber: "081234567803",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 1 Tasikmalaya",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 1",
      internshipPeriod: "1 September 2026 - 31 Desember 2026", // 4 Bulan (PKL Semester Ganjil)
      internshipStartDate: createDate(2026, 9, 1),
      internshipEndDate: createDate(2026, 12, 31),
      mentorId: mentor.id,
      // Belum dinilai
    },
    {
      fullName: "Dewi Lestari",
      email: "dewi.lestari@gmail.com",
      phoneNumber: "081234567804",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Pendidikan Indonesia (UPI) Kampus Tasikmalaya",
      studyProgram: "Desain Komunikasi Visual",
      studentId: "2204901",
      internshipPeriod: "15 Agustus 2026 - 15 Desember 2026", // 4 Bulan (Magang Desain Kreatif)
      internshipStartDate: createDate(2026, 8, 15),
      internshipEndDate: createDate(2026, 12, 15),
      mentorId: mentor.id,
      // Belum dinilai
    },
    {
      fullName: "Bayu Nugroho",
      email: "bayu.nugroho@gmail.com",
      phoneNumber: "081234567805",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 2 Ciamis",
      major: "Teknik Komputer dan Jaringan",
      classGrade: "XII TKJ 2",
      internshipPeriod: "1 Juli 2026 - 30 November 2026", // 5 Bulan (PKL Industri Panjang)
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 11, 30),
      mentorId: mentor.id,
      // Belum dinilai
    },
    {
      fullName: "Anisa Rahmawati",
      email: "anisa.rahmawati@gmail.com",
      phoneNumber: "081234567806",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas BSI Kampus Tasikmalaya",
      studyProgram: "Teknologi Informasi",
      studentId: "12210050",
      internshipPeriod: "1 Oktober 2026 - 31 Desember 2026", // 3 Bulan (Magang Semester Ganjil)
      internshipStartDate: createDate(2026, 10, 1),
      internshipEndDate: createDate(2026, 12, 31),
      mentorId: mentor.id,
      // Belum dinilai
    },
    {
      fullName: "Dimas Arya Saputra",
      email: "dimas.arya@gmail.com",
      phoneNumber: "081234567807",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 4 Tasikmalaya",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 2",
      internshipPeriod: "15 Juli 2026 - 30 November 2026", // 4.5 Bulan (PKL SMK)
      internshipStartDate: createDate(2026, 7, 15),
      internshipEndDate: createDate(2026, 11, 30),
      mentorId: mentor.id,
      // Belum dinilai
    },

    // ------------------------------------------------------------
    // B. CALON PESERTA BARU (PENDING APPROVAL: Periode Masa Depan Beragam)
    // ------------------------------------------------------------
    {
      fullName: "Kevin Sanjaya",
      email: "kevin.sanjaya@gmail.com",
      phoneNumber: "081234567808",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "PENDING",
      university: "Universitas Perjuangan Tasikmalaya (UNPER)",
      studyProgram: "Teknik Informatika",
      studentId: "2301987654",
      internshipPeriod: "1 Desember 2026 - 28 Februari 2027", // 3 Bulan
      internshipStartDate: createDate(2026, 12, 1),
      internshipEndDate: createDate(2027, 2, 28),
      mentorId: mentor.id,
    },
    {
      fullName: "Dini Nurlaila",
      email: "dini.nurlaila@gmail.com",
      phoneNumber: "081234567811",
      role: "INTERN",
      participantType: "SMK",
      status: "PENDING",
      schoolName: "SMKN 1 Kawali Ciamis",
      major: "Pengembangan Perangkat Lunak dan Gim",
      classGrade: "XII PPLG 2",
      internshipPeriod: "15 Desember 2026 - 15 April 2027", // 4 Bulan PKL Semester Genap
      internshipStartDate: createDate(2026, 12, 15),
      internshipEndDate: createDate(2027, 4, 15),
      mentorId: mentor.id,
    },

    // ------------------------------------------------------------
    // C. PESERTA LULUS (ARCHIVED / ALUMNI: Periode Masa Lampau)
    // ------------------------------------------------------------
    {
      fullName: "Maya Putri",
      email: "maya.putri@gmail.com",
      phoneNumber: "081234567809",
      role: "INTERN",
      participantType: "SMK",
      status: "ARCHIVED",
      schoolName: "SMKN 1 Ciamis",
      major: "Pengembangan Perangkat Lunak dan Gim",
      classGrade: "XII PPLG 1",
      internshipPeriod: "1 Juni 2026 - 31 Agustus 2026", // 3 Bulan PKL Musim Panas (Sudah Selesai)
      internshipStartDate: createDate(2026, 6, 1),
      internshipEndDate: createDate(2026, 8, 31),
      mentorId: mentor.id,
      evaluation: {
        discipline: 92,
        responsibility: 93,
        communication: 90,
        teamwork: 94,
        initiative: 91,
        technicalSkill: 95,
        finalScore: 92.5,
        grade: "A",
        mentorComment: "Maya telah menyelesaikan seluruh periode magang dengan predikat sangat baik dan berhasil menyelesaikan modul antarmuka CIMS.",
        recommendation: "Sangat direkomendasikan untuk berkarier sebagai Frontend Web Designer atau melanjutkan studi sarjana komputer.",
        status: "PUBLISHED",
        publishedAt: createDate(2026, 8, 31),
      },
    },

    // ------------------------------------------------------------
    // D. PENDAFTARAN DITOLAK (REJECTED: Periode Masa Depan)
    // ------------------------------------------------------------
    {
      fullName: "Fajar Ramadhan",
      email: "fajar.ramadhan@gmail.com",
      phoneNumber: "081234567810",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "REJECTED",
      university: "STMIK DCI Tasikmalaya",
      studyProgram: "Teknik Informatika",
      studentId: "22110088",
      internshipPeriod: "1 Januari 2027 - 31 Maret 2027", // 3 Bulan (Ditolak saat pendaftaran)
      internshipStartDate: createDate(2027, 1, 1),
      internshipEndDate: createDate(2027, 3, 31),
      mentorId: mentor.id,
    },
  ];

  console.log("\n📦 Menyiapkan akun pengguna CIMS dengan periode magang yang beragam...");

  const createdInternMap = new Map();

  for (const item of dummyInterns) {
    const { evaluation, ...userData } = item;
    userData.password = hashedInternPassword;

    const savedUser = await prisma.user.create({
      data: userData,
    });
    console.log(`   ✨ Dibuat: ${savedUser.fullName.padEnd(20)} [${savedUser.status.padEnd(8)}] Periode: ${savedUser.internshipPeriod}`);

    createdInternMap.set(savedUser.email, savedUser);

    if (evaluation) {
      await prisma.evaluation.create({
        data: {
          ...evaluation,
          userId: savedUser.id,
          mentorId: mentor.id,
        },
      });
    }
  }

  // ============================================================
  // 3. SEED PRESENSI SINKRON DENGAN TANGGAL MULAI MASING-MASING
  // ============================================================
  console.log("\n📅 Menyiapkan riwayat presensi harian sesuai periode masing-masing s.d. 26 November 2026...");

  const targetEndDate = createDate(2026, 11, 26);

  // Buat kalender hari kerja resmi dari tanggal paling awal peserta aktif (1 Juli 2026) s.d. 26 November 2026
  const masterWorkDays = [];
  const walkDate = createDate(2026, 7, 1);

  while (walkDate <= targetEndDate) {
    const redInfo = checkRedDate(walkDate);
    if (!redInfo.isRedDate) {
      masterWorkDays.push(new Date(Date.UTC(walkDate.getFullYear(), walkDate.getMonth(), walkDate.getDate(), 0, 0, 0, 0)));
    }
    walkDate.setDate(walkDate.getDate() + 1);
  }

  masterWorkDays.sort((a, b) => a.getTime() - b.getTime());
  console.log(`   🗓️ Master hari kerja resmi (1 Juli - 26 November 2026): ${masterWorkDays.length} hari.`);

  // Konfigurasi aktivitas tanggal 24, 25, 26 November 2026
  const date24Nov = createDate(2026, 11, 24).getTime();
  const date25Nov = createDate(2026, 11, 25).getTime();
  const date26Nov = createDate(2026, 11, 26).getTime();

  const specialDayActivities = {
    "fenty.anggraeni@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir tepat waktu di Cikara Studio menyelesaikan pengujian integrasi akhir sistem CIMS" },
      [date25Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio melakukan asistensi dokumen dan evaluasi bersama mentor" },
      [date26Nov]: { status: "WFO", notes: "Hadir tepat waktu mempresentasikan demonstrasi fitur lengkap CIMS kepada tim mentor" },
    },
    "ahmad.fauzi@gmail.com": {
      [date24Nov]: { status: "WFH", notes: "Bekerja dari rumah (WFH) optimasi query pooler database PostgreSQL" },
      [date25Nov]: { status: "WFH", notes: "Bekerja dari rumah (WFH) code review modul ekspor laporan CSV" },
      [date26Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio untuk sinkronisasi deployment dan backup database" },
    },
    "siti.nurhaliza@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio menyusun panduan penggunaan sistem (User Guide)" },
      [date25Nov]: { status: "IZIN", notes: "Izin mengikuti seminar akademik di kampus UNIGAL Ciamis (surat izin terlampir)" },
      [date26Nov]: { status: "WFH", notes: "Bekerja dari rumah (WFH) menyusun draf laporan akhir magang bab analisis sistem" },
    },
    "rizky.pratama@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio mengerjakan slicing komponen antarmuka" },
      [date25Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio implementasi modal dialog Bootstrap" },
      [date26Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio serah terima tugas slicing profil peserta" },
    },
    "dewi.lestari@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio finalisasi mockup aset grafis aplikasi" },
      [date25Nov]: { status: "SAKIT", notes: "Sakit demam dan flu, istirahat di rumah sesuai surat keterangan dokter" },
      [date26Nov]: { status: "WFO", notes: "Hadir di kantor studio setelah pulih, melanjutkan perapian ikon UI" },
    },
    "bayu.nugroho@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio maintenance jaringan lokal" },
      [date25Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio konfigurasi router dan monitoring server" },
      [date26Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio pengecekan akhir stabilitas koneksi jaringan" },
    },
    "anisa.rahmawati@gmail.com": {
      [date24Nov]: { status: "WFH", notes: "Bekerja dari rumah (WFH) menjalankan skenario pengujian black-box" },
      [date25Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio mendokumentasikan temuan uji fungsional" },
      [date26Nov]: { status: "IZIN", notes: "Izin pengurusan berkas administrasi dan yudisium di kampus BSI Tasikmalaya" },
    },
    "dimas.arya@gmail.com": {
      [date24Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio testing responsivitas layout mobile" },
      [date25Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio penyesuaian CSS dark mode" },
      [date26Nov]: { status: "WFO", notes: "Hadir di kantor Cikara Studio finalisasi modul kalender kegiatan" },
    },
  };

  const activeInterns = dummyInterns.filter((i) => i.status === "ACTIVE");
  const allPresencesToCreate = [];

  for (const internDef of activeInterns) {
    const internUser = createdInternMap.get(internDef.email);
    if (!internUser) continue;

    const isSmk = internDef.participantType === "SMK";
    const specialMap = specialDayActivities[internDef.email] || {};
    const startDateMs = internDef.internshipStartDate.getTime();

    // Saring HANYA hari kerja yang >= tanggal mulai magang peserta bersangkutan
    const internWorkDays = masterWorkDays.filter((d) => d.getTime() >= startDateMs);
    const internWorkDaysCount = internWorkDays.length;

    for (let idx = 0; idx < internWorkDaysCount; idx++) {
      const date = internWorkDays[idx];
      const dateTime = date.getTime();

      let status = "WFO";
      let notes = isSmk
        ? "Hadir di kantor Cikara Studio melaksanakan praktik kerja lapangan"
        : "Hadir tepat waktu di kantor Cikara Studio";

      if (specialMap[dateTime]) {
        status = specialMap[dateTime].status;
        notes = specialMap[dateTime].notes;
      } else {
        const daysFromEnd = internWorkDaysCount - 1 - idx;
        if (!isSmk && daysFromEnd % 4 === 0) {
          status = "WFH";
          notes = "Bekerja dari rumah (WFH) mengerjakan sprint tugas projek CIMS";
        } else if (daysFromEnd === 18 && internDef.email === "siti.nurhaliza@gmail.com") {
          status = "IZIN";
          notes = "Izin bimbingan akademik di kampus UNIGAL Ciamis";
        } else if (daysFromEnd === 25 && internDef.email === "bayu.nugroho@gmail.com") {
          status = "SAKIT";
          notes = "Sakit radang tenggorokan ringan, istirahat di rumah";
        } else if (daysFromEnd === 32 && internDef.email === "dewi.lestari@gmail.com") {
          status = "IZIN";
          notes = "Izin asistensi pameran karya DKV UPI Tasikmalaya";
        } else {
          status = "WFO";
          notes = isSmk
            ? "Hadir di kantor Cikara Studio melaksanakan praktik kerja lapangan"
            : "Hadir tepat waktu di kantor Cikara Studio";
        }
      }

      // Validasi ketat aturan CIMS: Siswa SMK tidak boleh WFH
      if (isSmk && status === "WFH") {
        status = "WFO";
        notes = "Hadir di kantor Cikara Studio melaksanakan praktik kerja lapangan";
      }

      allPresencesToCreate.push({
        userId: internUser.id,
        date,
        status,
        notes,
      });
    }

    console.log(`      -> ${internDef.fullName.padEnd(20)}: ${internWorkDaysCount} hari presensi (Mulai: ${internDef.internshipStartDate.toISOString().slice(0, 10)})`);
  }

  // Presensi Maya Putri (Lulus / ARCHIVED) Juni - Agustus 2026 (100% WFO SMK)
  const mayaUser = createdInternMap.get("maya.putri@gmail.com");
  if (mayaUser) {
    const mayaWalk = createDate(2026, 6, 1);
    const mayaEnd = createDate(2026, 8, 31);
    let mayaDaysCount = 0;
    while (mayaWalk <= mayaEnd) {
      const redInfo = checkRedDate(mayaWalk);
      if (!redInfo.isRedDate) {
        allPresencesToCreate.push({
          userId: mayaUser.id,
          date: new Date(Date.UTC(mayaWalk.getFullYear(), mayaWalk.getMonth(), mayaWalk.getDate(), 0, 0, 0, 0)),
          status: "WFO",
          notes: "Hadir di kantor Cikara Studio melaksanakan PKL",
        });
        mayaDaysCount++;
      }
      mayaWalk.setDate(mayaWalk.getDate() + 1);
    }
    console.log(`      -> ${"Maya Putri (Alumni)".padEnd(20)}: ${mayaDaysCount} hari presensi (Periode Juni-Agustus 2026)`);
  }

  if (allPresencesToCreate.length > 0) {
    await prisma.presence.createMany({
      data: allPresencesToCreate,
      skipDuplicates: true,
    });
  }
  console.log(`   ✅ Total riwayat presensi proporsional: ${allPresencesToCreate.length} record.`);

  // ============================================================
  // 4. SEED LOGBOOK HARIAN SINKRON (14 HARI KERJA TERAKHIR)
  // ============================================================
  console.log("\n📝 Menyiapkan catatan logbook harian peserta...");

  const logbookActivityBank = [
    {
      activity: "Setup project environment CIMS, konfigurasi Prisma ORM, dan pengujian koneksi basis data PostgreSQL.",
      obstacle: "Koneksi database cloud memerlukan penyesuaian query parameter SSL mode.",
      nextPlan: "Mengimplementasikan middleware otentikasi login berbasis Express Session.",
      mentorComment: "Bagus, konfigurasi dependensi dan environment lokal sudah rapi.",
    },
    {
      activity: "Pengembangan middleware keamanan Express: Helmet header, CSRF protection, dan rate limiter rute autentikasi.",
      obstacle: "Sinkronisasi token CSRF dengan sesi Express memerlukan penanganan khusus pada browser.",
      nextPlan: "Membuat endpoint registrasi dan validasi input data mahasiswa magang dan siswa SMK.",
      mentorComment: "Sangat baik, aspek keamanan sistem sudah diperhatikan sejak awal.",
    },
    {
      activity: "Slicing antarmuka responsif Dashboard CIMS menggunakan Bootstrap 5 dan penyesuaian palet warna institusi.",
      obstacle: "Penyelarasan kontras warna tabel pada dark mode memerlukan penyesuaian custom CSS.",
      nextPlan: "Mengintegrasikan widget kalender presensi bulanan dan kartu statistik kehadiran.",
      mentorComment: "Desain rapi, konsisten, dan nyaman dilihat di berbagai perangkat.",
    },
    {
      activity: "Implementasi modul presensi harian mandiri dengan deteksi otomatis hari libur nasional dan pembatasan WFH.",
      obstacle: "Validasi jam operasional kantor dan pencegahan presensi ganda pada tanggal yang sama.",
      nextPlan: "Membuat rekapitulasi kehadiran dan grafik status kehadiran untuk akun mentor.",
      mentorComment: "Logika validasi hari libur dan aturan WFH mahasiswa sudah berjalan tepat.",
    },
    {
      activity: "Penyusunan modul review logbook mentor dengan fitur penyaringan status, pencarian nama, dan input feedback.",
      obstacle: "Pengaturan pagination pada daftar entri logbook peserta yang bertambah banyak.",
      nextPlan: "Menambahkan indikator badge status PENDING dan REVIEWED.",
      mentorComment: "Alur pemeriksaan logbook intuitif dan sangat memudahkan mentor.",
    },
    {
      activity: "Implementasi lembar evaluasi capaian kompetensi magang dengan 6 aspek penilaian terstandar industri.",
      obstacle: "Kalkulasi nilai akhir desimal dan konversi otomatis predikat nilai A s.d. E.",
      nextPlan: "Menyediakan modul publikasi nilai agar hasil evaluasi dapat dilihat oleh peserta.",
      mentorComment: "Rubrik penilaian objektif dan sesuai standar evaluasi Cikara Studio.",
    },
    {
      activity: "Penyusunan modul Laporan Perkembangan Magang dengan agregasi data presensi, logbook, dan predikat nilai.",
      obstacle: "Optimasi query analitik multi-tabel Prisma ORM agar response time halaman tetap cepat.",
      nextPlan: "Menambahkan fitur ekspor rekapitulasi data magang ke format file CSV.",
      mentorComment: "Fitur rekapitulasi sangat bermanfaat untuk dokumentasi laporan ke kampus.",
    },
    {
      activity: "Refactoring query database, perapian rute modular, dan pengujian performa endpoint dashboard peserta.",
      obstacle: "Penyesuaian indexing pada kolom date dan userId di tabel presensi PostgreSQL.",
      nextPlan: "Melakukan pengujian black-box menyeluruh pada seluruh skenario fungsional.",
      mentorComment: "Kerja bagus, waktu pemuatan halaman dasbor kini meningkat signifikan.",
    },
    {
      activity: "Pengembangan fitur gamifikasi: perhitungan streak kehadiran aktif dan badge apresiasi kedisiplinan peserta.",
      obstacle: "Perhitungan streak yang tidak boleh terputus oleh hari libur nasional dan hari Minggu.",
      nextPlan: "Menampilkan widget lencana penghargaan pada halaman profil peserta magang.",
      mentorComment: "Inovasi gamifikasi yang sangat menarik untuk memotivasi keaktifan peserta.",
    },
    {
      activity: "Penyusunan dokumentasi teknis sistem CIMS dan penyesuaian diagram alur UML untuk laporan kerja praktik.",
      obstacle: "Penyelarasan diagram Use Case dan Activity Diagram dengan alur implementasi aktual.",
      nextPlan: "Melakukan asistensi bab 5 perancangan sistem bersama mentor pembimbing lapangan.",
      mentorComment: "Dokumentasi diagram tersusun komprehensif dan mudah dipahami.",
    },
  ];

  // 14 hari kerja terakhir master (Bulan November 2026 s.d. 26 November 2026)
  const recentLogbookDays = masterWorkDays.slice(-14);
  const allLogbooksToCreate = [];

  for (const internDef of activeInterns) {
    const internUser = createdInternMap.get(internDef.email);
    if (!internUser) continue;

    const specialMap = specialDayActivities[internDef.email] || {};

    for (let idx = 0; idx < recentLogbookDays.length; idx++) {
      const logDate = recentLogbookDays[idx];
      const logDateTime = logDate.getTime();

      // Aturan CIMS: Hari Izin atau Sakit TIDAK ADA LOGBOOK
      const specialStatus = specialMap[logDateTime]?.status;
      if (specialStatus === "IZIN" || specialStatus === "SAKIT") {
        continue;
      }

      let isPending = false;
      let activityText = "";
      let obstacleText = "";
      let nextPlanText = "";
      let mentorComment = null;

      if (logDateTime === date26Nov) {
        // 26 November 2026: PENDING REVIEW
        isPending = true;
        activityText = "Finalisasi implementasi sprint akhir projek CIMS, pengujian modul terintegrasi, dan demonstrasi hasil implementasi kepada mentor.";
        obstacleText = "Tidak ada kendala berarti, seluruh fungsi siap diserahkan.";
        nextPlanText = "Evaluasi akhir bersama pembimbing lapangan Cikara Studio.";
      } else if (logDateTime === date25Nov) {
        // 25 November 2026: PENDING REVIEW
        isPending = true;
        activityText = "Penyusunan rekapitulasi data kehadiran dan perapian antarmuka dasbor sebelum evaluasi akhir.";
        obstacleText = "Sinkronisasi filter periode tanggal pada modul kalender.";
        nextPlanText = "Melakukan review kelengkapan data bersama mentor.";
      } else if (logDateTime === date24Nov) {
        // 24 November 2026: Fenty & Bayu PENDING, sisanya REVIEWED
        if (internDef.email === "fenty.anggraeni@gmail.com" || internDef.email === "bayu.nugroho@gmail.com") {
          isPending = true;
          activityText = "Pengujian menyeluruh integrasi modul presensi dan logbook serta verifikasi token CSRF.";
          obstacleText = "Memastikan keamanan endpoint berjalan fail-closed.";
          nextPlanText = "Asistensi hasil pengujian dengan mentor pembimbing.";
        } else {
          isPending = false;
          const bankItem = logbookActivityBank[idx % logbookActivityBank.length];
          activityText = bankItem.activity;
          obstacleText = bankItem.obstacle;
          nextPlanText = bankItem.nextPlan;
          mentorComment = bankItem.mentorComment;
        }
      } else {
        // Hari-hari lampau: REVIEWED
        isPending = false;
        const bankItem = logbookActivityBank[idx % logbookActivityBank.length];
        activityText = bankItem.activity;
        obstacleText = bankItem.obstacle;
        nextPlanText = bankItem.nextPlan;
        mentorComment = bankItem.mentorComment;
      }

      allLogbooksToCreate.push({
        userId: internUser.id,
        date: logDate,
        activity: activityText,
        obstacle: obstacleText,
        nextPlan: nextPlanText,
        mentorComment: isPending ? null : mentorComment,
        status: isPending ? "PENDING" : "REVIEWED",
      });
    }
  }

  // Tambahkan logbook reviewed untuk Maya Putri (Alumni)
  if (mayaUser) {
    const mayaLogbookDates = [
      createDate(2026, 8, 25),
      createDate(2026, 8, 26),
      createDate(2026, 8, 27),
      createDate(2026, 8, 28),
      createDate(2026, 8, 29),
    ];
    for (const mDate of mayaLogbookDates) {
      allLogbooksToCreate.push({
        userId: mayaUser.id,
        date: mDate,
        activity: "Penyelesaian dan serah terima modul laporan antarmuka CIMS.",
        obstacle: "Tidak ada kendala.",
        nextPlan: "Penyusunan berkas kelulusan magang.",
        mentorComment: "Kerja yang sangat baik dan tuntas.",
        status: "REVIEWED",
      });
    }
  }

  if (allLogbooksToCreate.length > 0) {
    await prisma.logbook.createMany({
      data: allLogbooksToCreate,
      skipDuplicates: true,
    });
  }

  const pendingLogbookCount = allLogbooksToCreate.filter((l) => l.status === "PENDING").length;
  const reviewedLogbookCount = allLogbooksToCreate.filter((l) => l.status === "REVIEWED").length;
  console.log(`   ✅ Total logbook: ${allLogbooksToCreate.length} record (${reviewedLogbookCount} Reviewed, ${pendingLogbookCount} Pending Review).`);

  // ============================================================
  // 5. SEED PENGUMUMAN RESMI PERUSAHAAN
  // ============================================================
  console.log("\n📢 Menyiapkan pengumuman resmi perusahaan...");

  const announcements = [
    {
      title: "Selamat Datang Peserta Magang & PKL Wilayah Tasikmalaya - Ciamis",
      content: "Selamat bergabung di program kerja praktik & magang industri PT Cikara Bakti Nusantara. Mohon memastikan seluruh peserta mengisi presensi harian tepat waktu dan melengkapi logbook setiap sore hari kerja.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 7, 1),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Ketentuan Hari Kerja Resmi & Presensi Harian (Senin s.d. Sabtu)",
      content: "Diberitahukan kepada seluruh peserta magang bahwa hari kerja operasional Cikara Studio berlangsung dari hari Senin s.d. Sabtu (6 hari kerja; Minggu libur). Presensi harian wajib diisi pada pukul 07.00 - 18.00 WIB. Bagi mahasiswa dipersilakan WFO/WFH sesuai pembagian sprint, dan siswa PKL melaksanakan 100% WFO di studio.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 7, 5),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Jadwal Evaluasi Tengah Periode (Mid-term Review)",
      content: "Sesi evaluasi dan one-on-one review kemajuan magang diselenggarakan bersama mentor pembimbing. Silakan persiapkan progres jurnal logbook masing-masing.",
      category: "JADWAL",
      targetType: "ALL",
      publishDate: createDate(2026, 9, 15),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Instruksi Pelaksanaan Sprint Bulan November 2026",
      content: "Memasuki bulan November 2026, seluruh peserta magang diharapkan fokus menyelesaikan integrasi modul utama serta menyusun laporan kemajuan berkala.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 11, 2),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Jadwal Pengumpulan Draf Laporan Akhir Magang & PKL SMK",
      content: "Bagi seluruh peserta magang mahasiswa (UNSIL, UPI, UNIGAL, BSI) dan siswa PKL (SMKN 1 Tasikmalaya, SMKN 2 Ciamis, SMKN 4 Tasikmalaya), format draf laporan akhir magang wajib dikonsultasikan dengan mentor pembimbing paling lambat akhir November 2026.",
      category: "TUGAS",
      targetType: "ALL",
      publishDate: createDate(2026, 11, 10),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Briefing Penutupan Sprint & Demonstrasi Akhir Projek CIMS",
      content: "Demonstrasi hasil implementasi projek aplikasi CIMS akan dilaksanakan pada tanggal 26 November 2026. Seluruh peserta magang wajib mempersiapkan modul yang dikerjakan beserta dokumentasi teknisnya.",
      category: "JADWAL",
      targetType: "ALL",
      publishDate: createDate(2026, 11, 20),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
  ];

  for (const ann of announcements) {
    await prisma.announcement.create({ data: ann });
    console.log(`   ✨ Pengumuman dibuat: ${ann.title}`);
  }

  // ============================================================
  // 7. SUMMARY & KREDENSIAL LOGIN
  // ============================================================
  const totalUsers = await prisma.user.count();
  const mentorCount = await prisma.user.count({ where: { role: "MENTOR" } });
  const internCount = await prisma.user.count({ where: { role: "INTERN" } });
  const activeCount = await prisma.user.count({ where: { status: "ACTIVE" } });
  const pendingCount = await prisma.user.count({ where: { status: "PENDING" } });
  const archivedCount = await prisma.user.count({ where: { status: "ARCHIVED" } });
  const rejectedCount = await prisma.user.count({ where: { status: "REJECTED" } });
  const presenceCount = await prisma.presence.count();
  const logbookCount = await prisma.logbook.count();
  const publishedEvalCount = await prisma.evaluation.count({ where: { status: "PUBLISHED" } });
  const draftEvalCount = await prisma.evaluation.count({ where: { status: "DRAFT" } });
  const unevaluatedCount = activeCount - (publishedEvalCount + draftEvalCount);

  console.log("\n============================================================");
  console.log("🎉 SEEDING SELESAI (PERIODE MAGANG BERAGAM & NATURAL)!");
  console.log("============================================================");
  console.log("📊 Statistik Database CIMS Terkini:");
  console.log(`   - Total Pengguna           : ${totalUsers}`);
  console.log(`   - Akun Mentor              : ${mentorCount} (${mentorEmail})`);
  console.log(`   - Akun Intern              : ${internCount}`);
  console.log(`     * Sedang Aktif (ACTIVE)  : ${activeCount} Peserta (Periode & Tanggal Mulai Beragam)`);
  console.log(`     * Calon Baru (PENDING)   : ${pendingCount} Peserta (Batch Des 2026, Presensi 0, Logbook 0)`);
  console.log(`     * Selesai Magang (ARCHIVED): ${archivedCount} Peserta (Maya Putri, Lulus, Nilai 92.5 A Published, Evaluasi Selesai)`);
  console.log(`     * Ditolak (REJECTED)     : ${rejectedCount} Peserta (Fajar Ramadhan, Pendaftaran Ditolak, Presensi 0, Logbook 0)`);
  console.log(`   - Total Presensi           : ${presenceCount} (Tercatat akurat sesuai tanggal mulai masing-masing)`);
  console.log(`   - Total Logbook            : ${logbookCount} (${reviewedLogbookCount} Reviewed, ${pendingLogbookCount} Pending Menunggu Review)`);
  console.log(`   - Total Pengumuman         : ${announcements.length}`);
  console.log(`   - Status Penilaian         : ${publishedEvalCount} Published (Maya Putri), ${draftEvalCount} Draft (Fenty Anggraeni), ${unevaluatedCount} Belum Dinilai`);
  console.log("============================================================\n");

  return {
    success: true,
    totalUsers,
    mentorCount,
    internCount,
    activeCount,
    pendingCount,
    archivedCount,
    rejectedCount,
    presenceCount,
    logbookCount,
    pendingLogbookCount,
    reviewedLogbookCount,
    publishedEvalCount,
    draftEvalCount,
    unevaluatedCount,
  };
}

// Auto-run if executed from CLI
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  runSeed()
    .catch((error) => {
      console.error("❌ Seeding error:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
