export type UserRole = 'SUPERADMIN' | 'COMMITTEE' | 'MENTOR' | 'MENTI';

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
  groupId?: string; // If role is MENTOR or MENTI, bound to specific group
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  phone?: string;
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
  is_published: boolean;
  author: string;
  scripture?: string;
  schedule?: string;
  location?: string;
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
  period: string;
  photoUrl: string;
  bio: string;
  phone: string;
  email: string;
  order: number;
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
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
