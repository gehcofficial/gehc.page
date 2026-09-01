import React from 'react';
import { BrandCaption } from '../../brand/BrandCaption';
import { EmailRegisterPanel, GoogleRegisterPanel } from './shared/AuthPanels';

export const RegisterPage: React.FC = () => (
  <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
    <BrandCaption theme="light" className="mb-3" />
    <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2 font-display">
      Gabung Beyonders
    </h1>
    <p className="text-sm text-[#8C8880] mb-8 leading-relaxed">
      Buat akun pemuda — setelah masuk, lengkapi profil dan tes karunia. Komisi akan meninjau pendaftaranmu.
    </p>
    <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
      <GoogleRegisterPanel
        title="Daftar dengan Google"
        hint="Tanpa password — identitas diverifikasi langsung oleh Google."
        loginHref="#/login"
      />
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#8C8880]">
        <span className="flex-1 h-px bg-[#D9D7D0]" /> atau <span className="flex-1 h-px bg-[#D9D7D0]" />
      </div>
      <EmailRegisterPanel hint="Atau buat akun dengan email & kata sandi." loginHref="#/login" />
    </div>
  </section>
);
