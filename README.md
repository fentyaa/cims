# Cikara Internship Management System (CIMS)
Platform Pengelolaan dan Monitoring Peserta Magang di PT Cikara Bakti Nusantara

---

## 📁 Panduan Struktur Folder & Navigasi

Proyek ini telah dirapikan ke dalam struktur modular yang memudahkan pencarian file bimbingan, dokumen final, dan kode sumber aplikasi:

```text
cims/
├── Dokumen_Bimbingan_KP/          # 🌟 PUSAT DOKUMEN FINAL & MATERI BIMBINGAN
│   ├── 01_Laporan_Final/          # Naskah Laporan KP Final (.docx)
│   ├── 02_Presentasi_Sidang/      # Slide PPTX & PDF Presentasi Sidang KP
│   ├── 03_Referensi_Jurnal_Paper/ # 19 Dokumen PDF Jurnal Referensi Terindeks
│   └── 04_Diagram_dan_Aset/       # Diagram UML/ERD (MMD/SVG/PNG) & Screenshot Web
│
├── trash/                         # 🗑️ ARSIP FILE LAMA & DRAFT (TIDAK DIGUNAKAN)
│   ├── draft_laporan_lama/        # Cadangan & versi laporan sebelum restrukturisasi
│   ├── arsip_paper_mentah/        # Unduhan file mentah/zip jurnal
│   ├── skrip_helper_sementara/    # Skrip python pemeriksaan & alat bantu sementara
│   ├── slide_previews_lama/       # Render gambar slide versi awal
│   ├── scratch_dev/               # File scratch/pengujian sementara
│   └── arsip_zip/                 # Arsip zip diagram
│
├── docs/                          # 📖 DOKUMENTASI TEKNIS SISTEM
│   ├── diagrams/                  # Desain & alur sistem (UML, Activity, Sequence)
│   └── SECURITY_HARDENING.md      # Laporan penguatan keamanan (CSRF, RBAC, Bcrypt)
│
├── controllers/                   # Logika penanganan rute & alur HTTP
├── middlewares/                   # Autentikasi, otorisasi RBAC, upload, & CSRF
├── models/                        # Model & definisi data
├── prisma/                        # Skema basis data PostgreSQL (schema.prisma)
├── public/                        # Aset statis web (CSS, JS, gambar, upload)
├── routes/                        # Definisi endpoint URL aplikasi
├── services/                      # Logika bisnis (presensi, logbook, penilaian, dll)
├── storage/                       # Penyimpanan berkas lokal
├── tests/                         # Pengujian fungsional aplikasi
├── utils/                         # Fungsi pembantu, validator, & holiday helper
├── views/                         # Template antarmuka EJS dinamis
├── app.js                         # File utama server Express.js
├── seed.js                        # Data awal database (mentor, peserta, template)
├── package.json                   # Konfigurasi dependensi Node.js
└── .env                           # Konfigurasi environment database & session
```

---

## 🚀 Cara Menjalankan Aplikasi Web CIMS

1. **Instal Dependensi**:
   ```bash
   npm install
   ```

2. **Sinkronisasi Database (Prisma)**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Jalankan Seed Data (Opsional)**:
   ```bash
   node seed.js
   ```

4. **Jalankan Server Lokal**:
   ```bash
   npm run dev
   # atau
   node app.js
   ```
   Akses melalui browser di: `http://localhost:3000`

---

## 📌 Rincian Dokumen di `Dokumen_Bimbingan_KP/`

| Folder / File | Deskripsi |
|---|---|
| **`01_Laporan_Final/`** | Berisi file `LAPORAN KP (3) - Restrukturisasi BAB V - Final.docx` lengkap dengan 67 halaman sesuai format resmi. |
| **`02_Presentasi_Sidang/`** | Berisi file presentasi siap pakai `Presentasi_Sidang_KP_CIMS_Fenty_Anggraeni.pptx`, versi `.pdf`, dan format Office standard. |
| **`03_Referensi_Jurnal_Paper/`** | 19 berkas PDF jurnal penelitian berpenomoran urut (01–19) sesuai sitasi di Bab I, Bab II, Bab V, dan Daftar Pustaka. |
| **`04_Diagram_dan_Aset/`** | Berisi folder `Diagram_BAB_V` (seluruh diagram UML Use Case, Activity Diagram, dan ERD tiap increment) serta `Screenshots_Web_CIMS` (seluruh tangkapan layar antarmuka sistem). |
