import { describe, it, expect } from 'vitest';
import { filterSearchableOptions } from '../../src/lib/searchable-options';

const opts = [
  { value: '1', label: 'President University', hint: 'Cikarang' },
  { value: '2', label: 'Universitas Indonesia', hint: 'Depok' },
  { value: '3', label: 'Institut Teknologi Bandung', hint: 'Bandung' },
];

describe('filterSearchableOptions', () => {
  it('returns all options when the query is empty', () => {
    expect(filterSearchableOptions(opts, '  ')).toEqual(opts);
  });

  it('matches label case-insensitively', () => {
    expect(filterSearchableOptions(opts, 'indonesia').map((o) => o.value)).toEqual(['2']);
  });

  it('matches hint text', () => {
    expect(filterSearchableOptions(opts, 'cikarang').map((o) => o.value)).toEqual(['1']);
  });
});
