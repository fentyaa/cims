# Class Diagram - Cikara Internship Management System (CIMS)

## 1. Tujuan Diagram
Diagram ini memodelkan struktur kelas entitas data pada sistem CIMS yang diturunkan langsung dari skema Object-Relational Mapping (**Prisma ORM**) di [`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma), termasuk atribut tipe data, enumerasi (*enums*), dan kardinalitas relasi antar-kelas.

---

## 2. Class Diagram (Mermaid)

```mermaid
classDiagram
    %% ========================================================
    %% ENUMERATIONS (Tipe Data Terdefinisi)
    %% ========================================================
    class Role {
        <<enumeration>>
        MENTOR
        INTERN
    }

    class ParticipantType {
        <<enumeration>>
        UNIVERSITY
        SMK
    }

    class AccountStatus {
        <<enumeration>>
        PENDING
        ACTIVE
        REJECTED
        ARCHIVED
    }

    class PresenceStatus {
        <<enumeration>>
        WFO
        WFH
        IZIN
        SAKIT
    }

    class LogbookStatus {
        <<enumeration>>
        PENDING
        REVIEWED
    }

    class EvaluationStatus {
        <<enumeration>>
        DRAFT
        PUBLISHED
        ARCHIVED
    }

    class AnnouncementCategory {
        <<enumeration>>
        INFORMASI
        JADWAL
        TUGAS
        LIBUR
        PENTING
        LAINNYA
    }

    class AnnouncementTarget {
        <<enumeration>>
        ALL
        UNIVERSITY
        SMK
    }

    class AnnouncementStatus {
        <<enumeration>>
        DRAFT
        PUBLISHED
        ARCHIVED
    }

    %% ========================================================
    %% ENTITY CLASSES (Model Database Prisma)
    %% ========================================================
    class User {
        +String id
        +String fullName
        +String email
        +String phoneNumber
        +String password
        +Role role
        +ParticipantType participantType
        +AccountStatus status
        +String university
        +String studyProgram
        +String studentId
        +String schoolName
        +String major
        +String classGrade
        +String internshipPeriod
        +DateTime internshipStartDate
        +DateTime internshipEndDate
        +String profilePhoto
        +String resetPasswordToken
        +DateTime resetPasswordExpires
        +String mentorId
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Session {
        +String sid
        +Json sess
        +DateTime expire
    }

    class Presence {
        +String id
        +String userId
        +DateTime date
        +PresenceStatus status
        +String notes
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Logbook {
        +String id
        +String userId
        +DateTime date
        +String activity
        +String obstacle
        +String nextPlan
        +String mentorComment
        +LogbookStatus status
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Announcement {
        +String id
        +String title
        +String content
        +AnnouncementCategory category
        +AnnouncementTarget targetType
        +String attachment
        +DateTime publishDate
        +DateTime expireDate
        +AnnouncementStatus status
        +String createdById
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Evaluation {
        +String id
        +String userId
        +Float discipline
        +Float responsibility
        +Float communication
        +Float teamwork
        +Float initiative
        +Float technicalSkill
        +Float finalScore
        +String grade
        +String mentorComment
        +String recommendation
        +EvaluationStatus status
        +DateTime publishedAt
        +String mentorId
        +DateTime createdAt
        +DateTime updatedAt
    }

    %% ========================================================
    %% RELASI ANTAR KELAS (CARDINALITY & ASSOCIATIONS)
    %% ========================================================
    
    %% Relasi Self-Referencing Mentor - Mentee
    User "0..1" --> "0..*" User : membimbing (mentor - mentees)

    %% Relasi User dengan Presensi & Logbook
    User "1" --> "0..*" Presence : mencatat presensi
    User "1" --> "0..*" Logbook : mengisi logbook

    %% Relasi User dengan Penilaian (Evaluation)
    User "1" --> "0..1" Evaluation : menerima evaluasi (intern)
    User "0..1" --> "0..*" Evaluation : memberikan nilai (mentor)

    %% Relasi User dengan Pengumuman
    User "1" --> "0..*" Announcement : membuat pengumuman (mentor)

    %% Asosiasi Tipe Enumerasi ke Kelas
    User ..> Role
    User ..> ParticipantType
    User ..> AccountStatus
    Presence ..> PresenceStatus
    Logbook ..> LogbookStatus
    Evaluation ..> EvaluationStatus
    Announcement ..> AnnouncementCategory
    Announcement ..> AnnouncementTarget
    Announcement ..> AnnouncementStatus
```

---

## 3. Penjelasan Struktur Model

1. **Model `User` (Multi-Peran & Polimorfik Peserta):** Berfungsi sebagai entitas inti. Atribut `role` membedakan apakah pengguna adalah `MENTOR` atau `INTERN`. Atribut `participantType` menampung variasi data instansi (`UNIVERSITY` untuk Mahasiswa dengan atribut `university`, `studyProgram`, `studentId` atau `SMK` untuk Siswa dengan atribut `schoolName`, `major`, `classGrade`). Relasi *self-referencing* `mentorId` menghubungkan peserta magang dengan pembimbingnya.
2. **Model `Presence` & `Logbook`:** Memiliki integritas data *composite unique constraint* pada `[userId, date]`, memastikan bahwa setiap peserta hanya memiliki tepat satu catatan absensi dan satu catatan logbook pada tanggal tertentu.
3. **Model `Evaluation`:** Memiliki relasi *One-to-One* unik terhadap `userId` peserta magang (`userId @unique`) untuk menjamin satu peserta hanya memiliki satu rekapitulasi penilaian akhir magang yang mencakup 6 indikator kompetensi, nilai akhir (*finalScore*), dan *grade*.
4. **Model `Announcement`:** Memfasilitasi publikasi informasi dan arahan kerja dari mentor kepada peserta magang dengan segmentasi target (Mahasiswa, SMK, atau Seluruh Peserta).
5. **Model `Session`:** Merepresentasikan tabel penyimpanan sesi login server-side dari library `connect-pg-simple`.

---

## 4. Dasar Implementasi Source Code

- **Definisi Model & Relasi:** [`prisma/schema.prisma`](file:///d:/cims/cims/prisma/schema.prisma) (Baris 11–262)
- **Konfigurasi Instance Prisma Client:** [`config/database.js`](file:///d:/cims/cims/config/database.js)
- **Skrip Seeding & Relasi Dummy Data:** [`seed.js`](file:///d:/cims/cims/seed.js)
