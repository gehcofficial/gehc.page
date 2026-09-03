import { describe, expect, it } from 'vitest';
import { SEED_QUESTION_KEYS, SEED_QUESTIONS } from '../../server/lib/event-question-bank.mjs';
import {
  asalFromOrigin,
  isQuestionVisible,
  resolveWhatsAppUrl,
} from '../../server/lib/event-question-showif.mjs';
import { asalFromOrigin as asalFromOriginTs } from '../../src/lib/origin';
import { isQuestionVisible as isQuestionVisibleTs } from '../../src/lib/event-questions';

describe('event question bank seed', () => {
  it('punya kunci v1 tanpa asal_sulut', () => {
    expect(SEED_QUESTION_KEYS).toEqual(expect.arrayContaining([
      'ikut_makan',
      'alergi_makanan',
      'diet_khusus',
      'kebutuhan_akses',
      'asal_jemaat',
      'asal_jemaat_nama',
      'pertama_kali',
      'diundang_oleh',
      'relasi_hamba_tuhan',
      'relasi_hamba_tuhan_ket',
      'pelayan_khusus',
      'izin_dokumentasi',
      'moda_datang',
      'butuh_info_kost',
      'ukuran_kaos',
    ]));
    expect(SEED_QUESTION_KEYS).not.toContain('asal_sulut');
    expect(SEED_QUESTIONS).toHaveLength(SEED_QUESTION_KEYS.length);
  });
});

describe('showIf', () => {
  it('alergi hanya jika ikut makan', () => {
    const q = { showIf: { key: 'ikut_makan', equals: true } };
    expect(isQuestionVisible(q, { ikut_makan: true })).toBe(true);
    expect(isQuestionVisible(q, { ikut_makan: false })).toBe(false);
    expect(isQuestionVisible(q, {})).toBe(false);
    expect(isQuestionVisibleTs(q, { ikut_makan: true })).toBe(true);
  });

  it('nama jemaat jika GMIM lain atau non-GMIM', () => {
    const q = { showIf: { key: 'asal_jemaat', in: ['GMIM lain', 'Gereja non-GMIM'] } };
    expect(isQuestionVisible(q, { asal_jemaat: 'GMIM lain' })).toBe(true);
    expect(isQuestionVisible(q, { asal_jemaat: 'GEHC Cikarang' })).toBe(false);
  });

  it('tanpa showIf selalu tampil', () => {
    expect(isQuestionVisible({ showIf: null }, {})).toBe(true);
  });
});

describe('asalRegion dari origin', () => {
  it('menurunkan Sulut / Non-Sulut untuk CSV', () => {
    expect(asalFromOrigin('Sulut · Manado')).toEqual({ asalRegion: 'SULUT', asalPlace: 'Manado' });
    expect(asalFromOrigin('Luar Sulut · Bekasi')).toEqual({ asalRegion: 'NON_SULUT', asalPlace: 'Bekasi' });
    expect(asalFromOrigin(null)).toEqual({ asalRegion: 'KOSONG', asalPlace: '' });
    expect(asalFromOriginTs('Sulut · Bitung').asalRegion).toBe('SULUT');
  });
});

describe('resolveWhatsAppUrl', () => {
  it('urutan DB > env > ChannelLink', () => {
    expect(resolveWhatsAppUrl({
      dbUrl: 'https://chat.whatsapp.com/db',
      envUrl: 'https://chat.whatsapp.com/env',
      channelUrl: 'https://chat.whatsapp.com/ch',
    })).toBe('https://chat.whatsapp.com/db');
    expect(resolveWhatsAppUrl({
      dbUrl: '',
      envUrl: 'https://chat.whatsapp.com/env',
      channelUrl: 'https://chat.whatsapp.com/ch',
    })).toBe('https://chat.whatsapp.com/env');
    expect(resolveWhatsAppUrl({
      dbUrl: null,
      envUrl: null,
      channelUrl: 'https://chat.whatsapp.com/ch',
    })).toBe('https://chat.whatsapp.com/ch');
    expect(resolveWhatsAppUrl({ dbUrl: 'https://example.com/nope' })).toBe(null);
  });
});
