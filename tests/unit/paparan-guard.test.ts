import { describe, expect, it } from 'vitest';
import { PAPARAN_GLOSSARY, PAPARAN_ROLES, paparanDeck, registerPaparanRoutes } from '../../server/routes/paparan.mjs';

type Handler = (req: any, res: any, next: () => void) => unknown;

function collectHandlers() {
  const routes: { method: string; path: string; handlers: Handler[] }[] = [];
  const app = {
    get: (path: string, ...handlers: Handler[]) => {
      routes.push({ method: 'GET', path, handlers });
    },
  };
  registerPaparanRoutes(app, { wrap: (fn: Handler) => fn });
  return routes;
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return { json: (body: unknown) => { res.body = body; return res; } };
  };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

/** Jalankan rantai middleware express secara berurutan. */
async function runChain(handlers: Handler[], req: any) {
  const res = mockRes();
  let idx = -1;
  const next = async (): Promise<void> => {
    idx += 1;
    if (idx < handlers.length) await handlers[idx](req, res, () => void next());
  };
  await next();
  return res;
}

const reqWithRoles = (roles: string[] | null) => ({
  authUser: roles === null ? null : { email: 'uji@gehc.demo', roles: roles.map((role) => ({ role })) },
});

describe('paparan-guard — endpoint khusus pimpinan', () => {
  it('mendaftarkan GET /api/paparan/bpmj-2026-10', () => {
    const routes = collectHandlers();
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/api/paparan/bpmj-2026-10');
  });

  it('PAPARAN_ROLES tepat BPMJ+KOMISI+SUPERADMIN', () => {
    expect([...PAPARAN_ROLES].sort()).toEqual(['BPMJ', 'KOMISI', 'SUPERADMIN']);
  });

  it('401 tanpa login', async () => {
    const res = await runChain(collectHandlers()[0].handlers, reqWithRoles(null));
    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toBe('Belum login.');
  });

  it.each(['MENTEE', 'MENTOR', 'CO_MENTOR', 'COMMITTEE', 'ALUMNI', 'MEMBER'])('403 untuk peran %s', async (role) => {
    const res = await runChain(collectHandlers()[0].handlers, reqWithRoles([role]));
    expect(res.statusCode).toBe(403);
    expect(typeof res.body?.error).toBe('string');
    expect(res.body?.slides).toBeUndefined();
  });

  it.each(['BPMJ', 'KOMISI', 'SUPERADMIN'])('200 + deck 13 slide untuk peran %s', async (role) => {
    const res = await runChain(collectHandlers()[0].handlers, reqWithRoles([role]));
    expect(res.statusCode).toBe(200);
    expect(res.body?.error).toBeUndefined();
    expect(res.body?.slug).toBe('bpmj-2026-10');
    expect(res.body?.slides).toHaveLength(13);
  });

  it('deck utuh: tiap slide ber-id + judul', () => {
    const deck = paparanDeck();
    expect(deck.slides).toHaveLength(13);
    for (const s of deck.slides) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
    }
    expect(deck.slides.map((s) => s.id)).toContain('keputusan');
  });

  it('glosarium: unik + tiap footnote slide ter-resolve', () => {
    const terms = PAPARAN_GLOSSARY.map((g) => String(g.term).toUpperCase());
    expect(new Set(terms).size).toBe(terms.length);
    for (const g of PAPARAN_GLOSSARY) {
      expect(g.full.length).toBeGreaterThan(0);
      expect(g.meaning.length).toBeGreaterThan(0);
    }
    const known = new Set(terms);
    const deck = paparanDeck();
    expect(Array.isArray(deck.glossary)).toBe(true);
    let footnoteCount = 0;
    for (const s of deck.slides) {
      for (const t of s.footnotes || []) {
        footnoteCount += 1;
        expect(known.has(String(t).toUpperCase()), `footnote "${t}" di slide "${s.id}" wajib ada di glosarium`).toBe(true);
      }
    }
    expect(footnoteCount).toBeGreaterThan(20);
  });
});
