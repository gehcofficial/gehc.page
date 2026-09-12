/**
 * Cloudflare DNS helper untuk zone GEHC (default gehc.page).
 *
 * Auth: CF_API_TOKEN di .env (scope minimal: Zone -> DNS -> Edit + Zone -> Zone -> Read).
 * Zone: CF_ZONE_NAME (default gehc.page) atau CF_ZONE_ID (opsional).
 *
 * Perintah:
 *   node scripts/cloudflare-dns.mjs zones
 *   node scripts/cloudflare-dns.mjs list [zone]
 *   node scripts/cloudflare-dns.mjs upsert --type CNAME --name youth --content <target> [--ttl 300] [--proxied] [--apply]
 *   node scripts/cloudflare-dns.mjs delete --id <recordId> [--apply]
 *
 * Mutasi (upsert/delete) DEFAULT dry-run; tambahkan --apply untuk eksekusi.
 */
import 'dotenv/config';

const API = 'https://api.cloudflare.com/client/v4';

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const token = (process.env.CF_API_TOKEN || '').trim();
if (!token) fail('CF_API_TOKEN kosong di .env');

const defaultZoneName = (process.env.CF_ZONE_NAME || 'gehc.page').trim();
let cachedZoneId = (process.env.CF_ZONE_ID || '').trim() || null;

async function cf(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const detail =
      (json.errors || []).map((e) => `${e.code} ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return json.result;
}

async function resolveZone(name) {
  const zoneName = name || defaultZoneName;
  if (cachedZoneId && zoneName === defaultZoneName) return cachedZoneId;
  const zones = await cf(`/zones?name=${encodeURIComponent(zoneName)}`);
  if (!zones || zones.length === 0) fail(`Zone ${zoneName} tidak ditemukan untuk token ini`);
  cachedZoneId = zones[0].id;
  return cachedZoneId;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const bools = new Set(['apply', 'json', 'proxied', 'dns-only', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (bools.has(k)) flags[k] = true;
      else flags[k] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function fqdn(zoneName, name) {
  if (!name || name === '@') return zoneName;
  if (name === zoneName || name.endsWith(`.${zoneName}`)) return name;
  return `${name}.${zoneName}`;
}

const PROXIABLE = new Set(['A', 'AAAA', 'CNAME']);

function printRecords(records) {
  if (!records.length) {
    console.log('(tidak ada record)');
    return;
  }
  console.log('TYPE   NAME                     PROXIED  TTL    CONTENT');
  for (const r of records) {
    console.log(
      `${String(r.type).padEnd(6)} ${String(r.name).padEnd(24)} ${String(r.proxied).padEnd(8)} ${String(
        r.ttl,
      ).padEnd(6)} ${r.content}`,
    );
  }
}

async function cmdZones(flags) {
  const zones = await cf('/zones?per_page=50');
  if (flags.json) return console.log(JSON.stringify(zones, null, 2));
  for (const z of zones) {
    const match = z.name === defaultZoneName ? ' *' : '';
    console.log(`${z.name}${match}  id=${z.id}  status=${z.status}`);
  }
}

async function cmdList(positional, flags) {
  const zoneId = await resolveZone(positional[0]);
  const records = await cf(`/zones/${zoneId}/dns_records?per_page=100`);
  if (flags.json) return console.log(JSON.stringify(records, null, 2));
  printRecords(records);
}

async function cmdUpsert(flags) {
  const type = (flags.type || '').toUpperCase();
  const name = flags.name;
  const content = flags.content;
  if (!type || !name || !content) {
    fail('upsert butuh --type, --name, dan --content');
  }
  const zoneId = await resolveZone(flags.zone);
  const full = fqdn(flags.zone || defaultZoneName, name);
  const ttl = Number(flags.ttl || 300);
  if (!Number.isFinite(ttl) || ttl < 1) fail('--ttl tidak valid');
  const proxied = PROXIABLE.has(type) ? Boolean(flags.proxied) : false;

  const records = await cf(`/zones/${zoneId}/dns_records?per_page=100`);
  const existing = records.find((r) => r.type === type && r.name === full);

  const body = { type, name: full, content, ttl };
  if (PROXIABLE.has(type)) body.proxied = proxied;

  if (!existing) {
    if (!flags.apply) {
      console.log(`[dry-run] TAMBAH ${type} ${full} -> ${content} (ttl ${ttl}, proxied ${proxied})`);
      return;
    }
    const created = await cf(`/zones/${zoneId}/dns_records`, { method: 'POST', body });
    console.log(`✓ TAMBAH ${type} ${full} -> ${content} (id ${created.id})`);
    return;
  }

  const same = existing.content === content && existing.ttl === ttl && existing.proxied === proxied;
  if (same) {
    console.log(`= ${type} ${full} sudah sesuai (id ${existing.id})`);
    return;
  }
  if (!flags.apply) {
    console.log(
      `[dry-run] UBAH ${type} ${full}: ${existing.content} -> ${content} (ttl ${existing.ttl}->${ttl}, proxied ${existing.proxied}->${proxied})`,
    );
    return;
  }
  await cf(`/zones/${zoneId}/dns_records/${existing.id}`, { method: 'PATCH', body });
  console.log(`✓ UBAH ${type} ${full} -> ${content} (id ${existing.id})`);
}

async function cmdDelete(flags) {
  if (!flags.id) fail('delete butuh --id <recordId>');
  const zoneId = await resolveZone(flags.zone);
  if (!flags.apply) {
    console.log(`[dry-run] HAPUS record ${flags.id} di zone ${zoneId}`);
    return;
  }
  await cf(`/zones/${zoneId}/dns_records/${flags.id}`, { method: 'DELETE' });
  console.log(`✓ HAPUS record ${flags.id}`);
}

function usage() {
  console.log(`Cloudflare DNS helper — zone ${defaultZoneName}

  zones                                            daftar zone token
  list [zone]                                      daftar DNS record
  upsert --type T --name N --content C [opsi]      tambah/perbarui record
  delete --id <recordId>                           hapus record

Opsi:
  --ttl <detik>     default 300 (1 = auto)
  --proxied         aktifkan proxy (hanya A/AAAA/CNAME; default DNS-only)
  --zone <nama>     override zone
  --apply           eksekusi (default dry-run)
  --json            keluaran JSON (zones/list)
`);
}

const [command, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);

try {
  switch (command) {
    case 'zones':
      await cmdZones(flags);
      break;
    case 'list':
    case 'ls':
      await cmdList(positional, flags);
      break;
    case 'upsert':
    case 'add':
      await cmdUpsert(flags);
      break;
    case 'delete':
    case 'rm':
      await cmdDelete(flags);
      break;
    default:
      usage();
      if (command && command !== 'help' && command !== '--help') process.exit(1);
  }
} catch (err) {
  fail(err.message);
}
