# Draft susunan nav portal — 21 Sep 2026

> **Status:** draft untuk ditinjau. **Belum ada** perubahan nav yang diterapkan.
> Melanjutkan [`2026-09-20-portal-audit.md`](2026-09-20-portal-audit.md) bagian 5 (P2-1).
> Dokumen ini fokus ke **cara implementasi aman** + **keputusan yang diminta** — bukan mengulang daftar usulan.

---

## 1. Tujuan

Kurangi beban kognitif staf inti (KOMISI 21 tab, SUPERADMIN 26) dengan menggabungkan destinasi yang satu domain menjadi **1 destinasi + sub-tab**, tanpa menghapus komponen/fitur apa pun.

Target (dari audit bagian 5):

| Peran | Sekarang | Usulan |
|---|---|---|
| MENTEE | 7 | 5 |
| MENTOR / CO_MENTOR | 7 | 6 |
| ALUMNI | 4 | 4 (tetap) |
| COMMITTEE | 15–16 | 8 |
| BPMJ | 11 | 8 |
| KOMISI | 21 | 10 |
| SUPERADMIN | 26 | 11 |

---

## 2. Prinsip implementasi (backward-compatible)

1. **ID tab lama tetap hidup.** `#/portal/<ns>/<tab>` lama tetap valid dan merender komponen yang sama. Sub-tab hanya mengubah *cara mengakses*, bukan rute.
2. **Sidebar menampilkan "parent"**, bukan tiap tab. Parent punya daftar `children`.
3. **Sub-tab bar** memakai `ScrollTabBar` yang sudah ada di `PortalLayout`.
4. **Highlight** parent aktif dihitung dari child yang sedang aktif.
5. **Tidak menghapus komponen.** Hanya `portal-nav-config.ts` + `PortalLayout` + label yang berubah.
6. **Rollout bertahap**: mulai 1 peran (COMMITTEE), verifikasi, baru KOMISI/SUPERADMIN.

---

## 3. Peta parent → children

| Parent (baru) | children (id lama) | Peran |
|---|---|---|
| **Kegiatan** | `kegiatan`, `event-info` | semua |
| **Orang** | `people`, `youth-gehc`, `onboarding`, `catalog` | KOMISI |
| **Regenerasi** | `jethro`, `jethro-placement`, `beyonders-leaders` | KOMISI, BPMJ, COMMITTEE |
| **Konten** | `content-weekly`, `content-activities`, `content-testimonials`, `media-guide`, `announcements` | COMMITTEE, KOMISI |
| **Struktur & Hirarki** | `struktur`, `org-hierarchy` | COMMITTEE, KOMISI |
| **Sistem** | `integrations`, `church-info` | KOMISI, BPMJ |
| **Kelompok & Monitoring** | `groups-monitoring` (8 sub-tab internal, sudah ada) | 6 peran |

Catatan: `dashboard`, `account`, `kesaksian`, `pastoral-care`, `events`, `divisions`, `wa-channels` tetap destinasi mandiri.

---

## 4. Perubahan teknis yang dibutuhkan

1. `src/lib/portal-nav-config.ts`
   - Tambah tipe `children?: string[]` pada `PortalNavItemDef`.
   - Tambah entri parent + `NAMESPACE_NAV_OVERRIDES` baru per peran.
   - `buildPortalNavItems()` mengembalikan parent (dengan children ter-resolve).
2. `src/components/portal/PortalLayout.tsx`
   - Sidebar iterasi parent; render sub-tab bar saat parent aktif.
   - `activeTab` tetap child id (routing tidak berubah).
   - `handleNavClick(parentId)` → child pertama; sub-tab → child id.
3. Label i18n (`portal-id.ts`/`portal-en.ts`) untuk nama parent.
4. `tests/e2e/portal-nav-roles.spec.ts` — **wajib diperbarui**: test saat ini meng-assert label tab lama sebagai tombol sidebar (mis. `Orang & Undangan`, `Onboarding Pipeline`, `Jemaat`, `Review Penempatan`, `Kelola Warta Pemuda`, `Struktur Organisasi`). Setelah merge, label itu pindah ke sub-tab.

---

## 5. Dampak & risiko

| Area | Dampak |
|---|---|
| Deep link / bookmark lama | **Aman** (child id tetap routable) |
| `docs/tech/nav-api-parity.md` | Perlu disinkronkan (nav ↔ API) |
| e2e `portal-nav-roles` | **Perlu ditulis ulang** untuk struktur parent/sub-tab |
| Onboarding (2 tab) | Tidak berubah |
| `PortalHelpDrawer` / `PortalSearchPalette` | Ikut menampilkan parent + child — perlu penyesuaian label |

---

## 6. Keputusan yang diminta

- [ ] Setujui **peta parent → children** di bagian 3.
- [ ] Setujui **urutan & grup** sidebar per peran (Utama · Komunitas · Konten · Kerja · Sistem).
- [ ] Setujui **rollout bertahap** (COMMITTEE dulu) vs langsung semua peran.
- [ ] Setujui penulisan ulang `tests/e2e/portal-nav-roles.spec.ts`.
- [ ] (Opsional) `event-info` tetap jadi parent sendiri untuk ALUMNI/MENTEE (audit: ALUMNI tetap punya Info Event) — atau digabung ke Kegiatan untuk semua peran?

---

## 7. Rencana eksekusi (setelah disetujui)

1. Config + tipe `children` + unit test `buildPortalNavItems` (tanpa ubah UI).
2. Sub-tab bar di `PortalLayout` untuk 1 parent (Kegiatan) → verifikasi staging.
3. Terapkan parent lain per peran (COMMITTEE → KOMISI → BPMJ → SUPERADMIN).
4. Perbarui e2e + `nav-api-parity.md`.
5. Verifikasi device (mobile) + staging → `main`.
