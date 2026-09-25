import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, Pin, Paperclip, Link2, ExternalLink, CalendarClock, Trash2, Pencil, X, Upload, BookMarked, Copy, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { displayAvatar } from '../../lib/avatar';
import { parseHashSearch, parsePortalHash } from '../../lib/portal-routes';
import { buildWartaCaption } from '../../lib/warta-caption';
import { whatsappShareUrl, copyText } from '../../lib/rhb-caption';

type WartaAttachment = { kind: 'FILE' | 'LINK'; fileId?: string; name?: string; mimetype?: string; size?: number; label?: string; url?: string };
type Warta = {
  id: string; title: string; summary?: string | null; body?: string | null; category: string;
  caption?: string | null;
  share?: { id: string; name: string; avatar?: string | null } | null;
  shareNote?: string | null; attachments: WartaAttachment[]; link?: string | null;
  deadline?: string | null; status: string; isPinned: boolean; viewCount: number; publishedAt?: string | null; createdAt: string;
};

const CAT_LABEL: Record<string, string> = {
  BEASISWA: 'Beasiswa', LOWONGAN: 'Lowongan Kerja', PELUANG: 'Peluang', KEGIATAN: 'Kegiatan', UMUM: 'Umum',
};
const CATS = Object.keys(CAT_LABEL);

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fileUrl = (a: WartaAttachment) => (a.kind === 'FILE' ? `/api/internal-warta/attachment/${a.fileId}` : (a.url || '#'));
const kb = (n?: number) => (n ? `${Math.round(n / 1024)} KB` : '');

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1';
const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#FF416C]';

