import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  X,
  Clock,
  User,
  Loader2,
} from 'lucide-react';
import type { ServiceRole, ServiceSchedule } from '../../types/penatalayan';
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_COLORS } from '../../types/penatalayan';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useApp } from '../../context/AppContext';
import type { SearchableOption } from '../../lib/searchable-options';

const fmtLong = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/** Minggu-minggu dalam bulan dari sebuah tanggal ISO. */
function sundaysOfMonth(iso: string): string[] {
  const [y, m] = String(iso).slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** N Minggu ke depan (termasuk hari ini bila Minggu). */
function nextSundays(iso: string, count = 4): string[] {
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return [];
  const dow = new Date(t).getUTCDay();
  const first = t + (dow === 0 ? 0 : (7 - dow) * 86400000);
  return Array.from({ length: count }, (_, i) => new Date(first + i * 7 * 86400000).toISOString().slice(0, 10));
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

interface Props {
  division: string;
}

export default function PenatalayanCalendar({ division }: Props) {
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const r = await fetch(`/api/penatalayan/roles?division=${division}`, { credentials: 'include' });
      const d = await r.json();
      setRoles(d.roles || []);
    } catch { /* skip */ }
  }, [division]);

  const fetchSchedules = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const r = await fetch(`/api/penatalayan/schedules?from=${from}&to=${to}`, { credentials: 'include' });
      const d = await r.json();
      setSchedules(d.schedules || []);
    } catch { /* skip */ }
  }, [currentMonth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRoles(), fetchSchedules()]).finally(() => setLoading(false));
  }, [fetchRoles, fetchSchedules]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  const formatDate = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getSchedulesForDate = (dateStr: string) =>
    schedules.filter(s => s.date.startsWith(dateStr));

  const handleStatusToggle = async (schedule: ServiceSchedule) => {
    const nextStatus = schedule.status === 'SCHEDULED' ? 'CONFIRMED' : schedule.status === 'CONFIRMED' ? 'DONE' : 'SCHEDULED';
    await fetch(`/api/penatalayan/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchSchedules();
  };

  const handleDeleteSchedule = async (id: string) => {
    await fetch(`/api/penatalayan/schedules/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchSchedules();
  };

  return (
    <div className="space-y-4">
      {/* Month Navigator */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#1B1B1B]">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setCurrentMonth(new Date()); }} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">Hari Ini</button>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#D9D7D0]/50">
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
              {d}
            </div>
          ))}
        </div>
        {/* Date cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 border-b border-r border-[#D9D7D0]/30 bg-gray-50/50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(day);
            const daySchedules = getSchedulesForDate(dateStr);
            const isToday = new Date().toISOString().startsWith(dateStr);
            const isSelected = selectedDate === dateStr;
            const isSunday = new Date(year, month, day).getDay() === 0;

            return (
              <div
                key={day}
                onClick={() => { setSelectedDate(dateStr); setShowAssignForm(true); }}
                className={`h-24 border-b border-r border-[#D9D7D0]/30 p-1.5 cursor-pointer hover:bg-[#FAF9F5] transition-colors ${isSelected ? 'bg-blue-50 ring-2 ring-blue-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#F6AE4A] text-white' : isSunday ? 'text-red-500' : 'text-[#1B1B1B]'
                  }`}>
                    {day}
                  </span>
                  {daySchedules.length > 0 && (
                    <span className="text-[9px] bg-[#1B1B1B] text-white px-1.5 py-0.5 rounded-full font-bold">
                      {daySchedules.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {daySchedules.slice(0, 3).map(s => (
                    <div key={s.id} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        s.status === 'CONFIRMED' ? 'bg-green-500' :
                        s.status === 'DONE' ? 'bg-gray-400' :
                        s.status === 'CANCELLED' ? 'bg-red-400' : 'bg-blue-500'
                      }`} />
                      <span className="text-[8px] text-[#8C8880] truncate">{s.user?.name?.split(' ')[0] || '—'}</span>
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <span className="text-[8px] text-[#8C8880]">+{daySchedules.length - 3} lagi</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      {selectedDate && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h4>
            <button
              onClick={() => setShowAssignForm(true)}
              className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Tugaskan
            </button>
          </div>
          {getSchedulesForDate(selectedDate).length === 0 ? (
            <p className="text-xs text-[#8C8880] text-center py-4">Belum ada penatalayan dijadwalkan.</p>
          ) : (
            <div className="space-y-2">
              {getSchedulesForDate(selectedDate).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{s.serviceRole?.name}</p>
                    <p className="text-xs text-[#8C8880]">{s.user?.name} {s.timeStart ? `• ${s.timeStart}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${SERVICE_STATUS_COLORS[s.status]?.bg} ${SERVICE_STATUS_COLORS[s.status]?.text}`}>
                    {SERVICE_STATUS_LABELS[s.status]}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleStatusToggle(s)} className="p-1.5 rounded-lg hover:bg-white" title="Toggle status">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </button>
                    <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 rounded-lg hover:bg-white" title="Hapus">
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignForm && selectedDate && (
        <AssignModal
          date={selectedDate}
          roles={roles}
          onClose={() => setShowAssignForm(false)}
          onChanged={() => fetchSchedules()}
        />
      )}
    </div>
  );
}

// Assign Modal — penugasan massal: komponen[] × personel[] × tanggal[]
function AssignModal({ date, roles, onClose, onChanged }: {
  date: string;
  roles: ServiceRole[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { addToast } = useApp();
  const sortedRoles = [...roles].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const [roleIds, setRoleIds] = useState<string[]>(() => (roles[0] ? [roles[0].id] : []));
  const [people, setPeople] = useState<string[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<SearchableOption[]>([]);
  const [dates, setDates] = useState<string[]>([date]);
  const [dateInput, setDateInput] = useState(date);
  const [timeStart, setTimeStart] = useState('13:00');
  const [timeEnd, setTimeEnd] = useState('15:00');
  const [saving, setSaving] = useState(false);
  const [confirmBig, setConfirmBig] = useState(false);

  const total = roleIds.length * people.length * dates.length;
  const canSave = roleIds.length > 0 && people.length > 0 && dates.length > 0 && !saving;

  /** Cari personel langsung dari input (pola Portal Doa), hasil urut alfabetis. */
  const searchPeople = useCallback(async (query: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(query)}`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    return (d.people || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }));
  }, []);

  const toggleRole = (id: string) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const addDate = (d: string) => {
    const iso = String(d || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    setDates((prev) => (prev.includes(iso) ? prev : [...prev, iso].sort()));
  };
  const removeDate = (d: string) => setDates((prev) => prev.filter((x) => x !== d));

  const submit = async () => {
    setConfirmBig(false);
    setSaving(true);
    try {
      const r = await fetch('/api/penatalayan/schedules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceRoleIds: roleIds, userIds: people, dates, timeStart, timeEnd }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan penugasan.');
      addToast({
        type: 'success',
        title: `${d.created || 0} penugasan dibuat`,
        description: d.skipped ? `${d.skipped} dilewati (sudah ada).` : undefined,
      });
      setPeople([]);
      setPeopleOptions([]);
      setDates([date]);
      onChanged();
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan penugasan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-1">Tugaskan Penatalayan</h3>
        <p className="text-xs text-[#8C8880] mb-4">
          Bisa sekaligus: beberapa komponen × beberapa orang × beberapa tanggal. Tanggal awal: {fmtLong(date)}.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880]">
                Komponen / Jabatan ({roleIds.length}/{sortedRoles.length})
              </label>
              <button
                type="button"
                onClick={() => setRoleIds(roleIds.length === sortedRoles.length ? [] : sortedRoles.map((r) => r.id))}
                className="text-[10px] font-bold text-emerald-700"
              >
                {roleIds.length === sortedRoles.length ? 'Kosongkan' : 'Pilih semua'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5]">
              {sortedRoles.map((r) => {
                const on = roleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${on ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#5C5850] border-[#D9D7D0]'}`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">
              Personel ({people.length} dipilih)
            </label>
            <SearchableMultiSelect
              values={people}
              selectedOptions={peopleOptions}
              onSearch={searchPeople}
              onChange={(values, options) => { setPeople(values); setPeopleOptions(options); }}
              placeholder="Ketik nama personel (min. 2 huruf)…"
              emptyHint="Nama tidak ketemu — coba ejaan lain."
              minQuery={2}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880]">Tanggal ({dates.length})</label>
              <button type="button" onClick={() => sundaysOfMonth(date).forEach(addDate)} className="text-[10px] font-bold text-sky-700">+ Semua Minggu bulan ini</button>
              <button type="button" onClick={() => nextSundays(date, 4).forEach(addDate)} className="text-[10px] font-bold text-sky-700">+ 4 Minggu ke depan</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {dates.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold text-[#1B1B1B]">
                  {fmtLong(d)}
                  {dates.length > 1 && (
                    <button type="button" onClick={() => removeDate(d)} className="p-0.5 rounded-full hover:bg-white" aria-label={`Hapus ${d}`}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
              />
              <button type="button" onClick={() => addDate(dateInput)} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold">
                + Tambah tanggal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Jam Mulai</label>
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Jam Selesai</label>
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
          </div>

          <p className="text-[11px] text-[#5C5850] bg-[#FAF9F5] border border-[#D9D7D0] rounded-xl px-3 py-2">
            {roleIds.length} komponen × {people.length} orang × {dates.length} tanggal ={' '}
            <strong>{total} penugasan</strong>
            {total > 20 ? ' — akan diminta konfirmasi.' : ''}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Tutup</button>
          <button
            onClick={() => (total > 20 ? setConfirmBig(true) : void submit())}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : `Simpan ${total ? `(${total})` : ''}`}
          </button>
        </div>

        <ConfirmDialog
          open={confirmBig}
          title={`Simpan ${total} penugasan?`}
          confirmLabel="Ya, simpan"
          busy={saving}
          onClose={() => setConfirmBig(false)}
          onConfirm={() => void submit()}
          description={(
            <p>
              {roleIds.length} komponen × {people.length} orang × {dates.length} tanggal. Notifikasi dikirim ke {people.length} orang.
            </p>
          )}
        />
      </div>
    </div>
  );
}
