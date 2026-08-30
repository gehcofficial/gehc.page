import React, { useEffect, useState } from 'react';
import { COUNTRIES_INTL, countryName } from '../../lib/countries';

export type AddressScope = 'ID' | 'INTL';

export type AddressValue = {
  addressScope: AddressScope;
  addressCountry: string;
  addressLine: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  addressNote: string;
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  villageCode: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
};

type WilayahItem = { code: string; name: string };

async function fetchWilayah(path: string): Promise<WilayahItem[]> {
  const r = await fetch(`/api/wilayah/${path}`);
  if (!r.ok) return [];
  const j = await r.json();
  const rows = Array.isArray(j.data) ? j.data : [];
  return rows.map((item: WilayahItem) => ({
    code: String(item.code || '').trim(),
    name: String(item.name || '').trim(),
  }));
}

export const emptyAddress = (): AddressValue => ({
  addressScope: 'ID',
  addressCountry: 'ID',
  addressLine: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postalCode: '',
  addressNote: '',
  provinceCode: '',
  cityCode: '',
  districtCode: '',
  villageCode: '',
  lat: null,
  lng: null,
  placeId: '',
});

export function addressFromUser(u: Record<string, unknown> | null | undefined): AddressValue {
  const base = emptyAddress();
  if (!u) return base;
  const scope = u.addressScope === 'INTL' ? 'INTL' : 'ID';
  return {
    ...base,
    addressScope: scope,
    addressCountry: String(u.addressCountry || (scope === 'ID' ? 'ID' : '') || 'ID'),
    addressLine: String(u.addressLine || ''),
    village: String(u.village || ''),
    district: String(u.district || ''),
    city: String(u.city || ''),
    province: String(u.province || ''),
    postalCode: String(u.postalCode || ''),
    addressNote: String(u.addressNote || ''),
    provinceCode: String(u.provinceCode || ''),
    cityCode: String(u.cityCode || ''),
    districtCode: String(u.districtCode || ''),
    villageCode: String(u.villageCode || ''),
    lat: typeof u.lat === 'number' ? u.lat : null,
    lng: typeof u.lng === 'number' ? u.lng : null,
    placeId: String(u.placeId || ''),
  };
}

const field =
  'w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';

