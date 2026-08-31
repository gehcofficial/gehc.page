import type {
  Tenant,
  User,
  YouthGroup,
  GroupMember,
  MonitoringRecord,
  ContentItem,
  StrukturMember,
  IntegrationConfig,
  DriveFolder,
  GroupBatch,
} from '../types';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-youth',
    name: 'Pemuda (Youth)',
    slug: 'youth',
    domain: 'youth.gehc.page',
    badge: 'Active MVP',
    description: 'Komisi Pelayanan Pemuda GMIM Eben Haezer Cikarang',
    is_active: true,
  },
  {
    id: 'tenant-bapak',
    name: 'Pria/Kaum Bapa (P/KB)',
    slug: 'bapak',
    domain: 'bapak.gehc.page',
    badge: 'Next Ecosystem',
    description: 'Komisi Pelayanan Pria/Kaum Bapa GMIM Eben Haezer Cikarang',
    is_active: false,
  },
  {
    id: 'tenant-ibu',
    name: 'Wanita/Kaum Ibu (W/KI)',
    slug: 'ibu',
    domain: 'ibu.gehc.page',
    badge: 'Next Ecosystem',
    description: 'Komisi Pelayanan Wanita/Kaum Ibu GMIM Eben Haezer Cikarang',
    is_active: false,
  },
  {
    id: 'tenant-rekreasi',
    name: 'Komunitas & Rekreasional',
    slug: 'rekreasional',
    domain: 'community.gehc.page',
    badge: 'Planned',
    description: 'Unit Minat, Bakat, Musik, Olahraga & Rekreasional',
    is_active: false,
  },
  {
    id: 'tenant-teritorial',
    name: 'Wilayah & Kolom Teritorial',
    slug: 'teritorial',
    domain: 'kolom.gehc.page',
    badge: 'Planned',
    description: 'Pemetaan Kolom teritorial (saat ini 5 Kolom; bisa disesuaikan ulang)',
    is_active: false,
  },
];

/**
 * Persona fallback lokal — sinkron dengan akun dummy staging (seed-users.ts).
 * Hanya 9 persona inti per level RBAC; daftar lengkap diambil live dari
 * /api/demo/personas saat server aktif. Email = akun DB agar impersonate jalan.
 */
