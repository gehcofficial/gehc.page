require('dotenv').config();
const mysql=require('mysql2/promise');
(async()=>{
  const u=new URL(process.env.DATABASE_URL);
  const c=await mysql.createConnection({host:u.hostname,port:Number(u.port||4000),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.replace(/^\//,'').split('?')[0],ssl:{rejectUnauthorized:true}});
  try{
    const dry=process.argv.includes('--dry-run');
    const [rows]=await c.query(`SELECT id,user_id,sourceEvent FROM waiting_pool WHERE sourceEvent='BAKU TAU 4.0'`);
    console.log(`Baris tercap BAKU TAU: ${rows.length}`);
    let fixNull=0, fixInvite=0, skip=0;
    for(const r of rows){
      if (!r.user_id) { skip++; continue; } // counter orphans: legitimate
      const [ev]=await c.query(`SELECT sourceEvent FROM waiting_pool WHERE user_id=? AND sourceEvent LIKE 'Invite %'`,[r.user_id]).catch(()=>[[],[]]);
      // Heuristic: if user has ever had Invite source, but current is BAKU — likely overwritten. Check via audit: we approximate by checking if user created via invite (onboarding_path INVITED)
      const [usr]=await c.query(`SELECT onboarding_path, bipra FROM users WHERE id=?`,[r.user_id]);
      const path=usr[0]?.onboarding_path;
      if (path==='INVITED') {
        // Check if there's history: if user has no real event registration for BAKU, restore to Invite placeholder
        // We do conservative: set to NULL and let Commission re-tag if needed, unless we find Invite code in notification payload
        // For now, skip Invite restore and just log.
      }
      // Strict criteria for repair: user registered via google/local (ORGANIC) and never went through event-signup endpoint.
      // We check if user appears in event_attendees for BAKU event; if not, likely mis-capped.
      const [att]=await c.query(`SELECT id FROM event_attendees WHERE user_id=? AND event_id='evt-baku-tau-4-0'`,[r.user_id]);
      if (att.length===0) {
        // Also check if counter claim exists: if onboarding_path null? For safety, only fix those with sourceEvent BAKU but no attendee row
        if (path==='INVITED') fixInvite++; else fixNull++;
        if (!dry) {
          // For INVITED, try to recover Invite code from inviteCode table? keep NULL for now with note
          const target = path==='INVITED' ? null : null;
          await c.query(`UPDATE waiting_pool SET sourceEvent=? WHERE id=?`,[target, r.id]);
        }
      } else skip++;
    }
    console.log(`Akan diperbaiki null: ${fixNull}, invite: ${fixInvite}, dilewati: ${skip}`);
    if (dry) console.log('(dry-run — tambah tanpa --dry-run untuk eksekusi)');
    else console.log('Repair selesai');
  } finally { await c.end(); }
})().catch(e=>{ console.error(e.message); process.exit(1); });
