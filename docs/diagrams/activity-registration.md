# Activity Diagram - Registrasi Peserta, Penetapan Periode Otomatis, dan Self-Service Profil

## 1. Tujuan Diagram
Diagram ini memodelkan alur pendaftaran akun calon peserta magang (**Intern**), pengisian tanggal magang dengan kalkulasi otomatis keterangan periode yang terkunci (*immutable*), proses persetujuan akun oleh **Mentor**, serta fasilitas pembaruan mandiri (*Self-Service Profil*) oleh peserta untuk memperbaiki salah ketik (*typo*) biodata tanpa intervensi mentor.

---

## 2. Activity Diagram (Mermaid)

```mermaid
flowchart TD
    %% Node Awal & Akhir
    StartNode((●))
    EndSuccess((◉))
    EndFail((◉))

    %% Swimlane INTERN
    subgraph Swimlane_Intern ["Intern (Calon Peserta & Peserta Magang)"]
        A1["Akses Halaman Registrasi (/auth/register)"]
        A2["Pilih Tipe Peserta:
        1. Mahasiswa (Universitas, Prodi, NIM)
        2. Siswa SMK (Sekolah, Kejuruan, Kelas)"]
        A3["Pilih Tanggal Mulai & Tanggal Selesai Magang"]
        A4["Sistem Otomatis Mengisi & Mengunci Keterangan Periode Magang"]
        A5["Input Biodata Lengkap, Password, & Unggah Foto Profil"]
        A6["Submit Formulir Registrasi"]
        A7["Menerima Konfirmasi Akun Berstatus PENDING"]
        A8["Login Setelah Disetujui Mentor (/auth/login)"]
        A9["Mengakses Halaman Profil Mandiri (/intern/profil)"]
        A10["Memperbaiki Salah Ketik Nama, NIM, Asal Sekolah/Kampus, atau Kontak"]
    end

    %% Swimlane SISTEM CIMS
    subgraph Swimlane_System ["Sistem Backend CIMS"]
        S1["Hitung Teks Periode Otomatis via formatInternshipPeriod:
        Contoh: '2 Juni - 31 Juli 2026'"]
        S2["Kunci Input Periode (readonly bg-light) Anti-Manipulasi"]
        S3["Validasi Form & Berkas:<br/>• Nama Lengkap Valid (Mendukung Tanda Petik / Apostrof)<br/>• Format Email Unik & Password Kuat<br/>• Validasi Ukuran Foto Profil (Maksimal 2 MB, JPG/PNG)"]
        S4{"Validasi Berhasil?"}
        S5["Tampilkan Pesan Koreksi Validasi Ramah Pengguna"]
        S6["Simpan Data ke Tabel users:
        - Status: PENDING
        - Periode & Tanggal Magang Terkunci Permanen"]
        S7["Verifikasi Sesi & Kredensial Login (bcrypt)"]
        S8{"Pemeriksaan Status Akun?"}
        S9["Peringatan: Akun Masih Menunggu Approval Mentor"]
        S10["Peringatan: Akun Telah Ditolak Mentor"]
        S11["Izinkan Masuk ke Dashboard Peserta"]
        S12["updateOwnProfile(): Simpan Pembaruan Profil Mandiri<br/>• Validasi Nama (Mendukung Apostrof)<br/>• Validasi Ukuran Foto (Maksimal 2 MB)<br/>• Proteksi: Blokir Perubahan Periode & Tanggal Magang"]
    end

    %% Swimlane MENTOR
    subgraph Swimlane_Mentor ["Mentor (Pembimbing Lapangan)"]
        M1["Akses Halaman Persetujuan Akun (/auth/approval)"]
        M2["Periksa Biodata, Asal Institusi, & Periode Terkunci Pendaftar"]
        M3{"Keputusan Persetujuan?"}
        M4["Klik Tolak (Reject) -> Status Akun: REJECTED"]
        M5["Klik Setuju (Approve) -> Status Akun: ACTIVE"]
        M6["Memantau Peserta di Daftar Magang (Hak Edit Profil Ditiadakan)"]
    end

    %% Alur Registrasi
    StartNode --> A1
    A1 --> A2
    A2 --> A3
    A3 --> S1
    S1 --> S2
    S2 --> A4
    A4 --> A5
    A5 --> A6
    A6 --> S3
    S3 --> S4
    S4 -- "Gagal" --> S5
    S5 --> A5
    S4 -- "Sukses" --> S6
    S6 --> A7

    %% Alur Persetujuan Mentor
    A7 --> M1
    M1 --> M2
    M2 --> M3
    M3 -- "Tolak" --> M4
    M4 --> A8
    M3 -- "Setuju" --> M5
    M5 --> M6
    M5 --> A8

    %% Alur Login
    A8 --> S7
    S7 --> S8
    S8 -- "Status PENDING" --> S9
    S9 --> EndFail
    S8 -- "Status REJECTED" --> S10
    S10 --> EndFail
    S8 -- "Status ACTIVE" --> S11
    S11 --> EndSuccess

    %% Alur Self-Service Profil Mandiri
    S11 -.-> A9
    A9 --> A10
    A10 --> S12
    S12 --> EndSuccess
```

---

## 3. Penjelasan Alur Aktivitas

1. **Otomatisasi Periode Magang & Anti-Manipulasi:**
   Saat calon peserta mengisi tanggal mulai (`internshipStartDate`) dan tanggal selesai (`internshipEndDate`), fungsi helper `formatInternshipPeriod` secara *real-time* membentuk format baku bahasa Indonesia (misal: `"2 - 31 Juli 2026"` atau `"2 Juni - 31 Juli 2026"`). Nilai ini berstatus `readonly` dan terkunci permanen di database untuk mencegah manipulasi durasi magang.
2. **Pemisahan Wewenang (Self-Service Profil):**
   - **Peserta:** Memiliki wewenang mandiri penuh melalui `/intern/profil` untuk memperbaiki salah ketik (*typo*) nama lengkap, NIM/NIS, nama universitas/sekolah, program studi/jurusan, kelas, maupun nomor kontak HP.
   - **Mentor:** Tombol pengubahan data profil peserta pada antarmuka pembimbing ditiadakan, sehingga mentor hanya fokus pada fungsi pemantauan, verifikasi, dan penilaian objektif.
3. **Siklus Approval Akun:**
   Akun baru tersimpan dengan status `PENDING`. Mentor memeriksa kredibilitas pendaftar pada halaman `/auth/approval` sebelum memberikan izin masuk (`ACTIVE`).

---

## 4. Dasar Implementasi Source Code

- **Layanan Partisipan & Self-Service Profil:** [`services/participantService.js`](file:///d:/cims/cims/services/participantService.js) (`updateOwnProfile`)
- **Helper Periode Magang:** [`utils/helpers.js`](file:///d:/cims/cims/utils/helpers.js) (`formatInternshipPeriod`)
- **Kontroler Autentikasi:** [`controllers/authController.js`](file:///d:/cims/cims/controllers/authController.js)
- **Tampilan Registrasi & Profil:**
  - [`views/pages/auth/register.ejs`](file:///d:/cims/cims/views/pages/auth/register.ejs)
  - [`views/pages/intern/profil.ejs`](file:///d:/cims/cims/views/pages/intern/profil.ejs)
