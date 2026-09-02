# Review teman — 2 Sep 2026

Sumber: [Google Docs](https://docs.google.com/document/d/1tOgvxToOVVkoIhhJzJCkreOL5o8vAD6GfCMD-BnP5IA/edit) · PDF: `Feedback and Input for GEHC WEBSITE.pdf`

## Open

- [ ] **STG-05** (P2 / fitur) Folder foto per kelompok mentoring (cover square + link Drive + 3–5 preview), bukan galeri umum. Halaman: portal Beyonders / Docs. **Ditunda** — butuh desain + Drive ACL, bukan bug kecil.

## Done

- [x] **STG-01** (P1 / UX) Tombol *Explore Our Structure* membuka section *Our People*; section itu tersembunyi sampai tombol diklik. Nav label diselaraskan ke Our People / Orang Kami. `#/leaders`
- [x] **STG-02** (P1 / fitur) QR unik di kartu “Kamu sudah terdaftar!” dari id + timestamp daftar, untuk daftar ulang hari H. `#/event/bakutau`
  - Scanner hari H: tab **Check-in** di Panel Divisi → Koinonia. `POST /api/events/:slug/check-in` (QR `GEHC-BT|{poolId}|{ms}`) + walk-in. RBAC: Komisi / Tim Kerja BOD / Koinonia.
- [x] **STG-03** (P0 / bug) Kartu pillar di `#/leaders` tidak lagi meregang kosong saat kotak lain dibuka (`items-start` pada grid).
- [x] **STG-04** (P1 / bug) Countdown event tick tiap detik (termasuk detik) dan muncul tanpa perlu refresh. `#/events`
- [x] **STG-06** (P2 / UX) Hover pada tombol peran di *Konteks Peran Aktif* (termasuk MENTOR).
- [x] **STG-07** (P0 / bug) Popup assign role di-portal ke `document.body` agar tidak perlu scroll ke atas.
- [x] **STG-08** (P1 / fitur) Notifikasi `ROLE_ASSIGNED` ke user yang mendapat peran baru (lonceng portal).

## Notes

- Scanner hari H: tab Check-in Koinonia (QR + walk-in + CSV). Migrasi: `_migrate-event-checkin.cjs`.
- Panel **Kanal WhatsApp** (`#/portal/.../wa-channels`) menyimpan tautan undangan saja (bukan WhatsApp API).
