# Entity Relationship Diagram (ERD) - CIMS Database

## 1. Tujuan Diagram
Diagram ini memodelkan relasi fisik basis data relasional PostgreSQL pada sistem CIMS yang dikelola melalui **Prisma ORM** ([`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma)). Menampilkan entitas tabel, *Primary Key* (PK), *Foreign Key* (FK), *Unique Key* (UK), atribut data penting, dan kardinalitas relasi antar-tabel.

---

## 2. Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    %% ========================================================
    %% RELASI ANTAR TABEL (CARDINALITY)
    %% ========================================================
    
    %% Self-relation Mentor ke Peserta Magang
    users ||--o{ users : "mentors / has_mentor (mentorId)"

    %% Relasi Peserta ke Presensi dan Logbook
    users ||--o{ presences : "records (userId)"
    users ||--o{ logbooks : "submits (userId)"

    %% Relasi Peserta & Mentor ke Penilaian
    users ||--o| evaluations : "receives_eval (userId)"
    users ||--o{ evaluations : "creates_eval (mentorId)"

    %% Relasi Mentor ke Pengumuman
    users ||--o{ announcements : "publishes (createdById)"

    %% ========================================================
    %% DEFINISI ENTITAS DAN ATRIBUT
    %% ========================================================

    users {
        string id PK "cuid()"
        string fullName "Nama Lengkap"
        string email UK "Email Unik Login"
        string phoneNumber "Nomor Telepon/WA"
        string password "Bcrypt Hashed Password"
        string role "MENTOR | INTERN"
        string participantType "UNIVERSITY | SMK"
        string status "PENDING | ACTIVE | REJECTED | ARCHIVED"
        string university "Nama Kampus (Mahasiswa)"
        string studyProgram "Program Studi"
        string studentId "NIM Mahasiswa"
        string schoolName "Nama Sekolah (Siswa SMK)"
        string major "Jurusan / Kejuruan"
        string classGrade "Tingkat Kelas"
        string internshipPeriod "Teks Periode Magang"
        date internshipStartDate "Tanggal Mulai Magang"
        date internshipEndDate "Tanggal Selesai Magang"
        string profilePhoto "Path File Foto Profil"
        string resetPasswordToken "Token Reset Sandi"
        datetime resetPasswordExpires "Masa Berlaku Token"
        string mentorId FK "Relasi Pembimbing"
        datetime createdAt
        datetime updatedAt
    }

    Session {
        string sid PK "Session ID"
        json sess "Data Objek Sesi"
        datetime expire "Waktu Kedaluwarsa Sesi"
    }

    presences {
        string id PK "cuid()"
        string userId FK "Foreign Key users.id (Cascade Delete)"
        date date "Tanggal Presensi (UK [userId, date])"
        string status "WFO | WFH | IZIN | SAKIT"
        string notes "Catatan / Keterangan Alasan"
        datetime createdAt
        datetime updatedAt
    }

    logbooks {
        string id PK "cuid()"
        string userId FK "Foreign Key users.id (Cascade Delete)"
        date date "Tanggal Logbook (UK [userId, date])"
        string activity "Deskripsi Pekerjaan Harian"
        string obstacle "Kendala yang Dihadapi"
        string nextPlan "Rencana Kerja Hari Berikutnya"
        string mentorComment "Catatan / Review Pembimbing"
        string status "PENDING | REVIEWED"
        datetime createdAt
        datetime updatedAt
    }

    announcements {
        string id PK "cuid()"
        string title "Judul Pengumuman"
        string content "Isi Pesan Pengumuman"
        string category "INFORMASI | JADWAL | TUGAS | LIBUR | PENTING"
        string targetType "ALL | UNIVERSITY | SMK"
        string attachment "Nama Berkas Lampiran"
        datetime publishDate "Waktu Mulai Terbit"
        datetime expireDate "Waktu Kedaluwarsa"
        string status "DRAFT | PUBLISHED | ARCHIVED"
        string createdById FK "Foreign Key users.id (Mentor Pembuat)"
        datetime createdAt
        datetime updatedAt
    }

    evaluations {
        string id PK "cuid()"
        string userId FK "Foreign Key users.id (UK: 1 Peserta 1 Nilai)"
        float discipline "Skor Kedisiplinan Desimal (0-100)"
        float responsibility "Skor Tanggung Jawab Desimal (0-100)"
        float communication "Skor Komunikasi Desimal (0-100)"
        float teamwork "Skor Kerja Sama Tim Desimal (0-100)"
        float initiative "Skor Inisiatif Desimal (0-100)"
        float technicalSkill "Skor Keterampilan Teknis Desimal (0-100)"
        float finalScore "Nilai Akhir Rata-rata Desimal"
        string grade "Predikat Nilai: A | B | C | D | E"
        string mentorComment "Catatan Evaluasi Pembimbing"
        string recommendation "Rekomendasi Karir/Saran"
        string status "DRAFT | PUBLISHED | ARCHIVED"
        datetime publishedAt "Waktu Terbit Nilai"
        string mentorId FK "Foreign Key users.id (Mentor Penilai)"
        datetime createdAt
        datetime updatedAt
    }
```

---

## 3. Penjelasan Relasi & Batasan Integritas Database

1. **Mapping Nama Tabel:** Nama entitas tabel pada database PostgreSQL dipetakan secara eksplisit dari model Prisma menggunakan anotasi `@@map`:
   - `User` $\rightarrow$ `users`
   - `Presence` $\rightarrow$ `presences`
   - `Logbook` $\rightarrow$ `logbooks`
   - `Announcement` $\rightarrow$ `announcements`
   - `Evaluation` $\rightarrow$ `evaluations`
   - `Session` $\rightarrow$ `Session`
2. **Kardinalitas & Foreign Keys Utama:**
   - `users` ke `presences` (1 : N) dengan `onDelete: Cascade`. Jika akun user dihapus, seluruh riwayat presensinya otomatis terhapus.
   - `users` ke `logbooks` (1 : N) dengan `onDelete: Cascade`.
   - `users` ke `evaluations` (1 : 1 unik) pada `userId`. Menjamin setiap peserta magang hanya memiliki satu rekap evaluasi akhir.
   - `users` ke `announcements` (1 : N) pada `createdById` (mentor pembuat pengumuman).
3. **Composite Unique Constraints:**
   - `presences`: `@@unique([userId, date])` — Menolak duplikasi data absensi pada hari yang sama.
   - `logbooks`: `@@unique([userId, date])` — Menolak pengisian laporan aktivitas ganda pada tanggal yang sama.

---

## 4. Dasar Implementasi Source Code

- **Skema Lengkap Database:** [`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma) (Baris 11–195)
- **Migrasi Database:** Direktori [`prisma/migrations/`](file:///d:/cims/cims/prisma/migrations)
- **Konfigurasi Pooler & Driver:** [`app.js`](file:///d:/cims/cims/app.js) (Baris 116–149) dan [`config/database.js`](file:///d:/cims/cims/config/database.js)
