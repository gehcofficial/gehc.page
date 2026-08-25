import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Loader2, Save } from 'lucide-react';

type AttStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'TANPA_KABAR';

interface ServerMember {
  id: string;
  name: string;
  familyRole: string;
  status: string;
}

interface AttendanceRecordDto {
  id: string;
  groupMemberId: string;
  date: string;
  status: AttStatus;
  note?: string | null;
}

const STATUS_OPTIONS: { value: AttStatus; label: string; activeCls: string }[] = [
  { value: 'HADIR', label: 'H', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'IZIN', label: 'I', activeCls: 'bg-amber-500 text-white border-amber-500' },
  { value: 'SAKIT', label: 'S', activeCls: 'bg-sky-600 text-white border-sky-600' },
  { value: 'TANPA_KABAR', label: 'TK', activeCls: 'bg-red-600 text-white border-red-600' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Props {
  groupId: string;
  groupName: string;
  canWrite: boolean;
}

/** Input absensi mingguan per anggota — tersimpan ke TiDB (tabel attendance_records). */
export const AttendancePanel: React.FC<Props> = ({ groupId, groupName, canWrite }) => {
  const [date, setDate] = useState<string>(todayStr());
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const m = await request<{ members: ServerMember[] }>(`/api/db/groups/${groupId}/members`);
      const active = m.members.filter((x) => x.status === 'ACTIVE');
      setMembers(active);
      const a = await request<{ records: AttendanceRecordDto[] }>(
        `/api/db/groups/${groupId}/attendance?date=${date}`
      );
      const next: Record<string, AttStatus> = {};
      for (const r of a.records) next[r.groupMemberId] = r.status;
      setMarks(next);
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [groupId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const entries = Object.entries(marks).map(([groupMemberId, status]) => ({ groupMemberId, status }));
    if (!entries.length) {
      setMessage({ type: 'info', text: 'Belum ada status yang diisi.' });
      return;
    }
    setSaving(true);
    try {
      const r = await request<{ saved: number }>('/api/db/attendance', 'POST', { groupId, date, entries });
      setMessage({ type: 'ok', text: `Absensi ${r.saved} anggota tersimpan ke TiDB.` });
    } catch (e) {
      setMessage({ type: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#D9D7D0]/60 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#FF416C]" />
            Absensi Mingguan — {groupName}
          </h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Sumber aturan idle 4 minggu. H/Hadir · I/Izin · S/Sakit · TK/Tanpa Kabar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!canWrite}
            className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold"
          />
          {canWrite && (
            <button
              onClick={save}
              disabled={saving || loading}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan
            </button>
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2 text-[11px] text-[#8C8880]">
          Mode lihat-saja — hanya Mentor/Co-Mentor grup binaan atau Komisi yang dapat mengubah absensi.
        </div>
      )}

      {message && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            message.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700'
              : message.type === 'info'
              ? 'bg-gray-50 text-[#8C8880]'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8880] py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat roster dari TiDB…
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-[#8C8880] py-2">
          Tidak ada anggota aktif di server untuk grup ini.
        </p>
      ) : (
        <div className="divide-y divide-[#D9D7D0]/50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{m.name}</p>
                <p className="text-[10px] text-[#8C8880]">{m.familyRole}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {STATUS_OPTIONS.map((opt) => {
                  const isActiveMark = marks[m.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      title={opt.value}
                      onClick={() =>
                        canWrite &&
                        setMarks((prev) => {
                          const copy = { ...prev };
                          if (copy[m.id] === opt.value) delete copy[m.id];
                          else copy[m.id] = opt.value;
                          return copy;
                        })
                      }
                      className={`w-8 h-8 rounded-lg border text-[10px] font-black transition-all ${
                        isActiveMark
                          ? opt.activeCls
                          : 'bg-white border-[#D9D7D0] text-[#8C8880] hover:border-[#8C8880]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
