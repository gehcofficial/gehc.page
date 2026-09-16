/**
 * Katalog fitur portal (server-side) untuk asisten "Tanya AI".
 * Difilter per peran sebelum dikirim ke LLM — jangan bocorkan fitur peran lain.
 *
 * Jaga sinkron dengan `src/lib/portal-actions.ts` + `t.portal.guides`
 * (judul/langkah ID) bila berubah.
 */
export const PORTAL_FEATURE_CATALOG = [
  { id: 'event-info', page: 'event-info', roles: [], title: 'Info Event / QR', purpose: 'Kartu peserta, QR daftar ulang, lokasi, dan grup WhatsApp event.', steps: ['Buka Info Event.', 'Pilih event/tanggal bila ada.', 'Tunjukkan QR di hari H.'] },
  { id: 'kegiatan', page: 'kegiatan', roles: [], title: 'Kegiatan', purpose: 'Kalender kegiatan: umum, khusus, internal, rekreasional.', steps: ['Buka Kegiatan.', 'Pilih tanggal/event.', 'Buka Info Event untuk QR & WA.'] },
  { id: 'dashboard', page: 'dashboard', roles: ['COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'], title: 'Dashboard & Ringkasan', purpose: 'Ringkasan kelompok, monitoring, konten, dan HUT.', steps: ['Buka Dashboard.', 'Baca ringkasan.', 'Ikuti pintasan panel.'] },
  { id: 'groups-monitoring', page: 'groups-monitoring', roles: ['KOMISI', 'BPMJ', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], title: 'Monitoring Kelompok', purpose: 'Monitoring 10 kelompok binaan/anggota.', steps: ['Buka Monitoring.', 'Pilih kelompok.', 'Isi/lihat catatan.'] },
  { id: 'pastoral-care', page: 'pastoral-care', roles: ['KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], title: 'Portal Doa', purpose: 'Kabar penggembalaan privat & permintaan doa.', steps: ['Buka Portal Doa.', 'Tulis permintaan.', 'Kirim (privat).'] },
  { id: 'event-penatalayan', page: 'events', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], title: 'Tugaskan penatalayan', purpose: 'Isi roster ibadah: liturgist, WL, singer, pemusik, pembaca firman, doa, kolektor, MC, media.', steps: ['Buka Program & Event.', 'Pilih event.', 'Di panel Penatalayan & Liturgi tambah orang per komponen.', 'Bisa salin dari event sebelumnya.'] },
  { id: 'event-add-division', page: 'events', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], title: 'Tambah divisi ke event', purpose: 'Aktifkan pilar (Liturgia..Benzarpr) untuk event.', steps: ['Buka Program & Event.', 'Pilih event.', 'Klik chip Tambah divisi.'] },
  { id: 'event-create', page: 'events', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], title: 'Buat event baru', purpose: 'Daftarkan event dan siapkan folder Drive.', steps: ['Buka Program & Event.', 'Klik Program (buat).', 'Isi nama, jenis, tanggal, divisi.', 'Simpan.'] },
  { id: 'upload-rhb', page: 'divisions', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], title: 'Unggah RHB / materi', purpose: 'Unggah materi pemuridan per event ibadah.', steps: ['Buka Panel Divisi.', 'Pilih Didaskalia → Studio.', 'Pilih event/minggu lalu unggah.'] },
  { id: 'divisions', page: 'divisions', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], title: 'Panel Divisi', purpose: 'Workspace permanen 6 divisi + sub-divisi.', steps: ['Buka Panel Divisi.', 'Pilih divisi.', 'Kerja di tab yang tersedia.'] },
  { id: 'people-provision', page: 'people', roles: ['SUPERADMIN', 'KOMISI'], title: 'Provision akun & undang', purpose: 'Buat akun siap login atau bagikan link undangan.', steps: ['Buka Orang & Undangan.', 'Provision & Undang atau Link Undangan.', 'Kirim kredensial/link.'] },
  { id: 'wa-channels', page: 'wa-channels', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'], title: 'Kanal WhatsApp', purpose: 'Link grup permanen & per event.', steps: ['Buka Kanal WhatsApp.', 'Pilih layer.', 'Tempel & simpan link.'] },
  { id: 'manage-warta', page: 'content-weekly', roles: ['SUPERADMIN', 'COMMITTEE'], title: 'Kelola Warta Pemuda', purpose: 'Tulis & terbitkan warta.', steps: ['Buka Kelola Warta.', 'Buat/ubah entri.', 'Terbitkan bila siap.'] },
  { id: 'write-kesaksian', page: 'kesaksian', roles: ['MENTEE'], title: 'Tulis kesaksian', purpose: 'Bagikan kesaksian untuk landing.', steps: ['Buka Kesaksian.', 'Tulis cerita.', 'Kirim untuk ditinjau.'] },
  { id: 'youth-gehc', page: 'youth-gehc', roles: ['KOMISI'], title: 'Jemaat', purpose: 'Direktori BIPRA & HUT.', steps: ['Buka Jemaat.', 'Cari orang.', 'Lihat/kelola data.'] },
  { id: 'beyonders-leaders', page: 'beyonders-leaders', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'], title: 'Pemimpin 10 Rumah', purpose: 'Nama landing & generasi Retreat.', steps: ['Buka Pemimpin 10 Rumah.', 'Kelola nama.', 'Simpan.'] },
  { id: 'jethro-placement', page: 'jethro-placement', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'], title: 'Review Penempatan', purpose: 'Approve batch newcomer.', steps: ['Buka Review Penempatan.', 'Pilih batch.', 'Approve/reject.'] },
];

export function portalCatalogForRole(roles = []) {
  const set = new Set((roles || []).map((r) => String(r).toUpperCase()));
  const isSuper = set.has('SUPERADMIN');
  return PORTAL_FEATURE_CATALOG.filter((f) => isSuper || f.roles.length === 0 || f.roles.some((r) => set.has(r)));
}

export function isAllowedPageForRole(page, roles = []) {
  if (!page) return false;
  return portalCatalogForRole(roles).some((f) => f.page === page);
}
