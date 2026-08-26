import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  disabled = false,
  min,
  max,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { year, month } = viewDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handlePrev = () => {
    if (month === 0) setViewDate({ year: year - 1, month: 11 });
    else setViewDate({ year, month: month - 1 });
  };

  const handleNext = () => {
    if (month === 11) setViewDate({ year: year + 1, month: 0 });
    else setViewDate({ year, month: month + 1 });
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(year, month, day);
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium text-left focus:outline-none focus:border-[#FF416C] disabled:opacity-50"
      >
        <Calendar className="w-4 h-4 text-[#8C8880] shrink-0" />
        <span className={value ? 'text-[#1B1B1B]' : 'text-[#8C8880]'}>
          {displayValue || placeholder}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-xl border border-[#D9D7D0] p-4 w-[280px] animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={handlePrev} className="p-1 hover:bg-[#FAF9F5] rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-[#1B1B1B]">
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={handleNext} className="p-1 hover:bg-[#FAF9F5] rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-[#8C8880] py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = formatDate(year, month, day);
              const isToday = dateStr === today;
              const isSelected = dateStr === value;
              const isDisabled = (min && dateStr < min) || (max && dateStr > max);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  disabled={isDisabled}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#FF416C] text-white'
                      : isToday
                      ? 'bg-[#FAF9F5] text-[#FF416C] border border-[#FF416C]/30'
                      : isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'hover:bg-[#FAF9F5] text-[#1B1B1B]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="mt-3 pt-2 border-t border-[#D9D7D0]/50 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                onChange(formatDate(t.getFullYear(), t.getMonth(), t.getDate()));
                setIsOpen(false);
              }}
              className="text-[11px] font-bold text-[#FF416C] hover:underline"
            >
              Hari Ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
