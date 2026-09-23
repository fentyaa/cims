/**
 * Seed Script - Internship Management System (IMS) / CIMS
 * 
 * Membuat data awal & dummy data realistis wilayah Tasikmalaya & Ciamis:
 * 1. Akun Default Mentor: mentor.cims@gmail.com (Password: Mentor123!)
 * 2. 11 Akun Peserta Magang (Mahasiswa & Siswa SMK di Tasikmalaya / Ciamis) dengan password: Intern123!
 *    - 8 Akun ACTIVE & ON GOING (Periode berjalan: 1 Agustus s.d. 31 Oktober 2026, progres ~48%)
 *      * Presensi terisi lengkap 100% untuk seluruh hari kerja yang telah terlewati sampai hari ini (tanpa ada yang kosong).
 *      * Logbook memiliki entri REVIEWED dan PENDING (logbook terbaru menunggu review mentor).
 *      * Penilaian bervariasi (Sebagian DRAFT mid-term, sebagian belum dinilai / NONE agar mentor dapat membuat penilaian, dan 1 PUBLISHED).
 *      * Fenty Anggraeni (Universitas Siliwangi - UNSIL Tasikmalaya) - ONGOING
 *      * Ahmad Fauzi (Universitas Siliwangi - UNSIL Tasikmalaya) - Senior Intern (Published)
 *      * Siti Nurhaliza (Universitas Galuh - UNIGAL Ciamis) - ONGOING (Draft Mid-term)
 *      * Rizky Pratama (SMKN 1 Tasikmalaya) - ONGOING (Belum Dinilai)
 *      * Dewi Lestari (UPI Kampus Tasikmalaya) - ONGOING (Belum Dinilai)
 *      * Bayu Nugroho (SMKN 2 Ciamis) - ONGOING (Belum Dinilai)
 *      * Anisa Rahmawati (Universitas BSI Kampus Tasikmalaya) - ONGOING (Belum Dinilai)
 *      * Dimas Arya Saputra (SMKN 4 Tasikmalaya) - ONGOING (Belum Dinilai)
 *    - 1 Akun PENDING (Kevin Sanjaya - UNPER Tasikmalaya, menunggu approval mentor)
 *    - 1 Akun ARCHIVED (Maya Putri - SMKN 1 Ciamis, alumni yang sudah selesai)
 *    - 1 Akun REJECTED (Fajar Ramadhan - STMIK DCI Tasikmalaya)
 * 3. Seluruh email berdomain @gmail.com
 */

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import prisma from "./config/database.js";
import { checkRedDate } from "./utils/holidayHelper.js";

const SALT_ROUNDS = 10;

