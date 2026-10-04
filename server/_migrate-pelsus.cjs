/**
 * Idempotent (Pelsus 11 Okt 2026 — Pemilihan Pelayan Khusus GMIM):
 *   pelsus_elections, pelsus_candidates, pelsus_voters,
 *   pelsus_ballots, pelsus_kiosk_tokens, pelsus_audit_logs
 *
 * Standar: perorangan, langsung, rahasia, tertulis (digital = surat suara
 * panitia), tak dapat diwakilkan; 1 pemilih 1 submisi per election
 * (unique election+voter); kuorum 2/3 configurable per election.
 *
 * Jalankan: npm run db:migrate:pelsus[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`pelsus_elections\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`scope\` VARCHAR(16) NOT NULL DEFAULT 'BIPRA',
    \`bipra\` VARCHAR(16) NULL,
    \`kolom_id\` VARCHAR(64) NULL,
    \`role_target\` VARCHAR(32) NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`description\` TEXT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    \`max_choices\` INT NOT NULL DEFAULT 1,
    \`quorum_num\` INT NOT NULL DEFAULT 2,
    \`quorum_den\` INT NOT NULL DEFAULT 3,
    \`access_code\` VARCHAR(12) NULL,
    \`closes_at\` DATETIME(3) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`pelsus_elections_scope_status_idx\`(\`scope\`, \`status\`),
    INDEX \`pelsus_elections_kolom_id_idx\`(\`kolom_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`pelsus_candidates\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`election_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`nomor\` INT NOT NULL DEFAULT 0,
    \`role_target\` VARCHAR(32) NULL,
    \`photo_url\` TEXT NULL,
    \`visi\` TEXT NULL,
    \`vote_count\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`pelsus_candidates_election_nomor_key\`(\`election_id\`, \`nomor\`),
    INDEX \`pelsus_candidates_election_id_idx\`(\`election_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`pelsus_voters\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`election_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`bipra\` VARCHAR(16) NULL,
    \`kolom_id\` VARCHAR(64) NULL,
    \`has_voted\` BOOLEAN NOT NULL DEFAULT false,
    \`voted_at\` DATETIME(3) NULL,
    \`voted_via\` VARCHAR(16) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`pelsus_voters_election_user_key\`(\`election_id\`, \`user_id\`),
    INDEX \`pelsus_voters_election_voted_idx\`(\`election_id\`, \`has_voted\`),
    INDEX \`pelsus_voters_election_id_idx\`(\`election_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`pelsus_ballots\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`election_id\` VARCHAR(64) NOT NULL,
    \`voter_id\` VARCHAR(64) NOT NULL,
    \`candidate_id\` VARCHAR(64) NOT NULL,
    \`channel\` VARCHAR(16) NOT NULL DEFAULT 'LOGIN',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`pelsus_ballots_election_voter_cand_key\`(\`election_id\`, \`voter_id\`, \`candidate_id\`),
    INDEX \`pelsus_ballots_election_cand_idx\`(\`election_id\`, \`candidate_id\`),
    INDEX \`pelsus_ballots_election_voter_idx\`(\`election_id\`, \`voter_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`pelsus_kiosk_tokens\` (
    \`token\` VARCHAR(16) NOT NULL,
    \`election_id\` VARCHAR(64) NOT NULL,
    \`voter_id\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME(3) NOT NULL,
    \`used_at\` DATETIME(3) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`pelsus_kiosk_tokens_election_idx\`(\`election_id\`),
    INDEX \`pelsus_kiosk_tokens_voter_idx\`(\`voter_id\`),
    PRIMARY KEY (\`token\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`pelsus_audit_logs\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`election_id\` VARCHAR(64) NULL,
    \`actor_id\` VARCHAR(64) NULL,
    \`action\` VARCHAR(40) NOT NULL,
    \`detail\` JSON NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`pelsus_audit_logs_election_idx\`(\`election_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
];

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

  for (const ddl of DDL) {
    const name = /`([a-z_]+)`/.exec(ddl)?.[1] || '?';
    const [t] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name],
    );
    if (t.length) {
      console.log(`tabel ${name} sudah ada`);
      continue;
    }
    await conn.query(ddl);
    console.log(`✓ tabel ${name} dibuat`);
  }

  await conn.end();
  console.log('✓ Selesai (Pelsus: 6 tabel).');
})().catch((e) => {
  console.error('Gagal migrasi pelsus:', e?.message || e);
  process.exit(1);
});
