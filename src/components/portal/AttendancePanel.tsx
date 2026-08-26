import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Loader2, Save, ChevronDown, Check, X, UserCheck, Users } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import type { GroupMember } from '../../types';

type AttStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'TANPA_KABAR';

interface AttendanceRecordDto {
  id: string;
  groupMemberId: string;
  date: string;
  status: AttStatus;
  note?: string | null;
}

const STATUS_OPTIONS: { value: AttStatus; label: string; activeCls: string; emoji: string }[] = [
  { value: 'HADIR', label: 'Hadir', activeCls: 'bg-emerald-600 text-white border-emerald-600', emoji: '✅' },
  { value: 'IZIN', label: 'Izin', activeCls: 'bg-amber-500 text-white border-amber-500', emoji: '📝' },
  { value: 'SAKIT', label: 'Sakit', activeCls: 'bg-sky-600 text-white border-sky-600', emoji: '🤒' },
  { value: 'TANPA_KABAR', label: 'Tanpa Kabar', activeCls: 'bg-red-600 text-white border-red-600', emoji: '❓' },
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
  members: GroupMember[];
}

/** Input absensi mingguan per anggota — tersimpan ke TiDB (tabel attendance_records). */
export const AttendancePanel: React.FC<Props> = ({ groupId, groupName, canWrite, members }) => {
  const [date, setDate] = useState<string>(todayStr());
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [multiSelectOpen, setMultiSelectOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AttStatus>('HADIR');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
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

  const toggleMemberSelect = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map((m) => m.id)));
    }
  };

  const applyBulkStatus = () => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const id of selectedMembers) {
        next[id] = bulkStatus;
      }
      return next;
    });
    setSelectedMembers(new Set());
    setMultiSelectOpen(false);
  };

  const setAllStatus = (status: AttStatus) => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const m of members) {
        next[m.id] = status;
      }
      return next;
    });
  };

  const clearAll = () => {
    setMarks({});
  };

  const getMemberById = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="bg-white rounded-3xl border border-[#D9D7D0]/60 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#FF416C]" />
            Absensi Mingguan — {groupName}
          </h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Pilih anggota yang hadir, atau atur status per orang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={date} onChange={setDate} disabled={!canWrite} className="w-40" />
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
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${
          message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' :
          message.type === 'info' ? 'bg-gray-50 text-[#8C8880]' :
          'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions Bar */}
      {canWrite && !loading && members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#D9D7D0]/50">
          <button
            onClick={() => setAllStatus('HADIR')}
            className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold hover:bg-emerald-200 transition-colors"
          >
            ✅ Hadir Semua
          </button>
          <button
            onClick={() => setAllStatus('IZIN')}
            className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold hover:bg-amber-200 transition-colors"
          >
            📝 Izin Semua
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold hover:bg-gray-200 transition-colors"
          >
            🔄 Reset
          </button>

          {/* Multi-Select Dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={() => setMultiSelectOpen(!multiSelectOpen)}
              className="px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold flex items-center gap-1.5 hover:bg-black transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Pilih Massal
              <ChevronDown className={`w-3 h-3 transition-transform ${multiSelectOpen ? 'rotate-180' : ''}`} />
            </button>

            {multiSelectOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#D9D7D0] p-4 z-50 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#1B1B1B]">Pilih Anggota</span>
                  <button onClick={selectAll} className="text-[11px] font-bold text-[#FF416C] hover:underline">
                    {selectedMembers.size === members.length ? 'Batal Pilih' : 'Pilih Semua'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#FAF9F5] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(m.id)}
                        onChange={() => toggleMemberSelect(m.id)}
                        className="w-4 h-4 rounded text-[#FF416C] focus:ring-0"
                      />
                      <span className="text-xs font-medium text-[#1B1B1B] truncate">{m.name}</span>
                      {marks[m.id] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {STATUS_OPTIONS.find((o) => o.value === marks[m.id])?.label}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#D9D7D0]/50">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as AttStatus)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={applyBulkStatus}
                    disabled={selectedMembers.size === 0}
                    className="px-3 py-1.5 rounded-xl bg-[#FF416C] text-white text-xs font-bold disabled:opacity-40 hover:bg-[#FF416C]/90 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Terapkan ({selectedMembers.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8880] py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data absensi…
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-[#8C8880] py-2">
          Tidak ada anggota aktif di server untuk grup ini.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/40 hover:border-[#D9D7D0] transition-colors">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center text-[10px] font-bold text-[#8C8880] shrink-0">
                  {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{m.name}</p>
                  <p className="text-[10px] text-[#8C8880]">
                    {m.familyRole === 'MENTOR' ? 'Mentor' : m.familyRole === 'COMENTOR' ? 'Comentor' : 'Mentee'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {STATUS_OPTIONS.map((opt) => {
                  const isActiveMark = marks[m.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      title={opt.label}
                      onClick={() =>
                        canWrite &&
                        setMarks((prev) => {
                          const copy = { ...prev };
                          if (copy[m.id] === opt.value) delete copy[m.id];
                          else copy[m.id] = opt.value;
                          return copy;
                        })
                      }
                      className={`w-9 h-9 rounded-xl border text-[10px] font-black transition-all ${
                        isActiveMark
                          ? opt.activeCls
                          : 'bg-white border-[#D9D7D0] text-[#8C8880] hover:border-[#8C8880]'
                      }`}
                    >
                      {opt.emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Summary */}
      {!loading && members.length > 0 && Object.keys(marks).length > 0 && (
        <div className="pt-3 border-t border-[#D9D7D0]/50 flex flex-wrap gap-3 text-[11px]">
          {STATUS_OPTIONS.map((opt) => {
            const count = Object.values(marks).filter((s) => s === opt.value).length;
            return (
              <span key={opt.value} className="flex items-center gap-1">
                {opt.emoji} {opt.label}: <strong>{count}</strong>
              </span>
            );
          })}
          <span className="text-[#8C8880]">• Total: <strong>{Object.keys(marks).length}</strong> / {members.length}</span>
        </div>
      )}
    </div>
  );
};
