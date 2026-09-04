/** Kampus prioritas ekosistem GEHC Cikarang, lalu dump PT Indonesia. */
const PRIORITY = [
  { id: 'inst-president', slug: 'president-university', name: 'President University', kind: 'UNIVERSITY', city: 'Cikarang', country: 'Indonesia' },
  { id: 'inst-uph', slug: 'uph', name: 'Universitas Pelita Harapan', kind: 'UNIVERSITY', city: 'Tangerang', country: 'Indonesia' },
  { id: 'inst-binus', slug: 'binus', name: 'BINUS University', kind: 'UNIVERSITY', city: 'Jakarta', country: 'Indonesia' },
  { id: 'inst-ui', slug: 'universitas-indonesia', name: 'Universitas Indonesia', kind: 'UNIVERSITY', city: 'Depok', country: 'Indonesia' },
  { id: 'inst-itb', slug: 'itb', name: 'Institut Teknologi Bandung', kind: 'UNIVERSITY', city: 'Bandung', country: 'Indonesia' },
  { id: 'inst-ugm', slug: 'ugm', name: 'Universitas Gadjah Mada', kind: 'UNIVERSITY', city: 'Yogyakarta', country: 'Indonesia' },
  { id: 'inst-unpad', slug: 'unpad', name: 'Universitas Padjadjaran', kind: 'UNIVERSITY', city: 'Bandung', country: 'Indonesia' },
  { id: 'inst-undip', slug: 'undip', name: 'Universitas Diponegoro', kind: 'UNIVERSITY', city: 'Semarang', country: 'Indonesia' },
  { id: 'inst-its', slug: 'its', name: 'Institut Teknologi Sepuluh Nopember', kind: 'UNIVERSITY', city: 'Surabaya', country: 'Indonesia' },
  { id: 'inst-unj', slug: 'unj', name: 'Universitas Negeri Jakarta', kind: 'UNIVERSITY', city: 'Jakarta', country: 'Indonesia' },
  { id: 'inst-trisakti', slug: 'trisakti', name: 'Universitas Trisakti', kind: 'UNIVERSITY', city: 'Jakarta', country: 'Indonesia' },
  { id: 'inst-atmajaya', slug: 'atmajaya', name: 'Unika Atma Jaya', kind: 'UNIVERSITY', city: 'Jakarta', country: 'Indonesia' },
  { id: 'inst-ukrida', slug: 'ukrida', name: 'UKRIDA', kind: 'UNIVERSITY', city: 'Jakarta', country: 'Indonesia' },
  { id: 'inst-ukim', slug: 'ukim', name: 'Universitas Kristen Indonesia Maluku', kind: 'UNIVERSITY', city: 'Ambon', country: 'Indonesia' },
  { id: 'inst-unsrat', slug: 'unsrat', name: 'Universitas Sam Ratulangi', kind: 'UNIVERSITY', city: 'Manado', country: 'Indonesia' },
  { id: 'inst-unklab', slug: 'unklab', name: 'Universitas Klabat', kind: 'UNIVERSITY', city: 'Airmadidi', country: 'Indonesia' },
];

const ID = require('./institution-catalog-id.cjs');
const seen = new Set(PRIORITY.map((p) => p.slug));
const rest = ID.filter((row) => {
  if (seen.has(row.slug)) return false;
  seen.add(row.slug);
  return true;
});

module.exports = [...PRIORITY, ...rest];
