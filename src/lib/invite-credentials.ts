export const BEYONDERS_GROUPS = [
  { id: 'grp-1', name: 'Avodah' },
  { id: 'grp-2', name: 'Agape' },
  { id: 'grp-3', name: 'Shalom' },
  { id: 'grp-4', name: 'Hesed' },
  { id: 'grp-5', name: 'Kairos' },
  { id: 'grp-6', name: 'Logos' },
  { id: 'grp-7', name: 'Metanoia' },
  { id: 'grp-8', name: 'Ruach' },
  { id: 'grp-9', name: 'Dunamis' },
  { id: 'grp-10', name: 'Echad' },
];

export type InviteType = 'beyonders' | 'staff' | 'individual';

export type CredentialRow = {
  name: string;
  loginUsername?: string;
  email?: string | null;
  tempPassword?: string;
  claimUrl?: string;
};

export function formatCredentialBlock(row: CredentialRow, opts?: { banner?: string }) {
  const lines: string[] = [];
  if (opts?.banner) lines.push(opts.banner);
  lines.push(`Nama: ${row.name}`);
  if (row.loginUsername) lines.push(`Username: ${row.loginUsername}`);
  if (row.email) lines.push(`Email: ${row.email}`);
  if (row.tempPassword) lines.push(`Password: ${row.tempPassword}`);
  if (row.claimUrl) lines.push(`Link klaim Google (opsional): ${row.claimUrl}`);
  lines.push('Login: #/login (username + password di atas)');
  lines.push('(Password wajib diganti saat login pertama. Google bisa ditaut di Akun → Keamanan.)');
  return lines.join('\n');
}

export function formatBulkShareText(
  rows: CredentialRow[],
  opts: { header: string; bannerFor: (name: string) => string },
) {
  const blocks = rows.map((row) => {
    const title = `===== ${row.name} =====`;
    return `${title}\n${formatCredentialBlock(row, { banner: opts.bannerFor(row.name) })}`;
  });
  return [opts.header, '', ...blocks].join('\n\n');
}
