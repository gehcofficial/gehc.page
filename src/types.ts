export type UserRole =
  | 'SUPERADMIN'
  | 'BPMJ'
  | 'KOMISI'
  | 'COMMITTEE'
  | 'MENTOR'
  | 'CO_MENTOR'
  | 'MENTEE'
  | 'ALUMNI';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  badge: string;
  description: string;
  is_active: boolean;
}

export interface UserRoleMapping {
  tenantId: string;
  role: UserRole;
  groupId?: string; // If role is MENTOR or MENTEE, bound to specific group
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  phone?: string;
  /** ACTIVE (lolos approval) atau PENDING (menunggu Komisi) */
  accountStatus?: 'ACTIVE' | 'PENDING' | (string & {});
  /** Onboarding pipeline status */
  onboardingStatus?: 'WAITING_POOL' | 'PENDING' | 'ACTIVE' | (string & {});
  /** ORGANIC self-register vs INVITED pre-provision */
  onboardingPath?: 'ORGANIC' | 'INVITED' | (string & {});
  loginUsername?: string | null;
  hasPassword?: boolean;
  googleLinked?: boolean;
  /** Gift test top 5 results */
  giftsTop5?: string[];
  isBeyonders?: boolean;
  mustChangePassword?: boolean;
  roles: UserRoleMapping[];
}

export interface YouthGroup {
  id: string;
  tenant_id: string;
  name: string;
  meaning: string;
  scripture: string;
  mentorNames: string[];
  mentorUserIds: string[];
  memberCount: number;
  meetingSchedule: string;
  meetingLocation: string;
  color: string;
  icon: string;
  description: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  name: string;
  email: string;
  phone: string;
  is_mentor: boolean;
  joinedDate: string;
  attendanceRate: number; // e.g. 92%
  notes?: string;
  familyRole?: string;
  batchPeriod?: string;
}

export interface MonitoringData {
  attendanceCount: number;
  totalMembers: number;
  meetingTopic: string;
  spiritualTemperature: 'Sangat Baik' | 'Baik' | 'Perlu Perhatian' | 'Kurang Aktif';
  prayerRequests: string;
  followUpsNeeded: string;
  fellowshipActivity?: string;
  offeringAmount?: number;
  customNotes?: string;
}

export interface MonitoringRecord {
  id: string;
  group_id: string;
  group_name: string;
  mentor_id: string;
  mentor_name: string;
  date: string;
  data: MonitoringData;
  created_at: string;
}

export type ContentType = 'WEEKLY_INFO' | 'ACTIVITY';

export interface ContentItem {
  id: string;
  tenant_id: string;
  type: ContentType;
  title: string;
  subtitle?: string;
  body: string;
  category: string;
  published_at: string;
  /** Tanggal kegiatan (untuk timeline events); fallback ke published_at */
  event_date?: string;
  location?: string;
  is_featured_event?: boolean;
  is_published: boolean;
  author: string;
  scripture?: string;
  schedule?: string;
  location_detail?: string;
  targetAudience?: string;
  bannerUrl: string;
  pdfUrl?: string;
  tags: string[];
}

export interface StrukturMember {
  id: string;
  name: string;
  position: string;
  division: string;
  /** Sub-divisi teknis di bawah pantatugas (mis. "Pendoa" di bawah Liturgia) */
  subdivision?: string;
  period: string;
  photoUrl: string;
  bio: string;
  phone: string;
  email: string;
  order: number;
  /** true = posisi terbuka (belum ada nama) — tampil sebagai struktur, bukan orang */
  isOpenRole?: boolean;

  // NEW: Role hierarchy fields (Phase 6)
  /** Peran organisasi: MENTOR, CO_MENTOR, MENTEE, ALUMNI, COMMITTEE, KOMISI, BPMJ */
  role?: 'MENTOR' | 'CO_MENTOR' | 'MENTEE' | 'ALUMNI' | 'COMMITTEE' | 'KOMISI' | 'BPMJ';
  /** Urutan dalam hirarki peran (semakin kecil = semakin atas) */
  roleOrder?: number;
  /** Apakah memegang dobel peran (mis. Mentor + PIC Sub-Divisi) */
  isDoubleRole?: boolean;
  /** ID sub-role jika ada (mis. PIC Konsumsi di bawah DIAKONIA) */
  subRoleId?: string;
  /** ID grup mentoring (jika peran MENTOR/CO_MENTOR) */
  groupId?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  itemCount: number;
  lastModified: string;
  url: string;
}

export interface IntegrationConfig {
  id: string;
  tenant_id: string;
  provider: 'GOOGLE_DRIVE';
  is_connected: boolean;
  account_email: string;
  root_folder_id: string;
  root_folder_name: string;
  last_synced: string;
  last_synced_at?: string;
  allowed_mime_types: string[];
}

export type FamilyRole = 'MENTOR' | 'COMENTOR' | 'MENTEE';

export interface FamilyNode {
  name: string;
  role: FamilyRole;
  note?: string; // contoh: "(G)" guest / online
}

export interface GroupBatch {
  id: string;
  group_id: string;
  batchLabel: string; // "Batch 2026 — Retreat UNSHAKABLE"
  period: string; // "2026"
  mentor: string;
  comentor: string;
  mentees: { name: string; note?: string }[];
  theme?: string;
  isCurrent?: boolean;
}

export interface DriveMediaItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  /** Versi resolusi tinggi (±1200px) hasil rewrite parameter ukuran Google. */
  thumbnailUrl?: string;
  webViewLink?: string;
  iconLink?: string;
  createdTime?: string;
  folderName?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
