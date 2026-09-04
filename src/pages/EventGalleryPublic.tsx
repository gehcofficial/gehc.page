import React from 'react';
import { EventArchiveGallery } from '../components/public/EventArchiveGallery';

/** Arsip acara publik (nama · MM-YYYY). Tamu melihat 3–5 preview tersemat. */
export default function EventGalleryPublic() {
  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <EventArchiveGallery />
    </div>
  );
}
