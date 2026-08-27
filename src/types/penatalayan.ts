export interface ServiceRole {
  id: string;
  name: string;
  division: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceSchedule {
  id: string;
  serviceRoleId: string;
  userId: string;
  eventId?: string | null;
  date: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  status: 'SCHEDULED' | 'CONFIRMED' | 'DONE' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceRole?: ServiceRole;
  user?: { id: string; name: string; email?: string };
}

export interface DivisionMeeting {
  id: string;
  division: string;
  meetingDate: string;
  title?: string | null;
  agenda: AgendaEntry[];
  attendees: AttendeeEntry[];
  notes?: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
  updatedAt: string;
  agendaItems?: DivisionAgendaItem[];
}

export interface AgendaEntry {
  topic: string;
  lead?: string;
  output?: string;
  deadline?: string;
}

export interface AttendeeEntry {
  userId: string;
  role?: string;
}

export interface DivisionAgendaItem {
  id: string;
  meetingId: string;
  title: string;
  description?: string | null;
  division: string;
  component?: string | null;
  personInChargeId?: string | null;
  deadline?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  driveFolderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Dijadwalkan',
  CONFIRMED: 'Dikonfirmasi',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const SERVICE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CONFIRMED: { bg: 'bg-green-100', text: 'text-green-700' },
  DONE: { bg: 'bg-gray-100', text: 'text-gray-600' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-600' },
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Dijadwalkan',
  IN_PROGRESS: 'Berlangsung',
  DONE: 'Selesai',
};

export const AGENDA_STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  DONE: 'Done',
};

export const AGENDA_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  TODO: { bg: 'bg-gray-100', text: 'text-gray-700' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700' },
};
