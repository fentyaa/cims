# Cikara Internship Management System (CIMS)

<p align="center">
  <img src="public/images/logo.png" alt="CIMS Logo" width="120" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Platform Terpadu Pengelolaan, Presensi, dan Monitoring Peserta Magang (Mahasiswa & Siswa SMK)</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white" alt="Prisma ORM" />
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white" alt="Bootstrap" />
  <img src="https://img.shields.io/badge/Tests-134%20Passed-success" alt="Tests" />
  <img src="https://img.shields.io/badge/Security-Hardened-blue" alt="Security" />
</p>

---

## 📌 Tentang CIMS

**CIMS (Cikara Internship Management System)** adalah aplikasi web monolitik modern yang dirancang untuk mengotomatisasi seluruh siklus pelaksanaan program magang industri di **PT Cikara Bakti Nusantara**. Sistem ini memfasilitasi kolaborasi antara **Mentor Perusahaan** dan **Peserta Magang** (Mahasiswa Perguruan Tinggi & Siswa PKL SMK) mulai dari penerimaan akun, absensi harian, logbook kegiatan, hingga evaluasi akhir dan penerbitan sertifikat digital.

---

## ✨ Fitur Utama Sistem

### 1. 👥 Multi-Role Authentication & Akun
- **Role-Based Access Control (RBAC)**: Pemisahan hak akses antara `MENTOR` (Admin) dan `INTERN` (Peserta).
- **Alur Pendaftaran Terstruktur**: Form registrasi khusus mahasiswa (NIM, Jurusan, Universitas) dan siswa SMK (NISN, Jurusan, Sekolah).
- **Verifikasi & Approval Akun**: Setiap pendaftar baru berstatus `PENDING` hingga disetujui atau ditolak oleh mentor.
- **Pemulihan Akun (Forgot Password)**: Integrasi SMTP Nodemailer dengan token aman berbasis waktu kedaluwarsa (1 jam).

### 2. 📍 Presensi Harian & Attendance Policy
- **Kategori Kehadiran**: Pilihan kehadiran `WFO` (Work From Office), `WFH` (Work From Home), `IZIN`, dan `SAKIT`.
- **Kepatuhan Kebijakan Industri**:
  - Siswa PKL SMK: Wajib **100% WFO** di kantor.
  - Mahasiswa: Kebijakan *Hybrid* fleksibel (maksimal 2 hari WFH per minggu).
- **Deteksi Tanggal Merah Otomatis**: Integrasi data hari libur nasional Indonesia & hari Minggu.
- **Normalisasi Timezone UTC Midnight**: Akurasi pencatatan tanggal lokal (WIB) tanpa pergeseran zona waktu.

### 3. 📅 Kalender Magang Interaktif
- Visualisasi status kehadiran harian dalam format kalender bulanan.
- Sinkronisasi status presensi dengan riwayat logbook harian.
- Identifikasi batas periode mulai dan selesai magang peserta.

### 4. 📝 Daily Logbook & Review Mentor
- Pengisian aktivitas harian, kendala teknis yang dihadapi, dan rencana tindak lanjut.
- Fitur penolakan pengisian logbook otomatis jika peserta berstatus `IZIN` atau `SAKIT`.
- Ulasan, persetujuan (*approval*), dan catatan bimbingan langsung dari mentor.

### 5. 🏆 Gamifikasi & Pelacakan Kemajuan
- **Streak Kehadiran**: Penghitung kehadiran aktif berturut-turut tanpa jeda (*best streak* & *current streak*).
- **Persentase Progres Magang**: Visualisasi hari kerja terlalui vs sisa hari kerja secara proporsional.
- **Kebijakan Dropout Otomatis**: Deteksi 3 hari berturut-turut alpa tanpa keterangan resmi.

### 6. 📊 Evaluasi Akhir & Otomatisasi Dokumen
- Penilaian kompetensi kinerja peserta oleh mentor di akhir periode magang.
- Otomatisasi konversi skor angka ke predikat huruf (Grade A, B, C, D).
- **Penerbitan Dokumen Resmi**:
  - Surat Balasan / Penerimaan Magang
  - Surat Keterangan Selesai Magang
  - Sertifikat Kelulusan Resmi Digital (*Print-Ready* HTML & PDF export)
- Mekanisme proteksi IDOR (*Insecure Direct Object Reference*) untuk melindungi privasi dokumen antar peserta.

### 7. 📢 Pengumuman Perusahaan
- Publikasi pengumuman internal dari mentor dengan target penerima (Semua Peserta, Mahasiswa saja, atau SMK saja).
- Dukungan lampiran dokumen pendukung (PDF, Word, Gambar).

---

## 🛡️ Keamanan Sistem (Enterprise-Grade Security)

