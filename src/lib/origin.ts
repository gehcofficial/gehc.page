export type OriginRegion = 'SULUT' | 'NON_SULUT';

export const ORIGIN_REGION_OPTIONS: { value: OriginRegion; label: string }[] = [
  { value: 'SULUT', label: 'Sulawesi Utara (Sulut)' },
  { value: 'NON_SULUT', label: 'Luar Sulut' },
];

/** Kota & kabupaten di Sulawesi Utara — label sudah Title Case */
export const SULUT_PLACES: { value: string; label: string }[] = [
  { value: 'Manado', label: 'Manado' },
  { value: 'Bitung', label: 'Bitung' },
  { value: 'Tomohon', label: 'Tomohon' },
  { value: 'Kotamobagu', label: 'Kotamobagu' },
  { value: 'Minahasa', label: 'Minahasa' },
  { value: 'Minahasa Utara', label: 'Minahasa Utara' },
  { value: 'Minahasa Selatan', label: 'Minahasa Selatan' },
  { value: 'Minahasa Tenggara', label: 'Minahasa Tenggara' },
  { value: 'Bolaang Mongondow', label: 'Bolaang Mongondow' },
  { value: 'Bolaang Mongondow Utara', label: 'Bolaang Mongondow Utara' },
  { value: 'Bolaang Mongondow Selatan', label: 'Bolaang Mongondow Selatan' },
  { value: 'Bolaang Mongondow Timur', label: 'Bolaang Mongondow Timur' },
  { value: 'Kepulauan Sangihe', label: 'Kepulauan Sangihe' },
  { value: 'Kepulauan Sitaro', label: 'Kepulauan Sitaro' },
  { value: 'Kepulauan Talaud', label: 'Kepulauan Talaud' },
  { value: 'LAINNYA_SULUT', label: 'Lainnya di Sulut…' },
];

export const TITLE_CASE_HINT =
  'Tulis dengan huruf kapital di awal kata (contoh: Blok B Lantai 3, Kost Melati Dekat PU)';

/** Title-case ringan per kata — dipakai saat blur input manual */
export function titleCaseWords(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function buildOriginString(params: {
  originRegion: OriginRegion | '';
  originSulutPlace: string;
  originSulutOther: string;
  originNonSulut: string;
}): string | null {
  const { originRegion, originSulutPlace, originSulutOther, originNonSulut } = params;
  if (originRegion === 'SULUT') {
    if (!originSulutPlace) return null;
    if (originSulutPlace === 'LAINNYA_SULUT') {
      const custom = titleCaseWords(originSulutOther);
      return custom ? `Sulut · ${custom}` : null;
    }
    return `Sulut · ${originSulutPlace}`;
  }
  if (originRegion === 'NON_SULUT') {
    const place = titleCaseWords(originNonSulut);
    return place ? `Luar Sulut · ${place}` : null;
  }
  return null;
}

export function validateOriginForm(params: {
  originRegion: OriginRegion | '';
  originSulutPlace: string;
  originSulutOther: string;
  originNonSulut: string;
}): string | null {
  if (!params.originRegion) return 'Pilih asal daerah (Sulut atau Luar Sulut).';
  if (params.originRegion === 'SULUT') {
    if (!params.originSulutPlace) return 'Pilih kota/kabupaten di Sulut.';
    if (params.originSulutPlace === 'LAINNYA_SULUT' && !params.originSulutOther.trim()) {
      return 'Isi nama kota/kabupaten di Sulut.';
    }
  }
  if (params.originRegion === 'NON_SULUT' && !params.originNonSulut.trim()) {
    return 'Isi kota/kabupaten asal di luar Sulut.';
  }
  return null;
}
