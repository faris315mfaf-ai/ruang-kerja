<?php

namespace Database\Seeders;

use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Position;
use Illuminate\Database\Seeder;

/**
 * Dashboard per jabatan (F3): maps the demo positions to SPKD job dashboards
 * so the demo accounts land on one at /peran. Idempotent (by position name),
 * no events. Corsec and Analis have no demo position; Direksi and Super Admin
 * still open them from the picker.
 *
 * dio@ → Direktur Utama (dirut); direksi@ (Direktur Operasional), faris@ (Project Leader),
 * lestari.anggraini@ → Direktur Keuangan
 * (direktur), hr@ → Kepala Divisi SDM (hr), kadiv@ → Kepala Divisi
 * Operasional (implementer: field work at client sites), putri.ramadhani@ →
 * Kepala Divisi Pemasaran (marketing), yudi.hartono@ → Kepala Divisi
 * Programming (programming).
 */
class RoleDashboardDemoSeeder extends Seeder
{
    /** @var array<string, DashboardRole> */
    public const array POSITIONS = [
        'Direktur Utama' => DashboardRole::Dirut,
        'Project Leader' => DashboardRole::Direktur,
        'Direktur Operasional' => DashboardRole::Direktur,
        'Direktur Keuangan' => DashboardRole::Direktur,
        'Kepala Divisi SDM' => DashboardRole::Hr,
        'Kepala Divisi Operasional' => DashboardRole::Implementer,
        'Kepala Divisi Pemasaran' => DashboardRole::Marketing,
        'Kepala Divisi Programming' => DashboardRole::Programming,
    ];

    public function run(): void
    {
        $company = DemoCompany::ensure();

        Position::withoutEvents(function () use ($company): void {
            foreach (self::POSITIONS as $name => $role) {
                Position::query()
                    ->where('company_id', $company->id)
                    ->where('name', $name)
                    ->whereNull('dashboard_role')
                    ->update(['dashboard_role' => $role->value]);
            }
        });
    }
}