// Helper membuat tanggal pada UTC/Local 00:00:00
const createDate = (year, month, day) => {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

export async function runSeed() {
  console.log("🌱 Memulai proses seeding database CIMS (Data Ongoing Tasikmalaya & Ciamis)...\n");

  // ============================================================
  // 0. RESET DATA LAMA (RESET BERSIH)
  // ============================================================
  console.log("🧹 Mereset data lama...");
  await prisma.presence.deleteMany();
  await prisma.logbook.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.generationHistory.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.documentTemplate.deleteMany();

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

  const documentsStorageDir = path.resolve(process.cwd(), "storage/documents");
  if (fs.existsSync(documentsStorageDir)) {
    const docFiles = fs.readdirSync(documentsStorageDir);
    for (const f of docFiles) {
      if (f.endsWith(".html") || f.endsWith(".pdf")) {
        try {
          fs.unlinkSync(path.join(documentsStorageDir, f));
        } catch (e) {
          // ignore
        }
      }
    }
  }
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
  // 2. DAFTAR 11 PESERTA MAGANG (TASIKMALAYA & CIAMIS - @gmail.com)
  //    PERIODE BERJALAN (ON GOING: 1 AGUSTUS s.d. 31 OKTOBER 2026)
  // ============================================================

  const dummyInterns = [
    {
      fullName: "Fenty Anggraeni",
      email: "fenty.anggraeni@gmail.com",
      phoneNumber: "081234567800",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE", // ONGOING
      university: "Universitas Siliwangi (UNSIL) Tasikmalaya",
      studyProgram: "Informatika",
      studentId: "237006068",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
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
        recommendation: "Sangat direkomendasikan untuk bergabung sebagai Junior Software Engineer / Full Stack Web Developer.",
        status: "DRAFT", // DRAFT: Mid-term evaluation sedang berlangsung (bisa diedit/disahkan mentor)
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
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
      mentorId: mentor.id,
      evaluation: {
        discipline: 90,
        responsibility: 88,
        communication: 86,
        teamwork: 88,
        initiative: 90,
        technicalSkill: 92,
        finalScore: 89.0,
        grade: "A",
        mentorComment: "Ahmad menunjukkan pemahaman logika pemrograman backend dan integrasi database yang sangat solid.",
        recommendation: "Direkomendasikan untuk posisi Junior Backend Developer.",
        status: "PUBLISHED", // Telah selesai dinilai
        publishedAt: createDate(2026, 9, 8),
      },
    },
    {
      fullName: "Siti Nurhaliza",
      email: "siti.nurhaliza@gmail.com",
      phoneNumber: "081234567802",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE", // ONGOING
      university: "Universitas Galuh (UNIGAL) Ciamis",
      studyProgram: "Sistem Informasi",
      studentId: "210321045",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      evaluation: {
        discipline: 92,
        responsibility: 90,
        communication: 94,
        teamwork: 90,
        initiative: 90,
        technicalSkill: 90,
        finalScore: 91.0,
        grade: "A",
        mentorComment: "Siti sangat proaktif dalam komunikasi tim dan memiliki analisis kebutuhan sistem yang matang.",
        recommendation: "Sangat direkomendasikan untuk posisi System Analyst.",
        status: "DRAFT", // DRAFT: Sedang proses evaluasi
      },
    },
    {
      fullName: "Rizky Pratama",
      email: "rizky.pratama@gmail.com",
      phoneNumber: "081234567803",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE", // ONGOING - Belum dinilai (Tombol 'Buat Penilaian' aktif untuk mentor)
      schoolName: "SMKN 1 Tasikmalaya",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 1",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      // evaluation: null (ONGOING, belum dinilai)
    },
    {
      fullName: "Dewi Lestari",
      email: "dewi.lestari@gmail.com",
      phoneNumber: "081234567804",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE", // ONGOING - Belum dinilai
      university: "Universitas Pendidikan Indonesia (UPI) Kampus Tasikmalaya",
      studyProgram: "Desain Komunikasi Visual",
      studentId: "2204901",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      // evaluation: null (ONGOING)
    },
    {
      fullName: "Bayu Nugroho",
      email: "bayu.nugroho@gmail.com",
      phoneNumber: "081234567805",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE", // ONGOING - Belum dinilai
      schoolName: "SMKN 2 Ciamis",
      major: "Teknik Komputer dan Jaringan",
      classGrade: "XII TKJ 2",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      // evaluation: null (ONGOING)
    },
    {
      fullName: "Anisa Rahmawati",
      email: "anisa.rahmawati@gmail.com",
      phoneNumber: "081234567806",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE", // ONGOING - Belum dinilai
      university: "Universitas BSI Kampus Tasikmalaya",
      studyProgram: "Teknologi Informasi",
      studentId: "12210050",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      // evaluation: null (ONGOING)
    },
    {
      fullName: "Dimas Arya Saputra",
      email: "dimas.arya@gmail.com",
      phoneNumber: "081234567807",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE", // ONGOING - Belum dinilai
      schoolName: "SMKN 4 Tasikmalaya",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 2",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
      // evaluation: null (ONGOING)
    },
    {
      fullName: "Kevin Sanjaya",
      email: "kevin.sanjaya@gmail.com",
      phoneNumber: "081234567808",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "PENDING", // PENDING: Menunggu persetujuan akun di halaman Approval
      university: "Universitas Perjuangan Tasikmalaya (UNPER)",
      studyProgram: "Teknik Informatika",
      studentId: "2301987654",
      internshipPeriod: "1 Oktober 2026 - 31 Desember 2026",
      internshipStartDate: createDate(2026, 10, 1),
      internshipEndDate: createDate(2026, 12, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Maya Putri",
      email: "maya.putri@gmail.com",
      phoneNumber: "081234567809",
      role: "INTERN",
      participantType: "SMK",
      status: "ARCHIVED", // ARCHIVED: Alumni periode sebelumnya yang telah selesai
      schoolName: "SMKN 1 Ciamis",
      major: "Pengembangan Perangkat Lunak dan Gim",
      classGrade: "XII PPLG 1",
      internshipPeriod: "1 April 2026 - 30 Juni 2026",
      internshipStartDate: createDate(2026, 4, 1),
      internshipEndDate: createDate(2026, 6, 30),
      mentorId: mentor.id,
    },
    {
      fullName: "Fajar Ramadhan",
      email: "fajar.ramadhan@gmail.com",
      phoneNumber: "081234567810",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "REJECTED", // REJECTED: Pendaftaran ditolak (berkas tidak lengkap)
      university: "STMIK DCI Tasikmalaya",
      studyProgram: "Teknik Informatika",
      studentId: "22110088",
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
      mentorId: mentor.id,
    },
  ];

  console.log("\n📦 Menyiapkan 11 akun peserta magang Tasikmalaya & Ciamis...");

  const createdInternMap = new Map();

  for (const item of dummyInterns) {
    const { evaluation, ...userData } = item;
    userData.password = hashedInternPassword;

    const savedUser = await prisma.user.create({
      data: userData,
    });
    console.log(`   ✨ Dibuat: ${savedUser.fullName} (${savedUser.email}) - [${savedUser.status}] [${savedUser.university || savedUser.schoolName}]`);

    createdInternMap.set(savedUser.email, savedUser);

    // Buat evaluasi jika ada
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
  // 3. SEED PRESENSI LENGKAP SAMPAI HARI INI (TANPA ADA YANG KOSONG)
  // ============================================================

  console.log("\n📅 Menyiapkan riwayat presensi harian lengkap tanpa ada hari kerja yang kosong...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ambil seluruh hari kerja (Senin-Sabtu di luar Hari Libur Nasional) dari 45 hari kalender yang lalu sampai hari ini
  const recentWorkDays = [];
  const walkDate = new Date(today);
  walkDate.setDate(walkDate.getDate() - 45); // Mundur 45 hari kalender

  while (walkDate <= today) {
    const redInfo = checkRedDate(walkDate);
    // Hanya hari kerja resmi (bukan Minggu dan bukan Hari Libur Nasional)
    if (!redInfo.isRedDate) {
      recentWorkDays.push(new Date(Date.UTC(walkDate.getFullYear(), walkDate.getMonth(), walkDate.getDate(), 0, 0, 0, 0)));
    }
    walkDate.setDate(walkDate.getDate() + 1);
  }

  // Urutkan tanggal dari yang terlama ke terbaru (HANYA hari kerja resmi Senin-Sabtu di luar Libur Nasional)
  recentWorkDays.sort((a, b) => a.getTime() - b.getTime());

  const activeInterns = dummyInterns.filter((i) => i.status === "ACTIVE");

  // Konfigurasi profil presensi untuk setiap peserta dummy
  const internPresenceProfiles = {
    "fenty.anggraeni@gmail.com": {
      wfhInterval: 3, // Mahasiswa: WFH berkala hari Rabu
      breakDay: null, // Kehadiran 100% Sempurna (Disiplin Terbaik)
    },
    "ahmad.fauzi@gmail.com": {
      wfhInterval: 3,
      breakDay: null, // Kehadiran 100% Sempurna
    },
    "siti.nurhaliza@gmail.com": {
      wfhInterval: 4,
      breakOffset: 12,
      breakType: "IZIN",
      breakNote: "Izin bimbingan KRS online di kampus UNIGAL Ciamis",
    },
    "rizky.pratama@gmail.com": {
      wfhInterval: null, // SMK: WFO 100%
      breakOffset: 8,
      breakType: "IZIN",
      breakNote: "Izin pengurusan berkas di SMKN 1 Tasikmalaya",
    },
    "dewi.lestari@gmail.com": {
      wfhInterval: 3,
      breakOffset: 15,
      breakType: "IZIN",
      breakNote: "Izin asistensi studio DKV UPI Tasikmalaya",
    },
    "bayu.nugroho@gmail.com": {
      wfhInterval: null, // SMK: WFO 100%
      breakOffset: 6,
      breakType: "SAKIT",
      breakNote: "Sakit flu ringan, istirahat di rumah",
    },
    "anisa.rahmawati@gmail.com": {
      wfhInterval: 4,
      breakOffset: 18,
      breakType: "IZIN",
      breakNote: "Izin pengurusan administrasi kampus BSI Tasikmalaya",
    },
    "dimas.arya@gmail.com": {
      wfhInterval: null, // SMK: WFO 100%
      breakOffset: 10,
      breakType: "SAKIT",
      breakNote: "Sakit demam, istirahat",
    },
  };

  const totalWorkDaysCount = recentWorkDays.length;
  const allPresencesToCreate = [];

  for (const internDef of activeInterns) {
    const internUser = createdInternMap.get(internDef.email);
    if (!internUser) continue;

    const profile = internPresenceProfiles[internDef.email] || { wfhInterval: 3, breakDay: null };
    const isSmk = internDef.participantType === "SMK";

    for (let idx = 0; idx < totalWorkDaysCount; idx++) {
      const date = recentWorkDays[idx];
      const daysFromToday = (totalWorkDaysCount - 1) - idx; // 0 = Hari ini, 1 = Kemarin, dst.

      let status = "WFO";
      let notes = isSmk
        ? "Hadir di kantor Cikara Studio melaksanakan praktik kerja lapangan"
        : "Hadir tepat waktu di kantor Cikara Studio";

      if (profile.breakOffset && daysFromToday === profile.breakOffset) {
        // Hari Izin / Sakit yang terencana
        status = profile.breakType || "IZIN";
        notes = profile.breakNote || "Izin keperluan akademik";
      } else if (!isSmk && profile.wfhInterval && daysFromToday % profile.wfhInterval === 0) {
        // WFH berkala untuk mahasiswa
        status = "WFH";
        notes = "Bekerja dari rumah (WFH) mengerjakan sprint tugas projek CIMS";
      } else {
        // Hari-hari kerja lainnya: WFO
        status = "WFO";
        notes = isSmk
          ? "Hadir di kantor Cikara Studio melaksanakan praktik kerja lapangan"
          : "Hadir tepat waktu di kantor Cikara Studio";
      }

      allPresencesToCreate.push({
        userId: internUser.id,
        date,
        status,
        notes,
      });
    }
  }

  if (allPresencesToCreate.length > 0) {
    await prisma.presence.createMany({
      data: allPresencesToCreate,
      skipDuplicates: true,
    });
  }
  console.log(`   ✅ Riwayat presensi lengkap (${allPresencesToCreate.length} record) berhasil dibuat untuk ${activeInterns.length} peserta aktif.`);
  console.log(`   ✅ Seluruh ${totalWorkDaysCount} hari kerja terisi tanpa ada hari yang kosong.`);

  // ============================================================
  // 4. SEED LOGBOOK HARIAN (CAMPURAN REVIEWED & PENDING REVIEW)
  //    (Mencerminkan Aktivitas Magang yang Masih ON GOING!)
  // ============================================================

  console.log("\n📝 Menyiapkan catatan logbook harian peserta (Reviewed & Pending)...");

  const logbookActivities = [
    {
      activity: "Setup project environment CIMS, eksplorasi schema database PostgreSQL, dan integrasi Prisma ORM.",
      obstacle: "Konfigurasi SSL mode pada koneksi database Supabase memerlukan penyesuaian parameter query string.",
      nextPlan: "Mengimplementasikan middleware otentikasi login berbasis session.",
      mentorComment: "Bagus, environment lokal dan dependencies terinstal rapi.",
      status: "REVIEWED",
    },
    {
      activity: "Pengembangan middleware keamanan Express: Helmet, CSRF protection, dan rate limiter untuk rute auth.",
      obstacle: "Sinkronisasi CSRF token dengan session Express memerlukan pembersihan cookie saat logout.",
      nextPlan: "Membuat endpoint registrasi dan validasi input data mahasiswa magang dan siswa PKL.",
      mentorComment: "Kerja bagus, aspek keamanan fail-closed sudah diuji dengan baik.",
      status: "REVIEWED",
    },
    {
      activity: "Slicing antarmuka responsif Dashboard CIMS menggunakan Bootstrap 5 dan penyesuaian tema Dark/Light mode.",
      obstacle: "Penyelarasan kontras warna tabel pada dark mode memerlukan penyesuaian CSS variables.",
      nextPlan: "Mengintegrasikan widget kalender presensi bulanan dan streak kehadiran.",
      mentorComment: "Tampilan dashboard rapi dan responsif di berbagai resolusi layar.",
      status: "REVIEWED",
    },
    {
      activity: "Implementasi modul presensi harian mandiri dengan deteksi otomatis hari libur dan kalender nasional.",
      obstacle: "Penanganan presensi siswa PKL SMK yang diwajibkan 100% WFO di kantor.",
      nextPlan: "Membuat rekapitulasi kehadiran dan grafik KPI presensi untuk mentor.",
      mentorComment: "Aturan bisnis pembedaan mahasiswa dan siswa SMK sudah tepat.",
      status: "REVIEWED",
    },
    {
      activity: "Penyusunan modul review logbook mentor dengan fitur filter status, pencarian, dan feedback komentar.",
      obstacle: "Pengaturan pagination pada daftar entri logbook peserta yang banyak.",
      nextPlan: "Menambahkan indikator badge status pending dan reviewed.",
      mentorComment: "Alur review logbook intuitif dan mempermudah pemantauan.",
      status: "REVIEWED",
    },
    {
      activity: "Implementasi lembar evaluasi capaian kompetensi magang dengan 6 parameter penilaian terstandar.",
      obstacle: "Kalkulasi bobot nilai akhir dan penentuan grade A, B, C secara otomatis.",
      nextPlan: "Membuat tampilan cetak lembar nilai resmi untuk kampus dan sekolah.",
      mentorComment: "Rubrik penilaian komprehensif dan objektif.",
      status: "REVIEWED",
    },
    {
      activity: "Penyusunan modul Laporan Perkembangan Peserta Magang dengan agregasi data kehadiran, logbook, dan nilai.",
      obstacle: "Optimasi query analitik multi-tabel dengan Prisma ORM agar latensi tetap rendah.",
      nextPlan: "Menambahkan fitur ekspor rekapitulasi data ke format file CSV.",
      mentorComment: "Fitur laporan sangat informatif untuk pelaporan ke institusi mitra.",
      status: "REVIEWED",
    },
    // 3 Entri Terbaru: PENDING REVIEW (Masih On Going & Menunggu Review Mentor!)
    {
      activity: "Refactoring query database dan pengujian performa endpoint dashboard peserta dan mentor.",
      obstacle: "Penyesuaian indexing pada kolom date di tabel presensi.",
      nextPlan: "Menjalankan stress-test load data.",
      mentorComment: null,
      status: "PENDING", // PENDING: Menunggu review mentor
    },
    {
      activity: "Penyusunan dokumentasi teknis sistem CIMS dan penulisan draft bab 4 laporan magang.",
      obstacle: "Penyusunan diagram alur sistem dan visualisasi arsitektur.",
      nextPlan: "Melakukan asistensi bab 4 dengan mentor lapangan.",
      mentorComment: null,
      status: "PENDING", // PENDING: Menunggu review mentor
    },
    {
      activity: "Pengerjaan modul analitik presensi mingguan dan penyempurnaan UI komponen notifikasi.",
      obstacle: "Tidak ada kendala, pengerjaan sesuai rencana sprint.",
      nextPlan: "Konsultasi evaluasi mingguan bersama mentor pembimbing.",
      mentorComment: null,
      status: "PENDING", // PENDING: Hari ini / kemarin menunggu review mentor
    },
  ];

  // Ambil 10 hari kerja terakhir hingga hari ini untuk entri logbook
  const recentLogbookDays = recentWorkDays.slice(-10);
  const allLogbooksToCreate = [];

  for (const internDef of activeInterns) {
    const internUser = createdInternMap.get(internDef.email);
    if (!internUser) continue;

    for (let idx = 0; idx < recentLogbookDays.length; idx++) {
      const logDate = recentLogbookDays[idx];
      const sampleEntry = logbookActivities[idx % logbookActivities.length];

      allLogbooksToCreate.push({
        userId: internUser.id,
        date: logDate,
        activity: sampleEntry.activity,
        obstacle: sampleEntry.obstacle,
        nextPlan: sampleEntry.nextPlan,
        mentorComment: sampleEntry.mentorComment || null,
        status: sampleEntry.status,
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
  console.log(`   ✅ Catatan logbook (${allLogbooksToCreate.length} record: ${reviewedLogbookCount} Reviewed, ${pendingLogbookCount} Pending Review) berhasil diisi untuk ${activeInterns.length} peserta aktif.`);

  // ============================================================
  // 5. SEED PENGUMUMAN CIKARA STUDIO (TASIKMALAYA)
  // ============================================================

  console.log("\n📢 Menyiapkan pengumuman resmi perusahaan...");

  await prisma.announcement.deleteMany();

  const announcements = [
    {
      title: "Selamat Datang Peserta Magang & PKL Wilayah Tasikmalaya - Ciamis",
      content: "Selamat bergabung di program kerja praktik & magang industri Cikara Studio Tasikmalaya. Mohon memastikan seluruh peserta mengisi presensi harian tepat waktu dan melengkapi logbook setiap sore hari.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 8, 1),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Ketentuan Hari Kerja Resmi & Presensi Harian (Senin s.d. Sabtu)",
      content: "Diberitahukan kepada seluruh peserta magang (Mahasiswa & Siswa PKL) bahwa hari kerja operasional Cikara Studio berlangsung dari hari Senin s.d. Sabtu (6 hari kerja; Minggu libur). Presensi harian wajib diisi pada pukul 07.00 - 18.00 WIB. Bagi mahasiswa dipersilakan WFO/WFH sesuai pembagian jadwal sprint, dan siswa PKL melaksanakan WFO di studio.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 8, 3),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Jadwal Evaluasi Tengah Periode (Mid-term Review)",
      content: "Sesi evaluasi dan one-on-one review kemajuan magang diselenggarakan bersama mentor pembimbing. Silakan persiapkan progres jurnal logbook masing-masing.",
      category: "JADWAL",
      targetType: "ALL",
      publishDate: createDate(2026, 8, 15),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Briefing Penulisan Laporan Akhir Magang & PKL SMK",
      content: "Bagi seluruh peserta magang mahasiswa (UNSIL, UPI, UNIGAL, BSI) dan siswa PKL (SMKN 1 Tasikmalaya, SMKN 2 Ciamis, SMKN 4 Tasikmalaya), format penulisan laporan akhir magang telah dapat dikonsultasikan dengan mentor pembimbing.",
      category: "TUGAS",
      targetType: "ALL",
      publishDate: createDate(2026, 9, 1),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
  ];

  for (const ann of announcements) {
    await prisma.announcement.create({ data: ann });
    console.log(`   ✨ Pengumuman dibuat: ${ann.title}`);
  }

  // ============================================================
  // 6. SUMMARY & INFORMASI LOGIN
  // ============================================================

  const totalUsers = await prisma.user.count();
  const mentorCount = await prisma.user.count({ where: { role: "MENTOR" } });
  const internCount = await prisma.user.count({ where: { role: "INTERN" } });
  const activeCount = await prisma.user.count({ where: { status: "ACTIVE" } });
  const pendingCount = await prisma.user.count({ where: { status: "PENDING" } });
  const archivedCount = await prisma.user.count({ where: { status: "ARCHIVED" } });
  const presenceCount = await prisma.presence.count();
  const logbookCount = await prisma.logbook.count();
  const publishedEvalCount = await prisma.evaluation.count({ where: { status: "PUBLISHED" } });
  const draftEvalCount = await prisma.evaluation.count({ where: { status: "DRAFT" } });
  const unevaluatedCount = activeCount - (publishedEvalCount + draftEvalCount);

  console.log("\n============================================================");
  console.log("🎉 SEEDING DATABASE SELESAI (DATA REALISTIS ON GOING)!");
  console.log("============================================================");
  console.log("📊 Statistik Database Baru (Tasikmalaya & Ciamis):");
  console.log(`   - Total Pengguna       : ${totalUsers}`);
  console.log(`   - Akun Mentor          : ${mentorCount} (${mentorEmail})`);
  console.log(`   - Akun Intern          : ${internCount}`);
  console.log(`     * Sedang Aktif/On Going: ${activeCount} Peserta (Periode 1 Agt - 31 Okt 2026, progres ~48%)`);
  console.log(`     * Menunggu Approval    : ${pendingCount} Peserta (Kevin Sanjaya - UNPER Tasikmalaya)`);
  console.log(`     * Arsip / Selesai      : ${archivedCount} Peserta (Maya Putri - SMKN 1 Ciamis)`);
  console.log(`   - Total Presensi       : ${presenceCount} (Seluruh ${totalWorkDaysCount} hari kerja sampai hari ini terisi 100% tanpa kosong)`);
  console.log(`   - Total Logbook        : ${logbookCount} (${reviewedLogbookCount} Reviewed, ${pendingLogbookCount} Pending Menunggu Review)`);
  console.log(`   - Status Penilaian     : ${publishedEvalCount} Published, ${draftEvalCount} Draft Mid-term, ${unevaluatedCount} Belum Dinilai (Bisa dibuat mentor)`);
  console.log("------------------------------------------------------------");
  console.log("🔑 Kredensial Login yang Siap Digunakan (Semua @gmail.com):");
  console.log(`   1. Mentor : ${mentorEmail} | Password: ${mentorPassword}`);
  console.log(`   2. Fenty Anggraeni (UNSIL Tasikmalaya)     : fenty.anggraeni@gmail.com | Password: Intern123! [ON GOING - Draft Mid-term]`);
  console.log(`   3. Ahmad Fauzi (UNSIL Tasikmalaya)         : ahmad.fauzi@gmail.com     | Password: Intern123! [Senior Intern - Published]`);
  console.log(`   4. Siti Nurhaliza (UNIGAL Ciamis)          : siti.nurhaliza@gmail.com  | Password: Intern123! [ON GOING - Draft]`);
  console.log(`   5. Rizky Pratama (SMKN 1 Tasikmalaya)      : rizky.pratama@gmail.com   | Password: Intern123! [ON GOING - Belum Dinilai]`);
  console.log(`   6. Dewi Lestari (UPI Kampus Tasikmalaya)   : dewi.lestari@gmail.com    | Password: Intern123! [ON GOING - Belum Dinilai]`);
  console.log(`   7. Bayu Nugroho (SMKN 2 Ciamis)            : bayu.nugroho@gmail.com    | Password: Intern123! [ON GOING - Belum Dinilai]`);
  console.log(`   8. Anisa Rahmawati (Universitas BSI Tasik) : anisa.rahmawati@gmail.com | Password: Intern123! [ON GOING - Belum Dinilai]`);
  console.log(`   9. Dimas Arya (SMKN 4 Tasikmalaya)         : dimas.arya@gmail.com      | Password: Intern123! [ON GOING - Belum Dinilai]`);
  console.log(`  10. Kevin Sanjaya (Pending - UNPER Tasik)   : kevin.sanjaya@gmail.com   | Password: Intern123! [Menunggu Approval]`);
  console.log(`  11. Maya Putri (Archived - SMKN 1 Ciamis)   : maya.putri@gmail.com      | Password: Intern123! [Arsip / Selesai]`);
  console.log(`  12. Fajar Ramadhan (Rejected - STMIK DCI)   : fajar.ramadhan@gmail.com  | Password: Intern123! [Ditolak]`);
  console.log("============================================================\n");

  return {
    success: true,
    totalUsers,
    mentorCount,
    internCount,
    activeCount,
    pendingCount,
    archivedCount,
    presenceCount,
    logbookCount,
    pendingLogbookCount,
    reviewedLogbookCount,
    publishedEvalCount,
    draftEvalCount,
    unevaluatedCount,
    totalWorkDaysCount,
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
