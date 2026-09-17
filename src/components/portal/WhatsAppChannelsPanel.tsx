import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, MessageCircle, Save } from 'lucide-react';
import { ScrollTabBar } from './ScrollTabBar';
import { useLang } from '../../context/LangContext';
import { PanelGuide } from './PanelGuide';

type Kind = 'EVENT' | 'GROUP' | 'DIVISION' | 'LEADERSHIP' | 'BIPRA' | 'KOLOM' | 'RECREATIONAL';

type ChannelLink = {
  id: string;
  kind: Kind;
  refId: string;
  label?: string | null;
  url: string;
  updatedAt?: string | null;
};

type CatalogEntry = { id: string; name: string };

type Catalog = {
  events: Array<{ id: string; slug: string; name: string; status: string }>;
  groups: Array<{ id: string; name: string }>;
  divisions: CatalogEntry[];
  leadership: CatalogEntry[];
  bipra: CatalogEntry[];
  kolom: Array<{ id: string; number: number; name: string }>;
  recreational: Array<{ id: string; name: string; kind: string }>;
};

type Raci = Record<Kind, { responsible: string; accountable: string }>;

const KIND_LABEL: Record<Kind, string> = {
  EVENT: 'Event (sementara)',
  GROUP: 'Beyonders (permanen)',
  DIVISION: 'Divisi pelayanan (permanen)',
  LEADERSHIP: 'Kepemimpinan (permanen)',
  BIPRA: 'BIPRA (permanen)',
  KOLOM: 'Wilayah & Kolom (permanen)',
  RECREATIONAL: 'Rekreasi (permanen)',
};

const KINDS: Kind[] = ['EVENT', 'GROUP', 'DIVISION', 'LEADERSHIP', 'BIPRA', 'KOLOM', 'RECREATIONAL'];
const PERMANENT_KINDS: Kind[] = ['GROUP', 'DIVISION', 'LEADERSHIP', 'BIPRA', 'KOLOM', 'RECREATIONAL'];

