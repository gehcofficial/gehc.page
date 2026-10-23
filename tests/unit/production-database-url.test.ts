import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pickProductionDatabaseUrl } = require('../../server/_production-database-url.cjs');

describe('production database URL', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ['DATABASE_URL', 'DATABASE_URL_PRODUCTION', 'DATABASE_URL_MAIN', 'DATABASE_URL_PRD']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('prioritas PRODUCTION → MAIN → PRD', () => {
    process.env.DATABASE_URL_PRD = 'mysql://a@h/gehc';
    process.env.DATABASE_URL_MAIN = 'mysql://b@h/gehc';
    process.env.DATABASE_URL_PRODUCTION = 'mysql://c@h/gehc';
    expect(pickProductionDatabaseUrl()).toBe('mysql://c@h/gehc');
    delete process.env.DATABASE_URL_PRODUCTION;
    expect(pickProductionDatabaseUrl()).toBe('mysql://b@h/gehc');
    delete process.env.DATABASE_URL_MAIN;
    expect(pickProductionDatabaseUrl()).toBe('mysql://a@h/gehc');
  });
});
