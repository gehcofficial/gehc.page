# System Architecture & User Flow — GEHC Youth Ecosystem (Revised)

Dokumentasi arsitektur sistem, struktur database (Role-Based Access Control), dan Algoritma Regenerasi Kelompok untuk portal digital GMIM Eben Haezer Cikarang (GEHC).

---

## 1. Definisi Persona & RBAC (Role-Based Access Control)

Sistem menggunakan Autentikasi Google (Single Sign-On Gmail pribadi) yang dipetakan ke dalam Role di database (TiDB). Satu email bisa berganti Role seiring waktu tanpa kehilangan data historis.

| Level | Role Tag | Deskripsi & Akses Sistem |
|---|---|---|
| **L1** | `SUPERADMIN` | **Tim Tech / Developer.** Akses penuh ke *source code*, konfigurasi *environment*, integrasi API (Google Drive), dan manipulasi *database* tingkat dewa. |
| **L2** | `BPMJ` | **Badan Pekerja Majelis Jemaat.** Akses *Read-Only* ke seluruh dasbor statistik untuk melihat kesehatan rohani pemuda tanpa bisa mengubah data operasional. |
| **L3** | `KOMISI` | **Komisi Pemuda (Ketua, Wakil, Sekretaris, Bendahara).** *Executive Access*. Bisa merombak struktur, *approve* pergantian Mentor, me-*review* laporan *idle*, dan mengontrol arah platform. |
| **L4** | `COMMITTEE` | **Tim Kerja & Main Speaker.** *Operational Access*. Bisa mem-posting Warta, Modul Kurikulum, Kegiatan, dan melihat hasil input laporan dari semua grup untuk evaluasi. |
| **L5** | `MENTOR` | Pemimpin aktif grup. Akses *Write* untuk input laporan ibadah (*monitoring*), absen, dan memberikan *flag* / catatan ke *Mentee* di grup binaannya saja. |
| **L6** | `CO_MENTOR` | Wakil pemimpin grup. Bisa menggantikan peran *Write* jika Mentor utama berhalangan. |
| **L7** | `MENTEE` | Anggota aktif grup. Akses *Read-Only* untuk melihat profil grup, *family tree*, warta, dan jadwal pertemuan grupnya sendiri. |
| **L8** | `ALUMNI` | **Idle / Inaktif / Lulus.** Anggota historis (Gen-0/1) yang sudah menikah (PKB/WKI), pindah kota/negara, atau inaktif >1 bulan. Tetap punya akun untuk *login* melihat riwayat, tapi tidak memakan "kursi/kuota" di grup aktif. |

---

## 2. Sistem Regenerasi Kelompok (The 3 Parameters)

Inti dari ekosistem GEHC Youth adalah **Mitosis Kelompok** (Pembelahan & Penggabungan berdasarkan data). Setiap grup dibatasi ambang batas (*threshold*) **maksimal 10 orang** (gabungan Mentor, Co-Mentor, dan Mentee).

### Parameter 1: Generation & Newcomers (Logika Pembelahan)
Jika sebuah grup (Parent Group, misal: **RUACH**) hampir mencapai *threshold* 10 orang, dan ada kedatangan mahasiswa/pekerja baru (*Newcomers*), sistem akan memicu pembelahan generasi:
1. **Fill the Gap:** *Newcomers* dimasukkan ke RUACH sampai genap 10 orang.
2. **Promote & Split:** Sisa *Newcomers* membutuhkan grup baru. Sistem merekomendasikan 2 *Mentee* paling matang dari RUACH (Parent) untuk dinaikkan Role-nya menjadi `MENTOR` dan `CO_MENTOR` untuk membentuk **RUACH 2** (Child).
3. **Redistribute:** *Mentee* yang tersisa di RUACH dan sisa *Newcomers* dibagi proporsional. Kedua grup kini memiliki ruang kosong untuk bertumbuh kembali. Relasi "Parent-Child" (*Family Tree*) ini direkam permanen di *database*.

