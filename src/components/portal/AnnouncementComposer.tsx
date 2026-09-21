import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Megaphone, Send, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NOTIFY_CATEGORIES, NOTIFY_CATEGORY_LABEL, PRIORITY_LABEL } from '../../lib/notify-categories';
import { roleToNamespace } from '../../lib/portal-routes';

type Caps = {
  role: string;
  audiences: string[];
  categories: string[];
  scopeDivision: string | null;
  isBod: boolean;
  groupIds: string[];
};

type Announcement = {
  id: string;
  title: string;
  message?: string | null;
  category: string;
  priority: string;
  audienceType: string;
  status: string;
  sentCount: number;
  senderRole: string;
  createdAt: string;
  sentAt?: string | null;
};

const ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE', 'COMMITTEE', 'KOMISI', 'BPMJ', 'ALUMNI'];
const DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
const AUD_LABEL: Record<string, string> = {
  PUBLIC: 'Semua pelanggan',
  ROLE: 'Per peran',
  DIVISION: 'Per divisi',
  GROUP: 'Per kelompok',
  USER: 'Orang tertentu',
};
const STATUS_LABEL: Record<string, string> = { SCHEDULED: 'Terjadwal', SENT: 'Terkirim', ARCHIVED: 'Arsip', DRAFT: 'Draf' };

