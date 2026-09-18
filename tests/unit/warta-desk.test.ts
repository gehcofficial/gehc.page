import { describe, expect, it } from 'vitest';
import {
  buildWartaDesk,
  buildWartaDoa,
  buildWartaJadwal,
  buildWartaPelayanan,
  groupOfficers,
  maskPrayerSuggestions,
  pickServingForDate,
  pickWeekTheme,
} from '../../server/lib/warta-desk.mjs';

const schedule = (role, division, sortOrder, people) => people.map((name, i) => ({
  serviceRoleId: `sr-${role}`,
  serviceRole: { id: `sr-${role}`, name: role, division, sortOrder },
  user: { id: `u-${role}-${i}`, name },
}));

describe('groupOfficers', () => {
  it('kelompokkan per komponen, urut divisi lalu sortOrder, orang digabung', () => {
    const rows = [
      ...schedule('Operator Sound', 'MARTURIA', 2, ['Sari']),
      ...schedule('Liturgist', 'LITURGIA', 1, ['Budi']),
      ...schedule('Doa Syafaat', 'LITURGIA', 13, ['Ani', 'Tono']),
      ...schedule('Worship Leader', 'LITURGIA', 2, ['Rina', 'Rina']),
    ];
    const officers = groupOfficers(rows);
    expect(officers.map((o) => o.role)).toEqual(['Liturgist', 'Worship Leader', 'Doa Syafaat', 'Operator Sound']);
    expect(officers[1].people).toEqual(['Rina']);
    expect(officers[2].people).toEqual(['Ani', 'Tono']);
    expect(officers.map((o) => o.division)).toEqual(['LITURGIA', 'LITURGIA', 'LITURGIA', 'MARTURIA']);
  });

  it('aman untuk daftar kosong', () => {
    expect(groupOfficers([])).toEqual([]);
    expect(groupOfficers()).toEqual([]);
  });
});

describe('pickServingForDate', () => {
  const rows = [
    { eventDate: '2026-09-06', responsibleGroup: { id: 'g1', name: 'Agape' }, hostGroup: { id: 'g2', name: 'Hesed' } },
    { eventDate: '2026-09-13', responsibleGroup: { id: 'g2', name: 'Hesed' }, hostGroup: { id: 'g3', name: 'Kairos' } },
  ];

  it('cocok tepat pada tanggal', () => {
    const r = pickServingForDate(rows, '2026-09-13');
    expect(r.row.hostGroup.name).toBe('Kairos');
    expect(r.projected).toBe(false);
  });

  it('tidak ada baris tepat → pakai terdekat ≤21 hari & tandai perkiraan', () => {
    const r = pickServingForDate(rows, '2026-09-20');
    expect(r.row.responsibleGroup.name).toBe('Hesed');
    expect(r.projected).toBe(true);
  });

  it('terlalu jauh / kosong → null', () => {
    expect(pickServingForDate(rows, '2026-12-06').row).toBeNull();
    expect(pickServingForDate([], '2026-09-13').row).toBeNull();
  });
});

describe('pickWeekTheme', () => {
  const weeks = [
    { date: '2026-09-06', theme: 'Berakar', verse: 'Kolose 2:6-7' },
    { date: '2026-09-13', theme: 'Bertumbuh', servingTheme: 'Melayani', servingVerse: 'Roma 12:1' },
  ];

  it('ambil entri sesuai tanggal', () => {
    expect(pickWeekTheme(weeks, '2026-09-06').theme).toBe('Berakar');
    expect(pickWeekTheme(weeks, '2026-09-20')).toBeNull();
  });
});

describe('maskPrayerSuggestions', () => {
  it('nama depan + jenis saja, tanpa isi catatan', () => {
    const out = maskPrayerSuggestions([
      { kind: 'SAKIT', subject: { name: 'Budi Santoso' }, occurredOn: '2026-09-03', note: 'rahasia' },
      { kind: 'UMUM', isGeneral: true, occurredOn: '2026-09-04', note: 'rahasia' },
    ]);
    expect(out).toEqual([
      { name: 'Budi', kind: 'Sakit', occurredOn: '2026-09-03' },
      { name: 'Doa umum', kind: 'Umum', occurredOn: '2026-09-04' },
    ]);
    expect(JSON.stringify(out)).not.toContain('rahasia');
  });
});

