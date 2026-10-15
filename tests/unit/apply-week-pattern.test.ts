import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyWeekPattern } from '../../src/lib/apply-week-pattern';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: unknown) => impl(String(url), init as RequestInit)));
}

describe('applyWeekPattern: satu penulis pola + shell sesi', () => {
  it('PATCH pola lalu buat shell sesi tanggal efektif (18→17)', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    mockFetch((url, init) => {
      calls.push({ url, init });
      if (url.startsWith('/api/didaskalia/studio/') && init?.method === 'PATCH') return ok({});
      if (url === '/api/worship/sessions' && (!init?.method || init.method === 'GET')) return ok({ sessions: [] });
      if (url === '/api/worship/sessions' && init?.method === 'POST') return new Response(JSON.stringify({ session: { id: 'ws1' } }), { status: 201 });
      return new Response('{}', { status: 404 });
    });
    const out = await applyWeekPattern({
      ym: '2026-10', weekIndex: 3, patternCode: 'BEDAH_FILM',
      event: { id: 'ev-w3', name: 'Ibadah - 17 Okt 2026', eventDate: '2026-10-17T02:00:00.000Z' },
      weekDate: '2026-10-18',
    });
    expect(out).toEqual({ patternSaved: true, session: 'created' });
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ patternCode: 'BEDAH_FILM' });
    const post = calls.find((c) => c.init?.method === 'POST');
    const body = JSON.parse(String(post?.init?.body));
    expect(body.patternCode).toBe('BEDAH_FILM');
    expect(body.eventId).toBe('ev-w3');
    expect(body.sessionDate).toBe('2026-10-17');
    expect(body.slug).toBe('sesi-2026-10-17-bedah-film');
  });

  it('tidak duplikat bila sesi pola sudah ada', async () => {
    mockFetch((url, init) => {
      if (url.startsWith('/api/didaskalia/studio/')) return ok({});
      return ok({ sessions: [{ id: 'ws9', eventId: 'ev-w3', pattern: { code: 'BEDAH_FILM' } }] });
    });
    const out = await applyWeekPattern({
      ym: '2026-10', weekIndex: 3, patternCode: 'bedah_film',
      event: { id: 'ev-w3', eventDate: '2026-10-17T02:00:00.000Z' },
      weekDate: '2026-10-18',
    });
    expect(out.session).toBe('exists');
  });

  it('tanpa event → hanya pola (no-event)', async () => {
    const f = vi.fn(async () => ok({}));
    vi.stubGlobal('fetch', f);
    const out = await applyWeekPattern({ ym: '2026-10', weekIndex: 3, patternCode: 'MONOLOG', event: null });
    expect(out).toEqual({ patternSaved: true, session: 'no-event' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('gagal buat sesi → failed, pola tetap tersimpan', async () => {
    mockFetch((url, init) => {
      if (url.startsWith('/api/didaskalia/studio/')) return ok({});
      if (url === '/api/worship/sessions' && init?.method === 'POST') return new Response(JSON.stringify({ error: 'Slug sudah dipakai.' }), { status: 409 });
      return ok({ sessions: [] });
    });
    const out = await applyWeekPattern({
      ym: '2026-10', weekIndex: 3, patternCode: 'MONOLOG',
      event: { id: 'ev-w3', eventDate: '2026-10-17T02:00:00.000Z' },
    });
    expect(out).toEqual({ patternSaved: true, session: 'failed' });
  });

  it('PATCH gagal → lempar, tanpa buat sesi', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', f);
    await expect(applyWeekPattern({ ym: '2026-10', weekIndex: 3, patternCode: 'MONOLOG', event: { id: 'e' } })).rejects.toThrow(/Gagal menyimpan pola/);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