export const AnnouncementComposer: React.FC = () => {
  const { addToast, currentRole } = useApp();
  const [caps, setCaps] = useState<Caps | null>(null);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    message: '',
    href: '',
    category: 'announcement',
    priority: 'INFO',
    audienceType: 'PUBLIC',
    audienceRoles: [] as string[],
    audienceDivisions: [] as string[],
    audienceGroupIds: [] as string[],
    audienceUserIds: [] as string[],
    scheduled: false,
    publishAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, hr, gr, ur] = await Promise.all([
        fetch('/api/announcements/capabilities', { credentials: 'include' }),
        fetch('/api/announcements', { credentials: 'include' }),
        fetch('/api/db/groups/full', { credentials: 'include' }).catch(() => null),
        fetch('/api/db/users?limit=200', { credentials: 'include' }).catch(() => null),
      ]);
      if (cr.ok) {
        const c: Caps = await cr.json();
        setCaps(c);
        setForm((f) => ({
          ...f,
          category: c.categories.includes(f.category) ? f.category : (c.categories[0] || 'announcement'),
          audienceType: c.audiences.includes(f.audienceType) ? f.audienceType : (c.audiences[0] || 'PUBLIC'),
        }));
      }
      if (hr.ok) setHistory((await hr.json()).announcements || []);
      if (gr?.ok) setGroups((await gr.json()).groups || []);
      if (ur?.ok) setUsers((await ur.json()).users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const audiences = caps?.audiences || [];
  const categories = (caps?.categories || []).filter((c) => (NOTIFY_CATEGORIES as readonly string[]).includes(c));

  const toggle = (key: 'audienceRoles' | 'audienceDivisions' | 'audienceGroupIds' | 'audienceUserIds', value: string) => {
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  };

  const submit = async () => {
    if (!form.title.trim()) {
      addToast({ type: 'error', title: 'Judul wajib diisi' });
      return;
    }
    setSending(true);
    try {
      const r = await fetch('/api/announcements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim(),
          href: form.href.trim() || null,
          category: form.category,
          priority: form.priority,
          audienceType: form.audienceType,
          audienceRoles: form.audienceRoles,
          audienceDivisions: form.audienceDivisions,
          audienceGroupIds: form.audienceGroupIds,
          audienceUserIds: form.audienceUserIds,
          publishAt: form.scheduled && form.publishAt ? `${form.publishAt}:00` : undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim pengumuman');
      addToast({ type: 'success', title: form.scheduled ? 'Pengumuman terjadwal' : 'Pengumuman terkirim', description: form.scheduled ? undefined : `${d.sent || 0} penerima` });
      setForm((f) => ({ ...f, title: '', message: '', href: '', audienceRoles: [], audienceDivisions: [], audienceGroupIds: [], audienceUserIds: [], scheduled: false, publishAt: '' }));
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally {
      setSending(false);
    }
  };

  const sendNow = async (id: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/announcements/${id}/send`, { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim');
      addToast({ type: 'success', title: 'Terkirim', description: `${d.sent || 0} penerima` });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const audienceReady = useMemo(() => {
    if (form.audienceType === 'PUBLIC') return true;
    if (form.audienceType === 'ROLE') return form.audienceRoles.length > 0;
    if (form.audienceType === 'DIVISION') return form.audienceDivisions.length > 0;
    if (form.audienceType === 'GROUP') return form.audienceGroupIds.length > 0;
    if (form.audienceType === 'USER') return form.audienceUserIds.length > 0;
    return false;
  }, [form]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>;
  }
  if (!caps || !audiences.length) {
    return <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white p-6 text-sm text-[#8C8880]">Peran Anda tidak memiliki izin mengirim pengumuman.</div>;
  }

  const chip = (active: boolean) => `px-2.5 py-1 rounded-full text-[10px] font-bold border ${active ? 'bg-[#FF416C] text-white border-[#FF416C]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`;
  const scopedDivisions = caps.scopeDivision ? [caps.scopeDivision] : DIVISIONS;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Buat Pengumuman</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold">Dari: {caps.role}</span>
        </div>
        <p className="text-[11px] text-[#8C8880]">
          Ini mengirim <b>notifikasi aplikasi</b> (lonceng + web push) ke audiens terpilih.
          Butuh <b>chat WhatsApp</b> ke nomor mentee?{' '}
          <a
            href={`#/portal/${roleToNamespace(currentRole)}/groups-monitoring`}
            className="font-bold text-sky-700 hover:underline"
          >
            Buka Monitoring → Roster → “Broadcast WA (nomor)”
          </a>.
        </p>

        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul pengumuman" className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-sm" />
        <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Isi pesan…" className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-sm min-h-[80px]" />
        <input value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="Tautan (opsional) — mis. #/portal/komisi/events" className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-sm" />

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Kategori</span>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]">
              {categories.map((c) => <option key={c} value={c}>{NOTIFY_CATEGORY_LABEL[c] || c}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Prioritas</span>
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]">
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Audiens</span>
          <div className="flex flex-wrap gap-1.5">
            {audiences.map((a) => (
              <button key={a} type="button" onClick={() => setForm((f) => ({ ...f, audienceType: a }))} className={chip(form.audienceType === a)}>{AUD_LABEL[a] || a}</button>
            ))}
          </div>

          {form.audienceType === 'ROLE' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ROLES.map((r) => <button key={r} type="button" onClick={() => toggle('audienceRoles', r)} className={chip(form.audienceRoles.includes(r))}>{r}</button>)}
            </div>
          )}
          {form.audienceType === 'DIVISION' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {scopedDivisions.map((d) => <button key={d} type="button" onClick={() => toggle('audienceDivisions', d)} className={chip(form.audienceDivisions.includes(d))}>{d}</button>)}
            </div>
          )}
          {form.audienceType === 'GROUP' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {groups.filter((g) => caps.isBod || caps.role === 'KOMISI' || caps.groupIds.includes(g.id)).map((g) => (
                <button key={g.id} type="button" onClick={() => toggle('audienceGroupIds', g.id)} className={chip(form.audienceGroupIds.includes(g.id))}>{g.name}</button>
              ))}
            </div>
          )}
          {form.audienceType === 'USER' && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[#D9D7D0] p-2 flex flex-wrap gap-1.5">
              {users.map((u) => <button key={u.id} type="button" onClick={() => toggle('audienceUserIds', u.id)} className={chip(form.audienceUserIds.includes(u.id))}>{u.name}</button>)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#5C5850]">
            <input type="checkbox" checked={form.scheduled} onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.checked }))} />
            Jadwalkan
          </label>
          {form.scheduled && (
            <input type="datetime-local" value={form.publishAt} onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm" />
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || !form.title.trim() || !audienceReady}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF416C] text-white text-xs font-bold disabled:opacity-40"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {form.scheduled ? 'Jadwalkan' : 'Kirim sekarang'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black text-[#1B1B1B] px-1">Riwayat</h3>
        {history.length === 0 && <p className="text-xs text-[#8C8880] px-1">Belum ada pengumuman.</p>}
        {history.map((a) => (
          <div key={a.id} className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-3 flex items-start gap-3">
            <span className={`mt-0.5 text-[9px] font-black px-2 py-0.5 rounded-full ${a.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : a.status === 'SCHEDULED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[a.status] || a.status}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1B1B1B] truncate">{a.title}</p>
              <p className="text-[10px] text-[#8C8880]">
                {NOTIFY_CATEGORY_LABEL[a.category] || a.category} · {AUD_LABEL[a.audienceType] || a.audienceType} · dari {a.senderRole}
                {a.status === 'SENT' ? ` · ${a.sentCount} penerima` : ''}
              </p>
            </div>
            {a.status === 'SCHEDULED' && (
              <button type="button" onClick={() => void sendNow(a.id)} disabled={busyId === a.id} className="p-1.5 rounded-lg hover:bg-[#FAF9F5] text-[#1B1B1B]" title="Kirim sekarang">
                {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              </button>
            )}
            {a.status === 'SENT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-1 shrink-0" />}
            <button type="button" onClick={() => void archive(a.id)} disabled={busyId === a.id} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Arsipkan">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
