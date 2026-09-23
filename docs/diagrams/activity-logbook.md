# Activity Diagram - Pengisian dan Review Logbook Harian

## 1. Tujuan Diagram
Diagram ini memodelkan siklus alur kerja pelaporan aktivitas kerja harian oleh peserta magang (**Intern**), validasi pengisian laporan, penyimpanan status awal (`PENDING`), proses peninjauan dan pemberian catatan evaluasi oleh pembimbing (**Mentor**), hingga status laporan berubah menjadi (`REVIEWED`).

---

## 2. Activity Diagram (Mermaid)

```mermaid
flowchart TD
    %% Node Awal & Akhir
    StartNode((●))
    EndNode((◉))

    %% Swimlane INTERN
    subgraph Swimlane_Intern ["Intern (Peserta Magang)"]
        A1["Akses Halaman Logbook (/intern/logbook)"]
        A0_Info["Tampilkan Informasi Status:<br/>Tercatat IZIN / SAKIT Hari Ini<br/>(Form Pengisian Logbook Dinonaktifkan)"]
        A3{"Apakah Sudah Mengisi Logbook Hari Ini?"}
        A4["Tampilkan Logbook Hari Ini (Mode Edit Tersedia jika Belum Direview)"]
        A5["Isi Form Logbook Harian:<br/>- Deskripsi Aktivitas Kerja (min. 10 karakter)<br/>- Kendala yang Dihadapi (opsional)<br/>- Rencana Kerja Hari Berikutnya (opsional)"]
        A6["Submit Logbook (POST /intern/logbook/create)"]
        A7["Menerima Konfirmasi: Logbook Berhasil Dibuat (Status: PENDING)"]
        A8["Melihat Feedback / Komentar Mentor pada Riwayat Logbook (Status: REVIEWED)"]
    end

    %% Swimlane SISTEM CIMS
    subgraph Swimlane_System ["Sistem Backend CIMS"]
        S0["Query Presensi Hari Ini (getTodayPresence)"]
        S0_Check{"Apakah Presensi Hari Ini IZIN atau SAKIT?"}
        S1["Query Logbook Hari Ini (WHERE userId & date = TODAY)"]
        S2["Validasi Input Logbook & Guard Kehadiran (Tolak jika IZIN/SAKIT)"]
        S3{"Validasi Lolos?"}
        S4["Tampilkan Pesan Error Validasi Form"]
        S5["Simpan Data ke Tabel logbooks:<br/>- status = PENDING<br/>- mentorComment = NULL"]
        S6["Perbarui Data Logbook di Database:<br/>- mentorComment = komentar_mentor<br/>- status = REVIEWED<br/>- updatedAt = NOW()"]
    end

    %% Swimlane MENTOR
    subgraph Swimlane_Mentor ["Mentor (Pembimbing Magang)"]
        M1["Akses Daftar Logbook Peserta (/mentor/logbook)"]
        M2["Filter Logbook (Status PENDING / REVIEWED atau Cari Nama Peserta)"]
        M3["Pilih & Buka Detail Logbook Peserta (/mentor/logbook/:id)"]
        M4["Membaca Rincian Aktivitas, Kendala, & Rencana Peserta"]
        M5["Input Komentar / Catatan Evaluasi Review"]
        M6["Submit Review (POST /mentor/logbook/:id/review)"]
    end

    %% Alur Proses
    StartNode --> A1
    A1 --> S0
    S0 --> S0_Check
    S0_Check -- "Ya (Status IZIN / SAKIT)" --> A0_Info
    A0_Info --> EndNode
    S0_Check -- "Tidak (Hadir WFO/WFH atau Belum Presensi)" --> S1
    S1 --> A3
    A3 -- "Sudah Ada" --> A4
    A4 --> EndNode
    A3 -- "Belum Ada" --> A5
    A5 --> A6
    A6 --> S2
    S2 --> S3
    S3 -- "Tidak Valid" --> S4
    S4 --> A5
    S3 -- "Valid" --> S5
    S5 --> A7

    %% Alur Review oleh Mentor
    A7 --> M1
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> M5
    M5 --> M6
    M6 --> S6
    S6 --> A8
    A8 --> EndNode
```

---

## 3. Penjelasan Alur Aktivitas

1. **Sinkronisasi Status Kehadiran (Guard Izin/Sakit):** Sistem memeriksa status presensi peserta pada hari tersebut (`getTodayPresence`). Jika peserta tercatat `IZIN` atau `SAKIT`, formulir pengisian logbook otomatis dinonaktifkan untuk mencegah pelaporan kegiatan fiktif di hari ketidakhadiran.
2. **Pengisian Aktivitas Harian:** Pada hari aktif (WFO/WFH), peserta magang mencatat 3 komponen utama: deskripsi aktivitas/pekerjaan yang diselesaikan, kendala teknis yang dihadapi, serta rencana kerja hari berikutnya.
3. **Validasi dan Status Awal:** Sistem memvalidasi bahwa aktivitas diisi dengan detail memadai. Logbook yang baru disimpan otomatis mendapatkan status `PENDING` dan kolom komentar mentor masih bernilai `NULL`.
4. **Pemberian Ulasan oleh Mentor:** Mentor memeriksa antrean logbook pada `/mentor/logbook`. Mentor membaca deskripsi pekerjaan peserta lalu memberikan umpan balik, bimbingan, atau koreksi pada form komentar review.
5. **Perubahan Status:** Saat mentor mengirim komentar review, status logbook otomatis diperbarui menjadi `REVIEWED`. Peserta dapat langsung membaca catatan evaluasi tersebut pada tabel riwayat logbook masing-masing.

---

## 4. Dasar Implementasi Source Code

- **Route Logbook:** [`routes/index.js`](file:///d:/cims/cims/routes/index.js) (`/intern/logbook`, `/mentor/logbook`, `/mentor/logbook/:id/review`)
- **Controller Logbook:** [`controllers/logbookController.js`](file:///d:/cims/cims/controllers/logbookController.js) (Fungsi `internCreateLogbook`, `internLogbookPage`, `mentorReviewLogbook`, `mentorLogbookDetail`)
- **Layanan Logbook:** [`services/logbookService.js`](file:///d:/cims/cims/services/logbookService.js) (Fungsi `createLogbook`, `reviewLogbook`, `getTodayLogbook`, `getLogbookStats`)
- **Validasi Input:** [`utils/validators.js`](file:///d:/cims/cims/utils/validators.js) (Fungsi `validateLogbook`)
- **Skema Database:** [`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma) (`model Logbook`, `enum LogbookStatus { PENDING, REVIEWED }`)
