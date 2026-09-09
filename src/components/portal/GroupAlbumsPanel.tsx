import React, { useCallback, useEffect, useState } from 'react';
import { Images, Plus, Pin, RefreshCw, Trash2, X } from 'lucide-react';
import { DriveUploadButton } from './DriveUploadButton';
import { useApp } from '../../context/AppContext';

type Album = {
  id: string;
  title: string;
  kind: string;
  occurredOn: string;
  location?: string | null;
  coverUrl?: string | null;
  previews: { id: string; thumbnailUrl: string }[];
  driveUrl?: string;
};

export const GroupAlbumsPanel: React.FC<{
  groupId: string;
  canCreate: boolean;
  canUpload: boolean;
}> = ({ groupId, canCreate, canUpload }) => {
  const { addToast } = useApp();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [title, setTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string; thumbnailUrl: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<Record<string, { folderMissing: boolean; photoCount: number }>>({});
  const [brokenCover, setBrokenCover] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/groups/${groupId}/albums`, { credentials: 'include' });
    const d = await r.json();
    setAlbums(d.albums || []);
    setBrokenCover({});
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    const r = await fetch(`/api/groups/${groupId}/albums`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), occurredOn, location: location.trim() || null, kind: 'ADHOC' }),
    });
    const d = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal membuat album' });
      return;
    }
    setTitle('');
    if (d.drivePending) {
      addToast({ type: 'success', title: 'Album tersimpan, folder Drive menyusul', body: d.driveNote || 'Foto bisa diunggah setelah koneksi Drive pulih.' });
    }
    await load();
  };

  const openFiles = async (albumId: string) => {
    setOpenId(albumId);
    const r = await fetch(`/api/groups/${groupId}/albums/${albumId}/files`, { credentials: 'include' });
    const d = await r.json();
    setFiles(d.files || []);
  };

  const pinPreviews = async (albumId: string, ids: string[]) => {
    await fetch(`/api/groups/${groupId}/albums/${albumId}/previews`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewFileIds: ids.slice(0, 5) }),
    });
    await load();
  };

  // Samakan DB ↔ Drive: cek folder masih ada, hitung foto aktual,
  // bersihkan preview menunjuk file terhapus. Seperti refresh landing.
  const sync = async () => {
    setSyncing(true);
    try {
      const r = await fetch(`/api/groups/${groupId}/albums/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        addToast({ type: 'error', title: d.error || 'Gagal sinkron' });
        return;
      }
      const info: Record<string, { folderMissing: boolean; photoCount: number }> = {};
      for (const a of d.albums || []) info[a.id] = { folderMissing: Boolean(a.folderMissing), photoCount: a.photoCount ?? 0 };
      setSyncInfo(info);
      const missing = (d.albums || []).filter((a: { folderMissing?: boolean }) => a.folderMissing).length;
      addToast({
        type: missing ? 'error' : 'success',
        title: missing ? `${missing} album foldernya hilang di Drive` : 'Album sinkron dengan Drive',
      });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const deleteAlbum = async (album: Album) => {
    if (!window.confirm(`Hapus album "${album.title}"? Baris dihapus dan folder Drive masuk sampah (pulih 30 hari).`)) return;
    const r = await fetch(`/api/groups/${groupId}/albums/${album.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal hapus album' });
      return;
    }
    addToast({ type: 'success', title: 'Album dihapus', body: d.driveNote });
    if (openId === album.id) setOpenId(null);
    await load();
  };

  const deletePhoto = async (albumId: string, fileId: string, fileName: string) => {
    if (!window.confirm(`Hapus foto "${fileName}"? File masuk sampah Drive.`)) return;
    const r = await fetch(`/api/groups/${groupId}/albums/${albumId}/photos/${fileId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal hapus foto' });
      return;
    }
    addToast({ type: 'success', title: 'Foto dihapus' });
    await openFiles(albumId);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          title="Samakan daftar album dengan isi Drive aktual"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Menyamakan…' : 'Sinkronkan Drive'}
        </button>
      </div>
      {canCreate && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 p-4 bg-white space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Album kegiatan baru</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul (contoh: Kunjungan kampus)"
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
            />
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Tempat (opsional)"
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
            />
          </div>
          <button
            type="button"
            onClick={create}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat folder Drive
          </button>
        </div>
      )}

      {albums.length === 0 ? (
        <p className="text-xs text-[#8C8880]">Belum ada album. Mentor membuat kegiatan; anggota mengunggah foto.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {albums.map((a) => (
            <div key={a.id} className="rounded-2xl border border-[#D9D7D0]/50 overflow-hidden bg-white">
              <div className="aspect-square bg-[#F3F1EC] relative">
                {a.coverUrl && !brokenCover[a.id] ? (
                  <img
                    src={a.coverUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setBrokenCover((m) => ({ ...m, [a.id]: true }))}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#8C8880]">
                    <Images className="w-8 h-8" />
                    {brokenCover[a.id] ? (
                      <p className="text-[10px] font-bold px-3 text-center">Cover rusak — Sinkronkan Drive / pilih preview lain</p>
                    ) : (
                      syncInfo[a.id] && !syncInfo[a.id].folderMissing && syncInfo[a.id].photoCount === 0 && (
                        <p className="text-[10px] font-bold px-3 text-center">Belum ada foto — unggah di bawah</p>
                      )
                    )}
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold">{a.title}</p>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => void deleteAlbum(a)}
                      title="Hapus album (DB + folder Drive ke sampah)"
                      className="p-1 rounded-lg hover:bg-red-100 text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {syncInfo[a.id]?.folderMissing && (
                  <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    Folder Drive-nya sudah tidak ada — hapus album ini atau buat ulang.
                  </p>
                )}
                <p className="text-[11px] text-[#8C8880]">
                  {String(a.occurredOn).slice(0, 10)}
                  {a.location ? ` · ${a.location}` : ''}
                </p>
                <div className="flex gap-1">
                  {(a.previews || []).map((p) => (
                    <img
                      key={p.id}
                      src={p.thumbnailUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canUpload && (
                    <DriveUploadButton
                      label="Unggah foto"
                      onFile={async (payload) => {
                        const r = await fetch(`/api/groups/${groupId}/albums/${a.id}/photos`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                        });
                        const d = await r.json();
                        if (!r.ok) addToast({ type: 'error', title: d.error || 'Gagal unggah' });
                        else {
                          addToast({ type: 'success', title: 'Foto tersimpan di Drive' });
                          await load();
                        }
                      }}
                    />
                  )}
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => openFiles(a.id)}
                      className="text-[11px] font-bold text-[#1B1B1B] inline-flex items-center gap-1"
                    >
                      <Pin className="w-3 h-3" /> Pilih preview
                    </button>
                  )}
                  {a.driveUrl && (
                    <a href={a.driveUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[#8C8880]">
                      Buka Drive
                    </a>
                  )}
                </div>
                {openId === a.id && files.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {files.map((f) => (
                      <div key={f.id} className="relative w-12 h-12">
                        <button
                          type="button"
                          onClick={() => {
                            const current = albums.find((x) => x.id === a.id)?.previews.map((p) => p.id) || [];
                            const next = current.includes(f.id)
                              ? current.filter((id) => id !== f.id)
                              : [...current, f.id].slice(0, 5);
                            pinPreviews(a.id, next);
                          }}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-[#D9D7D0]"
                        >
                          <img src={f.thumbnailUrl} alt={f.name} className="w-full h-full object-cover" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePhoto(a.id, f.id, f.name)}
                          title={`Hapus ${f.name}`}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
