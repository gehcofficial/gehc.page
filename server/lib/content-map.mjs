/** Map Prisma ContentItem ↔ frontend ContentItem shape. */

function isoDate(d) {
  if (!d) return undefined;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10);
}

export function fromDbContent(c) {
  const rawTags = c.tags;
  const labels = Array.isArray(rawTags) ? rawTags : rawTags?.labels || [];
  const meta = Array.isArray(rawTags) ? {} : rawTags || {};

  return {
    id: c.id,
    tenant_id: c.tenantId,
    type: c.type,
    title: c.title,
    subtitle: c.subtitle ?? '',
    body: c.body ?? '',
    category: c.category ?? '',
    published_at: isoDate(c.publishedAt) || new Date().toISOString().slice(0, 10),
    event_date: isoDate(c.eventDate),
    location: meta.location || c.locationDetail || undefined,
    location_detail: c.locationDetail ?? undefined,
    is_featured_event: Boolean(c.isFeaturedEvent),
    is_published: c.isPublished,
    author: c.author ?? '',
    scripture: meta.scripture || undefined,
    schedule: meta.schedule || undefined,
    targetAudience: meta.targetAudience || undefined,
    bannerUrl: c.bannerUrl ?? '',
    pdfUrl: c.pdfUrl ?? undefined,
    tags: labels,
    eventId: c.eventId ?? undefined,
  };
}

export function toDbContent(item, { id, tenantId = 'tenant-youth' } = {}) {
  const tags = {
    labels: item.tags || [],
    ...(item.scripture ? { scripture: item.scripture } : {}),
    ...(item.schedule ? { schedule: item.schedule } : {}),
    ...(item.location ? { location: item.location } : {}),
    ...(item.targetAudience ? { targetAudience: item.targetAudience } : {}),
    ...(item.wartaId ? { wartaId: item.wartaId } : {}),
  };

  return {
    id,
    tenantId: item.tenant_id || tenantId,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle || null,
    body: item.body || null,
    category: item.category || null,
    publishedAt: item.published_at ? new Date(item.published_at) : new Date(),
    eventDate: item.event_date ? new Date(item.event_date) : null,
    locationDetail: item.location_detail || item.location || null,
    isFeaturedEvent: Boolean(item.is_featured_event),
    isPublished: item.is_published !== false,
    author: item.author || null,
    bannerUrl: item.bannerUrl || null,
    pdfUrl: item.pdfUrl || null,
    tags,
    ...(item.eventId !== undefined ? { eventId: item.eventId || null } : {}),
  };
}

/** Field terstruktur editor Warta → body landing. */
export const WARTA_FIELDS = ['ayat', 'khotbah', 'pengumuman', 'pelayanan', 'sharing', 'doa'];

export const WARTA_FIELD_LABELS = {
  ayat: 'Ayat',
  khotbah: 'Khotbah',
  pengumuman: 'Pengumuman',
  pelayanan: 'Pelayanan',
  sharing: 'Sharing',
  doa: 'Doa',
};

export function wartaBodyFromContent(contentJson, fallbackTitle = '') {
  const c = contentJson && typeof contentJson === 'object' ? contentJson : {};
  if (typeof contentJson === 'string' && contentJson.trim()) return contentJson;
  if (c.body) return c.body;
  if (c.summary && !WARTA_FIELDS.some((f) => c[f])) return c.summary;
  const parts = [];
  for (const f of WARTA_FIELDS) {
    const v = String(c[f] || '').trim();
    if (v) parts.push(`${WARTA_FIELD_LABELS[f]}:\n${v}`);
  }
  return parts.join('\n\n') || fallbackTitle;
}

export async function syncWartaToContentItem(prisma, warta) {
  const contentJson = warta.contentJson && typeof warta.contentJson === 'object' ? warta.contentJson : {};
  const body = wartaBodyFromContent(warta.contentJson, warta.title);

  const id = `cnt-warta-${warta.id}`;
  const data = {
    tenantId: 'tenant-youth',
    type: 'WEEKLY_INFO',
    title: warta.title,
    subtitle: contentJson.subtitle || contentJson.ayat || null,
    body,
    category: 'Warta Mingguan',
    publishedAt: warta.weekDate,
    isPublished: true,
    author: 'Komisi Pelayanan Pemuda',
    bannerUrl: warta.pngUrl || contentJson.bannerUrl || null,
    pdfUrl: warta.pdfUrl || null,
    tags: { labels: ['Warta'], wartaId: warta.id },
  };

  await prisma.contentItem.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
}
