import React, { useEffect, useState, useCallback } from 'react';
import {
  Image,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  Loader2,
  Upload,
  AlertTriangle,
} from 'lucide-react';

interface GalleryItem {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  mediaUrl: string;
  mediaType: 'PHOTO' | 'VIDEO';
  thumbUrl?: string | null;
  uploadedById: string;
  division?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectReason?: string | null;
  driveFileId?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function EventGalleryTab({ division, eventId }: { division: string; eventId?: string }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [showApprovedOnly, setShowApprovedOnly] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (eventId) params.set('eventId', eventId);
      if (division) params.set('division', division);
      if (showApprovedOnly) params.set('approvedOnly', '1');
      const r = await fetch(`/api/gallery?${params}`, { credentials: 'include' });
      const d = await r.json();
      setItems(d.items || []);
    } catch { /* skip */ }
  }, [division, eventId, showApprovedOnly]);

  useEffect(() => { setLoading(true); fetchItems().finally(() => setLoading(false)); }, [fetchItems]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    const form = new FormData(e.currentTarget);
    await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        eventId: form.get('eventId'),
        title: form.get('title'),
        description: form.get('description') || undefined,
        mediaUrl: form.get('mediaUrl'),
        mediaType: form.get('mediaType'),
        thumbUrl: form.get('thumbUrl') || undefined,
        division: form.get('division') || undefined,
        driveFileId: form.get('driveFileId') || undefined,
      }),
    });
    setShowUploadModal(false);
    setUploading(false);
    fetchItems();
  };

  const handleApprove = async (id: string, approve: boolean) => {
    await fetch(`/api/gallery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: approve ? 'APPROVED' : 'REJECTED', rejectReason: approve ? undefined : 'Tidak sesuai standar' }),
    });
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus item ini?')) return;
    await fetch(`/api/gallery/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchItems();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#F6AE4A]" /></div>;

  const pendingItems = items.filter(i => i.status === 'PENDING');
  const approvedItems = items.filter(i => i.status === 'APPROVED');
  const rejectedItems = items.filter(i => i.status === 'REJECTED');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#1B1B1B]">Event Gallery</h3>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={showApprovedOnly} onChange={e => setShowApprovedOnly(e.target.checked)} className="w-4 h-4 rounded border-[#D9D7D0] text-[#F6AE4A] focus:ring-[#F6AE4A]" />
            Hanya yang disetujui
          </label>
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-3 py-1.5 rounded-xl text-xs font-bold">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
      </div>

      {/* Pending Section */}
      {pendingItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-[#D9D7D0]/30">
            <h4 className="flex items-center gap-2 text-sm font-bold text-amber-700">
              <AlertTriangle className="w-4 h-4" /> Menunggu Persetujuan ({pendingItems.length})
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {pendingItems.map(item => (
              <GalleryCard key={item.id} item={item} onApprove={handleApprove} onDelete={handleDelete} onPreview={setPreviewItem} />
            ))}
          </div>
        </div>
      )}

      {/* Approved Section */}
      {approvedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-[#D9D7D0]/30">
            <h4 className="flex items-center gap-2 text-sm font-bold text-green-700">
              <CheckCircle2 className="w-4 h-4" /> Disetujui ({approvedItems.length})
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {approvedItems.map(item => (
              <GalleryCard key={item.id} item={item} onApprove={handleApprove} onDelete={handleDelete} onPreview={setPreviewItem} />
            ))}
          </div>
        </div>
      )}

      {/* Rejected Section */}
      {rejectedItems.length > 0 && (
        <details className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
          <summary className="px-4 py-3 bg-red-50 border-b border-[#D9D7D0]/30 cursor-pointer text-sm font-bold text-red-700">
            <XCircle className="w-4 h-4 inline" /> Ditolak ({rejectedItems.length})
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {rejectedItems.map(item => (
              <GalleryCard key={item.id} item={item} onApprove={handleApprove} onDelete={handleDelete} onPreview={setPreviewItem} />
            ))}
          </div>
        </details>
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-8 text-center">
          <Image className="w-10 h-10 text-[#D9D7D0] mx-auto mb-3" />
          <p className="text-sm text-[#8C8880]">Belum ada foto/video.</p>
          <button onClick={() => setShowUploadModal(true)} className="mt-3 text-xs font-bold text-[#F6AE4A] hover:underline">Upload pertama →</button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-4">Upload Media</h3>
            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Event ID</label>
                <input type="text" name="eventId" required defaultValue={eventId || 'evt-baku-tau-4-0'}
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Judul</label>
                <input type="text" name="title" required placeholder="Contoh: Foto Ibadah Minggu"
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Deskripsi</label>
                <textarea name="description" rows={2} placeholder="Opsional..."
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">URL Media</label>
                <input type="url" name="mediaUrl" required placeholder="https://drive.google.com/... atau URL gambar"
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Tipe</label>
                  <select name="mediaType" required className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
                    <option value="PHOTO">Foto</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Divisi</label>
                  <select name="division" className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
                    <option value="">Pilih...</option>
                    <option value="LITURGIA">Liturgia</option>
                    <option value="DIDASKALIA">Didaskalia</option>
                    <option value="KOINONIA">Koinonia</option>
                    <option value="DIAKONIA">Diakonia</option>
                    <option value="MARTURIA">Marturia</option>
                    <option value="BENZARPR">Benzarpreneurship</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Thumbnail URL (opsional)</label>
                <input type="url" name="thumbUrl" placeholder="https://..."
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Drive File ID (opsional)</label>
                <input type="text" name="driveFileId" placeholder="ID file Google Drive"
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
                <button type="submit" disabled={uploading} className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
                  {uploading ? 'Mengupload...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewItem(null)}>
          <div className="max-w-4xl w-full max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewItem(null)} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 shadow-lg"><XCircle className="w-6 h-6" /></button>
            {previewItem.mediaType === 'VIDEO' ? (
              <video src={previewItem.mediaUrl} controls className="w-full rounded-xl" />
            ) : (
              <img src={previewItem.mediaUrl} alt={previewItem.title} className="w-full rounded-xl" />
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl text-white">
              <p className="font-bold">{previewItem.title}</p>
              <p className="text-sm opacity-80">{previewItem.description || ''}</p>
              <p className="text-xs opacity-60 mt-1">Status: {STATUS_LABELS[previewItem.status]} | Divisi: {previewItem.division || '-'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryCard({ item, onApprove, onDelete, onPreview }: {
  item: GalleryItem;
  onApprove: (id: string, approve: boolean) => void;
  onDelete: (id: string) => void;
  onPreview: (item: GalleryItem) => void;
}) {
  return (
    <div className="relative group bg-white border border-[#D9D7D0]/50 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onPreview(item)}>
      <div className="aspect-square relative bg-gray-100 overflow-hidden">
        {item.thumbUrl ? (
          <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : item.mediaUrl ? (
          <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#D9D7D0]"><Image className="w-8 h-8" /></div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        {item.mediaType === 'VIDEO' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold truncate">{item.title}</p>
        <p className="text-[10px] text-[#8C8880] truncate">{item.division || '-'}</p>
      </div>
      {item.status === 'PENDING' && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/95 backdrop-blur-sm border-t border-[#D9D7D0]/30 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onApprove(item.id, true); }} className="flex-1 py-1.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Setujui</button>
          <button onClick={e => { e.stopPropagation(); onApprove(item.id, false); }} className="flex-1 py-1.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Tolak</button>
        </div>
      )}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 rounded-full bg-white/90 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}