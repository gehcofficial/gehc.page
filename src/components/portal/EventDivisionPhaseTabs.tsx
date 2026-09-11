import React, { useState, useEffect } from 'react';
import { SUB_DIVISIONS } from '../../lib/pantatugas';
import { Calendar, FileText, Users, Megaphone, Heart, HandHeart, Store, BookOpen, Flame } from 'lucide-react';

// Mirror server/lib/drive-ownership.mjs canonical names
const CANONICAL_SUB_DIVISIONS: Record<string, string[]> = Object.fromEntries(
  Object.entries(SUB_DIVISIONS).map(([k, v]) => [k, (v as Array<{ name: string }>).map((s) => s.name)])
);
const SUBDIVISION_CHILDREN: Record<string, string[]> = {
  'Liturgi & Ibadah': ['Foto', 'Berkas', 'Berkas/rundown', 'Foto/ibadah'],
  'Musik & Vokal': ['Foto', 'Berkas', 'Berkas/chord', 'Foto/rehearsal'],
  'Doa & Intercession': ['Foto', 'Berkas', 'Berkas/pokok-doa'],
  'Kurikulum Pemuridan': ['Foto', 'Berkas', 'Berkas/modul', 'Berkas/modul-rhb'],
  'Pembekalan Tim': ['Foto', 'Berkas', 'Foto/pembekalan', 'Berkas/materi-tim'],
  'Program & Acara': ['Foto', 'Berkas'],
  'Persekutuan & Integrasi': ['Foto', 'Berkas', 'Foto/welcome'],
  'Hubungan & Komunikasi': ['Foto', 'Berkas'],
  'Logistik & Fasilitas': ['Foto', 'Berkas', 'Inventaris', 'Berkas/checklist'],
  'Konsumsi & Keramahan': ['Foto', 'Berkas', 'Foto/distribusi'],
  'Kesehatan & Keselamatan': ['Foto', 'Berkas'],
  'Kasih Peduli & Benevolence': ['Foto', 'Berkas', 'Kunjungan'],
  'Dukungan Perantau': ['Foto', 'Berkas', 'Berkas/tips', 'Foto/komunitas'],
  'Dokumentasi Visual': ['Foto', 'Berkas', 'Arsip Acara'],
  'Desain & Publikasi': ['Foto', 'Berkas'],
  'Kesaksian & Story': ['Foto', 'Berkas', '_inbox'],
  'Penginjilan & Misi': ['Foto', 'Berkas', 'Foto/outreach'],
  'Merchandise & Produk': ['Foto', 'Berkas', 'produk'],
  'Penggalangan Dana': ['Foto', 'Berkas', 'produk'],
  'Persembahan & Donasi': ['Foto', 'Berkas', 'kampanye'],
};

type Phase = 'pre' | 'during' | 'post';

