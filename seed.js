/**
 * Seed Script - Internship Management System (IMS)
 * 
 * Membuat data awal & dummy data realistis:
 * 1. Akun Default Mentor (mentor@cims.com / Mentor123!)
 * 2. 10 Akun Peserta Magang (Mahasiswa & Siswa SMK) dengan password: Intern123!
 *    - 7 Akun ACTIVE (dengan presensi harian, logbook, dan evaluasi)
 *    - 1 Akun PENDING (untuk halaman Approval)
 *    - 1 Akun ARCHIVED (untuk halaman Arsip & Restore)
 *    - 1 Akun REJECTED
 * 3. Presensi harian bulan berjalan (WFO/WFH/Izin/Sakit)
 * 4. Logbook harian (Pending Review & Reviewed dengan komentar mentor)
 * 5. Penilaian & Evaluasi (Published & Draft)
 * 6. Template Dokumen & Pengumuman
 * 
 * Cara menjalankan:
 * npm run seed
 * atau:
 * node seed.js
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
  console.log("🌱 Memulai proses seeding database IMS...\n");

  // ============================================================
  // 0. RESET DATA LAMA (RESET BERSIH)
  // ============================================================
  console.log("🧹 Mereset data presensi, logbook, dokumen & riwayat generate...");
  await prisma.presence.deleteMany();
  await prisma.logbook.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.generationHistory.deleteMany();

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
  console.log("   ✅ Data lama berhasil direset bersih.\n");

  // ============================================================
  // 1. DEFAULT MENTOR ACCOUNT
  // ============================================================

  const mentorEmail = process.env.DEFAULT_MENTOR_EMAIL || "mentor@cims.com";
  const mentorPassword = process.env.DEFAULT_MENTOR_PASSWORD || "Mentor123!";
  const mentorName = process.env.DEFAULT_MENTOR_NAME || "Admin Mentor";
  const mentorPhone = process.env.DEFAULT_MENTOR_PHONE || "081234567890";

  let mentor = await prisma.user.findUnique({
    where: { email: mentorEmail },
  });

  const hashedMentorPassword = await bcrypt.hash(mentorPassword, SALT_ROUNDS);

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
  // 2. DAFTAR 10 PESERTA MAGANG (DUMMY DATA)
  // ============================================================

  const dummyInterns = [
    {
      fullName: "Ahmad Fauzi",
      email: "ahmad.fauzi@cims.com",
      phoneNumber: "081234567801",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Indonesia",
      studyProgram: "Teknik Informatika",
      studentId: "2106721001",
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
      mentorId: mentor.id,
      evaluation: {
        discipline: 90,
        responsibility: 88,
        communication: 85,
        teamwork: 87,
        initiative: 90,
        technicalSkill: 91,
        finalScore: 88.5,
        grade: "A",
        mentorComment: "Ahmad menunjukkan dedikasi dan kemampuan problem solving yang sangat baik dalam pengembangan sistem backend.",
        recommendation: "Direkomendasikan untuk bergabung sebagai Junior Backend Engineer setelah lulus.",
        status: "PUBLISHED",
        publishedAt: createDate(2026, 8, 28),
      },
    },
    {
      fullName: "Siti Nurhaliza",
      email: "siti.nurhaliza@cims.com",
      phoneNumber: "081234567802",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Institut Teknologi Bandung",
      studyProgram: "Sistem Informasi",
      studentId: "18221045",
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
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
        mentorComment: "Siti sangat proaktif dalam komunikasi tim dan memiliki pemahaman analisis bisnis yang matang.",
        recommendation: "Sangat direkomendasikan untuk posisi System Analyst / Product Specialist.",
        status: "DRAFT",
      },
    },
    {
      fullName: "Rizky Pratama",
      email: "rizky.pratama@cims.com",
      phoneNumber: "081234567803",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 1 Jakarta",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 1",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Dewi Lestari",
      email: "dewi.lestari@cims.com",
      phoneNumber: "081234567804",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Universitas Gadjah Mada",
      studyProgram: "Ilmu Komputer",
      studentId: "21/478901/PA/20850",
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
      mentorId: mentor.id,
    },
    {
      fullName: "Bayu Nugroho",
      email: "bayu.nugroho@cims.com",
      phoneNumber: "081234567805",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 2 Bandung",
      major: "Teknik Komputer dan Jaringan",
      classGrade: "XII TKJ 2",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Anisa Rahmawati",
      email: "anisa.rahmawati@cims.com",
      phoneNumber: "081234567806",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "ACTIVE",
      university: "Telkom University",
      studyProgram: "Desain Komunikasi Visual (UI/UX)",
      studentId: "1201213050",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Dimas Arya Saputra",
      email: "dimas.arya@cims.com",
      phoneNumber: "081234567807",
      role: "INTERN",
      participantType: "SMK",
      status: "ACTIVE",
      schoolName: "SMKN 4 Surabaya",
      major: "Rekayasa Perangkat Lunak",
      classGrade: "XII RPL 2",
      internshipPeriod: "1 Agustus 2026 - 31 Oktober 2026",
      internshipStartDate: createDate(2026, 8, 1),
      internshipEndDate: createDate(2026, 10, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Kevin Sanjaya",
      email: "kevin.sanjaya@cims.com",
      phoneNumber: "081234567808",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "PENDING", // Muncul di halaman Persetujuan Akun (Approval)
      university: "BINUS University",
      studyProgram: "Computer Science",
      studentId: "2501987654",
      internshipPeriod: "1 September 2026 - 30 November 2026",
      internshipStartDate: createDate(2026, 9, 1),
      internshipEndDate: createDate(2026, 11, 30),
      mentorId: mentor.id,
    },
    {
      fullName: "Maya Putri",
      email: "maya.putri@cims.com",
      phoneNumber: "081234567809",
      role: "INTERN",
      participantType: "SMK",
      status: "ARCHIVED", // Muncul di halaman Arsip Peserta
      schoolName: "SMKN 1 Cibinong",
      major: "Teknik Komputer dan Jaringan",
      classGrade: "XII TKJ 1",
      internshipPeriod: "1 Mei 2026 - 31 Juli 2026",
      internshipStartDate: createDate(2026, 5, 1),
      internshipEndDate: createDate(2026, 7, 31),
      mentorId: mentor.id,
    },
    {
      fullName: "Fajar Ramadhan",
      email: "fajar.ramadhan@cims.com",
      phoneNumber: "081234567810",
      role: "INTERN",
      participantType: "UNIVERSITY",
      status: "REJECTED", // Muncul di daftar Rejected
      university: "Universitas Padjadjaran",
      studyProgram: "Teknik Informatika",
      studentId: "140810210088",
      internshipPeriod: "1 Juli 2026 - 30 September 2026",
      internshipStartDate: createDate(2026, 7, 1),
      internshipEndDate: createDate(2026, 9, 30),
      mentorId: mentor.id,
    },
  ];

  console.log("\n📦 Menyiapkan 10 akun peserta magang...");

  const createdInternMap = new Map();

  for (const item of dummyInterns) {
    const { evaluation, ...userData } = item;
    userData.password = hashedInternPassword;

    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    let savedUser;
    if (existing) {
      savedUser = await prisma.user.update({
        where: { email: userData.email },
        data: userData,
      });
      console.log(`   🔄 Diperbarui: ${savedUser.fullName} (${savedUser.email}) - [${savedUser.status}]`);
    } else {
      savedUser = await prisma.user.create({
        data: userData,
      });
      console.log(`   ✨ Dibuat: ${savedUser.fullName} (${savedUser.email}) - [${savedUser.status}]`);
    }

    createdInternMap.set(savedUser.email, savedUser);

    // Buat evaluasi jika ada
    if (evaluation) {
      const existingEval = await prisma.evaluation.findUnique({
        where: { userId: savedUser.id },
      });

      if (existingEval) {
        await prisma.evaluation.update({
          where: { userId: savedUser.id },
          data: {
            ...evaluation,
            mentorId: mentor.id,
          },
        });
      } else {
        await prisma.evaluation.create({
          data: {
            ...evaluation,
            userId: savedUser.id,
            mentorId: mentor.id,
          },
        });
      }
    }
  }

  // ============================================================
  // 3. SEED PRESENSI HARIAN & STREAK REALISTIS (UNTUK PESERTA AKTIF)
  // ============================================================

  console.log("\n📅 Menyiapkan riwayat presensi harian & streak untuk peserta aktif...");

  // Dapatkan rentang tanggal kerja (Senin-Sabtu) hingga hari ini secara dinamis
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ambil hari kerja (Senin-Sabtu di luar Tanggal Merah / Libur Nasional) hingga hari ini
  const recentWorkDays = [];
  const walkDate = new Date(today);
  walkDate.setDate(walkDate.getDate() - 45); // Mundur 45 hari kalender

  while (walkDate <= today) {
    const redInfo = checkRedDate(walkDate);
    // Hanya hari kerja resmi (bukan Minggu dan bukan Hari Libur Nasional)
    if (!redInfo.isRedDate) {
      // Simpan copy Date pada 00:00:00 UTC/Local
      recentWorkDays.push(new Date(walkDate.getFullYear(), walkDate.getMonth(), walkDate.getDate(), 0, 0, 0, 0));
    }
    walkDate.setDate(walkDate.getDate() + 1);
  }

  const activeInterns = dummyInterns.filter((i) => i.status === "ACTIVE");

  // Konfigurasi profil streak spesifik untuk setiap peserta dummy
  const internStreakProfiles = {
    "ahmad.fauzi@cims.com": {
      targetStreak: 18, // 18 hari kerja berturut-turut WFO/WFH hingga hari ini
      breakOffset: null, // Tanpa absen / presensi sempurna
    },
    "anisa.rahmawati@cims.com": {
      targetStreak: 14, // 14 hari kerja berturut-turut WFO/WFH
      breakOffset: 15,
      breakType: "IZIN",
      breakNote: "Izin pengurusan administrasi beasiswa kampus",
    },
    "siti.nurhaliza@cims.com": {
      targetStreak: 10, // 10 hari kerja berturut-turut WFO/WFH
      breakOffset: 11,
      breakType: "IZIN",
      breakNote: "Izin bimbingan skripsi / KRS online",
    },
    "dimas.arya@cims.com": {
      targetStreak: 8, // 8 hari kerja berturut-turut WFO (SMK: 100% WFO)
      breakOffset: 9,
      breakType: "SAKIT",
      breakNote: "Sakit demam, istirahat di rumah",
    },
    "rizky.pratama@cims.com": {
      targetStreak: 7, // 7 hari kerja berturut-turut (membuka badge 7-Day Streak)
      breakOffset: 8,
      breakType: "IZIN",
      breakNote: "Izin pengurusan tugas sekolah SMKN 1",
    },
    "dewi.lestari@cims.com": {
      targetStreak: 5, // 5 hari kerja berturut-turut
      breakOffset: 6,
      breakType: "IZIN",
      breakNote: "Izin bimbingan dosen wali UGM",
    },
    "bayu.nugroho@cims.com": {
      targetStreak: 3, // 3 hari kerja berturut-turut (SMK: 100% WFO)
      breakOffset: 4,
      breakType: "SAKIT",
      breakNote: "Sakit flu ringan",
    },
  };

  const totalWorkDaysCount = recentWorkDays.length;
  const allPresencesToCreate = [];

  for (const internDef of activeInterns) {
    const internUser = createdInternMap.get(internDef.email);
    if (!internUser) continue;

    const profile = internStreakProfiles[internDef.email] || { targetStreak: 6, breakOffset: 7 };

    for (let idx = 0; idx < totalWorkDaysCount; idx++) {
      const date = recentWorkDays[idx];
      const daysFromToday = (totalWorkDaysCount - 1) - idx; // 0 = Hari ini, 1 = Kemarin kerja, dst.

      let status = "WFO";
      let notes = "Hadir tepat waktu di kantor";

      const isSmk = internDef.participantType === "SMK";

      if (daysFromToday === 0) {
        // Hari ini: WFO aktif
        status = "WFO";
        notes = isSmk ? "Hadir di kantor melaksanakan praktik kerja lapangan" : "Hadir tepat waktu di kantor PT. Cikara Bakti Nusantara";
      } else if (daysFromToday < profile.targetStreak) {
        // Dalam rentang active streak: Mahasiswa selang-seling WFO/WFH, SMK selalu WFO
        if (!isSmk && daysFromToday % 3 === 0) {
          status = "WFH";
          notes = "Bekerja dari rumah (WFH) mengerjakan sprint backlog";
        } else {
          status = "WFO";
          notes = isSmk ? "Hadir di kantor melaksanakan praktik kerja lapangan" : "Hadir di kantor mengerjakan modul projek";
        }
      } else if (profile.breakOffset !== null && daysFromToday === profile.breakOffset) {
        // Hari pemutus streak sebelumnya (Izin / Sakit)
        status = profile.breakType || "IZIN";
        notes = profile.breakNote || "Izin keperluan pribadi";
      } else {
        // Hari-hari lampau sebelum break
        if (!isSmk && daysFromToday % 4 === 0) {
          status = "WFH";
          notes = "Bekerja dari rumah (WFH)";
        } else {
          status = "WFO";
          notes = isSmk ? "Hadir di kantor melaksanakan praktik kerja lapangan" : "Hadir di kantor";
        }
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
  console.log(`   ✅ Riwayat presensi & streak aktif (${allPresencesToCreate.length} record) berhasil di-generate.`);

  // ============================================================
  // 4. SEED LOGBOOK HARIAN (DINAMIS HINGGA HARI INI)
  // ============================================================

  console.log("\n📝 Menyiapkan catatan logbook harian peserta...");

  const logbookActivities = [
    {
      activity: "Setup project environment, konfigurasi PostgreSQL connection pooling, dan eksplorasi schema database CIMS.",
      obstacle: "Sempat ada kendala port PostgreSQL lokal, berhasil diselesaikan dengan konfigurasi env.",
      nextPlan: "Mempelajari flow otentikasi login & registrasi dengan session.",
      mentorComment: "Bagus, pastikan semua dependencies terinstal rapi di environment masing-masing.",
      status: "REVIEWED",
    },
    {
      activity: "Mengimplementasikan middleware keamanan Helmet, CSRF protection, dan rate limiter untuk endpoint auth.",
      obstacle: "Pengaturan double-submit CSRF cookie membutuhkan sinkronisasi token dengan session.",
      nextPlan: "Membuat pengujian integrasi endpoint login dan logout.",
      mentorComment: "Kerja bagus, perhatikan sanitasi input HTML untuk mencegah XSS.",
      status: "REVIEWED",
    },
    {
      activity: "Slicing UI Dashboard interaktif dengan Bootstrap 5 dan penyesuaian tema dark/light mode.",
      obstacle: "Penyesuaian warna dark mode pada tabel sempat kurang kontras.",
      nextPlan: "Mengintegrasikan widget kalender presensi bulanan.",
      mentorComment: "Tampilan dashboard rapi dan responsif di mobile.",
      status: "REVIEWED",
    },
    {
      activity: "Mengembangkan fitur Internship Calendar dan kalkulasi streak hari aktif magang secara otomatis.",
      obstacle: "Logika penentuan hari Minggu (libur) tanpa memutus streak perlu ditangani cermat.",
      nextPlan: "Melakukan benchmark query database dengan Promise.all.",
      mentorComment: "Logika gamifikasi sudah sesuai dengan aturan hari kerja Senin-Sabtu.",
      status: "REVIEWED",
    },
    {
      activity: "Mengerjakan modul dokumen otomatis untuk generate sertifikat dan surat keterangan selesai magang.",
      obstacle: "Pencegahan path traversal pada nama file hasil generate dokumen.",
      nextPlan: "Melakukan pengujian bulk generation dokumen bersama mentor.",
      status: "PENDING",
    },
    {
      activity: "Optimasi latensi pemuatan halaman web, caching aset statis, dan tuning pool connection.",
      obstacle: "Tidak ada kendala berarti.",
      nextPlan: "Finalisasi laporan kemajuan mingguan magang.",
      status: "PENDING",
    },
  ];

  // Ambil 6 hari kerja terakhir hingga hari ini untuk logbook
  const recentLogbookDays = recentWorkDays.slice(-6);
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
  console.log(`   ✅ Catatan logbook (${allLogbooksToCreate.length} record) berhasil diisi untuk peserta aktif.`);

  // ============================================================
  // 5. SEED TEMPLATE DOKUMEN (SERTIFIKAT & SURAT)
  // ============================================================

  console.log("\n📄 Menyiapkan template dokumen bawaan...");

  const templates = [
    {
      name: "Template Sertifikat Kelulusan Standar v1.0",
      documentType: "CERTIFICATE",
      version: "1.0",
      filePath: "templates/sertifikat-v1.html",
      status: "ACTIVE",
      uploadedById: mentor.id,
    },
    {
      name: "Template Surat Keterangan Selesai Magang v1.0",
      documentType: "LETTER",
      version: "1.0",
      filePath: "templates/surat-v1.html",
      status: "ACTIVE",
      uploadedById: mentor.id,
    },
  ];

  for (const tpl of templates) {
    const existingTpl = await prisma.documentTemplate.findFirst({
      where: { documentType: tpl.documentType, version: tpl.version },
    });

    if (!existingTpl) {
      await prisma.documentTemplate.create({
        data: tpl,
      });
      console.log(`   ✨ Template dibuat: ${tpl.name}`);
    }
  }

  // ============================================================
  // 6. SEED PENGUMUMAN PERUSAHAAN
  // ============================================================

  console.log("\n📢 Menyiapkan pengumuman sampel...");

  const announcements = [
    {
      title: "Selamat Datang Peserta Magang Periode Q3 2026",
      content: "Selamat bergabung di program magang CIMS. Mohon memastikan seluruh peserta mengisi presensi harian tepat waktu dan melengkapi logbook setiap sore hari.",
      category: "INFORMASI",
      targetType: "ALL",
      publishDate: createDate(2026, 8, 1),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Jadwal Evaluasi Tengah Periode (Mid-term Review)",
      content: "Sesi evaluasi dan one-on-one review kemajuan magang akan diselenggarakan pada akhir bulan ini bersama mentor pembimbing masing-masing.",
      category: "JADWAL",
      targetType: "ALL",
      publishDate: createDate(2026, 8, 15),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
    {
      title: "Briefing Penulisan Laporan Akhir PKL SMK",
      content: "Khusus siswa PKL SMK, format penulisan laporan magang dan lembar pengesahan sekolah dapat diakses melalui modul Dokumen.",
      category: "TUGAS",
      targetType: "SMK",
      publishDate: createDate(2026, 8, 20),
      status: "PUBLISHED",
      createdById: mentor.id,
    },
  ];

  for (const ann of announcements) {
    const existingAnn = await prisma.announcement.findFirst({
      where: { title: ann.title },
    });

    if (!existingAnn) {
      await prisma.announcement.create({ data: ann });
      console.log(`   ✨ Pengumuman dibuat: ${ann.title}`);
    }
  }

  // ============================================================
  // 7. SUMMARY & INFORMASI LOGIN
  // ============================================================

  const totalUsers = await prisma.user.count();
  const mentorCount = await prisma.user.count({ where: { role: "MENTOR" } });
  const internCount = await prisma.user.count({ where: { role: "INTERN" } });
  const activeCount = await prisma.user.count({ where: { status: "ACTIVE" } });
  const pendingCount = await prisma.user.count({ where: { status: "PENDING" } });
  const archivedCount = await prisma.user.count({ where: { status: "ARCHIVED" } });
  const presenceCount = await prisma.presence.count();
  const logbookCount = await prisma.logbook.count();

  console.log("\n============================================================");
  console.log("🎉 SEEDING DATABASE SELESAI!");
  console.log("============================================================");
  console.log("📊 Statistik Database:");
  console.log(`   - Total Pengguna    : ${totalUsers}`);
  console.log(`   - Akun Mentor       : ${mentorCount}`);
  console.log(`   - Akun Intern       : ${internCount} (Active: ${activeCount}, Pending: ${pendingCount}, Archived: ${archivedCount})`);
  console.log(`   - Total Presensi    : ${presenceCount}`);
  console.log(`   - Total Logbook     : ${logbookCount}`);
  console.log("------------------------------------------------------------");
  console.log("🔥 Rincian Streak Presensi Aktif (Hari Beruntun):");
  console.log("   - Ahmad Fauzi (UI)       : 🔥 18 Hari Beruntun (100% Disiplin)");
  console.log("   - Anisa Rahmawati (TelU) : 🔥 14 Hari Beruntun");
  console.log("   - Siti Nurhaliza (ITB)   : 🔥 10 Hari Beruntun");
  console.log("   - Dimas Arya (SMKN 4)    : 🔥 8 Hari Beruntun");
  console.log("   - Rizky Pratama (SMKN 1) : 🔥 7 Hari Beruntun (Lencana 7-Day Streak Unlocked)");
  console.log("   - Dewi Lestari (UGM)     : 🔥 5 Hari Beruntun");
  console.log("   - Bayu Nugroho (SMKN 2)  : 🔥 3 Hari Beruntun");
  console.log("------------------------------------------------------------");
  console.log("🔑 Kredensial Login yang Siap Digunakan:");
  console.log(`   1. Mentor : ${mentorEmail} | Password: ${mentorPassword}`);
  console.log(`   2. Intern (Mahasiswa UI)  : ahmad.fauzi@cims.com   | Password: Intern123!`);
  console.log(`   3. Intern (Mahasiswa ITB) : siti.nurhaliza@cims.com | Password: Intern123!`);
  console.log(`   4. Intern (Siswa SMKN 1)  : rizky.pratama@cims.com  | Password: Intern123!`);
  console.log(`   5. Intern (Mahasiswa UGM) : dewi.lestari@cims.com   | Password: Intern123!`);
  console.log(`   6. Intern (Siswa SMKN 2)  : bayu.nugroho@cims.com   | Password: Intern123!`);
  console.log(`   7. Intern (Telkom Univ)   : anisa.rahmawati@cims.com| Password: Intern123!`);
  console.log(`   8. Intern (Siswa SMKN 4)  : dimas.arya@cims.com     | Password: Intern123!`);
  console.log(`   9. Intern (Pending - BINUS): kevin.sanjaya@cims.com | Password: Intern123!`);
  console.log(`  10. Intern (Archived - SMKN): maya.putri@cims.com    | Password: Intern123!`);
  console.log(`  11. Intern (Rejected - UNPAD): fajar.ramadhan@cims.com| Password: Intern123!`);
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
