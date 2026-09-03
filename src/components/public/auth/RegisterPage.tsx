import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { GehcLogo } from '../../brand/GehcLogo';
import { BrandCaption } from '../../brand/BrandCaption';
import { EmailRegisterPanel, GoogleRegisterPanel } from './shared/AuthPanels';

export const RegisterPage: React.FC = () => (
  <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <GehcLogo size={64} className="mx-auto mb-4 shadow-2xl" />
        <h1 className="text-2xl font-black tracking-tight">Gabung Beyonders</h1>
        <BrandCaption className="mt-3 items-center" align="center" />
        <p className="text-xs text-white/50 mt-3 leading-relaxed">
          Buat akun pemuda — setelah masuk, lengkapi profil dan tes karunia.
        </p>
      </div>

      <div className="rounded-[28px] bg-white/[0.04] border border-white/10 p-6 space-y-4">
        <GoogleRegisterPanel
          title="Daftar dengan Google"
          hint="Tanpa password — identitas diverifikasi langsung oleh Google."
          theme="dark"
        />
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
          <span className="flex-1 h-px bg-white/10" /> atau <span className="flex-1 h-px bg-white/10" />
        </div>
        <EmailRegisterPanel hint="Atau buat akun dengan email & kata sandi." theme="dark" />
      </div>

      <div className="mt-8 text-center space-y-3">
        <a
          href="#/login"
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = '#/login';
          }}
          className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
        >
          Sudah punya akun? Masuk
        </a>
        <div>
          <a
            href="#/beyonders"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = '#/beyonders';
            }}
            className="text-xs text-white/40 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke situs publik
          </a>
        </div>
      </div>
    </div>
  </div>
);
