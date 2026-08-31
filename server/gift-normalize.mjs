const GIFT_ID_TO_EN = {
  NUBUAT: 'Prophecy',
  PENGAJARAN: 'Teaching',
  HIKMAT: 'Word of Wisdom',
  PENGETAHUAN: 'Word of Knowledge',
  PENGUATAN: 'Exhortation',
  PEMBEDAAN: 'Discernment',
  PERSEPSI: 'Discernment',
  IMAN: 'Faith',
  MUKJIZAT: 'Miracles',
  PENGOBATAN: 'Healing',
  BAHASA_ROH: 'Tongues and Interpretation',
  MENAFSIR: 'Tongues and Interpretation',
  KERASULAN: 'Apostleship',
  PELAYANAN: 'Service',
  ADMINISTRASI: 'Administration',
  MEMBERI: 'Giving',
  KASIH_KARUNIA: 'Giving',
  BELAS_KASIH: 'Mercy',
  KERAMAHAN: 'Hospitality',
  INJIL: 'Evangelism',
  EVANGELISME: 'Evangelism',
  GEMBALA: 'Pastor/Shepherd',
  MEMIMPIN: 'Leadership',
  KEPEMIMPINAN: 'Leadership',
  MISI: 'Apostleship',
  KESUKARELAAN_MENDERITA: 'Faith',
};

const EN_SET = new Set([
  'Administration', 'Apostleship', 'Craftsmanship', 'Discernment', 'Evangelism',
  'Exhortation', 'Faith', 'Giving', 'Healing', 'Hospitality', 'Intercession',
  'Leadership', 'Mercy', 'Miracles', 'Pastor/Shepherd', 'Prophecy', 'Service',
  'Teaching', 'Tongues and Interpretation', 'Word of Knowledge', 'Word of Wisdom', 'Helps',
]);

export function normalizeGiftKey(gift) {
  if (!gift || typeof gift !== 'string') return gift;
  const trimmed = gift.trim();
  if (EN_SET.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase().replace(/\s+/g, '_');
  return GIFT_ID_TO_EN[upper] || trimmed;
}

export function normalizeGiftsTop5(gifts) {
  if (!Array.isArray(gifts)) return [];
  return gifts.map(normalizeGiftKey).filter(Boolean);
}

export function normalizeGiftsScores(scores) {
  if (!scores || typeof scores !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(scores)) {
    out[normalizeGiftKey(k)] = v;
  }
  return out;
}
