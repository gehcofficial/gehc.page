import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FolderSync,
  Lock,
  CheckCircle2,
  RefreshCw,
  Folder,
  Cloud,
  FileCheck,
  Shield,
  ExternalLink,
  Settings2,
} from 'lucide-react';

export const ManageIntegrations: React.FC = () => {
  const { isSuperAdmin, currentRole, integrationConfig, updateIntegrationConfig, addToast } =
    useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [rootFolderId, setRootFolderId] = useState(integrationConfig.root_folder_id);
  const [rootFolderName, setRootFolderName] = useState(integrationConfig.root_folder_name);
  const [allowedMimeTypes, setAllowedMimeTypes] = useState(
    integrationConfig.allowed_mime_types.join(', ')
  );

  // 403 Forbidden Gatekeeper check
  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-[32px] p-8 sm:p-16 border border-red-200 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <Lock className="w-8 h-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">
          HTTP 403 • Akses Ditolak
        </span>
        <h3 className="text-2xl font-bold text-[#1B1B1B] mt-2 mb-3">
          Integrasi Khusus SUPERADMIN
        </h3>
        <p className="text-xs sm:text-sm text-[#8C8880] leading-relaxed max-w-md mx-auto">
          Halaman konfigurasi Google Drive OAuth & folder repository ini hanya dapat dikelola oleh Superadmin GEHC.
          Peran aktif Anda: <strong className="text-[#1B1B1B] uppercase">[{currentRole}]</strong>.
        </p>
      </div>
    );
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateIntegrationConfig({
      root_folder_id: rootFolderId,
      root_folder_name: rootFolderName,
      allowed_mime_types: allowedMimeTypes.split(',').map((t) => t.trim()),
    });
    addToast({
      type: 'success',
      title: 'Konfigurasi Cloud Disimpan',
      description: 'Pengaturan Google Drive storage bridge berhasil diperbarui.',
    });
  };

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      updateIntegrationConfig({
        last_synced_at: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      addToast({
        type: 'success',
        title: 'Sinkronisasi Selesai',
        description: 'Seluruh aset media warta, foto pengurus, dan flyer kegiatan telah tersinkron dengan Google Drive.',
      });
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Bar */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <FolderSync className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Google Drive Cloud Storage Bridge
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Integrasi Media & File Storage
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Konfigurasi OAuth Google Drive untuk penyimpanan banner warta, foto struktur, dan dokumen kegiatan gereja secara terpusat.
          </p>
        </div>

        <button
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="px-5 py-3 rounded-full bg-[#181818] hover:bg-black disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Status Koneksi</span>
            <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>OAuth Connected</span>
            </div>
            <p className="text-[11px] text-[#8C8880] mt-0.5">Akun: ebenhaezer.cikarang@gmail.com</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Root Directory</span>
            <div className="text-xl font-bold text-[#1B1B1B] flex items-center gap-1.5 mt-1">
              <Folder className="w-4 h-4 text-blue-500" />
              <span>{integrationConfig.root_folder_name}</span>
            </div>
            <p className="text-[11px] font-mono text-[#8C8880] mt-0.5">ID: {integrationConfig.root_folder_id}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Sinkronisasi Terakhir</span>
            <div className="text-xl font-bold text-[#1B1B1B] mt-1">
              {integrationConfig.last_synced_at || 'Baru Saja'}
            </div>
            <p className="text-[11px] text-[#8C8880] mt-0.5">Auto-sync diaktifkan</p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm max-w-2xl">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/40">
          <Settings2 className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-base font-bold text-[#1B1B1B]">
            Pengaturan Root Folder & Filter File
          </h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Root Folder ID (Google Drive) *
            </label>
            <input
              type="text"
              required
              value={rootFolderId}
              onChange={(e) => setRootFolderId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-mono focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Nama Folder Utama *
            </label>
            <input
              type="text"
              required
              value={rootFolderName}
              onChange={(e) => setRootFolderName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Format File Yang Diizinkan (MIME Types)
            </label>
            <input
              type="text"
              value={allowedMimeTypes}
              onChange={(e) => setAllowedMimeTypes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-mono focus:outline-none focus:border-black"
            />
            <p className="text-[10px] text-[#8C8880] mt-1">
              Contoh: image/jpeg, image/png, image/webp, application/pdf
            </p>
          </div>

          <div className="pt-4 border-t border-[#D9D7D0]/40 flex items-center justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold shadow-md transition-all"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
