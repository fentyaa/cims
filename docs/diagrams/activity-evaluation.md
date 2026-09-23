# Activity Diagram - Penilaian Kinerja Magang (Evaluasi)

## 1. Tujuan Diagram
Diagram ini memodelkan alur penilaian performa peserta magang oleh **Mentor** berbasis 6 kriteria kompetensi standar, kalkulasi otomatis nilai akhir dan konversi predikat nilai (*grade huruf*), pengelolaan status (*Draft* / *Published*), serta kontrol visibilitas kartu nilai bagi peserta magang (**Intern**).

---

## 2. Activity Diagram (Mermaid)

```mermaid
flowchart TD
    %% Node Awal & Akhir
    StartNode((●))
    EndNode((◉))

    %% Swimlane MENTOR
    subgraph Swimlane_Mentor ["Mentor (Pembimbing Magang)"]
        M1["Akses Halaman Penilaian Peserta (/mentor/penilaian)"]
        M2["Pilih Peserta yang Akan Dinilai (/mentor/penilaian/buat/:userId)"]
        M3["Input Skor 6 Aspek Kompetensi (Skala 0 - 100):<br/>(Mendukung Desimal Koma '85,5' atau Titik '85.5')<br/>1. Kedisiplinan (Discipline)<br/>2. Tanggung Jawab (Responsibility)<br/>3. Komunikasi (Communication)<br/>4. Kerja Sama Tim (Teamwork)<br/>5. Inisiatif (Initiative)<br/>6. Keterampilan Teknis (Technical Skill)"]
        M4["Input Catatan Evaluasi Pembimbing & Rekomendasi Karir"]
        M5{"Pilih Aksi Simpan?"}
        M6["Simpan sebagai Draft (Status: DRAFT)"]
        M7["Publikasikan Nilai (Status: PUBLISHED)"]
    end

    %% Swimlane SISTEM CIMS
    subgraph Swimlane_System ["Sistem Backend CIMS"]
        S1["Normalisasi Format Desimal (Koma ke Titik) & Validasi Batas Rentang (0 <= Skor <= 100)"]
        S1_Check{"Apakah Semua Nilai Valid (0 s.d. 100)?"}
        S1_Err["Tampilkan Pesan Kesalahan Rentang Nilai & Kembalikan Isian Form"]
        S2["Kalkulasi Otomatis Nilai Akhir:<br/>finalScore = Rata-rata 6 Aspek (Presisi Float Desimal)"]
        S3["Konversi Otomatis Predikat Grade:<br/>• Skor &gt;= 85 : Grade A (Sangat Baik)<br/>• Skor 75 - 84 : Grade B (Baik)<br/>• Skor 65 - 74 : Grade C (Cukup)<br/>• Skor 50 - 64 : Grade D (Kurang)<br/>• Skor &lt; 50 : Grade E (Sangat Kurang)"]
        S4["Simpan Data ke Tabel evaluations (status = DRAFT, publishedAt = NULL)"]
        S5["Simpan Data ke Tabel evaluations (status = PUBLISHED, publishedAt = NOW())"]
        S6["Query Nilai Peserta (WHERE userId = session.user.id)"]
        S7{"Apakah Nilai Berstatus PUBLISHED?"}
        S8["Tampilkan Informasi: Penilaian Masih Dalam Proses Evaluasi Pembimbing"]
        S9["Tampilkan Kartu Hasil Penilaian Lengkap:<br/>• Skor 6 Kriteria Kompetensi Desimal<br/>• Nilai Akhir & Predikat Grade<br/>• Catatan & Rekomendasi Mentor"]
    end

    %% Swimlane INTERN
    subgraph Swimlane_Intern ["Intern (Peserta Magang)"]
        I1["Akses Halaman Nilai Saya (/intern/nilai)"]
        I2["Melihat Status Evaluasi Masih Draft / Belum Selesai"]
        I3["Melihat Kartu Hasil Evaluasi Nilai Resmi"]
    end

    %% Alur Input Nilai Mentor
    StartNode --> M1
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> M5
    M5 -- "Simpan Draft" --> M6
    M6 --> S1
    M5 -- "Publikasikan Sekarang" --> M7
    M7 --> S1
    S1 --> S1_Check
    S1_Check -- "Tidak Valid (Di Luar Rentang 0-100)" --> S1_Err
    S1_Err --> M3
    S1_Check -- "Valid (0 s.d. 100)" --> S2
    S2 --> S3
    S3 --> S4
    S3 --> S5

    %% Alur Akses Intern
    I1 --> S6
    S6 --> S7
    S7 -- "Belum Ada / Masih DRAFT" --> S8
    S8 --> I2
    I2 --> EndNode
    S7 -- "Status PUBLISHED" --> S9
    S9 --> I3
    I3 --> EndNode
```

---

## 3. Penjelasan Alur Aktivitas

1. **Pengukuran 6 Aspek Kinerja & Fleksibilitas Desimal:** Mentor mengevaluasi peserta magang berdasarkan 6 indikator kompetensi (Disiplin, Tanggung Jawab, Komunikasi, Kerja Sama Tim, Inisiatif, dan Keterampilan Teknis). Sistem mendukung masukan angka bulat maupun desimal berkoma lokal Indonesia (misal: `85,5`) yang dinormalisasi secara otomatis menjadi angka presisi mengambang (*Float*).
2. **Validasi Batas Rentang Skor Ketat:** Sistem memvalidasi bahwa setiap skor kompetensi berada dalam rentang $0 \le \text{Nilai} \le 100$. Jika ditemukan nilai di luar batas rentang (misal: `-5` atau `120`), penyimpanan ditolak dan formulir dimuat kembali dengan pesan galat validasi spesifik.
3. **Kalkulasi Skor dan Grade Otomatis:** Sistem secara otomatis menghitung nilai akhir rata-rata (*finalScore*) secara presisi desimal dan menentukan predikat huruf (*grade*) standar ($A \ge 85$, $B \ge 75$, $C \ge 65$, $D \ge 50$, $E < 50$).
4. **Kontrol Visibilitas (*Publication Workflow*):**
   - Jika disimpan sebagai `DRAFT`, nilai hanya dapat dilihat dan diedit oleh Mentor. Halaman nilai peserta magang akan menampilkan pesan informatif bahwa penilaian masih disusun oleh pembimbing.
   - Jika disimpan/diubah sebagai `PUBLISHED`, atribut `publishedAt` diisi dengan waktu saat ini, dan kartu hasil evaluasi resmi langsung terbuka dan dapat dilihat oleh peserta magang terkait.

---

## 4. Dasar Implementasi Source Code

- **Route Penilaian:** [`routes/index.js`](file:///d:/cims/cims/routes/index.js) (`/mentor/penilaian`, `/mentor/penilaian/buat/:userId`, `/mentor/penilaian/:id/publish`, `/intern/nilai`)
- **Controller Penilaian:** [`controllers/evaluationController.js`](file:///d:/cims/cims/controllers/evaluationController.js) (Fungsi `mentorCreate`, `mentorUpdate`, `mentorPublish`, `internNilai`)
- **Layanan Penilaian:** [`services/evaluationService.js`](file:///d:/cims/cims/services/evaluationService.js) (Fungsi `calculateScoreAndGrade`, `createEvaluation`, `publishEvaluation`, `getEvaluationByUserId`)
- **Validasi Nilai:** [`utils/validators.js`](file:///d:/cims/cims/utils/validators.js) (Fungsi `validateEvaluation`)
- **Skema Database:** [`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma) (`model Evaluation`, `enum EvaluationStatus { DRAFT, PUBLISHED, ARCHIVED }`)