describe('buildWartaPelayanan', () => {
  const officers = groupOfficers([
    ...schedule('Liturgist', 'LITURGIA', 1, ['Budi']),
    ...schedule('Operator Sound', 'MARTURIA', 2, ['Sari', 'Tono']),
  ]);

  it('memuat penanggung, tuan rumah, dan komponen per divisi', () => {
    const text = buildWartaPelayanan({
      responsibleGroup: { name: 'Agape' },
      hostGroup: { name: 'Hesed' },
      officers,
    });
    expect(text).toContain('Penanggung Jawab: Agape');
    expect(text).toContain('Tuan Rumah: Hesed');
    expect(text).toContain('— LITURGIA —');
    expect(text).toContain('Liturgist: Budi');
    expect(text).toContain('— MARTURIA —');
    expect(text).toContain('Operator Sound: Sari, Tono');
  });

  it('state kosong diberi keterangan', () => {
    const text = buildWartaPelayanan({ responsibleGroup: null, hostGroup: null, officers: [] });
    expect(text).toContain('Penanggung Jawab: belum ditetapkan');
    expect(text).toContain('belum ada yang terjadwal');
  });

  it('menandai bila jadwal masih perkiraan', () => {
    const text = buildWartaPelayanan({ responsibleGroup: { name: 'Agape' }, hostGroup: { name: 'Hesed' }, officers, projected: true });
    expect(text).toContain('(perkiraan');
  });
});

describe('buildWartaDoa', () => {
  it('pekan + bulan + saran doa disamarkan', () => {
    const text = buildWartaDoa({
      monthTheme: 'Bertumbuh Bersama',
      weekTheme: 'Berakar',
      verse: 'Kolose 2:6-7',
      suggestions: [{ name: 'Budi', kind: 'Sakit' }],
    });
    expect(text).toContain('POKOK DOA PEKAN INI');
    expect(text).toContain('Tema: Berakar');
    expect(text).toContain('Ayat: Kolose 2:6-7');
    expect(text).toContain('- Budi (Sakit)');
    expect(text).toContain('POKOK DOA BULAN INI');
    expect(text).toContain('Tema: Bertumbuh Bersama');
  });

  it('tanpa saran doa bila dimatikan', () => {
    const text = buildWartaDoa({ weekTheme: 'Berakar', suggestions: [{ name: 'Budi', kind: 'Sakit' }], includeSuggestions: false });
    expect(text).not.toContain('Budi');
  });

  it('kosong → keterangan', () => {
    expect(buildWartaDoa({})).toContain('belum ada tema/ayat');
  });
});

describe('buildWartaJadwal', () => {
  it('memuat tanggal + penanggung/tuan rumah minggu depan', () => {
    const text = buildWartaJadwal({
      nextDate: '2026-09-13',
      nextResponsible: { name: 'Hesed' },
      nextHost: { name: 'Kairos' },
    });
    expect(text).toContain('Minggu, 13 September 2026');
    expect(text).toContain('Penanggung Jawab: Hesed');
    expect(text).toContain('Tuan Rumah: Kairos');
  });

  it('null-safe', () => {
    expect(buildWartaJadwal({})).toContain('belum ditetapkan');
  });
});

describe('buildWartaDesk', () => {
  it('merangkai seluruh teks + metadata', () => {
    const desk = buildWartaDesk({
      date: '2026-09-06',
      serving: { row: { eventDate: '2026-09-06', responsibleGroup: { name: 'Agape' }, hostGroup: { name: 'Hesed' } }, projected: false },
      nextServing: { row: { eventDate: '2026-09-13', responsibleGroup: { name: 'Hesed' }, hostGroup: { name: 'Kairos' } }, projected: false },
      schedules: schedule('Liturgist', 'LITURGIA', 1, ['Budi']),
      monthPlan: { theme: 'Bertumbuh Bersama', weeks: [{ date: '2026-09-06', theme: 'Berakar', verse: 'Kolose 2:6-7' }] },
      prayerNotes: [{ kind: 'SAKIT', subject: { name: 'Budi Santoso' }, occurredOn: '2026-09-03' }],
    });
    expect(desk.date).toBe('2026-09-06');
    expect(desk.officers).toHaveLength(1);
    expect(desk.themes.weekTheme).toBe('Berakar');
    expect(desk.suggestionsPrivate).toBe(true);
    expect(desk.suggestions[0].name).toBe('Budi');
    expect(desk.next.responsibleGroup.name).toBe('Hesed');
    expect(desk.texts.pelayanan).toContain('Liturgist: Budi');
    expect(desk.texts.doa).toContain('Tema: Berakar');
    expect(desk.texts.jadwal).toContain('Tuan Rumah: Kairos');
  });

  it('tanpa serving/plan tetap aman', () => {
    const desk = buildWartaDesk({ date: '2026-09-06' });
    expect(desk.officers).toEqual([]);
    expect(desk.suggestionsPrivate).toBe(false);
    expect(desk.texts.pelayanan).toContain('belum ditetapkan');
  });
});