export const AddressForm: React.FC<{
  value: AddressValue;
  onChange: (v: AddressValue) => void;
}> = ({ value, onChange }) => {
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [wilayahError, setWilayahError] = useState('');

  const patch = (p: Partial<AddressValue>) => onChange({ ...value, ...p });

  useEffect(() => {
    if (value.addressScope !== 'ID') return;
    let cancelled = false;
    setLoading(true);
    fetchWilayah('provinces')
      .then((data) => {
        if (cancelled) return;
        setProvinces(data);
        setWilayahError(data.length ? '' : 'Gagal memuat daftar provinsi. Coba muat ulang.');
      })
      .catch(() => {
        if (!cancelled) setWilayahError('Gagal memuat daftar provinsi. Coba muat ulang.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.addressScope]);

  useEffect(() => {
    if (value.addressScope !== 'ID' || !value.provinceCode) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    fetchWilayah(`regencies/${encodeURIComponent(value.provinceCode)}`).then((data) => {
      if (!cancelled) setRegencies(data);
    });
    return () => {
      cancelled = true;
    };
  }, [value.addressScope, value.provinceCode]);

  useEffect(() => {
    if (value.addressScope !== 'ID' || !value.cityCode) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    fetchWilayah(`districts/${encodeURIComponent(value.cityCode)}`).then((data) => {
      if (!cancelled) setDistricts(data);
    });
    return () => {
      cancelled = true;
    };
  }, [value.addressScope, value.cityCode]);

  useEffect(() => {
    if (value.addressScope !== 'ID' || !value.districtCode) {
      setVillages([]);
      return;
    }
    let cancelled = false;
    fetchWilayah(`villages/${encodeURIComponent(value.districtCode)}`).then((data) => {
      if (!cancelled) setVillages(data);
    });
    return () => {
      cancelled = true;
    };
  }, [value.addressScope, value.districtCode]);

  const setScope = (scope: AddressScope) => {
    if (scope === 'ID') {
      onChange({
        ...emptyAddress(),
        addressScope: 'ID',
        addressCountry: 'ID',
        addressLine: value.addressLine,
        addressNote: value.addressNote,
        postalCode: value.postalCode,
      });
    } else {
      onChange({
        ...emptyAddress(),
        addressScope: 'INTL',
        addressCountry: value.addressCountry !== 'ID' ? value.addressCountry : '',
        addressLine: value.addressLine,
        city: value.city,
        addressNote: value.addressNote,
        postalCode: value.postalCode,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] block mb-1.5">
          Domisili
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope('ID')}
            className={`flex-1 px-3 py-2 rounded-2xl text-[11px] font-bold border ${
              value.addressScope === 'ID'
                ? 'bg-[#181818] text-white border-[#181818]'
                : 'bg-white text-[#8C8880] border-[#D9D7D0]'
            }`}
          >
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => setScope('INTL')}
            className={`flex-1 px-3 py-2 rounded-2xl text-[11px] font-bold border ${
              value.addressScope === 'INTL'
                ? 'bg-[#181818] text-white border-[#181818]'
                : 'bg-white text-[#8C8880] border-[#D9D7D0]'
            }`}
          >
            Luar negeri
          </button>
        </div>
      </div>

      {value.addressScope === 'ID' ? (
        <>
          <select
            className={field}
            value={value.provinceCode}
            disabled={loading}
            onChange={(e) => {
              const code = e.target.value;
              const name = provinces.find((p) => p.code === code)?.name || '';
              patch({
                provinceCode: code,
                province: name,
                cityCode: '',
                city: '',
                districtCode: '',
                district: '',
                villageCode: '',
                village: '',
              });
            }}
          >
            <option value="">{loading ? 'Memuat provinsi…' : 'Provinsi'}</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          {wilayahError ? <p className="text-[10px] text-red-500">{wilayahError}</p> : null}
          <select
            className={field}
            value={value.cityCode}
            disabled={!value.provinceCode}
            onChange={(e) => {
              const code = e.target.value;
              const name = regencies.find((p) => p.code === code)?.name || '';
              patch({
                cityCode: code,
                city: name,
                districtCode: '',
                district: '',
                villageCode: '',
                village: '',
              });
            }}
          >
            <option value="">Kabupaten / Kota</option>
            {regencies.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={field}
            value={value.districtCode}
            disabled={!value.cityCode}
            onChange={(e) => {
              const code = e.target.value;
              const name = districts.find((p) => p.code === code)?.name || '';
              patch({
                districtCode: code,
                district: name,
                villageCode: '',
                village: '',
              });
            }}
          >
            <option value="">Kecamatan (opsional)</option>
            {districts.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={field}
            value={value.villageCode}
            disabled={!value.districtCode}
            onChange={(e) => {
              const code = e.target.value;
              const name = villages.find((p) => p.code === code)?.name || '';
              patch({ villageCode: code, village: name });
            }}
          >
            <option value="">Kelurahan / Desa (opsional)</option>
            {villages.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <select
            className={field}
            value={value.addressCountry}
            onChange={(e) => patch({ addressCountry: e.target.value })}
          >
            <option value="">Negara</option>
            {COUNTRIES_INTL.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={field}
            placeholder="Kota"
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
          />
          {value.addressCountry && (
            <p className="text-[10px] text-[#8C8880]">
              Domisili: {countryName(value.addressCountry)}
            </p>
          )}
        </>
      )}

      <input
        className={field}
        placeholder={value.addressScope === 'ID' ? 'Jalan & nomor' : 'Alamat jalan / unit'}
        value={value.addressLine}
        onChange={(e) => patch({ addressLine: e.target.value })}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          className={field}
          placeholder="Kode pos (opsional)"
          value={value.postalCode}
          onChange={(e) => patch({ postalCode: e.target.value })}
        />
        <input
          className={field}
          placeholder="Patokan / RT RW / blok (opsional)"
          value={value.addressNote}
          onChange={(e) => patch({ addressNote: e.target.value })}
        />
      </div>
    </div>
  );
};
