import React, { useCallback, useEffect, useState } from 'react';
import { Images, Plus, Pin } from 'lucide-react';
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

  const load = useCallback(async () => {
    const r = await fetch(`/api/groups/${groupId}/albums`, { credentials: 'include' });
    const d = await r.json();
    setAlbums(d.albums || []);
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

  return (
    <div className="space-y-4">
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
                {a.coverUrl ? (
                  <img src={a.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#8C8880]">
                    <Images className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-[11px] text-[#8C8880]">
                  {String(a.occurredOn).slice(0, 10)}
                  {a.location ? ` · ${a.location}` : ''}
                </p>
                <div className="flex gap-1">
                  {(a.previews || []).map((p) => (
                    <img key={p.id} src={p.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
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
                        else addToast({ type: 'success', title: 'Foto tersimpan di Drive' });
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
                      <button
                        key={f.id}
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
