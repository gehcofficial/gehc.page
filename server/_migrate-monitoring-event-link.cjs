require('dotenv').config();
const mysql=require('mysql2/promise');
(async()=>{
 const raw=process.env.DATABASE_URL;
 if(!raw) throw new Error('DATABASE_URL missing');
 const u=new URL(raw);
 const c=await mysql.createConnection({host:u.hostname,port:Number(u.port||4000),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.replace(/^\//,'').split('?')[0], ssl:{rejectUnauthorized:true}});
 try{
   const cols=[
     ['monitoring_records','event_id','VARCHAR(64) NULL'],
     ['monitoring_records','week_index','INT NULL'],
     ['monitoring_records','year_month','VARCHAR(7) NULL'],
     ['monitoring_records','season','VARCHAR(16) NULL'],
   ];
   for(const [tbl,col,ddl] of cols){
     const [exists]=await c.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [tbl, col]);
     if(!exists.length){
       await c.query(`ALTER TABLE \`${tbl}\` ADD COLUMN \`${col}\` ${ddl}`);
       console.log(`${tbl}.${col} added`);
     } else console.log(`${tbl}.${col} exists`);
   }
   await c.query('CREATE INDEX idx_monitoring_event_id ON `monitoring_records` (`event_id`)').catch(()=>{});
   await c.query('CREATE INDEX idx_monitoring_year_month ON `monitoring_records` (`year_month`)').catch(()=>{});
   // backfill from data JSON where eventId exists
   const [rows]=await c.query("SELECT id, `data`, `date` FROM `monitoring_records` WHERE `event_id` IS NULL AND JSON_EXTRACT(`data`, '$.eventId') IS NOT NULL LIMIT 100");
   console.log('backfill candidates', rows.length);
   for(const r of rows){
     try{
       const d= typeof r.data==='string'? JSON.parse(r.data): r.data;
       const eventId=d.eventId|| d.weekRef?.eventId || null;
       if(eventId){
         let weekIndex=null, yearMonth=null, season=null;
         if(d.weekRef?.serviceType){ /* keep */ }
         // derive yearMonth from date if not in weekRef
         const iso= new Date(r.date).toISOString().slice(0,10);
         yearMonth= iso.slice(0,7);
         // try to resolve weekIndex from EventProgram metadata if eventId exists
         if(eventId){
           const [ev]=await c.query('SELECT metadata, event_date FROM `EventProgram` WHERE id=? LIMIT 1', [eventId]);
           if(ev.length && ev[0].metadata){
             try{ const meta= typeof ev[0].metadata==='string'? JSON.parse(ev[0].metadata): ev[0].metadata; if(meta.weekIndex) weekIndex= Number(meta.weekIndex); if(meta.yearMonth) yearMonth= meta.yearMonth; }catch{}
           }
         }
         await c.query('UPDATE `monitoring_records` SET `event_id`=?, `week_index`=?, `year_month`=? WHERE id=?', [eventId, weekIndex, yearMonth, r.id]);
         console.log(`backfill ${r.id} -> event ${eventId} week ${weekIndex}`);
       }
     }catch(e){ console.log('backfill skip', r.id, e.message.slice(0,80));}
   }
 }finally{ await c.end();}
 console.log('OK monitoring event link');
})().catch(e=>{ console.error(e.message); process.exit(1);});
