import { describe, it, expect } from 'vitest';
import { effectiveContext } from '../../server/routes/unit-landing.mjs';

const req = (host, query = {}) => ({ headers: { host }, query });

describe('unit-landing: konteks unit efektif', () => {
  it('host gehc.page menang; ?portal= diabaikan', () => {
    expect(effectiveContext(req('men.gehc.page', { portal: 'women' }))).toMatchObject({
      unit: 'men',
      tenantId: 'tenant-men',
    });
    expect(effectiveContext(req('staging-kids.gehc.page'))).toMatchObject({
      unit: 'kids',
      tenantId: 'tenant-kids',
    });
  });

  it('host tak dikenal boleh override ?portal= (preview dev)', () => {
    expect(effectiveContext(req('localhost:8787', { portal: 'women' }))).toMatchObject({
      unit: 'women',
      tenantId: 'tenant-women',
      bipra: 'IBU',
    });
    expect(effectiveContext(req('gehcpage.vercel.app', { portal: 'kolom' }))).toMatchObject({
      unit: 'districts',
      tenantId: 'tenant-districts',
    });
  });

  it('tanpa override, host tak dikenal tetap Pemuda', () => {
    expect(effectiveContext(req('localhost'))).toMatchObject({
      unit: 'youth',
      tenantId: 'tenant-youth',
    });
    expect(effectiveContext(req('preview-abc.vercel.app', { portal: 'bogus' }))).toMatchObject({
      unit: 'youth',
      tenantId: 'tenant-youth',
    });
  });
});