/** Info & Peluang — warta internal (login-only). Feed + admin editor. */
export const InternalWartaPanel: React.FC = () => {
  const { addToast, authUser } = useApp();
  const [rows, setRows] = useState<Warta[]>([]);
  const [canAdmin, setCanAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [detail, setDetail] = useState<Warta | null>(null);
  const [editor, setEditor] = useState<Warta | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (cat) qs.set('category', cat);
      if (showArchived) qs.set('archived', '1');
      const r = await fetch(`/api/internal-warta?${qs.toString()}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setRows(d.warta || []);
      setCanAdmin(Boolean(d.canAdmin));
    } finally {
      setLoading(false);
    }
  }, [q, cat, showArchived]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (w: Warta) => {
    setDetail(w);
    try {
      const r = await fetch(`/api/internal-warta/${w.id}`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setDetail(d.warta || w); }
    } catch { /* pakai data list */ }
  };

  const remove = async (w: Warta) => {
    if (!window.confirm(`Hapus warta "${w.title}"?`)) return;
    setBusy(w.id);
    try {
      await fetch(`/api/internal-warta/${w.id}`, { method: 'DELETE', credentials: 'include' });
      await load();
      addToast({ type: 'success', title: 'Warta dihapus' });
    } finally { setBusy(null); }
  };

  const shareNs = () => (typeof window !== 'undefined' ? (parsePortalHash(window.location.hash)?.namespace || 'superadmin') : 'superadmin');
  const shareCaption = (w: Warta) => buildWartaCaption(w, { origin: typeof window !== 'undefined' ? window.location.origin : '', ns: shareNs() });
  const copyCaption = async (w: Warta) => {
    const ok = await copyText(shareCaption(w));
    addToast({ type: ok ? 'success' : 'error', title: ok ? 'Caption disalin' : 'Gagal menyalin caption' });
  };
  const waCaption = (w: Warta) => {
    if (typeof window !== 'undefined') window.open(whatsappShareUrl(shareCaption(w)), '_blank', 'noopener');
  };

  // Deep link: #/portal/<ns>/internal-warta?item=<id> → buka detail otomatis.
  const deepDone = useRef(false);
  useEffect(() => {
    if (deepDone.current) return;
    const id = parseHashSearch(typeof window !== 'undefined' ? window.location.hash : '').get('item');
    if (!id) { deepDone.current = true; return; }
    if (!rows.length) return;
    deepDone.current = true;
    const row = rows.find((r) => r.id === id);
    if (row) { void openDetail(row); return; }
    fetch(`/api/internal-warta/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.warta) setDetail(d.warta); })
      .catch(() => {});
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookMarked className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Info & Peluang</h3>
          <span className="text-[10px] text-[#8C8880]">kabar, beasiswa & lowongan — khusus akun GEHC</span>
          {canAdmin && (
            <button type="button" onClick={() => setEditor('new')} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Buat Warta
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul/isi…" className={`${inputCls} pl-9`} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Semua kategori</option>
            {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8C8880]">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-3.5 h-3.5 rounded border-[#D9D7D0]" /> Tampilkan arsip
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold">Belum ada info.</p>
          <p className="text-xs text-[#8C8880] mt-1">Kabar & peluang akan tampil di sini.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => (
            <article key={w.id} className={`rounded-2xl border bg-white p-4 space-y-2 ${w.isPinned ? 'border-amber-300 bg-amber-50/40' : 'border-[#D9D7D0]/60'}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">{CAT_LABEL[w.category] || w.category}</span>
                {w.isPinned && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><Pin className="w-3 h-3" /> Disematkan</span>}
                {w.status === 'ARCHIVED' && <span className="text-[10px] font-bold text-[#8C8880]">Arsip</span>}
                {canAdmin && (
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => void copyCaption(w)} className="p-1.5 rounded-lg hover:bg-[#F3F1EC]" title="Salin caption WA"><Copy className="w-3.5 h-3.5 text-[#8C8880]" /></button>
                    <button type="button" onClick={() => waCaption(w)} className="p-1.5 rounded-lg hover:bg-[#F3F1EC]" title="Kirim ke WhatsApp"><MessageCircle className="w-3.5 h-3.5 text-emerald-700" /></button>
                    <button type="button" onClick={() => setEditor(w)} className="p-1.5 rounded-lg hover:bg-[#F3F1EC]" title="Edit"><Pencil className="w-3.5 h-3.5 text-[#8C8880]" /></button>
                    <button type="button" onClick={() => void remove(w)} disabled={busy === w.id} className="p-1.5 rounded-lg hover:bg-[#F3F1EC] disabled:opacity-40" title="Hapus"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => void openDetail(w)} className="text-left">
                <h4 className="text-sm font-black text-[#1B1B1B] hover:underline">{w.title}</h4>
              </button>
              {w.summary && <p className="text-xs text-[#5C5850] line-clamp-3">{w.summary}</p>}

              {w.share && (
                <div className="flex items-center gap-2 pt-1">
                  <img src={displayAvatar(w.share.name, w.share.avatar)} alt="" className="w-6 h-6 rounded-full object-cover bg-gray-100" />
                  <span className="text-[11px] font-bold text-[#1B1B1B]">{w.share.name}</span>
                  {w.shareNote && <span className="text-[10px] text-[#8C8880] truncate">· {w.shareNote}</span>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(w.attachments || []).filter((a) => a.kind === 'LINK').slice(0, 3).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline"><Link2 className="w-3 h-3" /> {a.label}</a>
                ))}
                {(w.attachments || []).filter((a) => a.kind === 'FILE').slice(0, 3).map((a, i) => (
                  <a key={i} href={fileUrl(a)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"><Paperclip className="w-3 h-3" /> {a.name}</a>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#8C8880] pt-1">
                <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {fmtDate(w.publishedAt || w.createdAt)}</span>
                {w.deadline && <span className="text-rose-600 font-bold">Tutup {fmtDate(w.deadline)}</span>}
                <span>{w.viewCount} dilihat</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <DetailModal
          w={detail}
          onClose={() => setDetail(null)}
          actions={canAdmin ? (
            <>
              <button type="button" onClick={() => void copyCaption(detail)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#5C5850]"><Copy className="w-3 h-3" /> Salin caption</button>
              <button type="button" onClick={() => waCaption(detail)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"><MessageCircle className="w-3 h-3" /> Kirim WA</button>
            </>
          ) : null}
        />
      )}
      {editor && (
        <EditorModal
          initial={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void load(); }}
          authUserId={authUser?.id}
        />
      )}
    </div>
  );
};

const DetailModal: React.FC<{ w: Warta; onClose: () => void; actions?: React.ReactNode }> = ({ w, onClose, actions }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">{CAT_LABEL[w.category] || w.category}</span>
        <button type="button" onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-[#F3F1EC]"><X className="w-4 h-4" /></button>
      </div>
      {actions && <div className="flex flex-wrap gap-2 mt-2">{actions}</div>}
      <h3 className="text-lg font-black text-[#1B1B1B] mt-2">{w.title}</h3>
      {w.share && (
        <div className="flex items-center gap-2 mt-2">
          <img src={displayAvatar(w.share.name, w.share.avatar)} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" />
          <div>
            <p className="text-xs font-bold text-[#1B1B1B]">{w.share.name}</p>
            {w.shareNote && <p className="text-[10px] text-[#8C8880]">{w.shareNote}</p>}
          </div>
        </div>
      )}
      {w.summary && <p className="text-sm text-[#1B1B1B] font-semibold mt-3">{w.summary}</p>}
      {w.body && <p className="text-sm text-[#5C5850] whitespace-pre-line mt-2 leading-relaxed">{w.body}</p>}
      <div className="mt-3 space-y-1.5">
        {(w.attachments || []).map((a, i) => (
          <a key={i} href={fileUrl(a)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] hover:bg-[#F0EFEB]">
            {a.kind === 'FILE' ? <Paperclip className="w-4 h-4 text-emerald-700 shrink-0" /> : <Link2 className="w-4 h-4 text-sky-700 shrink-0" />}
            <span className="text-xs font-bold text-[#1B1B1B] truncate flex-1">{a.kind === 'FILE' ? a.name : a.label}</span>
            {a.kind === 'FILE' && a.size ? <span className="text-[10px] text-[#8C8880]">{kb(a.size)}</span> : null}
            <ExternalLink className="w-3.5 h-3.5 text-[#8C8880] shrink-0" />
          </a>
        ))}
        {w.link && (
          <a href={w.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8]">
            <ExternalLink className="w-4 h-4 text-sky-700 shrink-0" /><span className="text-xs font-bold truncate flex-1">{w.link}</span>
          </a>
        )}
      </div>
      {w.deadline && <p className="text-[11px] text-rose-600 font-bold mt-3">Batas waktu: {fmtDate(w.deadline)}</p>}
    </div>
  </div>
);

const EditorModal: React.FC<{ initial: Warta | null; onClose: () => void; onSaved: () => void; authUserId?: string }> = ({ initial, onClose, onSaved, authUserId }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState({
    title: initial?.title || '',
    category: initial?.category || 'PELUANG',
    summary: initial?.summary || '',
    body: initial?.body || '',
    caption: initial?.caption || '',
    shareNote: initial?.shareNote || '',
    deadline: initial?.deadline ? String(initial.deadline).slice(0, 10) : '',
    link: initial?.link || '',
    isPinned: initial?.isPinned || false,
    status: initial?.status || 'DRAFT',
  });
  const [share, setShare] = useState<{ id: string; name: string; avatar?: string | null } | null>(initial?.share || null);
  const [shareQ, setShareQ] = useState('');
  const [shareResults, setShareResults] = useState<Array<{ id: string; name: string; avatar?: string | null }>>([]);
  const [attachments, setAttachments] = useState<WartaAttachment[]>(initial?.attachments || []);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!shareQ.trim()) { setShareResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(shareQ.trim())}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d) => { if (!cancelled) setShareResults(d.users || []); })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [shareQ]);

  const uploadFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 8_000_000) { addToast({ type: 'error', title: 'Berkas > 8MB' }); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(new Error('Gagal membaca berkas.'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/internal-warta/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ filename: file.name, mimetype: file.type || 'application/octet-stream', data: dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengunggah.');
      setAttachments((prev) => [...prev, { kind: 'FILE', ...d.file }]);
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal mengunggah.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!form.title.trim()) { addToast({ type: 'error', title: 'Judul wajib' }); return; }
    setSaving(true);
    try {
      const payload = {
        ...form, status,
        shareUserId: share?.id || null,
        attachments,
        deadline: form.deadline || null,
        notify: status === 'PUBLISHED',
      };
      const r = await fetch(initial ? `/api/internal-warta/${initial.id}` : '/api/internal-warta', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      addToast({ type: 'success', title: status === 'PUBLISHED' ? 'Warta dipublikasikan' : 'Draf disimpan' });
      onSaved();
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-black">{initial ? 'Edit Warta' : 'Buat Warta'}</h3>
          <button type="button" onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-[#F3F1EC]"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div><label className={labelCls}>Judul Warta</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="mis. Peluang Beasiswa Korsel" className={inputCls} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kategori</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Batas waktu (opsional)</label><input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Ringkasan singkat</label><input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="1-2 kalimat" className={inputCls} /></div>
          <div><label className={labelCls}>Isi lengkap</label><textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={5} className={inputCls} /></div>

          {/* Caption WhatsApp */}
          <div className="rounded-2xl border border-[#EFEDE8] p-3 space-y-2">
            <label className={labelCls}>Caption WhatsApp (opsional — kosong = otomatis)</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              rows={4}
              placeholder="Biarkan kosong untuk caption otomatis (judul, kategori, ringkasan, deadline, sharer, link)."
              className={inputCls}
            />
            {!form.caption.trim() && (
              <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1">Pratinjau caption otomatis</p>
                <pre className="text-[11px] whitespace-pre-wrap text-[#1B1B1B] font-sans">{buildWartaCaption({
                  id: initial?.id || '',
                  title: form.title || '(judul)',
                  category: form.category,
                  summary: form.summary,
                  deadline: form.deadline || null,
                  share,
                  shareNote: form.shareNote,
                  link: form.link,
                }, { origin: typeof window !== 'undefined' ? window.location.origin : '', ns: typeof window !== 'undefined' ? (parsePortalHash(window.location.hash)?.namespace || 'superadmin') : 'superadmin' })}</pre>
              </div>
            )}
          </div>

          {/* Sharer */}
          <div className="rounded-2xl border border-[#EFEDE8] p-3 space-y-2">
            <label className={labelCls}>Yang berbagi (nama + foto tampil di feed)</label>
            {share ? (
              <div className="flex items-center gap-2">
                <img src={displayAvatar(share.name, share.avatar)} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                <span className="text-xs font-bold flex-1">{share.name}</span>
                <button type="button" onClick={() => setShare(null)} className="text-[11px] font-bold text-[#8C8880]">Ganti</button>
              </div>
            ) : (
              <>
                <input value={shareQ} onChange={(e) => setShareQ(e.target.value)} placeholder="Cari nama anggota…" className={inputCls} />
                {shareResults.length > 0 && (
                  <div className="rounded-xl border border-[#EFEDE8] divide-y divide-[#EFEDE8] max-h-40 overflow-y-auto">
                    {shareResults.map((u) => (
                      <button key={u.id} type="button" onClick={() => { setShare(u); setShareQ(''); setShareResults([]); }} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#FAF9F5]">
                        <img src={displayAvatar(u.name, u.avatar)} alt="" className="w-6 h-6 rounded-full object-cover bg-gray-100" />
                        <span className="text-xs font-semibold">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <input value={form.shareNote} onChange={(e) => setForm((f) => ({ ...f, shareNote: e.target.value }))} placeholder="Keterangan (mis. Alumni · Penerima Beasiswa Korsel)" className={inputCls} />
          </div>

          {/* Attachments */}
          <div className="rounded-2xl border border-[#EFEDE8] p-3 space-y-2">
            <label className={labelCls}>Lampiran (PDF/gambar/dokumen + tautan)</label>
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold">
                  {a.kind === 'FILE' ? <Paperclip className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                  <span className="max-w-[180px] truncate">{a.kind === 'FILE' ? a.name : a.label}</span>
                  <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))} className="p-0.5 rounded-full hover:bg-white"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"><Upload className="w-3.5 h-3.5" /> Unggah berkas</button>
              <input ref={fileRef} type="file" accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx" className="hidden" onChange={(e) => void uploadFile(e.target.files?.[0])} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[110px]"><label className={labelCls}>Label tautan</label><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} className={inputCls} /></div>
              <div className="flex-[2] min-w-[160px]"><label className={labelCls}>URL</label><input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className={inputCls} /></div>
              <button type="button" onClick={() => { if (/^https?:\/\//i.test(linkUrl.trim())) { setAttachments((p) => [...p, { kind: 'LINK', label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }]); setLinkLabel(''); setLinkUrl(''); } }} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold">Tambah tautan</button>
            </div>
            <div><label className={labelCls}>Tautan utama (opsional)</label><input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://…" className={inputCls} /></div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#5C5850]">
            <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))} className="w-4 h-4 rounded border-[#D9D7D0]" /> Sematkan di atas
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button type="button" onClick={() => void save('DRAFT')} disabled={saving} className="ml-auto px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-sm font-bold disabled:opacity-50">Simpan draf</button>
          <button type="button" onClick={() => void save('PUBLISHED')} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Publikasikan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InternalWartaPanel;
