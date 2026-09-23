# Sequence Diagram - Presensi Harian CIMS

## 1. Deskripsi Alur
Diagram ini memodelkan proses pencatatan presensi kehadiran oleh peserta magang (status WFO, WFH, Sakit, atau Izin) beserta validasi tanggal dan pembaruan metrik keaktifan (*streak / active days*).

---

## 2. Diagram Sequence Presensi (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Intern as Peserta Magang (Intern)
    participant View as View (EJS / Web UI)
    participant Ctrl as presenceController.js
    participant DB as Database (PostgreSQL / Prisma)

    Intern->>View: Buka halaman Presensi (/intern/presence)
    View->>Ctrl: GET /intern/presence
    Ctrl->>DB: prisma.presence.findFirst({ where: { userId, date: today } })
    DB-->>Ctrl: Return status presensi hari ini
    Ctrl-->>View: Render form kehadiran & histori presensi
    View-->>Intern: Tampilkan opsi: WFO, WFH, Izin, Sakit + unggah bukti jika izin/sakit

    Intern->>View: Pilih status kehadiran & klik tombol 'Submit Presensi'
    View->>Ctrl: POST /intern/presence (status, notes, attachment, _csrf)
    
    Ctrl->>Ctrl: Validasi jam kerja & verifikasi token CSRF
    alt Presensi sudah tercatat hari ini
        Ctrl-->>View: Flash error 'Anda sudah mengisi presensi hari ini'
        View-->>Intern: Tampilkan peringatan presensi duplikat
    else Presensi belum tercatat
        Ctrl->>DB: prisma.presence.create({ data: { userId, status, checkInTime: now } })
        DB-->>Ctrl: Data presensi berhasil tersimpan
        
        %% Update metrik gamifikasi / streak
        Ctrl->>DB: Update Active Days & Current Streak pada profil
        DB-->>Ctrl: Profil terupdate
        
        Ctrl-->>View: Flash success 'Presensi berhasil dicatat'
        View-->>Intern: Tampilkan badge sukses & update visual kalender
    end
```
