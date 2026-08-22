import React from 'react';

export const ManifestoSection: React.FC = () => {
  return (
    <section className="py-[100px] sm:py-[150px] px-4 sm:px-8 max-w-[1440px] mx-auto relative flex flex-col items-center text-center bg-[#FAF9F5] overflow-hidden">
      {/* Decorative Sacred Geometric Watermark */}
      <div className="absolute top-0 right-[5%] sm:right-[15%] w-[320px] sm:w-[460px] h-[320px] sm:h-[460px] opacity-10 pointer-events-none">
        <svg className="w-full h-full" fill="none" stroke="url(#manifesto-grad-gehc)" strokeWidth="0.6" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="manifesto-grad-gehc" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#FF416C" />
              <stop offset="100%" stopColor="#FF4B2B" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" />
          <ellipse cx="50" cy="50" rx="24" ry="48" />
          <ellipse cx="50" cy="50" rx="48" ry="24" />
          <line x1="2" x2="98" y1="50" y2="50" />
          <line x1="50" x2="50" y1="2" y2="98" />
        </svg>
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#D9D7D0] mb-8 z-10 shadow-sm">
        <span className="text-[11px] font-bold text-[#8C8880] tracking-widest uppercase">
          Visi Pelayanan Pemuda GEHC
        </span>
      </div>

      <h2 className="text-2xl sm:text-4xl md:text-5xl font-light text-[#1B1B1B] leading-[1.25] tracking-tight max-w-[960px] relative z-10 font-display text-balance">
        "Jangan seorang pun menganggap engkau rendah karena engkau muda. Jadilah teladan bagi orang-orang percaya, dalam perkataanmu, dalam tingkah lakumu, dalam kasihmu, dalam kesetiaanmu dan dalam kesucianmu."
      </h2>

      <p className="mt-6 text-sm sm:text-base font-bold text-[#FF416C] tracking-wide uppercase">
        1 Timotius 4:12 • GMIM Eben Haezer Cikarang
      </p>
    </section>
  );
};
