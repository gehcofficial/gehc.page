require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
  try {
    // Cari event 06 Sep 2026 (stored as 2026-09-06T00:00:00Z or dengan jam)
    const [events] = await conn.query(
      `SELECT id, name, status, service_type, event_date, metadata FROM \`EventProgram\` WHERE DATE(event_date) = '2026-09-06' LIMIT 5`
    );
    console.log('events 2026-09-06:', events.length, events.map(e=> `${e.id} | ${e.name} | ${e.status} | ${e.service_type} | ${e.event_date}`));
    let target = events.find(e => String(e.name || '').toLowerCase().includes('ibadah') || true) || events[0];
    if (!target) {
      const [byName] = await conn.query(`SELECT id, name, status, service_type, event_date FROM \`EventProgram\` WHERE name LIKE '%06 Sep 2026%' LIMIT 5`);
      console.log('byName 06 Sep:', byName.length, byName.map(e=> `${e.id} | ${e.name} | ${e.status}`));
      target = byName[0];
    }
    if (!target) {
      console.log('Tidak ada event 06 Sep ditemukan — skip retrofill (mungkin belum pernah dibuat).');
    } else {
      const meta = { retrofill: true, weekIndex: 1, yearMonth: '2026-09', serviceType: 'MENTORING_DAY', updatedAt: new Date().toISOString() };
      await conn.query(`UPDATE \`EventProgram\` SET service_type='MENTORING_DAY', metadata=? WHERE id=?`, [JSON.stringify(meta), target.id]);
      console.log(`Updated ${target.id} -> MENTORING_DAY metadata`);
      // Pastikan plan weeks[0] mentoringTheme terisi dari nama event jika kosong
      let plans = [];
      try {
        [plans] = await conn.query(`SELECT id, weeks FROM \`ministry_month_plans\` WHERE \`year_month\`='2026-09' LIMIT 1`);
      } catch (e) { console.log('plans query skipped:', e.message.slice(0,120)); plans = []; }
      if (plans.length) {
        let weeks = [];
        try {
          const raw = plans[0].weeks;
          weeks = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
          if (!Array.isArray(weeks) && typeof raw === 'object') weeks = raw;
        } catch {}
        if (Array.isArray(weeks) && weeks[0]) {
          const w0 = weeks[0];
          const hasMentoring = String(w0.mentoringTheme || w0.theme || '').trim();
          if (!hasMentoring) {
            const inferred = String(target.name || '').split(':')[1]?.split('-')[0]?.trim() || String(target.name || '');
            w0.mentoringTheme = inferred.slice(0,190);
            w0.theme = w0.mentoringTheme;
            await conn.query(`UPDATE \`ministry_month_plans\` SET weeks=? WHERE id=?`, [JSON.stringify(weeks), plans[0].id]);
            console.log('Backfill weeks[0].mentoringTheme ->', w0.mentoringTheme);
          } else console.log('weeks[0] already has mentoringTheme:', hasMentoring);
        }
      } else console.log('No ministry_month_plans 2026-09 row — skip weeks backfill (grid computed)');
      // Deliverable link: hanya MODULE/RUNDOWN Didaskalia week 1 yang belum linked (jangan link HUT docs)
      let dels = [];
      try {
        [dels] = await conn.query(`SELECT id, title, week_index, division, kind, event_id FROM \`ministry_week_deliverables\` WHERE week_index=1 AND division='DIDASKALIA' AND kind IN ('MODULE','RUNDOWN') AND plan_id=(SELECT id FROM \`ministry_month_plans\` WHERE \`year_month\`='2026-09' LIMIT 1) LIMIT 10`);
      } catch (e) { console.log('dels query skipped:', e.message.slice(0,120)); dels = []; }
      console.log('Didaskalia MODULE week 1:', dels.length, dels.map(d=> `${d.id} ${d.title} kind=${d.kind} event=${d.event_id}`));
      const unlinked = dels.find(d=> !d.event_id);
      if (unlinked) {
        await conn.query(`UPDATE \`ministry_week_deliverables\` SET event_id=?, service_type='MENTORING' WHERE id=?`, [target.id, unlinked.id]);
        console.log(`Linked deliverable ${unlinked.id} -> event ${target.id}`);
        // Pastikan EventDivision DIDASKALIA ada
        const [divs] = await conn.query(`SELECT id FROM \`EventDivision\` WHERE event_id=? AND division='DIDASKALIA'`, [target.id]);
        if (!divs.length) {
          const divId = `evd-${target.id.replace('evt-','')}-DIDASKALIA`;
          await conn.query(`INSERT IGNORE INTO \`EventDivision\` (id, event_id, division) VALUES (?,?, 'DIDASKALIA')`, [divId, target.id]).catch(()=>{});
          console.log('Created EventDivision DIDASKALIA for', target.id);
        }
      } else if (dels.length) console.log('All week1 deliverables already linked');
      else console.log('No deliverables week 1 — nothing to link');
    }
  } finally { await conn.end(); }
  console.log('OK backfill 06 Sep mentoring');
})().catch(e=>{ console.error(e.message); process.exit(1); });
