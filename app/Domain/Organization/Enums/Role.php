<?php

namespace App\Domain\Organization\Enums;

/**
 * Global roles managed by spatie/laravel-permission (guard `web`).
 */
enum Role: string
{
    case SuperAdmin = 'super_admin';
    case Direksi = 'direksi';
    case Hr = 'hr';
    case KepalaDivisi = 'kepala_divisi';
    case Anggota = 'anggota';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Direksi => 'Direksi',
            self::Hr => 'HR',
            self::KepalaDivisi => 'Kepala Divisi',
            self::Anggota => 'Anggota',
        };
    }

    /**
     * Roles only a Super Admin may grant or revoke (HR may handle kepala_divisi/anggota).
     */
    public function onlySuperAdminAssigns(): bool
    {
        return match ($this) {
            self::SuperAdmin, self::Direksi, self::Hr => true,
            self::KepalaDivisi, self::Anggota => false,
        };
    }

    /**
     * Permission matrix (single source of truth, synced by RoleSeeder and
     * documented in docs/sprints/sprint-1/CORE.md).
     *
     * @return list<Permission>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin => [
                Permission::EmployeesView,
                Permission::EmployeesManage,
                Permission::OrganizationManage,
                Permission::SettingsManage,
                Permission::AuditView,
                Permission::AttendanceViewAll,
                Permission::AttendanceManage,
                Permission::AttendanceExport,
                Permission::RequestsViewAll,
                Permission::RequestsManageFlows,
                Permission::WorkspacesManage,
                Permission::DashboardViewCompany,
                Permission::PortfolioView,
            ],
            self::Direksi => [
                Permission::EmployeesView,
                Permission::AttendanceViewAll,
                Permission::RequestsViewAll,
                Permission::WorkspacesViewAll,
                Permission::DashboardViewCompany,
                Permission::PortfolioView,
            ],
            self::Hr => [
                Permission::EmployeesView,
                Permission::EmployeesManage,
                Permission::OrganizationManage,
                Permission::AttendanceViewAll,
                Permission::AttendanceManage,
                Permission::AttendanceViewSelfie,
                Permission::AttendanceExport,
                Permission::RequestsViewAll,
                Permission::RequestsManageFlows,
                Permission::DashboardViewCompany,
            ],
            self::KepalaDivisi, self::Anggota => [],
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
