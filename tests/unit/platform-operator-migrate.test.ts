import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('platform operator migrate CJS', () => {
  const src = readFileSync('server/_migrate-platform-operators.cjs', 'utf8');

  it('does not drop operator tables', () => {
    expect(src).not.toMatch(/DROP\s+TABLE/i);
  });

  it('creates tables only if missing', () => {
    expect(src).toMatch(/tableExists/);
    expect(src).toMatch(/CREATE TABLE platform_operators/);
  });
});

describe('role_assignments migrate CJS', () => {
  const src = readFileSync('server/_migrate-role-assignments.cjs', 'utf8');

  it('does not drop tables', () => {
    expect(src).not.toMatch(/DROP\s+TABLE/i);
  });

  it('creates role_assignments only if missing', () => {
    expect(src).toMatch(/CREATE TABLE role_assignments/);
    expect(src).toMatch(/assignment_id/);
  });
});