export const WhatsAppChannelsPanel: React.FC = () => {
  const { t } = useLang();
  const [layer, setLayer] = useState<'event' | 'permanent'>('permanent');
  const [kind, setKind] = useState<Kind>('GROUP');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({
    events: [],
    groups: [],
    divisions: [],
    leadership: [],
    bipra: [],
    kolom: [],
    recreational: [],
  });
  const [canWrite, setCanWrite] = useState<Partial<Record<Kind, boolean>>>({});
  const [raci, setRaci] = useState<Raci | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Rekreasi ditampilkan satu per satu (dropdown) — default: yang sudah punya tautan. */
  const [recreationalId, setRecreationalId] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/channel-links', { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    setLinks(d.links || []);
    setCatalog(d.catalog || { events: [], groups: [], divisions: [], leadership: [], bipra: [], kolom: [], recreational: [] });
    setCanWrite(d.canWrite || {});
    setRaci(d.raci || null);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [load]);

  // Rekreasi: pilih default (yang sudah ada tautannya) setelah katalog termuat.
  useEffect(() => {
    if (kind !== 'RECREATIONAL') return;
    const recs = catalog.recreational;
    if (!recs.length) return;
    setRecreationalId((prev) => {
      if (prev && recs.some((r) => r.id === prev)) return prev;
      const withLink = recs.find((r) => links.some((l) => l.kind === 'RECREATIONAL' && l.refId === r.id));
      return (withLink || recs[0]).id;
    });
  }, [kind, catalog.recreational, links]);

  const rows = useMemo(() => {
    if (kind === 'EVENT') return catalog.events.map((ev) => ({ id: ev.id, label: ev.name, hint: ev.status }));
    if (kind === 'GROUP') return catalog.groups.map((g) => ({ id: g.id, label: g.name, hint: 'Beyonders' }));
    if (kind === 'DIVISION') return catalog.divisions.map((d) => ({ id: d.id, label: d.name, hint: 'Divisi' }));
    if (kind === 'LEADERSHIP') return catalog.leadership.map((d) => ({ id: d.id, label: d.name, hint: 'Kepemimpinan' }));
    if (kind === 'BIPRA') return catalog.bipra.map((d) => ({ id: d.id, label: d.name, hint: 'Kategorial' }));
    if (kind === 'KOLOM') return catalog.kolom.map((k) => ({ id: k.id, label: k.name, hint: `Kolom ${k.number}` }));
    const rec = catalog.recreational.find((r) => r.id === recreationalId);
    return rec ? [{ id: rec.id, label: rec.name, hint: rec.kind }] : [];
  }, [kind, catalog, recreationalId]);

  const linkByRef = useMemo(() => {
    const m = new Map<string, ChannelLink>();
    for (const l of links) {
      if (l.kind === kind) m.set(l.refId, l);
    }
    return m;
  }, [links, kind]);

  const save = async (refId: string, label: string) => {
    const url = (drafts[refId] ?? linkByRef.get(refId)?.url ?? '').trim();
    setSaving(refId);
    setError('');
    try {
      const r = await fetch('/api/channel-links', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, refId, url, label }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const writable = !!canWrite[kind];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-[#1B1B1B] flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          {t.portal.wa.title}
        </h2>
        <p className="text-sm text-[#8C8880] mt-1">
          {t.portal.guides['wa-channels'].purpose}
        </p>
      </div>

      <PanelGuide guideId="wa-channels" />

      {raci && (
        <div className="rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5] px-4 py-3 text-xs text-[#5C5850]">
          <p><span className="font-bold">Responsible:</span> {raci[kind].responsible}</p>
          <p className="mt-0.5"><span className="font-bold">Accountable:</span> {raci[kind].accountable}</p>
        </div>
      )}

      <ScrollTabBar className="w-fit max-w-full" active={layer}>
        <button
          type="button"
          role="tab"
          aria-selected={layer === 'permanent'}
          onClick={() => { setLayer('permanent'); setKind('GROUP'); }}
          className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${layer === 'permanent' ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'}`}
        >
          {t.portal.wa.layerPermanent}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={layer === 'event'}
          onClick={() => { setLayer('event'); setKind('EVENT'); }}
          className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${layer === 'event' ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'}`}
        >
          {t.portal.wa.layerEvent}
        </button>
      </ScrollTabBar>

      {kind === 'EVENT' && (
        <p className="text-xs text-[#5C5850] rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5] px-4 py-3">
          Layer Event hanya tampilan. Ubah tautan di Program & Event → Edit.
        </p>
      )}

      <ScrollTabBar active={kind}>
        {(layer === 'event' ? (['EVENT'] as Kind[]) : PERMANENT_KINDS).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${
              kind === k ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'
            }`}
          >
            {k === 'EVENT' ? t.portal.wa.kindEvent : k === 'GROUP' ? t.portal.wa.kindGroup : k === 'DIVISION' ? t.portal.wa.kindDivision : k === 'LEADERSHIP' ? t.portal.wa.kindLeadership : k === 'BIPRA' ? t.portal.wa.kindBipra : k === 'KOLOM' ? t.portal.wa.kindKolom : t.portal.wa.kindRecreational}
          </button>
        ))}
      </ScrollTabBar>

      {kind === 'RECREATIONAL' && catalog.recreational.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Pilih minat</label>
          <select
            value={recreationalId}
            onChange={(e) => setRecreationalId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
          >
            {catalog.recreational.map((r) => (
              <option key={r.id} value={r.id}>
                {links.some((l) => l.kind === 'RECREATIONAL' && l.refId === r.id) ? '✓ ' : ''}{r.name}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[#8C8880]">
            Hanya minat yang dipilih yang ditampilkan — bukan semua sekaligus.
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-[#8C8880]">Memuat kanal…</p>}

      <ul className="space-y-2">
        {rows.map((row) => {
          const existing = linkByRef.get(row.id);
          const value = drafts[row.id] ?? existing?.url ?? '';
          return (
            <li key={row.id} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#1B1B1B]">{row.label}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#8C8880]">{row.hint}</p>
                </div>
                {existing?.url && (
                  <a href={existing.url} target="_blank" rel="noreferrer" className="text-emerald-700">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={value}
                  disabled={kind === 'EVENT' || !writable}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  placeholder="https://chat.whatsapp.com/…"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs disabled:opacity-60"
                />
                {writable && kind !== 'EVENT' && (
                  <button
                    type="button"
                    onClick={() => save(row.id, row.label)}
                    disabled={saving === row.id || !value.trim()}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {saving === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Simpan
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!loading && rows.length === 0 && (
          <li className="text-sm text-[#8C8880]">
            {kind === 'RECREATIONAL' ? 'Pilih minat dulu untuk melihat kanalnya.' : 'Tidak ada kanal untuk filter ini.'}
          </li>
        )}
      </ul>
    </div>
  );
};
