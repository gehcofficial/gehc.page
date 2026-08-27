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
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

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

  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/db/users?limit=100', { credentials: 'include' });
      const d = await r.json();
      setUsers((d.users || []).map((u: any) => ({ id: u.id, name: u.name })));
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRoles(), fetchSchedules(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchRoles, fetchSchedules, fetchUsers]);

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
          users={users}
          onClose={() => setShowAssignForm(false)}
          onSaved={() => { setShowAssignForm(false); fetchSchedules(); }}
        />
      )}
    </div>
  );
}

// Assign Modal
function AssignModal({ date, roles, users, onClose, onSaved }: {
  date: string;
  roles: ServiceRole[];
  users: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ serviceRoleId: roles[0]?.id || '', userId: '', timeStart: '13:00', timeEnd: '15:00', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.serviceRoleId || !form.userId) return;
    setSaving(true);
    try {
      await fetch('/api/penatalayan/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, date }),
      });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Tugaskan Penatalayan</h3>
        <p className="text-xs text-[#8C8880] mb-4">
          {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Role / Jabatan</label>
            <select value={form.serviceRoleId} onChange={e => setForm({ ...form, serviceRoleId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Personel</label>
            <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
              <option value="">Pilih personel...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Jam Mulai</label>
              <input type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Jam Selesai</label>
              <input type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={handleSubmit} disabled={saving || !form.userId}
            className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
