import { describe, it, expect } from 'vitest';
import { dictionaries } from '../../src/i18n';
import { buildPortalSearchIndex, searchPortal, guideIdToPage } from '../../src/lib/portal-search-index';

const t = dictionaries.id;

function indexFor(role: 'KOMISI' | 'MENTEE' | 'MENTOR' | 'SUPERADMIN') {
  return buildPortalSearchIndex({
    t,
    role,
    ctx: { isGroupMentor: role === 'MENTOR', isMentee: role === 'MENTEE', isBodTimkerja: false },
    isOnboarding: false,
    isGroupMentor: role === 'MENTOR',
    isMentee: role === 'MENTEE',
  });
}

describe('guideIdToPage', () => {
  it('memetakan sub-guide ke halaman induk', () => {
    expect(guideIdToPage('events.ibadah')?.page).toBe('events');
    expect(guideIdToPage('ibadah-mingguan')?.page).toBe('kegiatan');
    expect(guideIdToPage('account.security')).toEqual({ page: 'account', accountSection: 'security' });
  });
});

describe('buildPortalSearchIndex', () => {
  it('menyertakan menu terkunci untuk transparansi', () => {
    const entries = indexFor('MENTEE');
    const people = entries.find((e) => e.id === 'page:people');
    expect(people).toBeTruthy();
    expect(people?.allowed).toBe(false);
    const eventInfo = entries.find((e) => e.id === 'page:event-info');
    expect(eventInfo?.allowed).toBe(true);
  });

  it('menyertakan aksi dengan status izin sesuai peran', () => {
    const komisi = indexFor('KOMISI').find((e) => e.id === 'action:event-penatalayan');
    const mentee = indexFor('MENTEE').find((e) => e.id === 'action:event-penatalayan');
    expect(komisi?.allowed).toBe(true);
    expect(mentee?.allowed).toBe(false);
  });

  it('membawa langkah panduan untuk pratinjau', () => {
    const entry = indexFor('MENTEE').find((e) => e.id === 'page:event-info');
    expect(entry?.steps && entry.steps.length).toBeGreaterThan(0);
    expect(entry?.purpose).toBeTruthy();
  });
});

describe('searchPortal', () => {
  it('menemukan fitur lewat kata kunci sinonim', () => {
    const results = searchPortal(indexFor('MENTEE'), 'qr');
    expect(results[0].page).toBe('event-info');
  });

  it('menemukan aksi penatalayan untuk Komisi', () => {
    const results = searchPortal(indexFor('KOMISI'), 'penatalayan');
    expect(results.some((r) => r.id === 'action:event-penatalayan')).toBe(true);
  });

  it('mengembalikan kosong bila tak cocok', () => {
    expect(searchPortal(indexFor('MENTEE'), 'zzzxxyy')).toHaveLength(0);
  });
});