const demoAvatar = (seed: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1b1b1b`;
const YOUTH = 'tenant-youth';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-tech',
    name: 'Tim Tech GEHC',
    email: 'tech@gehc.demo',
    avatar: demoAvatar('Tim Tech'),
    roles: [{ tenantId: YOUTH, role: 'SUPERADMIN' }],
  },
  {
    id: 'usr-stevania-hadinda',
    name: 'Pnt Stevania Hadinda',
    email: 'stevania.hadinda@gehc.demo',
    avatar: demoAvatar('Stevania Hadinda'),
    roles: [
      { tenantId: YOUTH, role: 'KOMISI' }, // Ketua Komisi (Penatua Pemuda)
      { tenantId: YOUTH, role: 'MENTOR', groupId: 'grp-2' }, // demo multi-role
    ],
  },
  {
    id: 'usr-theodore-kowaas',
    name: 'Theodore Beckham Milano Kowaas',
    email: 'theodore.kowaas@gehc.demo',
    avatar: demoAvatar('Theodore Kowaas'),
    roles: [
      { tenantId: YOUTH, role: 'COMMITTEE' }, // Ketua Tim Kerja
      { tenantId: YOUTH, role: 'MENTOR', groupId: 'grp-3' }, // Shalom
    ],
  },
  {
    id: 'usr-glenity-siauw',
    name: 'Glenity Siauw',
    email: 'glenity.siauw@gehc.demo',
    avatar: demoAvatar('Glenity Siauw'),
    roles: [
      { tenantId: YOUTH, role: 'KOMISI' }, // Sekretaris Komisi
      { tenantId: YOUTH, role: 'MENTEE', groupId: 'grp-7' }, // Metanoia — multi-role
    ],
  },
  {
    id: 'usr-mighty-rengkung',
    name: 'Mighty Rengkung',
    email: 'mighty.rengkung@gehc.demo',
    avatar: demoAvatar('Mighty Rengkung'),
    roles: [{ tenantId: YOUTH, role: 'MENTOR', groupId: 'grp-6' }], // Logos
  },
  {
    id: 'usr-yulius-waworuntu',
    name: 'Yulius Waworuntu',
    email: 'yulius.waworuntu@gehc.demo',
    avatar: demoAvatar('Yulius Waworuntu'),
    roles: [{ tenantId: YOUTH, role: 'ALUMNI' }],
  },
  {
    id: 'usr-andrea-sondakh',
    name: 'Andrea Sondakh',
    email: 'andrea.sondakh@gehc.demo',
    avatar: demoAvatar('Andrea Sondakh'),
    roles: [{ tenantId: YOUTH, role: 'MENTEE', groupId: 'grp-8' }], // Ruach
  },
];

export const INITIAL_GROUPS: YouthGroup[] = [
  {
    id: 'grp-1',
    tenant_id: 'tenant-youth',
    name: 'Avodah',
    meaning: 'Ibadah & Pelayanan yang Nyata dalam Karya',
    scripture: 'Kolose 3:23 — "Apapun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan dan bukan untuk manusia."',
    mentorNames: ['Zhanon Lausan', 'Farendy Lumintang'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Jumat, 19:30 WIB',
    meetingLocation: 'Ruang Serbaguna GEHC / Home Fellowship Lippo Cikarang',
    color: '#FF416C',
    icon: 'volunteer_activism',
    description: 'Kelompok pemuda yang berfokus pada keteladanan kerja keras di tempat kerja, kampus, dan pelayanan aktif di gereja.',
  },
  {
    id: 'grp-2',
    tenant_id: 'tenant-youth',
    name: 'Agape',
    meaning: 'Kasih yang Tulus dan Tanpa Syarat',
    scripture: '1 Korintus 13:4-7 — "Kasih itu sabar; kasih itu murah hati; ia tidak cemburu. Ia tidak memegahkan diri dan tidak sombong."',
    mentorNames: ['Prichel Kampong', 'Syallomitha Mawitjere'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Sabtu, 17:00 WIB',
    meetingLocation: 'Fellowship Lounge Lantai 2 GEHC',
    color: '#E94057',
    icon: 'favorite',
    description: 'Membangun persekutuan yang hangat, saling mendoakan, dan merangkul pemuda baru yang merantau di kawasan industri Cikarang.',
  },
  {
    id: 'grp-3',
    tenant_id: 'tenant-youth',
    name: 'Shalom',
    meaning: 'Damai Sejahtera dan Ketenangan Batin',
    scripture: 'Yohanes 14:27 — "Damai sejahtera Kutinggalkan bagimu. Damai sejahtera-Ku Kuberikan kepadamu."',
    mentorNames: ['Theodore Kowaas', 'Fladyna Mondoringin'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Kamis, 19:30 WIB',
    meetingLocation: 'Jababeka Residence Cafe & Home Meeting',
    color: '#2A81FF',
    icon: 'spa',
    description: 'Kelompok persekutuan pemuda dengan fokus doa bersama, kesehatan mental rohani, dan keheningan di tengah kesibukan.',
  },
  {
    id: 'grp-4',
    tenant_id: 'tenant-youth',
    name: 'Hesed',
    meaning: 'Kasih Setia Allah yang Kekal & Rahmat Berkelanjutan',
    scripture: 'Ratapan 3:22-23 — "Tak berkesudahan kasih setia TUHAN, tak habis-habisnya rahmat-Nya, selalu baru tiap pagi."',
    mentorNames: ['Milithya Wuisan', 'Christian Lombogia'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Jumat, 20:00 WIB',
    meetingLocation: 'Ruang Doa GEHC Cikarang',
    color: '#8A2387',
    icon: 'all_inclusive',
    description: 'Menumbuhkan pemahaman doktrin kasih setia Tuhan dan ketahanan iman bagi pemuda profesional muda.',
  },
  {
    id: 'grp-5',
    tenant_id: 'tenant-youth',
    name: 'Kairos',
    meaning: 'Waktu Perkenanan dan Rencana Indah Tuhan',
    scripture: 'Pengkhotbah 3:11 — "Ia membuat segala sesuatu indah pada waktunya."',
    mentorNames: ['Michel Lonteng', 'Artjuna Timbuleng'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Rabu, 19:30 WIB',
    meetingLocation: 'Delta Silicon Fellowship Spot',
    color: '#F27121',
    icon: 'hourglass_top',
    description: 'Mendiskusikan karier, pasangan hidup, dan bagaimana merespons panggilan Tuhan di usia muda.',
  },
  {
    id: 'grp-6',
    tenant_id: 'tenant-youth',
    name: 'Logos',
    meaning: 'Firman Hidup yang Menjadi Landasan Kebenaran',
    scripture: 'Yohanes 1:1 — "Pada mulanya adalah Firman; Firman itu bersama-sama dengan Allah dan Firman itu adalah Allah."',
    mentorNames: ['Mighty Rengkung', 'Reiner Montolalu'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Jumat, 19:30 WIB',
    meetingLocation: 'Baitel Room GEHC & Online Hybrid',
    color: '#00B4D8',
    icon: 'menu_book',
    description: 'Komunitas pemuda yang mendalami studi Alkitab ekspositori, diskusi teologi kontekstual, dan pemuridan.',
  },
  {
    id: 'grp-7',
    tenant_id: 'tenant-youth',
    name: 'Metanoia',
    meaning: 'Pembaruan Budi dan Transformasi Hidup',
    scripture: 'Roma 12:2 — "Berubahlah oleh pembaharuan budimu, sehingga kamu dapat membedakan manakah kehendak Allah."',
    mentorNames: ['Stefanus Tambariki', 'Julivie Irot'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Sabtu, 16:30 WIB',
    meetingLocation: 'Taman Sehati Wibawa Mukti / Cafe Area',
    color: '#059669',
    icon: 'autorenew',
    description: 'Kelompok kreatif yang mendorong perubahan gaya hidup sehat, produktif, dan menjauhi pergaulan toksik.',
  },
  {
    id: 'grp-8',
    tenant_id: 'tenant-youth',
    name: 'Ruach',
    meaning: 'Nafas Roh Kudus yang Menghidupkan & Mengobarkan Semangat',
    scripture: 'Yehezkiel 37:9 — "Masuklah nafas hidup ke dalam mereka, sehingga mereka hidup kembali."',
    mentorNames: ['Krisetia Mamoto', 'Filipo Karinda'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Selasa, 20:00 WIB',
    meetingLocation: 'Ruang Musik GEHC Studio',
    color: '#7C3AED',
    icon: 'air',
    description: 'Wadah bagi pemusik, singer, worship leaders, multimedia, dan pemuda yang haus akan kebangunan rohani.',
  },
  {
    id: 'grp-9',
    tenant_id: 'tenant-youth',
    name: 'Dunamis',
    meaning: 'Kekuatan dan Kuasa Ilahi yang Dahsyat',
    scripture: 'Kisah Para Rasul 1:8 — "Tetapi kamu akan menerima kuasa, kalau Roh Kudus turun ke atas kamu, dan kamu akan menjadi saksi-Ku."',
    mentorNames: ['Jeremiah Mewengkang', 'Patrisha Lengkey'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Sabtu, 18:30 WIB',
    meetingLocation: 'Cikarang Baru Center Court',
    color: '#DC2626',
    icon: 'bolt',
    description: 'Pengembangan talenta kepemimpinan, misi penginjilan di lingkungan kampus/pabrik, dan olahraga bersama.',
  },
  {
    id: 'grp-10',
    tenant_id: 'tenant-youth',
    name: 'Echad',
    meaning: 'Kesatuan Sejati dalam Kasih Kristus',
    scripture: 'Efesus 4:3 — "Dan berusahalah memelihara kesatuan Roh oleh ikatan damai sejahtera."',
    mentorNames: ['Holly Kalele', 'Aditya Wellem'],
    mentorUserIds: [],
    memberCount: 8,
    meetingSchedule: 'Setiap Minggu, 12:30 WIB (Setelah Ibadah II)',
    meetingLocation: 'Konsistori GEHC Cikarang',
    color: '#0D9488',
    icon: 'groups',
    description: 'Fasilitator integrasi pemuda perantau baru dari berbagai daerah Minahasa, Manado, dan nusantara ke dalam gereja.',
  },
];

export const INITIAL_MEMBERS: GroupMember[] = [
  {
    id: 'mbr-1',
    group_id: 'grp-6',
    name: 'Michael Pangemanan',
    email: 'michael.p@gehc.page',
    phone: '+62 856-1122-3344',
    is_mentor: true,
    joinedDate: '2024-01-15',
    attendanceRate: 98,
    notes: 'Mentor Utama Kelompok Logos. Siap mendampingi mentoring mingguan.',
  },
  {
    id: 'mbr-2',
    group_id: 'grp-6',
    name: 'Andrea Sondakh',
    email: 'andrea.sondakh@gmail.com',
    phone: '+62 878-1234-5678',
    is_mentor: false,
    joinedDate: '2024-02-10',
    attendanceRate: 92,
    notes: 'Aktif di tim multimedia pemuda, mahasiswa IT Cikarang.',
  },
  {
    id: 'mbr-3',
    group_id: 'grp-6',
    name: 'Timothy Lumempouw',
    email: 'timothy.l@gmail.com',
    phone: '+62 813-8899-0011',
    is_mentor: false,
    joinedDate: '2024-03-01',
    attendanceRate: 85,
    notes: 'Bekerja shift di EJIP Cikarang, butuh fleksibilitas jam persekutuan.',
  },
  {
    id: 'mbr-4',
    group_id: 'grp-6',
    name: 'Vania Roring',
    email: 'vania.roring@outlook.com',
    phone: '+62 812-7766-5544',
    is_mentor: false,
    joinedDate: '2024-02-20',
    attendanceRate: 95,
    notes: 'Penyanyi paduan suara pemuda, sangat antusias dalam PA.',
  },
  {
    id: 'mbr-5',
    group_id: 'grp-1',
    name: 'Jessica Tendean',
    email: 'jessica.t@gehc.page',
    phone: '+62 812-4455-6677',
    is_mentor: true,
    joinedDate: '2024-01-10',
    attendanceRate: 100,
    notes: 'Mentor Kelompok Avodah, koordinator diakonia pemuda.',
  },
  {
    id: 'mbr-6',
    group_id: 'grp-1',
    name: 'Samuel Palit',
    email: 'samuel.palit@gmail.com',
    phone: '+62 812-8877-6655',
    is_mentor: false,
    joinedDate: '2024-03-12',
    attendanceRate: 88,
    notes: 'Karyawan di GIIC Deltamas, mohon doa untuk persiapan sertifikasi profesional.',
  },
  {
    id: 'mbr-7',
    group_id: 'grp-1',
    name: 'Clara Mamahit',
    email: 'clara.m@gmail.com',
    phone: '+62 857-4433-2211',
    is_mentor: false,
    joinedDate: '2024-04-01',
    attendanceRate: 90,
    notes: 'Anggota aktif tim usher & penerima tamu ibadah pemuda.',
  },
];

export const INITIAL_MONITORING: MonitoringRecord[] = [];

export const INITIAL_CONTENT: ContentItem[] = [
  {
    id: 'cnt-bakutau',
    tenant_id: 'tenant-youth',
    type: 'ACTIVITY',
    title: 'BAKU TAU 4.0 — Bakudapa di Rantau',
    subtitle: 'Malam penyambutan mahasiswa baru di perantauan — bertemu & terhubung di GMIM Eben Haezer',
    category: 'Welcome Night',
    published_at: '2026-08-20',
    event_date: '2026-09-12',
    is_featured_event: true,
    location_detail: 'GMIM Eben Haezer Cikarang · 15.00 WIB',
    is_published: true,
    author: 'Komisi Pemuda GEHC',
    bannerUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1200&auto=format&fit=crop',
    tags: ['BAKU TAU', 'Welcome', 'President University', 'Community'],
    body: `BAKU TAU berasal dari bahasa Manado: BAKUdapa di ranTAU — "saling mengenal di perantauan". Malam perkenalan tahunan ini menyambut mahasiswa baru President University agar tidak sendirian menempuh masa studi di Cikarang. Kenali sepuluh kelompok mentoring kami, temukan rumah pertumbuhan imanmu, dan mulai perjalanan Beyond the Sunday Walk bersama kami.`,
  },

];

/**
 * Struktur organisasi berbasis PANTATUGAS (Liturgia, Didaskalia, Koinonia,
 * Diakonia, Marturia) + Penopang.
 *
 * Nama ASLI komite retreat 2026 sudah di-seed (BOD + PIC per divisi).
 * Posisi yang belum ada namanya ditandai isOpenRole: tampil sebagai
 * struktur terbuka, bukan orang palsu. Sub-divisi extensible via portal.
 */
const PERIODE = 'Periode Pelayanan 2025 - 2029';
const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1b1b1b`;

export const INITIAL_STRUKTUR: StrukturMember[] = [
  // ---- BPMJ — Badan Pekerja Majelis Jemaat (nama asli, payung tertinggi) ----
  { id: 'st-bpmj-1', name: 'Pdt Meyke Poluan Sth Mpdk', position: 'Ketua BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Meyke Poluan'), bio: 'Payung tertinggi pelayanan pemuda; seluruh komisi bertanggung jawab kepada Ketua BPMJ.', phone: '', email: '', order: 1 },
  { id: 'st-bpmj-2', name: 'Pnt Veky Lengkong', position: 'Wakil Ketua BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Veky Lengkong'), bio: '', phone: '', email: '', order: 2 },
  { id: 'st-bpmj-3', name: 'Pnt Noldy Wanget', position: 'Sekretaris BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Noldy Wanget'), bio: '', phone: '', email: '', order: 3 },
  { id: 'st-bpmj-4', name: 'Pnt Nofri Raco', position: 'Wakil Sekretaris BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Nofri Raco'), bio: '', phone: '', email: '', order: 4 },
  { id: 'st-bpmj-5', name: 'Dkn Selfi Lumbu', position: 'Bendahara BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Selfi Lumbu'), bio: '', phone: '', email: '', order: 5 },
  { id: 'st-bpmj-6', name: 'Dkn Bonny Rondonuwu', position: 'Anggota Bendahara BPMJ', division: 'BPMJ', period: PERIODE, photoUrl: avatar('Bonny Rondonuwu'), bio: '', phone: '', email: '', order: 6 },

  // ---- Komisi Pemuda — dipimpin Penatua Pemuda (periode 5 tahun) ----
  { id: 'st-komisi-1', name: 'Pnt Stevania Hadinda', position: 'Chairperson — Penatua Pemuda / Ketua Komisi', division: 'KOMISI', period: PERIODE, photoUrl: avatar('Stevania Hadinda'), bio: 'Memimpin Komisi Pemuda periode 2025–2029 dan mengawal arah pelayanan Beyonders; bertanggung jawab kepada BPMJ.', phone: '', email: '', order: 7 },
  { id: 'st-komisi-2', name: 'Kevin Moniaga', position: 'Wakil Ketua Komisi', division: 'KOMISI', period: PERIODE, photoUrl: avatar('Kevin Moniaga'), bio: 'Menemani ketua dan mengawal operasional program komisi.', phone: '', email: '', order: 8 },
  { id: 'st-komisi-3', name: 'Glenity Siauw', position: 'Secretary — Sekretaris Komisi', division: 'KOMISI', period: PERIODE, photoUrl: avatar('Glenity Siauw'), bio: 'Administrasi, notulen, dan surat-menyurat komisi. Rangkap mentee Metanoia.', phone: '', email: '', order: 9 },
  { id: 'st-komisi-4', name: 'Rendy Lumintang', position: 'Treasurer — Bendahara Komisi', division: 'KOMISI', period: PERIODE, photoUrl: avatar('Rendy Lumintang'), bio: 'Mengelola kas komisi dan pertanggungjawaban keuangan.', phone: '', email: '', order: 10 },

  // ---- BOD Tim Kerja — pelaksara program di bawah Komisi ----
  { id: 'st-timkerja-1', name: 'Theodore Beckham Milano Kowaas', position: 'Ketua Tim Kerja', division: 'TIMKERJA', period: PERIODE, photoUrl: avatar('Theodore Kowaas'), bio: 'Memimpin Tim Kerja yang mengerjakan program pelayanan pemua; membawahi 5 Panca Tugas + Benzarpreneurship.', phone: '', email: '', order: 11 },
  { id: 'st-timkerja-2', name: 'Zhanon Varelie Lausan', position: 'Sekretaris Tim Kerja', division: 'TIMKERJA', period: PERIODE, photoUrl: avatar('Zhanon Lausan'), bio: 'Administrasi tim kerja; rangkap mentor Avodah.', phone: '', email: '', order: 12 },
  { id: 'st-timkerja-3', name: 'Milithya Christy Kerin Wuisan', position: 'Bendahara Tim Kerja', division: 'TIMKERJA', period: PERIODE, photoUrl: avatar('Milithya Wuisan'), bio: 'Keuangan tim kerja; rangkap mentor Hesed.', phone: '', email: '', order: 13 },

  // ---- KOINONIA (termasuk ex-Penopang: acara/rundown & usaha dana dipindah) ----
  { id: 'st-koi-1', name: 'Program Persekutuan', position: 'Games & Bonding', division: 'KOINONIA', subdivision: 'Program Persekutuan', period: PERIODE, photoUrl: avatar('Persekutuan'), bio: 'Merancang momen persekutuan, games, ice breaking, dan bonding night.', phone: '', email: '', order: 14, isOpenRole: true },
  { id: 'st-koi-2', name: 'Krisetia Mamoto', position: 'PIC Acara & Rundown', division: 'KOINONIA', subdivision: 'Program Persekutuan', period: PERIODE, photoUrl: avatar('Krisetia Mamoto'), bio: 'Mengkonsep rundown keseluruhan kegiatan pra-during-pasca retreat; koordinator acara di bawah Program Persekutuan.', phone: '', email: '', order: 15 },
  { id: 'st-koi-3', name: 'Public Relations (PR)', position: 'Follow-up, MC & Media Sosial', division: 'KOINONIA', subdivision: 'Public Relations (PR)', period: PERIODE, photoUrl: avatar('PR Koinonia'), bio: 'Follow-up newcomer & anggota, MC acara, update media sosial, komunikasi internal-eksternal. Jembatan ke Placement Recommender (Jethro Engine).', phone: '', email: '', order: 16, isOpenRole: true },

  // ---- LITURGIA ----
  { id: 'st-lit-1', name: 'Holly Kalele', position: 'PIC Ibadah — Worship & Personel Liturgi', division: 'LITURGIA', subdivision: 'Liturgi & Musik', period: PERIODE, photoUrl: avatar('Holly Kalele'), bio: 'Mengatur liturgi ibadah, worship leader, pemazmur, dan personel pelayanan ibadah.', phone: '', email: '', order: 17 },
  { id: 'st-lit-2', name: 'Pendoa', position: 'Koordinator Doa', division: 'LITURGIA', subdivision: 'Pendoa', period: PERIODE, photoUrl: avatar('Pendoa'), bio: 'Doa khusus untuk orang sakit, ulang tahun, dan doa berjenjang pada rangkaian acara.', phone: '', email: '', order: 18, isOpenRole: true },
  { id: 'st-lit-3', name: 'Intercessor', position: 'Intercessor Pra-During-Pasca', division: 'LITURGIA', subdivision: 'Intercessor', period: PERIODE, photoUrl: avatar('Intercessor'), bio: 'Tim doa yang menaungi seluruh rangkaian retreat dari awal hingga tuntas.', phone: '', email: '', order: 19, isOpenRole: true },

  // ---- DIDASKALIA ----
  { id: 'st-did-1', name: 'Tim Penyusun Modul', position: 'Penyusun Modul & Kurikulum', division: 'DIDASKALIA', subdivision: 'Kurikulum & Pembekalan', period: PERIODE, photoUrl: avatar('Kurikulum Pembekalan'), bio: 'Menyusun modul pembekalan mentor-comentor dan kurikulum pemuridan.', phone: '', email: '', order: 20, isOpenRole: true },
  { id: 'st-did-2', name: 'Putri Massie', position: 'Main Speaker — Pembekal Mentor & Comentor', division: 'DIDASKALIA', subdivision: 'Kurikulum & Pembekalan', period: PERIODE, photoUrl: avatar('Putri Massie'), bio: 'Fasilitator utama pembekalan mentor, comentor, dan mentee. Rangkap mentee Ruach.', phone: '', email: '', order: 21 },
  { id: 'st-did-3', name: 'Alvandi Saerang', position: 'Main Speaker — Pembekal Mentor & Comentor', division: 'DIDASKALIA', subdivision: 'Kurikulum & Pembekalan', period: PERIODE, photoUrl: avatar('Alvandi Saerang'), bio: 'Fasilitator pembekalan bersama Putri. Rangkap mentee Logos.', phone: '', email: '', order: 22 },

  // ---- DIAKONIA ----
  { id: 'st-dia-1', name: 'Prichel Kampong', position: 'PIC Logistik — Akomodasi & Peralatan', division: 'DIAKONIA', subdivision: 'Logistik & Akomodasi', period: PERIODE, photoUrl: avatar('Prichel Kampong'), bio: 'Menyediakan akomodasi dan seluruh peralatan kegiatan.', phone: '', email: '', order: 23 },
  { id: 'st-dia-2', name: 'Artjuna Timbuleng', position: 'PIC Konsumsi — Vendor & Self-Made', division: 'DIAKONIA', subdivision: 'Konsumsi', period: PERIODE, photoUrl: avatar('Artjuna Timbuleng'), bio: 'Skema konsumesi peserta baik melalui vendor maupun mandiri.', phone: '', email: '', order: 24 },
  { id: 'st-dia-3', name: 'Medis & First Aid', position: 'First Aid & Kesehatan', division: 'DIAKONIA', subdivision: 'Medis & First Aid', period: PERIODE, photoUrl: avatar('Medis First Aid'), bio: 'Tim kesehatan dan pertolongan pertama selama kegiatan berlangsung.', phone: '', email: '', order: 25, isOpenRole: true },

  // ---- MARTURIA ----
  { id: 'st-mar-1', name: 'Dokumentasi', position: 'Foto & Video', division: 'MARTURIA', subdivision: 'Dokumentasi', period: PERIODE, photoUrl: avatar('Dokumentasi'), bio: 'Merekam kesaksian apa yang Tuhan kerjakan di setiap kegiatan.', phone: '', email: '', order: 26, isOpenRole: true },
  { id: 'st-mar-2', name: 'Gievara Bogar', position: 'PIC MTDD — Multimedia, Dokumentasi & Publikasi', division: 'MARTURIA', subdivision: 'Desain & Publikasi', period: PERIODE, photoUrl: avatar('Gievara Bogar'), bio: 'Desain promosi, PPT ibadah, dokumentasi, dan publikasi digital di semua fase retreat.', phone: '', email: '', order: 27 },
  { id: 'st-mar-4', name: 'Penginjilan Praktis', position: 'Perlengkapan & Pelatihan Injili', division: 'MARTURIA', subdivision: 'Penginjilan Praktis', period: PERIODE, photoUrl: avatar('Penginjilan'), bio: 'Memperlengkapi cara menginjil dan mengajak melakukan penginjilan praktis.', phone: '', email: '', order: 28, isOpenRole: true },

  // ---- BENZARPRENEURSHIP (BZP) — usaha & dana di bawah Tim Kerja ----
  { id: 'st-bzp-1', name: 'Fladyna Mondoringin', position: 'Kepala Benzarpreneurship (BZP)', division: 'BENZARPR', period: PERIODE, photoUrl: avatar('Fladyna Mondoringin'), bio: 'Bertanggung jawab penuh atas BZP: merchandise, fundraising, dan donation. Melapor kepada Bendahara Komisi/Tim Kerja.', phone: '', email: '', order: 29 },
  { id: 'st-bzp-2', name: 'Merchandise — Eben Haezer Goods', position: 'Produksi & Penjualan Merchandise', division: 'BENZARPR', subdivision: 'Merchandise', period: PERIODE, photoUrl: avatar('Merchandise BZP'), bio: 'Produksi dan penjualan merchandise sebagai identitas & alat kesaksian.', phone: '', email: '', order: 30, isOpenRole: true },
  { id: 'st-bzp-3', name: 'Fundraising', position: 'Usaha Dana & Penggalangan Dana', division: 'BENZARPR', subdivision: 'Fundraising', period: PERIODE, photoUrl: avatar('Fundraising BZP'), bio: 'Penjualan makan-minum mingguan & penggalangan dana program pelayanan.', phone: '', email: '', order: 31, isOpenRole: true },
  { id: 'st-bzp-4', name: 'Donation', position: 'Pengelolaan Persembahan & Donasi', division: 'BENZARPR', subdivision: 'Donation', period: PERIODE, photoUrl: avatar('Donation BZP'), bio: 'Pengelolaan persembahan & donasi khusus untuk program pelayanan pemuda.', phone: '', email: '', order: 32, isOpenRole: true },
];

