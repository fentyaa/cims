# Sequence Diagram - Pengisian dan Validasi Logbook CIMS

## 1. Deskripsi Alur
Diagram ini menggambarkan interaksi sekuensial antara Peserta Magang (*Intern*), Antarmuka Web CIMS, Kontroler (`logbookController`), Database PostgreSQL (via Prisma), dan Pembimbing Lapangan (*Mentor*).

---

## 2. Diagram Sequence Logbook (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Intern as Peserta Magang (Intern)
    participant View as View (EJS / Web UI)
    participant Ctrl as logbookController.js
    participant DB as Database (PostgreSQL / Prisma)
    actor Mentor as Pembimbing Lapangan (Mentor)

    %% Fase 1: Input Logbook oleh Peserta
    Note over Intern, View: Tahap Pemeriksaan Kehadiran & Pengisian Logbook Harian
    Intern->>View: Buka halaman Logbook (/intern/logbook)
    View->>Ctrl: GET /intern/logbook
    Ctrl->>DB: prisma.presence.findUnique (Cek status presensi hari ini)
    DB-->>Ctrl: Return data presensi hari ini (WFO / WFH / IZIN / SAKIT)
    alt Presensi Tercatat IZIN atau SAKIT
        Ctrl-->>View: Render peringatan: Presensi tercatat IZIN / SAKIT
        View-->>Intern: Tampilkan banner info (Form pengisian logbook dinonaktifkan)
    else Hadir Hari Aktif (WFO / WFH)
        Ctrl-->>View: Render form isian logbook harian
        Intern->>View: Input deskripsi kegiatan, kendala, & rencana kerja
        View->>Ctrl: POST /intern/logbook (data + _csrf token)
        Ctrl->>Ctrl: Validasi input & guard kehadiran aktif
        Ctrl->>DB: prisma.logbook.create({ data: {...}, status: 'PENDING' })
        DB-->>Ctrl: Data logbook berhasil disimpan
        Ctrl-->>View: Flash message 'Logbook berhasil dikirim' & redirect
        View-->>Intern: Tampilkan riwayat logbook (status: PENDING)
    end

    %% Fase 2: Review dan Validasi oleh Mentor
    Note over Mentor, View: Tahap Peninjauan & Verifikasi oleh Mentor
    Mentor->>View: Buka daftar logbook bimbingan (/mentor/logbook)
    View->>Ctrl: GET /mentor/logbook
    Ctrl->>DB: prisma.logbook.findMany({ include: { user: true } })
    DB-->>Ctrl: Return daftar logbook peserta
    Ctrl-->>View: Render tabel logbook & tombol aksi (Approve / Revise)
    View-->>Mentor: Tampilkan daftar logbook peserta bimbingan

    %% Aksi Keputusan Mentor
    alt Logbook Disetujui (Approved)
        Mentor->>View: Klik 'Setujui' (Approve) & beri catatan umpan balik
        View->>Ctrl: POST /mentor/logbook/:id/approve
        Ctrl->>DB: prisma.logbook.update({ status: 'APPROVED', feedback: notes })
        DB-->>Ctrl: Status terupdate
        Ctrl-->>View: Flash message 'Logbook disetujui'
        View-->>Mentor: Tampilkan status hijau (APPROVED)
        View-->>Intern: Status logbook berubah menjadi APPROVED di dashboard
    else Logbook Perlu Revisi / Ditolak (Rejected/Needs Revision)
        Mentor->>View: Klik 'Minta Perbaikan' & isi alasan penolakan
        View->>Ctrl: POST /mentor/logbook/:id/reject (alasan revisi)
        Ctrl->>DB: prisma.logbook.update({ status: 'REVISION', feedback: reasons })
        DB-->>Ctrl: Status terupdate
        Ctrl-->>View: Flash message 'Permintaan revisi dikirim'
        View-->>Intern: Notifikasi revisi + catatan mentor
    end
```
