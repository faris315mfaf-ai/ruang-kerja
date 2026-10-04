<?php

namespace App\Domain\Organization\Enums;

/**
 * Global permissions (spatie/laravel-permission, guard `web`).
 *
 * Granted per role in Role::permissions() and synced by RoleSeeder. Data scope
 * (own / direct reports / division / all) is NOT a permission: it is decided by
 * the `visibleTo($viewer)` query scopes and policies. See docs/sprints/sprint-1/CORE.md.
 */
enum Permission: string
{
    case EmployeesView = 'employees.view';
    case EmployeesManage = 'employees.manage';
    case OrganizationManage = 'organization.manage';
    case SettingsManage = 'settings.manage';
    case AuditView = 'audit.view';
    case AttendanceViewAll = 'attendance.view_all';
    case AttendanceManage = 'attendance.manage';
    case AttendanceViewSelfie = 'attendance.view_selfie';
    case AttendanceExport = 'attendance.export';
    case RequestsViewAll = 'requests.view_all';
    case RequestsManageFlows = 'requests.manage_flows';
    case WorkspacesViewAll = 'workspaces.view_all';
    case WorkspacesManage = 'workspaces.manage';
    case DashboardViewCompany = 'dashboard.view_company';
    case PortfolioView = 'portfolio.view';

    public function label(): string
    {
        return match ($this) {
            self::EmployeesView => 'Lihat semua karyawan',
            self::EmployeesManage => 'Kelola karyawan',
            self::OrganizationManage => 'Kelola divisi, tim, dan jabatan',
            self::SettingsManage => 'Kelola pengaturan sistem',
            self::AuditView => 'Lihat audit log',
            self::AttendanceViewAll => 'Lihat absensi semua karyawan',
            self::AttendanceManage => 'Kelola absensi, shift, lokasi, dan hari libur',
            self::AttendanceViewSelfie => 'Lihat selfie absensi',
            self::AttendanceExport => 'Ekspor rekap absensi',
            self::RequestsViewAll => 'Lihat semua pengajuan',
            self::RequestsManageFlows => 'Kelola alur persetujuan dan jenis cuti',
            self::WorkspacesViewAll => 'Lihat semua workspace non-pribadi',
            self::WorkspacesManage => 'Kelola semua workspace non-pribadi',
            self::DashboardViewCompany => 'Lihat dashboard seluruh perusahaan',
            self::PortfolioView => 'Lihat portofolio proyek',
        };
    }
}
