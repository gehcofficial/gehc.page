# Portal Nav ↔ API Parity Matrix

Each portal tab must only call endpoints the user's role can access.

| Nav ID | Panel | Roles (nav) | Primary API endpoints | Server roles |
|--------|-------|-------------|----------------------|--------------|
| my-profile | MyProfilePanel | all 8 | GET/PATCH `/api/me/profile` | auth |
| dashboard | PortalDashboard | 6 roles | GET `/api/groups`, `/api/jemaat/birthdays/upcoming` | varies |
| people | PeopleInvites | SUPERADMIN, KOMISI | `/api/users`, `/api/invites` | KOMISION_CORE |
| onboarding | WaitingPoolPanel | SUPERADMIN, KOMISI | `/api/waiting-pool`, `/api/pending-approval` | KOMISION_CORE |
| jethro-placement | JethroPlacementReview | SUPERADMIN, KOMISI, COMMITTEE, BPMJ | `/api/jethro/placement/*` | read: +BPMJ; write: KOMISION |
| youth-gehc | YouthGEHCList | SUPERADMIN, KOMISI | `/api/jemaat/*` | KOMISION_CORE |
| groups-monitoring | ManageGroupsMonitoring | 5 roles | monitoring local + attendance APIs | MENTOR scoped write |
| jethro | JethroEngine | SUPERADMIN, KOMISI, BPMJ | `/api/jethro/*` | KOMISION (+BPMJ read) |
| content-weekly | ManageWeeklyInfo | SUPERADMIN, COMMITTEE | content APIs | KOMISION |
| content-activities | ManageActivities | SUPERADMIN, COMMITTEE | content APIs | KOMISION |
| media-guide | MediaGuidePanel | SUPERADMIN, KOMISI, COMMITTEE | `/api/drive/*` | content_manage |
| struktur | ManageStruktur | SUPERADMIN, COMMITTEE | `/api/db/sync-struktur` | KOMISION |
| events | EventWorkspacePanel | SUPERADMIN, KOMISI, COMMITTEE | `/api/events/*` | KOMISION |
| divisions | DivisionWorkspacePanel | SUPERADMIN, KOMISI, COMMITTEE | division APIs | KOMISION |
| integrations | ManageIntegrations | SUPERADMIN, KOMISI | drive config | SUPERADMIN/KOMISI |
| pwa-settings | PWASettingsPanel | 7 roles | `/api/pwa/*`, push | auth |

**Enforcement:** Playwright smoke in `tests/e2e/portal-nav-roles.spec.ts`.
