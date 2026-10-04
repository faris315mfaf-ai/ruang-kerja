# Sprint 1 — CORE (fondasi data organisasi)

> Status: rencana (diperbarui menjadi referensi lengkap di akhir slice).

## Rencana
1. Migrasi baru `2026_10_05_*`: companies, divisions, teams, positions, kolom organisasi di users (migrasi baru, Sprint 0 tidak diubah), employee_profiles, audit_logs. Model di `app/Models`, factory + state.
2. Enum `WorkMode`, `UserStatus`, `Permission` (+ matriks peran di `Role::permissions()`), `RoleSeeder` sinkron permission.
3. `User::scopeVisibleTo()`; `ManagerHierarchy` + rule `ValidManager` (cegah siklus atasan).
4. Middleware `EnsureActiveEmployee` di grup `web`.
5. `AuditLogger` + trait `Auditable` (User, Company, Division, Team, Position) + Action `SyncUserRoles` (audit perubahan peran).
6. Policy Company/Division/Team/Position/User/AuditLog + test matriks peran × aksi.
7. `OrganizationSeeder` demo (idempoten) + demo account ditempatkan di struktur.
8. Props Inertia `auth.user` memuat divisi/jabatan/perusahaan.
9. Dokumen referensi untuk agent fitur (file ini) + DATABASE.md.
