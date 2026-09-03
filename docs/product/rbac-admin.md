# RBAC Admin — Role Management

Role assignment is managed through **Jemaat** (`YouthGEHCList`) and the **org hierarchy** (`OrgNode` / `OrgAssignment`), not a separate localStorage demo panel.

## Layers

| Layer | Model | Purpose |
|-------|--------|---------|
| Portal RBAC | `UserRole` / `RoleAssignment` | Feature access (8 roles) |
| Org tree | `OrgNode` + `OrgAssignment` | Church structure slots (BOD, Panca, Kolom leaders) — **source of truth for assignments** |
| Directory | `User.membershipKind` | `JEMAAT` vs `SIMPATISAN` — filter/label only, no portal gate |
| Landing CMS | `struktur_members` | Public Leaders page (photos, names, open-role badges) — **not** the RBAC tree |

`ManageStruktur` and `OrgHierarchyPanel` are two intentional layers (CMS vs slots). Do not merge or delete either until Drive / COMMITTEE division scoping has been migrated off `struktur_members` onto Org metadata.

## Where to manage roles

| Task | Location |
|------|----------|
| Assign user to org slot (+ dual-write RBAC) | Jemaat → Assign Role wizard (tree-driven) |
| Configure org tree (assignment slots) | Kelola Hirarki (`OrgHierarchyPanel`) — Komisi only |
| Public Leaders photos/names | Struktur Organisasi (`ManageStruktur`) — COMMITTEE landing CMS |
| Revoke role assignment | Jemaat → expanded row → revoke |
| Approve BIPRA suggest | Jemaat → Konfirmasi kategorial banner |
| Mark simpatisan | Jemaat → edit profil → Keanggotaan |
| Account invites | Orang & Undangan |
| Onboarding pipeline | Onboarding Pipeline (WaitingPool + pending approval) |

## API

| Endpoint | Role | Notes |
|----------|------|-------|
| `GET /api/org/nodes?domain=YOUTH` | KOMISI+ | Read tree |
| `POST/PATCH/DELETE /api/org/nodes` | KOMISI | CRUD nodes |
| `POST /api/org/assignments` | KOMISI | Assign slot + dual-write `RoleAssignment` |
| `DELETE /api/org/assignments/:id` | KOMISI | Revoke slot |
| `PATCH /api/jemaat/:id` | KOMISI | `membershipKind` only |

Seed default tree: `npm run db:seed:org-tree` (staging: `db:seed:org-tree:staging`).

## Removed

- `ManageUsersRBAC.tsx` — deprecated localStorage demo (deleted Episode E0)
