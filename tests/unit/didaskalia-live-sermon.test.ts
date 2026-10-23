import { describe, expect, it } from 'vitest';
import { applyPublishedSnapshot, buildKhutbahDeck, contentFromStudio, releaseDrift, sermonOutlineFilled } from '../../src/lib/didaskalia-presentation';
import { citationsOutsideWeek, defaultStudio, formatJakarta, publishFeedback } from '../../src/lib/didaskalia';
import { RHB_FORMAT } from '../../server/lib/didaskalia-normalize.mjs';
import { restoreLiteralSermon } from '../../server/lib/didaskalia-ai.mjs';
import { buildResponsibleGroupCaption, displayServiceRoleName, WORSHIP_ORDER_ROLES } from '../../src/lib/serving-roles';

describe('halaman khotbah memakai hasil parse', () => {
  it('outline live mengalahkan snapshot publish yang kosong', () => {
    const studio = defaultStudio();
    studio.sermon.outline.pengantar = 'Pengantar dari naskah.';
    studio.sermon.teksUtama = { ref: '1 Korintus 1:13', text: '' };
    const live = contentFromStudio(studio, 4, '2026-10-25', 'Our Roots & DNA', 'SERVING_DAY', 'Creative Lab', 'CREATIVE_LAB');
    const shown = applyPublishedSnapshot(live, {
      sermon: { ...studio.sermon, outline: { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' }, summary: 'snapshot lama' },
      paths: [],
      images: { cover: 'lama' },
    });
    expect(sermonOutlineFilled(shown.sermon)).toBe(true);
    expect(shown.sermon.outline.pengantar).toBe('Pengantar dari naskah.');
    expect(shown.images.cover).toBe('lama');
  });

  it('snapshot tetap dipakai bila studio belum berisi outline', () => {
    const live = contentFromStudio(defaultStudio(), 1, '', '', null, null, null);
    const shown = applyPublishedSnapshot(live, {
      sermon: {
        ...defaultStudio().sermon,
        outline: { pengantar: 'Dari PDF terbit', bedahTeologis: '', jembatan: '', kesimpulan: '' },
      },
    });
    expect(shown.sermon.outline.pengantar).toBe('Dari PDF terbit');
  });

  it('cover pekan 4 memakai teks utama dan kitab fokus, bukan salinan fundamental', () => {
    const studio = defaultStudio();
    studio.sermon.teksUtama = { ref: '1 Korintus 1:13', text: '' };
    studio.sermon.outline.pengantar = 'Pengantar.';
    studio.kitabFokus = '2 Timotius 1:3--18';
    studio.fundamentalFirman = { ref: '1 Korintus 1:13', text: '' };
    const content = contentFromStudio(studio, 4, '2026-10-25', 'Our Roots & DNA');
    const cover = buildKhutbahDeck(content)[0];
    expect(cover.subtitle).toBe('2026-10-25 · 2 Timotius 1:3–18');
    const fields = (cover.fields || []).map((f) => `${f.label}: ${f.value}`).join(' | ');
    expect(fields).toContain('Teks Utama Khotbah: 1 Korintus 1:13');
    expect(fields).toContain('Kitab Bagian Fokus: 2 Timotius 1:3–18');
    expect(fields).not.toContain('Teks Jangkar Mingguan');
  });

  it('snapshot kosong dihitung basi terhadap outline yang sudah terisi', () => {
    const studio = defaultStudio();
    studio.sermon.outline.pengantar = 'Ada.';
    const live = contentFromStudio(studio, 4, '2026-10-25', 'Our Roots & DNA');
    expect(releaseDrift(live, { sermon: { ...studio.sermon, outline: { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' } } })).toBe('stale');
  });
});

describe('rilis dan kutipan pekan', () => {
  it('18 Okt 10:36 WIB tidak tampil sebagai 17 Okt', () => {
    const label = formatJakarta('2026-10-18T03:36:08.474Z');
    expect(label.startsWith('18')).toBe(true);
    expect(label).toContain('WIB');
    expect(label).not.toMatch(/^17/);
  });

  it('Drive gagal tetap disebut halaman sudah diperbarui', () => {
    const note = publishFeedback({ saved: true, version: 2, driveError: 'Unggah Drive habis waktu.' });
    expect(note.tone).toBe('warn');
    expect(note.title).toContain('v2');
    expect(note.detail).toContain('Unggah Drive habis waktu.');
    expect(publishFeedback({ saved: false }).tone).toBe('error');
  });

  it('Kolose di luar teks utama dan kitab fokus pekan 4', () => {
    const bad = citationsOutsideWeek(
      'Mengacu pada ayat jangkar minggu ini, Kolose 1:13-14.',
      ['1 Korintus 1:13', '2 Timotius 1:3--18'],
    );
    expect(bad.join(' ')).toMatch(/Kolose 1:13/);
    expect(citationsOutsideWeek('Bedah 1 Korintus 1:13 dan 2 Timotius 1:3-18.', ['1 Korintus 1:13', '2 Timotius 1:3-18'])).toEqual([]);
  });
});

describe('segarkan khotbah menjaga outline sumber', () => {
  it('menyalin empat bagian MD dan tidak memendekkannya', () => {
    const long = 'Pengantar utuh dari naskah. '.repeat(40);
    const out = restoreLiteralSermon({
      outline: { pengantar: 'satu kalimat', bedahTeologis: '', jembatan: '', kesimpulan: '' },
      teksUtama: { ref: 'salah', text: 'kutipan' },
    }, {
      info: { teksUtama: '1 Korintus 1:13' },
      outline: { pengantar: long, bedahTeologis: 'Bedah utuh.', jembatan: '', kesimpulan: 'Tutup.' },
    });
    expect(out.outline.pengantar).toBe(long.trim());
    expect(out.outline.bedahTeologis).toBe('Bedah utuh.');
    expect(out.outline.kesimpulan).toBe('Tutup.');
    expect(out.teksUtama.ref).toBe('1 Korintus 1:13');
    expect(out.teksUtama.text).toBe('kutipan');
  });
});

describe('rapikan refleksi pribadi', () => {
  it('menyimpan pertanyaan asli dan menambah tiga varian', () => {
    expect(RHB_FORMAT).toContain('pertanyaan asli');
    expect(RHB_FORMAT).toContain('🎒 Pelajar —');
    expect(RHB_FORMAT).toContain('🎓 Mahasiswa —');
    expect(RHB_FORMAT).toContain('💼 Pekerja —');
  });
});

describe('usulan peran pola ibadah', () => {
  it('Liturgist - Shyllo tampil sebagai Liturgos', () => {
    expect(displayServiceRoleName('Liturgist - Shyllo')).toBe('Liturgos');
    expect(displayServiceRoleName('Pemimpin Pujian')).toBe('Pemimpin Pujian');
  });

  it('musik opsional dan caption menyebut Liturgia serta tuan rumah', () => {
    const music = WORSHIP_ORDER_ROLES.filter((r) => String(r.roleKey || '').startsWith('musician-'));
    expect(music.length).toBeGreaterThan(0);
    expect(music.every((r) => r.optional)).toBe(true);
    expect(WORSHIP_ORDER_ROLES.map((r) => r.order)).toEqual(WORSHIP_ORDER_ROLES.map((_, i) => i + 1));
    const text = buildResponsibleGroupCaption({
      dateLabel: 'Minggu, 25 Oktober 2026',
      responsibleGroup: 'Agape',
      hostGroup: 'Shalom',
    });
    expect(text).toContain('Agape');
    expect(text).toContain('Shalom');
    expect(text).toContain('Liturgos');
    expect(text).toContain('Liturgia');
    expect(text).not.toContain('Shyllo');
  });
});