### Parameter 2: Role Shuffling (Transisi Fleksibel)
Gereja mengakomodasi kesibukan pekerja 9-to-5 dan mahasiswa tugas akhir. 
*   **Logika:** Jika `MENTOR` dan atau `CO_MENTOR` tidak bisa melanjutkan komitmen kuartalnya, Role-nya diturunkan menjadi `MENTEE` (ia tetap di grup, menjadi anggota biasa agar tetap tergembala). `CO_MENTOR` atau `MENTEE` yang siap akan dinaikkan statusnya menjadi `MENTOR` dan atau `CO_MENTOR`. Perpindahan Role ini mulus tanpa membuat akun baru.

### Parameter 3: Activity & The Alumni Protocol
Pemuda bersifat nomaden. Untuk menjaga akurasi data grup yang *actively serving*:
*   **Logika Idle:** Jika *Mentee* tidak hadir / *offline* selama 4 minggu berturut-turut (berdasarkan input laporan Mentor), sistem memberikan notifikasi *Auto-Flag* ke Komisi.
*   **Logika Transisi:** Jika anggota pindah ke luar negeri, luar kota, atau menikah (masuk PKB/WKI), statusnya diubah menjadi `ALUMNI`. Mereka dikeluarkan dari *Active Group Capacity* (memberikan slot kosong untuk *Newcomer*), tapi nama dan jejak pelayanannya tetap terukir di halaman *Family Tree History* grup tersebut.

---

## 3. Integrasi AI / Decision Support System (The "Jethro" Engine)

Untuk mengelola 3 parameter di atas tanpa membebani Komisi secara manual, platform akan dilengkapi dengan fungsi rekomendasi otomatis (AI-assisted logic) di *Dashboard Komisi*.

*Fitur Automasi Dasbor Komisi:*
1.  **Placement Recommender (AI Penempatan):** Ketika ada *Newcomers* massal, sistem menganalisa kapasitas grup. (Contoh *Prompt Sistem*: *"RUACH 1 tersisa 2 slot, SHALOM tersisa 1 slot. Rekomendasi: Assign 2 newcomers ke RUACH 1, 1 ke SHALOM"*).
2.  **Mitosis Trigger (Notifikasi Pecah Grup):** Sistem memberi *alert*: *"Grup AVODAH sudah mencapai 10/10 anggota aktif. 2 Mentee (Nama A & Nama B) memiliki tingkat kehadiran 100%. Rekomendasikan mereka untuk buka AVODAH Generasi 2."*
3.  **Merger / Consolidation Suggestion:** AI mengamankan grup yang sekarat. Jika banyak *Mentee* di RUACH 1 dan RUACH 2 secara serentak lulus/pindah menjadi `ALUMNI` (tersisa 3 orang per grup), sistem menyarankan: *"Kapasitas gabungan RUACH 1 & RUACH 2 kini hanya 6 orang. Rekomendasi: Merger kembali menjadi RUACH (Parent) untuk memaksimalkan koinonia."*

---

## 4. Revisi Struktur Halaman & UI Landing Page

### Halaman Publik (Tanpa Login)
*   **Hero Section:** Visual retreat. Headline: *"From 9-to-5 to the Altar. Beyond the Sunday Walk."*
*   **Manifesto:** DNA Beyonders (Authenticity & Coram Deo).
*   **Carousel 10 Grup (Active State):** Menampilkan grup yang **sedang aktif**. Jika RUACH sudah beranak menjadi RUACH 1 & RUACH 2, keduanya tampil. Kartu menampilkan nama Mentor aktif saat ini.
*   **Struktur Hirarki Eksekutif:** Menampilkan profil BPMJ, Komisi Pemuda, dan Tim Kerja divisi.

### Dynamic Page (Klik Detail Grup dari Carousel)
*   **Active Roster:** Menampilkan Mentor, Co-Mentor, dan Mentee yang *currently active* di grup tersebut.
*   **The Heritage Tab (Family Tree History):** Tab khusus untuk melihat sejarah grup. *User* bisa melihat siapa *founding* Mentor-nya di Gen-0 (Kuartal III 2026), dan daftar para `ALUMNI` yang kini berkarya di luar kota/luar negeri.
*   **Gallery (G-Drive API):** Tarikan otomatis foto-foto kegiatan grup dari folder Google Drive GEHC.