Aplikasi CIMS telah melalui audit keamanan komprehensif:
* **CSRF Protection**: Implementasi *Double-Submit Cookie Pattern* menggunakan `crypto.timingSafeEqual()`.
* **Password Hashing**: Enkripsi password menggunakan **Bcrypt** dengan salt rounds tinggi.
* **Brute-Force Defense**: *Rate Limiting* berbasis window request pada endpoint otentikasi dan aksi kritis.
* **XSS Defense**: Sanitasi input dan escaping otomatis pada kompilasi template EJS & generator dokumen.
* **Secure File Upload**: Validasi ganda ekstensi dan MIME type (*whitelist-based*) serta pencegahan eksekusi skrip berbahaya.
* **HTTP Security Headers**: Penerapan `Helmet.js` untuk mengamankan header HTTP (X-Frame-Options, X-Content-Type-Options).

---

## 🛠️ Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Backend Runtime** | Node.js (ES Modules / v20+) |
| **Web Framework** | Express.js v5 |
| **Database** | PostgreSQL (Hosted on Supabase) |
| **ORM** | Prisma ORM v5 |
| **Template Engine** | EJS (Embedded JavaScript) & Express EJS Layouts |
| **Frontend Styling** | Bootstrap 5.3, Bootstrap Icons, Plus Jakarta Sans Font |
| **Session Store** | Express-Session dengan `connect-pg-simple` (PostgreSQL Pool) |
| **Email Service** | Nodemailer (Gmail SMTP / App Passwords) |
| **Testing** | Node.js Test Suite (134 Automated Tests) |
| **Deployment** | Vercel (`vercel.json`) & Render (`render.yaml`) Ready |

---

## 📁 Struktur Direktori

```text
cims/
├── api/                    # Serverless handler untuk deployment Vercel
├── config/                 # Konfigurasi database Prisma & mailer SMTP
├── controllers/            # Controller HTTP (Auth, Presensi, Logbook, Dokumen, dll)
├── docs/                   # Dokumentasi teknis & arsitektur sistem
│   ├── diagrams/           # Diagram arsitektur UML & alur sistem
│   └── SECURITY_HARDENING.md
├── middlewares/            # Middleware (Auth guard, CSRF, Rate Limiting, Upload)
├── models/                 # Model data
├── prisma/                 # Skema Prisma (schema.prisma) & target engine
├── public/                 # Aset publik statis (CSS, JS, Images, Uploads)
├── routes/                 # Definisi rute HTTP aplikasi
├── scripts/                # Tool generator diagram & seeder template
├── services/               # Lapisan logika bisnis (Business Logic Layer)
├── storage/templates/      # Berkas template HTML dokumen resmi CIMS
├── tests/                  # Automated Regression & Security Test Suite
├── utils/                  # Helper fungsi, validasi, dan kalender libur
├── views/                  # Halaman antarmuka EJS dinamis & layout
├── app.js                  # Entry point utama aplikasi Express.js
├── package.json            # Manifest proyek & dependensi
├── seed.js                 # Data awal database (12 peserta dengan aktivitas realistis)
├── render.yaml             # Blueprint konfigurasi deployment Render
└── vercel.json             # Konfigurasi deployment Vercel
```

---

## 🚀 Panduan Memulai (Instalasi Lokal)

### 1. Clone Repositori
```bash
git clone https://github.com/fentyaa/cims.git
cd cims
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`, lalu lengkapi kredensial database dan SMTP Anda:
```bash
cp .env.example .env
```
Contoh isi `.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"
SESSION_SECRET="your-super-secret-key"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="email@anda.com"
SMTP_PASS="sandi-aplikasi-google"
```

### 4. Setup Database
Generate Prisma Client dan sinkronkan skema ke basis data:
```bash
npx prisma generate
npx prisma db push
```

### 5. Isi Data Awal (Seeding)
Jalankan seeder untuk mengisi data master mentor, 12 profil peserta magang beragam, presensi, logbook, dan pengumuman:
```bash
node seed.js
```

### 6. Jalankan Server
```bash
# Mode Development (auto-reload)
npm run dev

# Mode Production
npm start
```
Buka browser dan akses: **`http://localhost:3000`**

---

## 🧪 Menjalankan Pengujian Otomatis

Aplikasi ini dilengkapi pengujian regresi dan keamanan menyeluruh:
```bash
npm test
```
*Output: 134 PASSED, 0 FAILED (100% test coverage).*

---

## 🔑 Akun Demo Pengujian

Setelah menjalankan `node seed.js`, Anda dapat langsung masuk menggunakan akun default berikut:

| Role | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Mentor (Admin)** | `mentor.cims@gmail.com` | `Mentor123!` | Akses penuh dashboard mentor, approval, dan penilaian |
| **Intern (Mahasiswa)** | `fenty.anggraeni@gmail.com` | `Intern123!` | Akun mahasiswa aktif (UNSIL, siap evaluasi akhir) |
| **Intern (Mahasiswa)** | `ahmad.fauzi@gmail.com` | `Intern123!` | Akun magang MBKM 6 bulan |
| **Intern (Siswa SMK)** | `rizky.pratama@gmail.com` | `Intern123!` | Akun siswa PKL SMK (aturan 100% WFO) |
| **Alumni (Lulus)** | `maya.putri@gmail.com` | `Intern123!` | Akun berstatus selesai, nilai terbit & sertifikat aktif |

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT License** — silakan gunakan dan kembangkan sesuai kebutuhan.
