import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { approverUserIds } from '../lib/approval-notify.mjs';
import {
  birthdayOffsetInWeek,
  DEFAULT_BIRTHDAY_CAPTION,
  mondayOfWeek,
  renderBirthdayCaption,
  todayWibKey,
} from '../lib/birthday-week.mjs';

const nid = () => `ntf-${crypto.randomUUID()}`;

export { renderBirthdayCaption };

function ageOn(birthDate, todayKey) {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const [y, m, d] = todayKey.split('-').map(Number);
  let age = y - b.getUTCFullYear();
  const bm = b.getUTCMonth() + 1;
  const bd = b.getUTCDate();
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age >= 0 ? age : null;
}

async function activeSetting(prisma) {
  try {
    const row = await prisma.birthdaySetting.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    if (row) return row;
  } catch { /* tabel belum ada */ }
  return { caption: DEFAULT_BIRTHDAY_CAPTION, photoUrl: null };
}

/**
 * Dipakai cron harian: user ACTIVE berultah hari ini (WIB) dapat 1 notif
 * BIRTHDAY_WISH (dedupe per hari) + 1 digest ke Komisi bila ada yang ultah.
 */
export async function runBirthdayWishes(prisma, now = new Date()) {
  const today = todayWibKey(now);
  if (!today) return { wished: [], digested: 0 };
  const monday = mondayOfWeek(today);
  const users = await prisma.user.findMany({
    where: { birthDate: { not: null }, accountStatus: 'ACTIVE' },
    select: { id: true, name: true, birthDate: true },
    take: 1000,
  }).catch(() => []);
  const celebrants = [];
  for (const u of users) {
    const b = new Date(u.birthDate);
    if (Number.isNaN(b.getTime())) continue;
    const off = birthdayOffsetInWeek(b.getUTCMonth() + 1, b.getUTCDate(), monday);
    if (off < 0) continue;
    // samakan tanggal WIB-nya dengan hari ini
    const wk = [];
    for (let i = 0; i < 7; i++) {
      const t = Date.parse(`${monday}T00:00:00Z`);
      wk.push(new Date(t + i * 86400000).toISOString().slice(0, 10));
    }
    if (wk[off] !== today) continue;
    celebrants.push({ ...u, age: ageOn(u.birthDate, today) });
  }
  if (!celebrants.length) return { wished: [], digested: 0 };

  const setting = await activeSetting(prisma);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const already = await prisma.notification.findMany({
    where: { type: 'BIRTHDAY_WISH', status: 'OPEN', createdAt: { gte: dayStart } },
    select: { memberId: true },
  }).catch(() => []);
  const doneIds = new Set(already.map((n) => n.memberId));
  const wished = [];
  for (const c of celebrants) {
    if (doneIds.has(c.id)) continue;
    try {
      await prisma.notification.create({
        data: {
          id: nid(),
          type: 'BIRTHDAY_WISH',
          memberId: c.id,
          title: `Selamat ulang tahun, ${String(c.name || '').split(' ')[0] || 'Jemaat'}! 🎉`,
          message: renderBirthdayCaption(setting.caption, { name: c.name, age: c.age }),
          payload: {
            userId: c.id,
            age: c.age,
            photoUrl: setting.photoUrl || null,
            url: '#/portal/mentee/account',
          },
          status: 'OPEN',
        },
      });
      wished.push(c.name);
    } catch { /* lanjut user berikutnya */ }
  }

  let digested = 0;
  try {
    const recipients = await approverUserIds(prisma);
    if (recipients.length && celebrants.length) {
      await prisma.notification.createMany({
        data: recipients.map((userId) => ({
          id: nid(),
          type: 'BIRTHDAY_WISH',
          memberId: userId,
          title: `Hari ini ${celebrants.length} jemaat ultah`,
          message: celebrants.map((c) => c.name).slice(0, 8).join(', '),
          payload: { date: today, count: celebrants.length, url: '#/portal/komisi/people' },
          status: 'OPEN',
        })),
      });
      digested = recipients.length;
    }
  } catch { /* abaikan */ }
  return { wished, digested };
}

export function registerBirthdayRoutes(app, { wrap }) {
  app.get(
    '/api/birthday/wish',
    requireRole(),
    wrap(async (_req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ caption: DEFAULT_BIRTHDAY_CAPTION, photoUrl: null });
      const s = await activeSetting(prisma);
      res.json({ caption: s.caption, photoUrl: s.photoUrl || null });
    }),
  );

  app.put(
    '/api/birthday/wish',
    requireRole('SUPERADMIN', 'KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const caption = String(req.body?.caption || '').trim();
      if (!caption) return res.status(400).json({ error: 'Caption wajib.' });
      const photoUrl = String(req.body?.photoUrl || '').trim() || null;
      if (photoUrl && !/^https:\/\//i.test(photoUrl)) {
        return res.status(400).json({ error: 'Foto harus URL https.' });
      }
      try {
        await prisma.birthdaySetting.updateMany({ data: { isActive: false } });
        const row = await prisma.birthdaySetting.create({
          data: {
            id: `bday-${crypto.randomBytes(6).toString('hex')}`,
            caption: caption.slice(0, 500),
            photoUrl,
            isActive: true,
            updatedById: req.authUser.id,
          },
        });
        return res.json({ caption: row.caption, photoUrl: row.photoUrl || null });
      } catch (e) {
        return res.status(400).json({ error: e?.message || 'Gagal menyimpan.' });
      }
    }),
  );
}
