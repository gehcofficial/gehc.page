import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
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
  UserRole,
  UserRoleMapping,
  ToastMessage,
} from '../types';
import {
  INITIAL_TENANTS,
  INITIAL_USERS,
  INITIAL_GROUPS,
  INITIAL_MEMBERS,
  INITIAL_MONITORING,
  INITIAL_CONTENT,
  INITIAL_STRUKTUR,
  INITIAL_DRIVE_FOLDERS,
  INITIAL_INTEGRATION_CONFIG,
  INITIAL_GROUP_BATCHES,
} from '../data/initialData';
import { fetchAuthConfig, fetchMe, loginWithGoogle, logout as logoutApi, fetchPersonas, impersonate as impersonateApi } from '../services/authApi';
import { effectiveRole, sortRoles, uniqueRolesByName } from '../lib/roles';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { tabFromHash as tabFromHashRoute, LEGACY_HASH_MAP, eventSlugFromHash } from '../app/routes';
import { parseHashRoute } from '../lib/hash-routes';

type PublicTab =
  | 'beyonders'
  | 'leaders'
  | 'events'
  | 'bulletin'
  | 'join'
  | 'login'
  | 'register'
  | 'event-signup'
  | 'group-detail'
  | 'benzarpreneurship';

interface AppContextType {
  // Navigation & Tenant
  currentTenant: Tenant;
  allTenants: Tenant[];
  switchTenant: (tenantId: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  publicTab: PublicTab;
  setPublicTab: (tab: PublicTab | string, opts?: { eventSlug?: string }) => void;
  eventSlug?: string;
  selectedGroupId: string | null;
  openGroupDetail: (groupId: string) => void;
  closeGroupDetail: () => void;

  // Authentication & RBAC
  currentUser: User;
  currentRole: UserRole;
  setCurrentUserById: (userId: string) => void;
  userAssignedGroupId?: string;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isKomisi: boolean;
  isBpmj: boolean;
  isMentor: boolean;
  isCoMentor: boolean;
  isGroupMentor: boolean;
  isMentee: boolean;
  isAlumni: boolean;
  canAccess: (resource: 'settings_users' | 'settings_integrations' | 'content_manage' | 'groups_all' | 'group_monitoring_write' | 'struktur_manage', groupId?: string) => boolean;

  // Google SSO nyata (server-backed)
  authUser: User | null;
  authLoading: boolean;
  ssoClientId: string | null;
  loginWithCredential: (credential: string) => Promise<void>;
  logoutSso: () => Promise<void>;
  /** true jika persona switcher memakai akun dummy dari TiDB */
  demoMode: boolean;
  sessionSource: 'google' | 'demo' | null;

  // Multi-role (rangkap jabatan)
  myRoleOptions: UserRole[];
  setActiveUserRole: (role: UserRole) => void;

  // Data Collections
  groups: YouthGroup[];
  members: GroupMember[];
  monitoringRecords: MonitoringRecord[];
  contentItems: ContentItem[];
  strukturMembers: StrukturMember[];
  driveFolders: DriveFolder[];
  groupBatches: GroupBatch[];
  integrationConfig: IntegrationConfig;
  allUsers: User[];

  // Content Operations (CMS)
  addContentItem: (item: Omit<ContentItem, 'id' | 'published_at'>) => void;
  updateContentItem: (id: string, updates: Partial<ContentItem>) => void;
  deleteContentItem: (id: string) => void;

  // Monitoring Operations
  submitMonitoringRecord: (record: Omit<MonitoringRecord, 'id' | 'created_at'>) => void;
  deleteMonitoringRecord: (id: string) => void;

  // Group Member Operations
  addGroupMember: (member: Omit<GroupMember, 'id' | 'joinedDate'>) => void;
  updateGroupMember: (id: string, updates: Partial<GroupMember>) => void;
  deleteGroupMember: (id: string) => void;

  // Struktur Operations
  addStrukturMember: (member: Omit<StrukturMember, 'id'>) => void;
  updateStrukturMember: (id: string, updates: Partial<StrukturMember>) => void;
  deleteStrukturMember: (id: string) => void;

  // Integration Operations
  updateIntegrationConfig: (updates: Partial<IntegrationConfig>) => void;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => void;
  selectDriveRootFolder: (folderId: string) => void;

  // User RBAC Operations
  updateUserRole: (userId: string, tenantId: string, newRole: UserRole, groupId?: string) => void;
  addNewUser: (user: Omit<User, 'id'>) => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Reset Data
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TENANTS: 'gehc_tenants_v1',
  USERS: 'gehc_users_v2',
  CURRENT_USER_ID: 'gehc_current_user_id_v2',
  GROUPS: 'gehc_groups_v1',
  MEMBERS: 'gehc_members_v1',
  MONITORING: 'gehc_monitoring_v1',
  CONTENT: 'gehc_content_v1',
  STRUKTUR: 'gehc_struktur_v2',
  INTEGRATION: 'gehc_integration_v1',
  GROUP_BATCHES: 'gehc_group_batches_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State — hash routing (#/beyonders, #/leaders, #/events, #/bulletin)
  const [activeView, setActiveView] = useState<string>('public'); // 'public' | 'portal'
  const TAB_IDS = ['beyonders', 'leaders', 'events', 'bulletin', 'join', 'login', 'register', 'event-signup', 'benzarpreneurship', 'group-detail'] as const;
  const tabFromHash = (): PublicTab => {
    const parsed = parseHashRoute();
    if (parsed.tab === 'group-detail') return 'group-detail';
    if ((TAB_IDS as readonly string[]).includes(parsed.tab)) return parsed.tab as PublicTab;
    return tabFromHashRoute(window.location.hash) as PublicTab;
  };

  const [publicTab, setPublicTabState] = useState<PublicTab>(tabFromHash);
  const [eventSlug, setEventSlug] = useState<string | undefined>(() => eventSlugFromHash(window.location.hash) || parseHashRoute().eventSlug);

  const setPublicTab = (tab: PublicTab | string, opts?: { eventSlug?: string }) => {
    const raw = String(tab);
    const canonical = (
      LEGACY_HASH_MAP[raw] ||
      ((TAB_IDS as readonly string[]).includes(raw) ? raw : 'beyonders')
    ) as PublicTab;
    setPublicTabState(canonical);
    if (canonical === 'event-signup') {
      const slug = opts?.eventSlug || eventSlug || 'bakutau';
      setEventSlug(slug);
      window.location.hash = `#/event/${slug}`;
    } else if (canonical !== 'group-detail') {
      window.location.hash = `#/${canonical}`;
    }
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onHash = () => {
      setPublicTabState(tabFromHash());
      setEventSlug(eventSlugFromHash(window.location.hash) || parseHashRoute().eventSlug);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string>('tenant-youth');

  // Load Persisted Data or Fallback
  const [allTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TENANTS);
    return saved ? JSON.parse(saved) : INITIAL_TENANTS;
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    return saved || 'usr-tech'; // Default: persona pertama (Tim Tech / SUPERADMIN)
  });

  const [groups, setGroups] = useState<YouthGroup[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const [members, setMembers] = useState<GroupMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [monitoringRecords, setMonitoringRecords] = useState<MonitoringRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MONITORING);
    return saved ? JSON.parse(saved) : INITIAL_MONITORING;
  });

  const [contentItems, setContentItems] = useState<ContentItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTENT);
    return saved ? JSON.parse(saved) : INITIAL_CONTENT;
  });

  const [strukturMembers, setStrukturMembers] = useState<StrukturMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STRUKTUR);
    return saved ? JSON.parse(saved) : INITIAL_STRUKTUR;
  });

  const [driveFolders] = useState<DriveFolder[]>(INITIAL_DRIVE_FOLDERS);

  const [groupBatches, setGroupBatches] = useState<GroupBatch[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GROUP_BATCHES);
    return saved ? JSON.parse(saved) : INITIAL_GROUP_BATCHES;
  });

  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INTEGRATION);
    return saved ? JSON.parse(saved) : INITIAL_INTEGRATION_CONFIG;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persistent storage sync
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MONITORING, JSON.stringify(monitoringRecords));
  }, [monitoringRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTENT, JSON.stringify(contentItems));
  }, [contentItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STRUKTUR, JSON.stringify(strukturMembers));
  }, [strukturMembers]);

  // Hydration API-first: struktur resmi = TiDB. Menimpa localStorage lama
  // sehingga panel & semua konsumen context selalu sinkron dengan seed terbaru.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/db/struktur')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled || !Array.isArray(d.members) || d.members.length === 0) return;
        const mapped: StrukturMember[] = d.members.map((m: any) => ({
          ...m,
          order: typeof m.order === 'number' ? m.order : Number(m.sortOrder ?? 0),
        }));
        setStrukturMembers(mapped);
      })
      .catch(() => {
        /* server tidak tersedia → pertahankan data lokal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydration API-first: warta & kegiatan dari TiDB (content_items).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/content/public')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled || !Array.isArray(d.items)) return;
        if (d.items.length > 0) setContentItems(d.items);
      })
      .catch(() => {
        /* server tidak tersedia → pertahankan data lokal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydration API-first: kelompok + batch mentoring + anggota dari TiDB.
  // Menimpa localStorage lama agar panel Monitoring/family tree selalu sinkron
  // dengan seed terbaru (nama orang asli tetap dari database).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/db/groups');
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled || !Array.isArray(d.groups)) return;

        const gMapped: YouthGroup[] = [];
        const bMapped: GroupBatch[] = [];
        const mMap = new Map<string, any>();

        for (const g of d.groups) {
          gMapped.push({
            ...(g as any),
            tenant_id: g.tenantId || 'tenant-youth',
            mentorNames: [],
            mentorUserIds: [],
          });
          for (const b of g.batches || []) {
            bMapped.push({
              id: b.id,
              group_id: g.id,
              batchLabel: b.batchLabel ?? '',
              period: String(b.period ?? ''),
              mentor: b.mentorName ?? '',
              comentor: b.comentorName ?? '',
              theme: b.theme ?? '',
              isCurrent: !!b.isCurrent,
              mentees: [],
            });
          }
          for (const m of g.members || []) {
            mMap.set(m.id, {
              id: m.id,
              group_id: g.id,
              name: m.name,
              email: m.email || undefined,
              phone: m.phone || undefined,
              is_mentor: String(m.familyRole || '').toUpperCase() !== 'MENTEE',
              joinedDate: String(m.createdAt || '').slice(0, 10),
              attendanceRate: m.attendanceRate ?? 0,
              notes: m.notes || undefined,
              familyRole: m.familyRole,
              batchPeriod: m.batchPeriod ? String(m.batchPeriod) : undefined,
            });
          }
        }

        // Sisipkan mentee ke batch-nya (kunci: groupId|period)
        const byKey = new Map(bMapped.map((b) => [`${b.group_id}|${b.period}`, b]));
        for (const m of mMap.values() as IterableIterator<any>) {
          if (String(m.familyRole || '').toUpperCase() === 'MENTEE' && m.batchPeriod) {
            const b = byKey.get(`${m.group_id}|${m.batchPeriod}`);
            if (b) b.mentees.push({ name: m.name, note: undefined });
          }
        }

        // Build members array from groupBatches (same source as landing page family tree)
        // This ensures panel & landing page show identical data
        const membersFromBatches: GroupMember[] = [];
        for (const b of bMapped) {
          // Mentor
          if (b.mentor) {
            membersFromBatches.push({
              id: `${b.id}-mentor`,
              group_id: b.group_id,
              name: b.mentor,
              email: '',
              phone: '',
              is_mentor: true,
              joinedDate: '',
              attendanceRate: 0,
              familyRole: 'MENTOR',
              batchPeriod: b.period,
            });
          }
          // Comentor
          if (b.comentor) {
            membersFromBatches.push({
              id: `${b.id}-comentor`,
              group_id: b.group_id,
              name: b.comentor,
              email: '',
              phone: '',
              is_mentor: true,
              joinedDate: '',
              attendanceRate: 0,
              familyRole: 'COMENTOR',
              batchPeriod: b.period,
            });
          }
          // Mentees
          for (let i = 0; i < b.mentees.length; i++) {
            const mt = b.mentees[i];
            membersFromBatches.push({
              id: `${b.id}-m${i + 1}`,
              group_id: b.group_id,
              name: mt.name,
              email: '',
              phone: '',
              is_mentor: false,
              joinedDate: '',
              attendanceRate: 0,
              notes: mt.note,
              familyRole: 'MENTEE',
              batchPeriod: b.period,
            });
          }
        }
        // Merge with any extra members from group_members (non-mentee, alumni, etc.)
        const batchIds = new Set(membersFromBatches.map((m) => m.id));
        for (const m of mMap.values() as IterableIterator<any>) {
          if (!batchIds.has(m.id)) {
            membersFromBatches.push(m);
          }
        }

        if (cancelled) return;
        setGroups(gMapped);
        setGroupBatches(bMapped);
        setMembers(membersFromBatches);
      } catch {
        /* offline → pertahankan data lokal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INTEGRATION, JSON.stringify(integrationConfig));
  }, [integrationConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GROUP_BATCHES, JSON.stringify(groupBatches));
  }, [groupBatches]);

  // Group Detail Navigation
  const openGroupDetail = (groupId: string) => {
    setSelectedGroupId(groupId);
    setPublicTab('group-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeGroupDetail = () => {
    setPublicTab('beyonders');
    setSelectedGroupId(null);
  };

  // Current Tenant Resolution
  const currentTenant = allTenants.find((t) => t.id === currentTenantId) || allTenants[0];

  const switchTenant = (tenantId: string) => {
    const target = allTenants.find((t) => t.id === tenantId);
    if (target) {
      setCurrentTenantId(tenantId);
      addToast({
        type: 'info',
        title: `Beralih ke Ekosistem: ${target.name}`,
        description: target.is_active
          ? 'Ekosistem aktif dimuat.'
          : 'Tenant ini adalah fondasi multi-tenant (Preview arsitektur).',
      });
    }
  };

  // Google SSO nyata (server-backed) — menimpa persona demo saat aktif
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ssoClientId, setSsoClientId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [sessionSource, setSessionSource] = useState<'google' | 'demo' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchAuthConfig();
        if (cancelled) return;
        setSsoClientId(cfg.clientId);
        if (cfg.configured) {
          const me = await fetchMe();
          if (!cancelled) setAuthUser(me);
        }
      } catch {
        // Belum login / server belum jalan → tetap mode demo
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithCredential = async (credential: string) => {
    const user = await loginWithGoogle(credential);
    setAuthUser(user);
    setSessionSource('google');
    addToast({
      type: 'success',
      title: `Login Google: ${user.name}`,
      description: 'Sesi SSO aktif — role dimuat dari TiDB.',
    });
  };

  // Akun dummy dari TiDB untuk persona switcher (staging only, gated server)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPersonas();
        if (cancelled || list.length === 0) return;
        setAllUsers(list);
        setDemoMode(true);
        const fallback = list.find((u) => u.roles.some((r) => r.role === 'SUPERADMIN')) ?? list[0];
        setCurrentUserId((prev) => (list.some((u) => u.id === prev) ? prev : fallback.id));
        const existing = await fetchMe().catch(() => null);
        if (cancelled || existing) return;
        const target = list.find((u) => u.email === fallback.email) ?? fallback;
        const u = await impersonateApi(target.email);
        if (cancelled) return;
        setAuthUser(u);
        setSessionSource('demo');
      } catch {
        // Server mati / fitur nonaktif → tetap pakai data lokal hardcoded
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logoutSso = async () => {
    await logoutApi();
    setAuthUser(null);
    setSessionSource(null);
    setCurrentUserId('usr-tech');
    addToast({ type: 'info', title: 'Logout berhasil', description: 'Kembali ke mode simulasi persona.' });
  };

  const setActiveUserRole = (role: UserRole) => {
    if (!myRoleOptions.includes(role)) return;
    setRoleOverride(role);
    const mapping = myRoleMappings.find((r) => r.role === role);
    addToast({
      type: 'info',
      title: `Konteks aktif: ${role}`,
      description: mapping?.groupId ? `Scoped ke grup ${groups.find((g) => g.id === mapping.groupId)?.name ?? mapping.groupId}.` : undefined,
    });
  };

  // User & RBAC Computation (multi-role: satu akun bisa rangkap jabatan)
  const currentUser: User =
    authUser ?? (allUsers.find((u) => u.id === currentUserId) || allUsers[0]);

  // Semua peran milik user di tenant aktif, terurut precedensi
  const myRoleMappings = sortRoles(
    uniqueRolesByName(
      currentUser.roles.filter((r) => r.tenantId === currentTenantId || r.role === 'SUPERADMIN')
    )
  );
  const myRoleOptions: UserRole[] = myRoleMappings.map((r) => r.role);

  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);
  useEffect(() => {
    setRoleOverride(null); // ganti persona/login → kembali ke peran tertinggi
  }, [currentUser.id]);

  const effectiveUserRole = effectiveRole(myRoleOptions, roleOverride);
  const currentRoleMapping: UserRoleMapping =
    myRoleMappings.find((r) => r.role === effectiveUserRole) || {
      tenantId: currentTenantId,
      role: 'MENTEE' as UserRole,
      groupId: undefined,
    };

  const currentRole: UserRole = currentRoleMapping.role;
  const userAssignedGroupId = currentRoleMapping.groupId;

  const {
    isSuperAdmin,
    isBpmj,
    isKomisi,
    isCommittee,
    isMentor,
    isCoMentor,
    isGroupMentor,
    isMentee,
    isAlumni,
  } = useRoleFlags(currentRole);

  // Strict RBAC Access Checker per revision-v2-beyonders.md (L1–L8)
  const canAccess = (
    resource:
      | 'settings_users'
      | 'settings_integrations'
      | 'content_manage'
      | 'groups_all'
      | 'group_monitoring_write'
      | 'struktur_manage',
    groupId?: string
  ): boolean => {
    switch (resource) {
      case 'settings_users':
      case 'settings_integrations':
        return isSuperAdmin || isKomisi; // L1 + Komisi integrasi
      case 'content_manage':
      case 'struktur_manage':
        return isSuperAdmin || isCommittee || isKomisi; // L1, L3, L4
      case 'groups_all':
        return isSuperAdmin || isCommittee || isKomisi || isBpmj; // BPMJ read-only dasbor
      case 'group_monitoring_write':
        if (isSuperAdmin || isCommittee || isKomisi) return true;
        if ((isMentor || isCoMentor) && userAssignedGroupId) { // L5, L6
          return !groupId || userAssignedGroupId === groupId;
        }
        return false;
      default:
        return false;
    }
  };

  const setCurrentUserById = (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(userId);
      // Staging: ganti persona = buat sesi server sungguhan sebagai akun dummy itu,
      // sehingga endpoint ber-RBAC (Jethro, absensi) langsung bisa diuji.
      if (demoMode && sessionSource !== 'google') {
        impersonateApi(target.email)
          .then((u) => {
            setAuthUser(u);
            setSessionSource('demo');
          })
          .catch(() => {});
      }
      const roleMap = target.roles.find((r) => r.tenantId === currentTenantId);
      const roleName = roleMap ? roleMap.role : 'MENTEE';
      addToast({
        type: 'success',
        title: `Login sebagai: ${target.name}`,
        description: `Peran aktif: ${roleName} ${roleMap?.groupId ? `(Grup: ${groups.find((g) => g.id === roleMap.groupId)?.name})` : ''}`,
      });
    }
  };

  // Toast System
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  // Content Operations (CMS) — optimistic local + sync TiDB
  const addContentItem = (item: Omit<ContentItem, 'id' | 'published_at'>) => {
    const tempId = `cnt-${Date.now()}`;
    const newItem: ContentItem = {
      ...item,
      id: tempId,
      published_at: new Date().toISOString().split('T')[0],
    };
    setContentItems((prev) => [newItem, ...prev]);
    addToast({
      type: 'success',
      title: 'Konten Berhasil Diterbitkan',
      description: `"${newItem.title}" kini langsung tampil di portal publik!`,
    });

    fetch('/api/content', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (d.item) {
          setContentItems((prev) => prev.map((i) => (i.id === tempId ? d.item : i)));
        }
      })
      .catch(() => {
        addToast({
          type: 'warning',
          title: 'Sinkron Server Gagal',
          description: 'Konten tersimpan lokal — login portal lalu simpan ulang untuk sinkron TiDB.',
        });
      });
  };

  const updateContentItem = (id: string, updates: Partial<ContentItem>) => {
    let mergedForSync: ContentItem | undefined;
    setContentItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };
        mergedForSync = merged;
        return merged;
      });
      return next;
    });
    addToast({
      type: 'success',
      title: 'Konten Diperbarui',
      description: 'Perubahan telah disimpan ke database.',
    });

    if (!mergedForSync) return;
    fetch(`/api/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedForSync),
    }).catch(() => {
      addToast({
        type: 'warning',
        title: 'Sinkron Server Gagal',
        description: 'Perubahan lokal belum tersinkron ke TiDB.',
      });
    });
  };

  const deleteContentItem = (id: string) => {
    setContentItems((prev) => prev.filter((item) => item.id !== id));
    addToast({
      type: 'info',
      title: 'Konten Dihapus',
      description: 'Artikel telah dihapus dari sistem.',
    });

    fetch(`/api/content/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {
      addToast({
        type: 'warning',
        title: 'Sinkron Server Gagal',
        description: 'Hapus lokal belum tersinkron ke TiDB.',
      });
    });
  };

  // Monitoring Operations
  const submitMonitoringRecord = (record: Omit<MonitoringRecord, 'id' | 'created_at'>) => {
    const newRecord: MonitoringRecord = {
      ...record,
      id: `mon-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setMonitoringRecords((prev) => [newRecord, ...prev]);
    addToast({
      type: 'success',
      title: 'Data Monitoring Berhasil Disimpan',
      description: `Laporan persekutuan ${newRecord.group_name} tanggal ${newRecord.date} telah tersimpan.`,
    });
  };

  const deleteMonitoringRecord = (id: string) => {
    setMonitoringRecords((prev) => prev.filter((rec) => rec.id !== id));
    addToast({
      type: 'info',
      title: 'Data Monitoring Dihapus',
      description: 'Laporan monitoring telah dihapus.',
    });
  };

  // Group Member Operations
  const addGroupMember = (member: Omit<GroupMember, 'id' | 'joinedDate'>) => {
    const newMember: GroupMember = {
      ...member,
      id: `mbr-${Date.now()}`,
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setMembers((prev) => [...prev, newMember]);
    // update group member count
    setGroups((prev) =>
      prev.map((g) =>
        g.id === member.group_id ? { ...g, memberCount: g.memberCount + 1 } : g
      )
    );
    addToast({
      type: 'success',
      title: 'Anggota Ditambahkan',
      description: `${newMember.name} telah terdaftar ke dalam kelompok.`,
    });
  };

  const updateGroupMember = (id: string, updates: Partial<GroupMember>) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
    addToast({
      type: 'success',
      title: 'Data Anggota Diperbarui',
    });
  };

  const deleteGroupMember = (id: string) => {
    const memberToDelete = members.find((m) => m.id === id);
    if (memberToDelete) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === memberToDelete.group_id
            ? { ...g, memberCount: Math.max(0, g.memberCount - 1) }
            : g
        )
      );
      addToast({
        type: 'info',
        title: 'Anggota Dihapus',
        description: 'Anggota telah dikeluarkan dari daftar.',
      });
    }
  };

  // Struktur Operations
  // Setiap mutasi langsung disinkronkan ke TiDB (fire-and-forget; UI tetap lokal-first).
  const syncStrukturToServer = (list: StrukturMember[]) => {
    fetch('/api/db/sync-struktur', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: list }),
    }).catch(() => {});
  };

  const addStrukturMember = (member: Omit<StrukturMember, 'id'>) => {
    const newStruktur: StrukturMember = {
      ...member,
      id: `st-${Date.now()}`,
    };
    setStrukturMembers((prev) => {
      const next = [...prev, newStruktur];
      syncStrukturToServer(next);
      return next;
    });
    addToast({
      type: 'success',
      title: 'Pengurus Baru Ditambahkan',
      description: `${newStruktur.name} sebagai ${newStruktur.position}.`,
    });
  };

  const updateStrukturMember = (id: string, updates: Partial<StrukturMember>) => {
    setStrukturMembers((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      syncStrukturToServer(next);
      return next;
    });
    addToast({
      type: 'success',
      title: 'Data Pengurus Diperbarui',
    });
  };

  const deleteStrukturMember = (id: string) => {
    setStrukturMembers((prev) => {
      const next = prev.filter((s) => s.id !== id);
      syncStrukturToServer(next);
      return next;
    });
    addToast({
      type: 'info',
      title: 'Pengurus Dihapus',
    });
  };

  // Integration Operations
  const updateIntegrationConfig = (updates: Partial<IntegrationConfig>) => {
    setIntegrationConfig((prev) => ({ ...prev, ...updates }));
  };

  const connectGoogleDrive = async () => {
    // Simulate OAuth2 popup/authorization
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIntegrationConfig((prev) => ({
      ...prev,
      is_connected: true,
      account_email: 'multimedia.gehc@gmail.com',
      last_synced: new Date().toISOString(),
    }));
    addToast({
      type: 'success',
      title: 'Google Drive Terhubung',
      description: 'Akun multimedia.gehc@gmail.com siap digunakan untuk sinkronisasi media.',
    });
  };

  const disconnectGoogleDrive = () => {
    setIntegrationConfig((prev) => ({
      ...prev,
      is_connected: false,
    }));
    addToast({
      type: 'info',
      title: 'Google Drive Diputuskan',
      description: 'Akses token dinonaktifkan.',
    });
  };

  const selectDriveRootFolder = (folderId: string) => {
    const target = driveFolders.find((f) => f.id === folderId);
    if (target) {
      setIntegrationConfig((prev) => ({
        ...prev,
        root_folder_id: target.id,
        root_folder_name: target.name,
        last_synced: new Date().toISOString(),
      }));
      addToast({
        type: 'success',
        title: 'Folder Media Diubah',
        description: `Folder root aktif: ${target.name}`,
      });
    }
  };

  // User Operations
  const updateUserRole = (
    userId: string,
    tenantId: string,
    newRole: UserRole,
    groupId?: string
  ) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          // Multi-role: upsert mapping (tenantId+groupId) ini tanpa menghapus peran lain.
          const others = u.roles.filter(
            (r) => !(r.tenantId === tenantId && r.role === newRole)
          );
          return {
            ...u,
            roles: [...others, { tenantId, role: newRole, groupId }],
          };
        }
        return u;
      })
    );
    addToast({
      type: 'success',
      title: 'Peran Pengguna Diperbarui',
      description: `Peran ${newRole} ditetapkan (peran lain tetap tersimpan).`,
    });
  };

  const addNewUser = (user: Omit<User, 'id'>) => {
    const newUser: User = {
      ...user,
      id: `usr-${Date.now()}`,
    };
    setAllUsers((prev) => [...prev, newUser]);
    addToast({
      type: 'success',
      title: 'Pengguna Baru Terdaftar',
      description: `${newUser.name} (${newUser.email}) telah terdaftar.`,
    });
  };

  // Reset All
  const resetAllData = () => {
    localStorage.clear();
    setAllUsers(INITIAL_USERS);
    setCurrentUserId('usr-tech');
    setGroups(INITIAL_GROUPS);
    setMembers(INITIAL_MEMBERS);
    setMonitoringRecords(INITIAL_MONITORING);
    setContentItems(INITIAL_CONTENT);
    setStrukturMembers(INITIAL_STRUKTUR);
    setGroupBatches(INITIAL_GROUP_BATCHES);
    setIntegrationConfig(INITIAL_INTEGRATION_CONFIG);
    setCurrentTenantId('tenant-youth');
    addToast({
      type: 'info',
      title: 'Data Direset ke Awal',
      description: 'Seluruh data demo GMIM Eben Haezer Cikarang telah dipulihkan.',
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentTenant,
        allTenants,
        switchTenant,
        activeView,
        setActiveView,
        publicTab,
        setPublicTab,
        eventSlug,
        selectedGroupId,
        openGroupDetail,
        closeGroupDetail,

        currentUser,
        currentRole,
        setCurrentUserById,
        userAssignedGroupId,
        isSuperAdmin,
        isCommittee,
        isKomisi,
        isBpmj,
        isMentor,
        isCoMentor,
        isGroupMentor,
        isMentee,
        isAlumni,
        canAccess,

        authUser,
        authLoading,
        ssoClientId,
        loginWithCredential,
        logoutSso,
        demoMode,
        sessionSource,

        myRoleOptions,
        setActiveUserRole,

        groups,
        members,
        monitoringRecords,
        contentItems,
        strukturMembers,
        driveFolders,
        groupBatches,
        integrationConfig,
        allUsers,

        addContentItem,
        updateContentItem,
        deleteContentItem,

        submitMonitoringRecord,
        deleteMonitoringRecord,

        addGroupMember,
        updateGroupMember,
        deleteGroupMember,

        addStrukturMember,
        updateStrukturMember,
        deleteStrukturMember,

        updateIntegrationConfig,
        connectGoogleDrive,
        disconnectGoogleDrive,
        selectDriveRootFolder,

        updateUserRole,
        addNewUser,

        toasts,
        addToast,
        removeToast,

        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
