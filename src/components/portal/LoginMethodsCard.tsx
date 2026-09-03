import React from 'react';
import { CheckCircle2, Circle, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type MethodRow = {
  id: string;
  label: string;
  detail: string;
  active: boolean;
};

export const LoginMethodsCard: React.FC = () => {
  const { authUser } = useApp();

  const methods: MethodRow[] = [
    {
      id: 'username',
      label: 'Username + password',
      detail: authUser?.loginUsername
        ? `@${authUser.loginUsername}`
        : 'Belum diset — isi di bawah',
      active: Boolean(authUser?.loginUsername && authUser?.hasPassword),
    },
    {
      id: 'password',
      label: 'Password cadangan',
      detail: authUser?.hasPassword
        ? 'Aktif — tetap bisa dipakai setelah Google ditaut'
        : 'Belum ada — set di kartu password',
      active: Boolean(authUser?.hasPassword),
    },
    {
      id: 'google',
      label: 'Google SSO',
      detail: authUser?.googleLinked
        ? 'Tertaut — login cepat satu klik'
        : 'Opsional — tautkan di bawah',
      active: Boolean(authUser?.googleLinked),
    },
  ];

  const activeCount = methods.filter((m) => m.active).length;

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#1B1B1B]">Metode login</h2>
          <p className="text-[11px] text-[#8C8880]">
            {activeCount} dari {methods.length} metode aktif — dual auth seperti Mobile Legends.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {methods.map((m) => (
          <li
            key={m.id}
            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border ${
              m.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-[#D9D7D0]'
            }`}
          >
            {m.active ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-[#8C8880] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-bold ${m.active ? 'text-emerald-900' : 'text-[#1B1B1B]'}`}>{m.label}</p>
              <p className={`text-[10px] ${m.active ? 'text-emerald-700' : 'text-[#8C8880]'}`}>{m.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