const PHASE_LABEL: Record<Phase, { label: string; hint: string; color: string }> = {
  pre: { label: 'Pre-event', hint: 'H-21 → H-1 persiapan', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  during: { label: 'During', hint: 'Hari-H eksekusi', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  post: { label: 'Post-event', hint: 'H+1 → H+7 tindak lanjut', color: 'bg-sky-50 border-sky-200 text-sky-800' },
};

const PHASE_TASKS: Record<string, Record<Phase, string[]>> = {
  'Liturgi & Ibadah': {
    pre: ['Susun liturgi Word-centered (pembaca firman, liturgist, WL, banner)', 'Finalisasi rundown ibadah + alur transisi', 'Briefing WL & liturgist, upload Berkas/rundown ke Drive'],
    during: ['Jalankan flow ibadah sesuai rundown', 'Standby ganti WL/liturgist darurat', 'Centang checklist rundown live'],
    post: ['Upload final rundown ke Arsip Acara', 'Terima kasih kepada WL/liturgist (catat di Updates)', 'Evaluasi H+7 untuk ibadah berikut'],
  },
  'Musik & Vokal': {
    pre: ['Pilih lagu & siapkan chord sheet (Berkas/chord)', 'Assign band/singer/kantoria/rebana via ServiceSchedule', 'Jadwal rehearsal & sebar undangan latihan'],
    during: ['Cek sound & setlist tampil', 'Pimpin pujian sesuai rundown', 'Dokumentasi rehearsal Foto/rehearsal'],
    post: ['Upload rekaman rehearsal ke Drive', 'Evaluasi chord & setlist next week', 'Catat kebutuhan alat'],
  },
  'Doa & Intercession': {
    pre: ['Kumpulkan pokok doa mingguan (Berkas/pokok-doa)', 'Jadwal prayer covering pra-acara (H-1)', 'Sebar pokok doa ke tim doa'],
    during: ['Tim doa siaga (siapa petugas + jam)', 'Doa syafaat live intercession', 'Catat jawaban doa'],
    post: ['Rangkum jawaban doa untuk warta (field doa)', 'Follow-up anggota bergumul', 'Update pokok doa next week'],
  },
  'Kurikulum Pemuridan': {
    pre: ['Siapkan modul pembekalan mentor/komentor untuk tema minggu ini (Berkas/modul)', 'Upload materi ke Drive Kurikulum', 'Briefing Lead Equippers (Putri & Alvandi)'],
    during: ['Rilis RHB harian 7 PDF: Senin-Sabat (6-12 Sep) di Berkas/modul-rhb', 'Pastikan mentor akses via Monitoring Kelompok', 'Pantau pembacaan RHB di portal'],
    post: ['Susun warta: ayat/khotbah/ringkasan (WartaPublik)', 'Kumpulkan feedback modul untuk evaluasi batch', 'Arsip modul ke Foto/Berkas'],
  },
  'Pembekalan Tim': {
    pre: ['Siapkan materi pembekalan tim (Berkas/materi-tim) — SESUAI HARI: Mentoring=deck utama 10 grup, Serving=ringkas 2 grup', 'Jadwal sesi pembekalan H-3 (Mentoring undang semua mentor/10 grup, Serving undang penanggung+host 2 grup)', 'Undang mentor/komentor sesuai hari'],
    during: ['Absensi pembekalan terpisah per hari (Mentoring 10 grup / Serving 2 grup)', 'Sampaikan materi pembekalan (deck per event)', 'Foto pembekalan per hari'],
    post: ['Evaluasi pembekalan H+7 per hari', 'Update materi untuk next Mentoring/Serving terpisah', 'Lapor ke Didaskalia HoD per hari'],
  },
  'Program & Acara': {
    pre: ['Konsep acara: games/bonding/dekor (RACI Proposal)', 'Finalisasi rundown acara + rundown detail', 'Koordinasi dengan Liturgia & Diakonia'],
    during: ['Eksekusi rundown persekutuan (jaga waktu)', 'Pandu games & bonding', 'Dokumentasi Foto acara'],
    post: ['Upload final rundown ke Drive', 'Evaluasi acara & catat improvement', 'Handover ke Hubungan untuk posting'],
  },
  'Persekutuan & Integrasi': {
    pre: ['Flow welcome newcomer + hospitality checklist (Foto/welcome)', 'Siapkan ice breaker & seating', 'Briefing tim welcome'],
    during: ['Sambut newcomer & antar ke kelompok', 'Jaga kehangatan persekutuan', 'Catat newcomer baru'],
    post: ['Input newcomer → Jethro Engine (via Hubungan)', 'Follow-up light care (bukan klinis)', 'Update daftar anggota'],
  },
  'Hubungan & Komunikasi': {
    pre: ['Siapkan MC, broadcast WA, FAQ acara, kalender publikasi H-21', 'Koordinasi sosmed dengan Desain', 'Sebar info ke semua 10 grup'],
    during: ['MC on-mic + jaga alur komunikasi', 'Broadcast live update (jika perlu)', 'Catat pertanyaan FAQ baru'],
    post: ['Posting rekap acara ke sosmed (handoff dari Desain)', 'Input newcomer FAQ → Jethro', 'Evaluasi komunikasi next week'],
  },
  'Logistik & Fasilitas': {
    pre: ['Cek venue, layout, peralatan, transport (Berkas/checklist, Inventaris)', 'H-7 cek inventory, H-3 kit siap', 'Koordinasi dengan Koinonia untuk dekor'],
    during: ['On-site jaga fasilitas & layout', 'Siaga peralatan cadangan', 'Catat penggunaan'],
    post: ['Laporan kerusakan & inventaris akhir', 'Arsip checklist ke Berkas', 'Siapkan list perbaikan next week'],
  },
  'Konsumsi & Keramahan': {
    pre: ['Tentukan menu, vendor/self-made, distribusi (Foto/distribusi)', 'Koordinasi dengan Koinonia untuk momen makan', 'Pesan & konfirmasi vendor'],
    during: ['Distribusi konsumsi tepat waktu', 'Jaga keramahan & kebersihan', 'Foto distribusi'],
    post: ['Hitung sisa & reimburse ke BZP bila perlu', 'Evaluasi menu & vendor', 'Catat feedback'],
  },
  'Kesehatan & Keselamatan': {
    pre: ['Siapkan first-aid kit, protokol darurat, obat', 'Briefing tim kesehatan', 'Cek jalur evakuasi venue'],
    during: ['Standby medis (siapa petugas + lokasi kit)', 'Tanggap darurat jika ada insiden', 'Catat kejadian'],
    post: ['Laporan insiden (jika ada) → Kasih Peduli', 'Restock kit', 'Evaluasi protokol'],
  },
  'Kasih Peduli & Benevolence': {
    pre: ['— (hanya bila ada kasus member susah/sakit)', 'Siapkan kunjungan & bantuan praktis', 'Koordinasi dengan mentor/Komisi'],
    during: ['Sapa anggota bergumul (light care)', 'Catat kebutuhan praktis', 'Siaga kunjungan'],
    post: ['Kunjungan sakit/mercy (PastoralCareNote)', 'Lapor ke Komisi', 'Follow-up H+7'],
  },
  'Dukungan Perantau': {
    pre: ['Siapkan tips adaptasi Cikarang, burnout kerja (Berkas/tips)', 'Identifikasi perantau baru', 'Buat komunitas praktis'],
    during: ['Sapa perantau & ajak ngobrol', 'Berbagi tips praktis', 'Foto komunitas'],
    post: ['Follow-up burnout via chat/kunjungan', 'Update tips untuk next week', 'Evaluasi kebutuhan perantau'],
  },
  'Dokumentasi Visual': {
    pre: ['Brief shotlist & assign fotografer/videografer (Arsip Acara)', 'Cek baterai/kartu/storage', 'Koordinasi dengan Liturgia untuk momen kunci'],
    during: ['Coverage foto/video live (During tab: live upload)', 'Upload ke GroupAlbum eventId atau Drive Live', 'Jaga backup'],
    post: ['H+1 upload ke Drive [EVENT:slug]/Arsip Acara (buat 5 preview)', 'Pilih foto untuk make-warta (10 approved)', 'Arsip ke public-archive'],
  },
  'Desain & Publikasi': {
    pre: ['Desain poster/deck/brand asset (Berkas)', 'Handoff ke Hubungan untuk kalender publikasi', 'Final asset H-7'],
    during: ['Slides tampil (proyektor)', 'Standby edit cepat', 'Foto hasil desain tampil'],
    post: ['Feed rekap desain ke Hubungan untuk posting', 'Arsip asset ke Drive', 'Evaluasi brand'],
  },
  'Kesaksian & Story': {
    pre: ['— (siapkan template testimoni)', 'Koordinasi dengan mentor untuk calon kesaksian', 'Siapkan _inbox Drive'],
    during: ['Kumpulkan testimoni mentee live (catat)', 'Foto penulis testimoni', 'Upload ke _inbox'],
    post: ['Kurasi wall of testimony (approve Komisi)', 'POST /api/testimonials → landing collage', 'H+7 kumpulkan draft testimoni next'],
  },
  'Penginjilan & Misi': {
    pre: ['Siapkan invite-a-friend list & materi pre-evangelism (Foto/outreach)', 'Briefing tim outreach', 'Doa misi'],
    during: ['Outreach corner / ajak teman baru', 'Bagikan materi misi', 'Catat jiwa baru'],
    post: ['Lapor jiwa baru → follow-up Koinonia', 'Evaluasi outreach', 'Rencana mission trip'],
  },
  'Merchandise & Produk': {
    pre: ['Cek stok katalog (produk) di portal BZP', 'Siapkan booth & price list', 'Koordinasi dengan Liturgia untuk slot jualan'],
    during: ['Booth penjualan buka (jaga stock)', 'Catat penjualan', 'Foto produk'],
    post: ['Stok akhir & laporan ke portal BZP', 'Restock plan', 'Rekonsiliasi dengan Bendahara'],
  },
  'Penggalangan Dana': {
    pre: ['Plan jualan makan-minum mingguan (PIC Fladyna)', 'Siapkan menu & harga', 'Koordinasi dengan Konsumsi'],
    during: ['Jualan & catat pemasukan', 'Foto produk/jualan', 'Jaga kas'],
    post: ['Setoran & laporan ke Bendahara Tim Kerja', 'Evaluasi jualan', 'Plan next week'],
  },
  'Persembahan & Donasi': {
    pre: ['Siapkan QRIS & kampanye donasi khusus (kampanye)', 'Koordinasi dengan Diakonia', 'Test QRIS'],
    during: ['Kolekte persembahan (jaga QRIS)', 'Catat donasi', 'Foto kampanye'],
    post: ['Rekonsiliasi QRIS → Bendahara Tim Kerja', 'Laporan donasi ke Komisi', 'Update kampanye next'],
  },
};

const DIVISION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  LITURGIA: Flame,
  DIDASKALIA: BookOpen,
  KOINONIA: Heart,
  DIAKONIA: HandHeart,
  MARTURIA: Megaphone,
  BENZARPR: Store,
};

interface Props {
  division: string;
  eventId: string;
  eventDate?: string | null;
  serviceType?: string | null;
  driveFolderId?: string | null;
  discussions?: Array<{ id: string; authorName?: string; authorId: string; body: string }>;
  curriculumFiles?: Record<string, Array<{ id: string; name: string; webViewLink?: string }>>;
  onPostUpdate?: (body: string) => void;
  canWrite?: boolean;
}

export const EventDivisionPhaseTabs: React.FC<Props> = ({ division, eventId, eventDate, serviceType, driveFolderId, discussions = [], curriculumFiles, onPostUpdate, canWrite }) => {
  const [phase, setPhase] = useState<Phase>('pre');
  // By-event Kurikulum 3 sub — sistem baca per subfolder dan posisikan (seperti RHB) — sinkron dengan parent bila ada
  const [driveSubFiles, setDriveSubFiles] = useState<Record<string, Array<{ id: string; name: string; webViewLink?: string }>>>({});
  useEffect(() => {
    if (curriculumFiles) { setDriveSubFiles(curriculumFiles); return; }
    if (division !== 'DIDASKALIA' || !eventId) return;
    const subs = ['01 Pembekalan Mentor - Co mentor', '02 Ringkasan Khotbah', '03 RHB 7 Hari'];
    subs.forEach(async (s) => {
      try {
        const r = await fetch(`/api/events/${eventId}/divisions/DIDASKALIA/drive?subfolder=${encodeURIComponent(s)}&fresh=1`, { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        if (Array.isArray(d.files)) setDriveSubFiles((prev) => ({ ...prev, [s]: d.files }));
      } catch {}
    });
  }, [eventId, division, curriculumFiles]);
  const subDivs = CANONICAL_SUB_DIVISIONS[division as keyof typeof CANONICAL_SUB_DIVISIONS] || [];
  const Icon = DIVISION_ICON[division] || FileText;
  const getTasks = (sub: string, ph: Phase): string[] => {
    if (sub === 'Pembekalan Tim' && serviceType) {
      const isMentoring = serviceType === 'MENTORING_DAY';
      const isServing = serviceType === 'SERVING_DAY';
      if (isMentoring) {
        if (ph === 'pre') return ['Siapkan materi pembekalan Mentoring (deck utama SOP 10 grup, Berkas/materi-tim)', 'Jadwal sesi pembekalan Mentoring H-3 untuk semua mentor/10 grup', 'Undang semua mentor/komentor + Komisi (all)'];
        if (ph === 'during') return ['Absensi pembekalan Mentoring (10 grup roll call)', 'Sampaikan materi Mentoring Day (tema besar)', 'Foto pembekalan Mentoring'];
        if (ph === 'post') return ['Evaluasi pembekalan Mentoring H+7', 'Update materi untuk next Mentoring Day', 'Lapor ke Didaskalia HoD + Komisi'];
      }
      if (isServing) {
        if (ph === 'pre') return ['Siapkan materi pembekalan Serving (ringkas praktik 2 grup, Berkas/materi-tim)', 'Jadwal sesi pembekalan Serving H-3 untuk penanggung+host 2 grup', 'Undang mentor/komentor 2 grup bertugas'];
        if (ph === 'during') return ['Absensi pembekalan Serving (2 grup)', 'Sampaikan materi Serving (praktik)', 'Foto pembekalan Serving'];
        if (ph === 'post') return ['Evaluasi pembekalan Serving H+7', 'Update materi untuk next Serving Day', 'Lapor ke Didaskalia HoD + penanggung jawab'];
      }
    }
    if (sub === 'Kurikulum Pemuridan' && serviceType) {
      const isMentoring = serviceType === 'MENTORING_DAY';
      if (ph === 'during') {
        return isMentoring
          ? ['Rilis RHB harian 7 PDF: Senin–Sabtu untuk Mentoring (Berkas/modul-rhb)', 'Pastikan mentor 10 grup akses via Monitoring', 'Pantau pembacaan RHB']
          : ['Rilis RHB harian 7 PDF: Senin–Sabtu untuk Serving (Berkas/modul-rhb) — tetap 7 PDF', 'Pastikan 2 grup bertugas + mentor terkait akses', 'Pantau pembacaan RHB Serving'];
      }
    }
    return PHASE_TASKS[sub]?.[ph] || [];
  };

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#FAF9F5] border-b border-[#D9D7D0]">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#8C8880]" />
          <span className="text-xs font-black text-[#1B1B1B]">{division}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-[#D9D7D0] text-[#8C8880]">{subDivs.length} sub</span>
        </div>
        {driveFolderId && <a href={`https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noopener" className="text-[11px] font-bold text-sky-700 hover:underline">Drive</a>}
      </div>
      <div className="flex gap-1.5 p-2 bg-white border-b border-[#D9D7D0] overflow-x-auto">
        {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPhase(p)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${phase === p ? PHASE_LABEL[p].color + ' shadow-sm' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}
          >
            {PHASE_LABEL[p].label}
            <span className="ml-1 font-normal hidden sm:inline">· {PHASE_LABEL[p].hint}</span>
          </button>
        ))}
      </div>
      <div className="p-3 space-y-4 max-h-[520px] overflow-y-auto">
        {subDivs.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada sub-divisi terdaftar untuk {division}.</p>
        ) : subDivs.map((sub) => {
          const tasks = getTasks(sub, phase);
          const children = SUBDIVISION_CHILDREN[sub] || [];
          return (
            <div key={sub} className="rounded-xl border border-[#EFEDE8] bg-[#FFFBF5] p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-[#1B1B1B] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FF416C] shrink-0" />{sub}</p>
                  <p className="text-[11px] text-[#8C8880] leading-relaxed">{children.length ? `Drive: ${children.slice(0,3).join(' · ')}${children.length>3 ? ' …' : ''}` : ''}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${PHASE_LABEL[phase].color}`}>{phase}</span>
              </div>
              <ul className="space-y-1.5">
                {tasks.map((t, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#1B1B1B]">
                    <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#8C8880]">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
                {tasks.length === 0 && <li className="text-xs text-[#8C8880] italic">Tidak ada tugas spesifik untuk fase ini — standby.</li>}
              </ul>
              {/* By-event Kurikulum files — sistem posisikan per subfolder (RHB sudah bagus) */}
              {sub === 'Pembekalan Tim' && (driveSubFiles['01 Pembekalan Mentor - Co mentor'] || []).length > 0 && (
                <div className="pt-2 border-t border-[#EFEDE8] space-y-1">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Materi Pembekalan (by event 01 — mentor-only):</p>
                  {(driveSubFiles['01 Pembekalan Mentor - Co mentor'] || []).map((f) => (
                    <a key={f.id} href={f.webViewLink || '#'} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-sky-700 hover:underline">📄 {f.name}</a>
                  ))}
                </div>
              )}
              {sub === 'Kurikulum Pemuridan' && (
                <>
                  {(driveSubFiles['03 RHB 7 Hari'] || []).length > 0 && (
                    <div className="pt-2 border-t border-[#EFEDE8] space-y-1">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase">RHB 7 Hari (by event 03 — Senin–Sabtu, by event seperti Monitor):</p>
                      {(driveSubFiles['03 RHB 7 Hari'] || []).map((f) => (
                        <a key={f.id} href={f.webViewLink || '#'} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-sky-700 hover:underline">📄 {f.name}</a>
                      ))}
                    </div>
                  )}
                  {(driveSubFiles['02 Ringkasan Khotbah'] || []).length > 0 && (
                    <div className="pt-1 space-y-1">
                      <p className="text-[10px] font-bold text-sky-800 uppercase">Ringkasan Khotbah (by event 02 — posisikan juga di Info Event portal):</p>
                      {(driveSubFiles['02 Ringkasan Khotbah'] || []).map((f) => (
                        <a key={f.id} href={f.webViewLink || '#'} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold text-sky-700 hover:underline">📄 {f.name}</a>
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* Mini discussion for this sub — reuse division discussions filtered roughly */}
              {discussions.length > 0 && phase === 'pre' && (
                <div className="pt-2 border-t border-[#EFEDE8] space-y-1">
                  <p className="text-[10px] font-bold text-[#8C8880] uppercase">Update terbaru</p>
                  {discussions.slice(-2).map((u, idx) => (
                    <p key={u.id || idx} className="text-xs bg-white rounded-lg px-2 py-1 border border-[#EFEDE8]"><span className="font-bold">{u.authorName || u.authorId}</span>: {u.body}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Composer selalu tampil di semua fase */}
        <div className="flex gap-2 pt-2 border-t border-[#D9D7D0]">
          <input
            type="text"
            placeholder={`Tulis update ${PHASE_LABEL[phase].label.toLowerCase()} untuk ${division}… (Enter kirim)`}
            className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C]"
            onKeyDown={(e) => {
              const target = e.target as HTMLInputElement;
              if (e.key === 'Enter' && target.value.trim() && onPostUpdate) {
                onPostUpdate(`[${phase.toUpperCase()}] ${target.value.trim()}`);
                target.value = '';
              }
            }}
            disabled={!canWrite}
          />
          <span className="text-[10px] text-[#8C8880] self-center hidden sm:block">Enter</span>
        </div>
        <p className="text-[10px] text-[#8C8880]">Selalu tampil — sub-divisi yang belum ada personel (`isOpenRole`) tetap terlihat dengan tugas di atas untuk rekrutmen.</p>
      </div>
    </div>
  );
};
