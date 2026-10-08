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
     * Roles that make an employee more than "staf" (keputusan pemilik 6 Okt
     * 2026): someone holding none of these is staff (User::isStaffOnly()).
     *
     * @return list<self>
     */
    public static function aboveStaff(): array
    {
        return [self::SuperAdmin, self::Direksi, self::Hr, self::KepalaDivisi];
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
     * Roles whose password only a Super Admin may set (audit R-06): the same
     * set `onlySuperAdminAssigns()` guards — a password is a way in.
     *
     * @return list<self>
     */
    public static function superAdminSetsPassword(): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $role): bool => $role->onlySuperAdminAssigns(),
        ));
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
                Permission::RequestsCancelApproved,
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
                Permission::RequestsCancelApproved,
                // Read-only access to every shared workspace (keputusan pemilik 6 Okt 2026).
                Permission::WorkspacesViewAll,
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