export const INITIAL_DRIVE_FOLDERS: DriveFolder[] = [];

export const INITIAL_INTEGRATION_CONFIG: IntegrationConfig = {
  id: 'int-1',
  tenant_id: 'tenant-youth',
  provider: 'GOOGLE_DRIVE',
  is_connected: false,
  account_email: '',
  root_folder_id: '',
  root_folder_name: 'GEHC Youth — Google Drive',
  last_synced: new Date().toISOString(),
  allowed_mime_types: [],
} as IntegrationConfig;

// Data struktur mentoring asli — sumber: "Retreat Attendance_GEHC YOUTH 2026.xlsx"
export const INITIAL_GROUP_BATCHES: GroupBatch[] = [
  {
    id: 'bat-2026-shalom',
    group_id: 'grp-3',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Theodore Kowaas',
    comentor: 'Fladyna Mondoringin',
    mentees: [
      { name: 'Jessica Poyoh' },
      { name: 'Gemma Montol' },
      { name: 'Riska Sajow' },
      { name: 'Gabriel Lintong' },
      { name: 'Kimberly Turambi' },
      { name: 'Kevin Budianto' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-avodah',
    group_id: 'grp-1',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Zhanon Lausan',
    comentor: 'Farendy Lumintang',
    mentees: [
      { name: 'Clay Langi' },
      { name: 'Michelle Watung' },
      { name: 'Ario Semet' },
      { name: 'Ivanna Pande' },
      { name: 'Jeremy Walangitan' },
      { name: 'Kimmy Casey Liogu' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-echad',
    group_id: 'grp-10',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Holly Kalele',
    comentor: 'Aditya Wellem',
    mentees: [
      { name: 'Timoty Wewengkang' },
      { name: 'Virginia Parera' },
      { name: 'Nicole Naray' },
      { name: 'Chelsea Tjheuw' },
      { name: 'Daud Lumanauw' },
      { name: 'Pnt. Kevin Kamagi', note: '(G)' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-ruach',
    group_id: 'grp-8',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Krisetia Mamoto',
    comentor: 'Filipo Karinda',
    mentees: [
      { name: 'Lucky Losu' },
      { name: 'Shien Siauw' },
      { name: 'Soneta Imanuela' },
      { name: 'Lorenzo Ricsamana' },
      { name: 'Mega Welan' },
      { name: 'Putri Massie', note: '(G)' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-hesed',
    group_id: 'grp-4',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Milithya Wuisan',
    comentor: 'Christian Lombogia',
    mentees: [
      { name: 'Nelcy Lodarmase' },
      { name: 'Marhaen Manus' },
      { name: 'Aurellia Hillary' },
      { name: 'Yohana Doga' },
      { name: 'Akwila Gente' },
      { name: 'Timothy Mewengkang' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-dunamis',
    group_id: 'grp-9',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Jeremiah Mewengkang',
    comentor: 'Patrisha Lengkey',
    mentees: [
      { name: 'Lovely Pantouw' },
      { name: 'Agnes Reimas' },
      { name: 'Thea Sanger' },
      { name: 'Febrian Evander' },
      { name: 'Avriel Singal' },
      { name: 'Imanuel Yimna Esau' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-agape',
    group_id: 'grp-2',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Prichel Kampong',
    comentor: 'Syallomitha Mawitjere',
    mentees: [
      { name: 'Jilova Pakasi' },
      { name: 'Jeconia Wanget' },
      { name: 'Natalie Musak' },
      { name: 'Cia Worung' },
      { name: 'Hoky Theos' },
      { name: 'Kezia Joseph' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-kairos',
    group_id: 'grp-5',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Michel Lonteng',
    comentor: 'Artjuna Timbuleng',
    mentees: [
      { name: 'Injilia Oroh' },
      { name: 'Marshal Maramis' },
      { name: 'Reywin Rengkuan' },
      { name: 'Angelita Entjaurau' },
      { name: 'Resty Budianto' },
      { name: 'David Pesoth' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-metanoia',
    group_id: 'grp-7',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Stefanus Tambariki',
    comentor: 'Julivie Irot',
    mentees: [
      { name: 'Gievara Bogar' },
      { name: 'Shanella Mondong' },
      { name: 'Glenity Siauw' },
      { name: 'Lingkan Pinontoan' },
      { name: 'Jonathan Tintingon' },
      { name: 'Yuen Pajow' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
  {
    id: 'bat-2026-logos',
    group_id: 'grp-6',
    batchLabel: 'Batch 2026 — Retreat UNSHAKABLE',
    period: '2026',
    mentor: 'Mighty Rengkung',
    comentor: 'Reiner Montolalu',
    mentees: [
      { name: 'Jeconia Luwuk' },
      { name: 'Trivena Rattu' },
      { name: 'Diferd Wuri' },
      { name: 'Gracia Laura' },
      { name: 'Jacqson Naharia' },
      { name: 'Alvandi Saerang', note: '(G)' },
    ],
    theme: 'UNSHAKABLE — Highland Camp Puncak, 18-19 Juli 2026',
    isCurrent: true,
  },
];
