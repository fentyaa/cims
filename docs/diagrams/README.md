# Katalog Diagram Desain Sistem Cikara Internship Management System (CIMS)

Seluruh diagram pemodelan sistem untuk Laporan Kerja Praktek di PT Cikara Bakti Nusantara disimpan secara terpisah dalam format Mermaid Markdown pada folder ini:

| No | Nama File | Jenis Diagram | Deskripsi & Peran dalam Laporan |
|---|---|---|---|
| 0 | [`incremental-model-teori.md`](./incremental-model-teori.md) | **Landasan Teori SDLC** | Alur teoritis *The Incremental Model* menurut Roger S. Pressman (5 aktivitas kerangka kerja & feedback loop) untuk **Bab II Tinjauan Pustaka**. |
| 0B | [`alur-kerja-pelaksanaan-magang.md`](./alur-kerja-pelaksanaan-magang.md) | **SOP / Prosedur Magang** | Alur kerja pelaksanaan magang (arahan mentor &rarr; studi &rarr; eksekusi &rarr; diskusi &rarr; uji &rarr; serah terima) untuk **Bab III.2 Prosedur Pelaksanaan**. |
| 1 | [`incremental-model-cims.md`](./incremental-model-cims.md) | **Flowchart / SDLC** | Alur penerapan *Incremental Model* pada CIMS (Increment 1, 2, 3) untuk **Bab III Metodologi** & **Bab V**. |
| 2 | [`use-case.md`](./use-case.md) | **UML Use Case** | Interaksi fungsional antara aktor *Mentor* dan *Intern* beserta relasi `<<include>>` dan `<<extend>>`. |
| 3 | [`activity-presence.md`](./activity-presence.md) | **UML Activity** | Alur presensi harian (WFO, WFH, Sakit, Izin), reset streak mangkir, deteksi mangkir berturut-turut, hingga penegakan otomatis sanksi drop-out 3 hari (status ARCHIVED). |
| 4 | [`activity-logbook.md`](./activity-logbook.md) | **UML Activity** | Alur pengisian dan peninjauan logbook harian oleh peserta dan mentor. |
| 5 | [`activity-evaluation.md`](./activity-evaluation.md) | **UML Activity** | Alur penilaian 6 kriteria kompetensi magang hingga publikasi nilai. |
| 6 | [`activity-registration.md`](./activity-registration.md) | **UML Activity** | Alur registrasi mandiri peserta dengan periode magang terkunci otomatis, persetujuan mentor, serta pembaruan profil mandiri (self-service profile). |
| 7 | [`sequence-presence.md`](./sequence-presence.md) | **UML Sequence** | Urutan pengiriman data presensi, validasi jam, dan update streak keaktifan. |
| 8 | [`sequence-logbook.md`](./sequence-logbook.md) | **UML Sequence** | Urutan pengajuan logbook, pengecekan CSRF, dan validasi *approve/revision* oleh mentor. |
| 9 | [`class-diagram.md`](./class-diagram.md) | **UML Class Diagram** | Struktur kelas sistem (User, Profile, Presence, Logbook, Evaluation, Announcement). |
| 10 | [`erd.md`](./erd.md) | **Entity Relationship** | Struktur relasi basis data relasional PostgreSQL dengan model Prisma. |

> **Catatan untuk Penyusunan Laporan:**
> Diagram di atas dapat dibuka langsung di GitHub / VS Code dengan ekstensi Mermaid Preview, atau disalin ke [Mermaid Live Editor](https://mermaid.live) untuk di-export menjadi format gambar PNG/SVG beresolusi tinggi bila ingin disisipkan ke dalam laporan cetak.
