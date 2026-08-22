import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Mail, Phone, Award } from 'lucide-react';

export const StrukturSection: React.FC = () => {
  const { strukturMembers } = useApp();

  const sortedMembers = [...strukturMembers].sort((a, b) => a.order - b.order);

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-[1440px] mx-auto">
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#D9D7D0] mb-3 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
            Komisi Pelayanan Pemuda (Kompelka Pemuda)
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1B1B1B] font-display">
          Struktur Pengurus Periode 2025 - 2029
        </h2>
        <p className="text-sm sm:text-base text-[#8C8880] mt-3 leading-relaxed">
          BPMJ GMIM Eben Haezer Cikarang • Melayani dengan ketulusan hati, keteladanan karakter Kristus, dan komitmen bagi generasi muda.
        </p>
      </div>

      {/* Organizational Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {sortedMembers.map((member) => (
          <div
            key={member.id}
            className="group bg-white rounded-[32px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1"
          >
            <div>
              {/* Photo Frame */}
              <div className="h-64 w-full relative overflow-hidden bg-[#F0EFEB]">
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-wider">
                    {member.division}
                  </span>
                </div>
              </div>

              {/* Text Info */}
              <div className="p-5 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-[#1B1B1B] group-hover:text-[#FF416C] transition-colors leading-snug">
                  {member.name}
                </h3>
                <p className="text-xs font-semibold text-[#FF416C] mt-0.5 mb-3">
                  {member.position}
                </p>

                <p className="text-xs text-[#8C8880] leading-relaxed line-clamp-3">
                  {member.bio}
                </p>
              </div>
            </div>

            {/* Footer Contact Info */}
            <div className="p-5 sm:p-6 pt-0 border-t border-[#D9D7D0]/30 mt-4 text-[11px] text-[#8C8880] space-y-1.5">
              {member.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-[#1B1B1B] shrink-0" />
                  <span className="truncate">{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3 h-3 text-[#1B1B1B] shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
