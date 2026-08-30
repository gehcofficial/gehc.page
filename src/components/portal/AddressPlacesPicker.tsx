import React, { useEffect, useRef, useState } from 'react';
import { PROVINCES_ID } from '../../lib/profile';

export type AddressValue = {
  addressLine: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
  addressNote: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

function parsePlace(place: any): Partial<AddressValue> {
  const comps: any[] = place.address_components || [];
  const get = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || '';
  const loc = place.geometry?.location;
  const lat = loc ? (typeof loc.lat === 'function' ? loc.lat() : loc.lat) : null;
  const lng = loc ? (typeof loc.lng === 'function' ? loc.lng() : loc.lng) : null;
  const route = get('route');
  const streetNo = get('street_number');
  return {
    addressLine: [streetNo, route].filter(Boolean).join(' ') || place.formatted_address || '',
    village: get('administrative_area_level_4', 'sublocality_level_1', 'sublocality'),
    district: get('administrative_area_level_3', 'locality'),
    city: get('administrative_area_level_2'),
    province: get('administrative_area_level_1'),
    postalCode: get('postal_code'),
    lat,
    lng,
    placeId: place.place_id || '',
  };
}

let mapsPromise: Promise<void> | null = null;
function loadMaps(key: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=id&region=ID`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat Google Maps'));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export const AddressPlacesPicker: React.FC<{
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  mapsKey: string | null;
}> = ({ value, onChange, mapsKey }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const [search, setSearch] = useState(value.addressLine || '');
  const [mapsOk, setMapsOk] = useState(false);

  const patch = (p: Partial<AddressValue>) => onChange({ ...value, ...p });

  useEffect(() => {
    if (!mapsKey || !inputRef.current) return;
    let ac: any;
    loadMaps(mapsKey)
      .then(() => {
        if (!inputRef.current || !window.google?.maps?.places) return;
        setMapsOk(true);
        ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'id' },
          fields: ['address_components', 'formatted_address', 'geometry', 'place_id', 'name'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place?.geometry) return;
          const parsed = parsePlace(place);
          const next = { ...value, ...parsed };
          onChange(next);
          setSearch(place.formatted_address || parsed.addressLine || '');
          if (mapObj.current && parsed.lat != null && parsed.lng != null) {
            const pos = { lat: parsed.lat, lng: parsed.lng };
            mapObj.current.setCenter(pos);
            mapObj.current.setZoom(16);
            if (markerObj.current) markerObj.current.setPosition(pos);
          }
        });
        if (mapRef.current && !mapObj.current) {
          const center = value.lat && value.lng
            ? { lat: value.lat, lng: value.lng }
            : { lat: -6.32, lng: 107.15 };
          mapObj.current = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: value.lat ? 16 : 11,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          markerObj.current = new window.google.maps.Marker({
            map: mapObj.current,
            position: center,
            draggable: true,
          });
          markerObj.current.addListener('dragend', () => {
            const pos = markerObj.current.getPosition();
            if (pos) onChange({ ...value, lat: pos.lat(), lng: pos.lng() });
          });
        }
      })
      .catch(() => setMapsOk(false));
    return () => {
      if (ac && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(ac);
    };
  }, [mapsKey]);

  const field = 'w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] block mb-1">Cari alamat (Maps)</label>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={mapsOk ? 'Ketik komplek, jalan, atau nama tempat…' : 'Maps belum aktif — isi manual di bawah'}
          className={field}
        />
        {!mapsKey && (
          <p className="text-[10px] text-[#8C8880] mt-1">Set GOOGLE_MAPS_API_KEY (Places + Maps JS) agar pencarian seperti e-commerce aktif.</p>
        )}
      </div>
      <div ref={mapRef} className="w-full h-40 rounded-2xl border border-[#D9D7D0] bg-[#F3F1EC] overflow-hidden" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={field} placeholder="Jalan & nomor" value={value.addressLine} onChange={(e) => patch({ addressLine: e.target.value })} />
        <input className={field} placeholder="Kelurahan" value={value.village} onChange={(e) => patch({ village: e.target.value })} />
        <input className={field} placeholder="Kecamatan" value={value.district} onChange={(e) => patch({ district: e.target.value })} />
        <input className={field} placeholder="Kota / Kabupaten" value={value.city} onChange={(e) => patch({ city: e.target.value })} />
        <select className={field} value={PROVINCES_ID.includes(value.province) ? value.province : value.province ? 'Lainnya' : ''} onChange={(e) => patch({ province: e.target.value === 'Lainnya' ? value.province : e.target.value })}>
          <option value="">Provinsi</option>
          {PROVINCES_ID.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className={field} placeholder="Kode pos" value={value.postalCode} onChange={(e) => patch({ postalCode: e.target.value })} />
      </div>
      <input className={field} placeholder="Patokan / RT RW / blok (opsional)" value={value.addressNote} onChange={(e) => patch({ addressNote: e.target.value })} />
    </div>
  );
};

export const emptyAddress = (): AddressValue => ({
  addressLine: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postalCode: '',
  lat: null,
  lng: null,
  placeId: '',
  addressNote: '',
});
