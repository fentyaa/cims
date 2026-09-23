# Activity Diagram - Presensi Harian dan Penegakan Kebijakan Drop-Out 3 Hari Mangkir

## 1. Tujuan Diagram
Diagram ini memodelkan alur pencatatan presensi harian oleh peserta magang (**Intern**), validasi pembatasan kehadiran pada hari kerja, mekanisme pemutusan rangkaian mangkir saat peserta hadir/izin/sakit, serta alur penegakan otomatis kebijakan **Drop-Out (Status ARCHIVED)** apabila peserta tidak masuk kerja selama **3 hari berturut-turut** tanpa keterangan resmi.

---

## 2. Activity Diagram (Mermaid)

```mermaid
flowchart TD
    %% Node Awal & Akhir
    StartNode((●))
    EndNode((◉))

    %% Swimlane INTERN
    subgraph Swimlane_Intern ["Intern (Peserta Magang)"]
        A1["Akses Halaman Presensi (/intern/presensi)"]
        A2["Periksa Status Hari Ini (Hari Libur / Sudah Absen)"]
        A3{"Apakah Sudah Mengisi Hari Ini?"}
        A4["Tampilkan Status & Riwayat Kehadiran (Form Presensi Terkunci)"]
        A5["Pilih Status Kehadiran (WFO / WFH / IZIN / SAKIT)"]
        A6["Input Keterangan Catatan / Bukti Surat (Wajib jika Izin/Sakit)"]
        A7["Submit Form Presensi Harian (POST /intern/presensi)"]
        A8["Menerima Notifikasi Keberhasilan Presensi"]
        A9["Lihat Progres Hari Kerja Magang di Dashboard"]
    end

    %% Swimlane SISTEM CIMS
    subgraph Swimlane_System ["Sistem Backend CIMS"]
        S1["Cek Kalender Hari Libur Nasional & Hari Minggu (holidayHelper.js)"]
        S2["Query Rekapitulasi Presensi Tanggal Berjalan"]
        S3["Validasi Input & Token Keamanan CSRF"]
        S4["Simpan Data Presensi ke Tabel presences (Unique [userId, date])"]
        S5["Reset Streak Mangkir (Consecutive Absences = 0) Karena Ada Kabar/Kehadiran"]
        S6["Kalkulasi Ulang Hari Kerja:
        - Hari ke-X dari Y Total Hari Kerja Magang
        - Sisa Hari Kerja yang Belum Dijalani
        - Persentase Progres Ketercapaian"]
        
        %% Logika Pemeriksaan Mangkir Harian
        S7{"Pemeriksaan Rutin: Ada Hari Kerja Tanpa Presensi/Keterangan?"}
        S8["Hitung Jumlah Hari Mangkir Berturut-turut (Senin s.d. Sabtu)"]
        S9{"Apakah Streak Mangkir >= 3 Hari Kerja?"}
        S10["Pasang Banner & Lencana Peringatan: Mangkir 1 - 2 Hari"]
        S11["Eksekusi Drop-Out Otomatis (enforceDropoutPolicy):
        - Ubah Status Peserta Menjadi ARCHIVED
        - Catat Keterangan Drop-Out 3 Hari Mangkir"]
    end

    %% Swimlane MENTOR
    subgraph Swimlane_Mentor ["Mentor (Pembimbing Lapangan)"]
        M1["Akses Halaman Monitoring Presensi (/mentor/presensi)"]
        M2["Pantau Rekap Kehadiran, Status WFO/WFH, & Izin"]
        M3["Menerima Lencana Peringatan '⚠️ X Hari Mangkir' di Tabel Peserta"]
        M4["Melihat Status Peserta yang Terkena Drop-Out Otomatis"]
    end

    %% Alur Normal Presensi
    StartNode --> A1
    A1 --> S1
    S1 --> S2
    S2 --> A2
    A2 --> A3
    A3 -- "Sudah Presensi" --> A4
    A4 --> EndNode
    A3 -- "Belum Presensi" --> A5
    A5 --> A6
    A6 --> A7
    A7 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> A8
    A8 --> A9
    A9 --> EndNode

    %% Alur Evaluasi Mangkir & Drop-Out
    S1 --> S7
    S7 -- "Ada Hari Kerja Mangkir" --> S8
    S8 --> S9
    S9 -- "1 - 2 Hari" --> S10
    S10 --> M3
    S9 -- ">= 3 Hari" --> S11
    S11 --> M4
    M3 --> EndNode
    M4 --> EndNode

    %% Alur Monitoring Mentor
    S4 -.-> M1
    M1 --> M2
    M2 --> EndNode
```

---

## 3. Penjelasan Alur Aktivitas Presensi dan Drop-Out

1. **Verifikasi Hari Kerja & Tanggal Merah:**
   Sebelum form presensi dapat diakses, modul [`holidayHelper.js`](file:///d:/cims/cims/utils/holidayHelper.js) memverifikasi apakah hari ini adalah hari kerja (Senin s.d. Sabtu). Hari Minggu dan Hari Libur Nasional resmi dilewati dan tidak dihitung sebagai hari mangkir.
2. **Pencatatan Presensi & Pemutusan Rangkaian Mangkir:**
   Jika peserta mencatatkan presensi (`WFO`, `WFH`, `IZIN`, atau `SAKIT`), sistem menganggap peserta telah memberikan keterangan resmi (*ada kabar*). Akibatnya, hitungan mangkir berturut-turut langsung **direset kembali ke 0**.
3. **Pemberlakuan Kebijakan Drop-Out 3 Hari Mangkir Berturut-turut:**
   - Melalui fungsi `checkConsecutiveUnexcusedAbsences` pada [`presenceService.js`](file:///d:/cims/cims/services/presenceService.js), sistem menelusuri riwayat hari kerja ke belakang.
   - Jika ditemukan **1 s.d. 2 hari kerja berturut-turut** tanpa presensi atau surat izin/sakit, sistem memunculkan banner peringatan dini berwarna kuning bagi peserta dan lencana `⚠️ X Hari Mangkir` bagi mentor.
   - Jika peserta mangkir selama **$\ge 3$ hari kerja berturut-turut**, fungsi `enforceDropoutPolicy` secara otomatis mengubah status akun peserta menjadi `ARCHIVED` (Drop-Out / Tidak Melanjutkan Magang).
4. **Kalkulasi Hari Kerja Terpadu:**
   Sistem menghitung metrik hari kerja secara presisi (hari ke-X dari total Y hari kerja, sisa hari kerja, dan persentase progres ketercapaian) yang ditampilkan dalam bentuk progress bar ramping di dashboard mentor dan intern.

---

## 4. Dasar Implementasi Source Code

- **Layanan Presensi & Kebijakan Mangkir:** [`services/presenceService.js`](file:///d:/cims/cims/services/presenceService.js) (`checkConsecutiveUnexcusedAbsences`, `enforceDropoutPolicy`)
- **Layanan Kalkulasi Progres:** [`services/gamificationService.js`](file:///d:/cims/cims/services/gamificationService.js) (`calculateInternshipProgress`)
- **Kontroler Presensi:** [`controllers/presenceController.js`](file:///d:/cims/cims/controllers/presenceController.js)
- **Helper Hari Libur:** [`utils/holidayHelper.js`](file:///d:/cims/cims/utils/holidayHelper.js)
