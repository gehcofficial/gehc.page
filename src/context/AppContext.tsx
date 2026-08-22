import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../data/initialData';

interface AppContextType {
  // Navigation & Tenant
  currentTenant: Tenant;
  allTenants: Tenant[];
  switchTenant: (tenantId: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  publicTab: 'home' | 'weekly-info' | 'activity' | 'struktur' | 'groups';
  setPublicTab: (tab: 'home' | 'weekly-info' | 'activity' | 'struktur' | 'groups') => void;

  // Authentication & RBAC
  currentUser: User;
  currentRole: UserRole;
  setCurrentUserById: (userId: string) => void;
  userAssignedGroupId?: string;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isMentor: boolean;
  isMenti: boolean;
  canAccess: (resource: 'settings_users' | 'settings_integrations' | 'content_manage' | 'groups_all' | 'group_monitoring_write' | 'struktur_manage', groupId?: string) => boolean;

  // Data Collections
  groups: YouthGroup[];
  members: GroupMember[];
  monitoringRecords: MonitoringRecord[];
  contentItems: ContentItem[];
  strukturMembers: StrukturMember[];
  driveFolders: DriveFolder[];
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
  USERS: 'gehc_users_v1',
  CURRENT_USER_ID: 'gehc_current_user_id_v1',
  GROUPS: 'gehc_groups_v1',
  MEMBERS: 'gehc_members_v1',
  MONITORING: 'gehc_monitoring_v1',
  CONTENT: 'gehc_content_v1',
  STRUKTUR: 'gehc_struktur_v1',
  INTEGRATION: 'gehc_integration_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State
  const [activeView, setActiveView] = useState<string>('public'); // 'public' | 'portal'
  const [publicTab, setPublicTab] = useState<'home' | 'weekly-info' | 'activity' | 'struktur' | 'groups'>('home');
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
    return saved || 'usr-1'; // Default: Superadmin Pnt. Daniel
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INTEGRATION, JSON.stringify(integrationConfig));
  }, [integrationConfig]);

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

  // User & RBAC Computation
  const currentUser: User =
    allUsers.find((u) => u.id === currentUserId) || allUsers[0];

  const currentRoleMapping: UserRoleMapping = currentUser.roles.find(
    (r) => r.tenantId === currentTenantId
  ) || { tenantId: currentTenantId, role: 'MENTI' as UserRole, groupId: undefined };

  const currentRole: UserRole = currentRoleMapping.role;
  const userAssignedGroupId = currentRoleMapping.groupId;

  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const isCommittee = currentRole === 'COMMITTEE';
  const isMentor = currentRole === 'MENTOR';
  const isMenti = currentRole === 'MENTI';

  // Strict RBAC Access Checker per PRD Matrix
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
        return isSuperAdmin;
      case 'content_manage':
      case 'struktur_manage':
      case 'groups_all':
        return isSuperAdmin || isCommittee;
      case 'group_monitoring_write':
        if (isSuperAdmin || isCommittee) return true;
        if (isMentor && userAssignedGroupId) {
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
      const roleMap = target.roles.find((r) => r.tenantId === currentTenantId);
      const roleName = roleMap ? roleMap.role : 'MENTI';
      addToast({
        type: 'success',
        title: `Login sebagai: ${target.name}`,
        description: `Peran aktif: ${roleName} ${roleMap?.groupId ? `(Grup: ${groups.find((g) => g.id === roleMap.groupId)?.name})` : ''}`,
      });
    }
  };

  // Toast System
  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Content Operations (CMS)
  const addContentItem = (item: Omit<ContentItem, 'id' | 'published_at'>) => {
    const newItem: ContentItem = {
      ...item,
      id: `cnt-${Date.now()}`,
      published_at: new Date().toISOString().split('T')[0],
    };
    setContentItems((prev) => [newItem, ...prev]);
    addToast({
      type: 'success',
      title: 'Konten Berhasil Diterbitkan',
      description: `"${newItem.title}" kini langsung tampil di portal publik!`,
    });
  };

  const updateContentItem = (id: string, updates: Partial<ContentItem>) => {
    setContentItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    addToast({
      type: 'success',
      title: 'Konten Diperbarui',
      description: 'Perubahan telah disimpan ke database.',
    });
  };

  const deleteContentItem = (id: string) => {
    setContentItems((prev) => prev.filter((item) => item.id !== id));
    addToast({
      type: 'info',
      title: 'Konten Dihapus',
      description: 'Artikel telah dihapus dari sistem.',
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
  const addStrukturMember = (member: Omit<StrukturMember, 'id'>) => {
    const newStruktur: StrukturMember = {
      ...member,
      id: `st-${Date.now()}`,
    };
    setStrukturMembers((prev) => [...prev, newStruktur]);
    addToast({
      type: 'success',
      title: 'Pengurus Baru Ditambahkan',
      description: `${newStruktur.name} sebagai ${newStruktur.position}.`,
    });
  };

  const updateStrukturMember = (id: string, updates: Partial<StrukturMember>) => {
    setStrukturMembers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    addToast({
      type: 'success',
      title: 'Data Pengurus Diperbarui',
    });
  };

  const deleteStrukturMember = (id: string) => {
    setStrukturMembers((prev) => prev.filter((s) => s.id !== id));
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
          const existingRoles = u.roles.filter((r) => r.tenantId !== tenantId);
          return {
            ...u,
            roles: [...existingRoles, { tenantId, role: newRole, groupId }],
          };
        }
        return u;
      })
    );
    addToast({
      type: 'success',
      title: 'Peran Pengguna Diperbarui',
      description: `Peran berhasil diubah menjadi ${newRole}.`,
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
    setCurrentUserId('usr-1');
    setGroups(INITIAL_GROUPS);
    setMembers(INITIAL_MEMBERS);
    setMonitoringRecords(INITIAL_MONITORING);
    setContentItems(INITIAL_CONTENT);
    setStrukturMembers(INITIAL_STRUKTUR);
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

        currentUser,
        currentRole,
        setCurrentUserById,
        userAssignedGroupId,
        isSuperAdmin,
        isCommittee,
        isMentor,
        isMenti,
        canAccess,

        groups,
        members,
        monitoringRecords,
        contentItems,
        strukturMembers,
        driveFolders,
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
