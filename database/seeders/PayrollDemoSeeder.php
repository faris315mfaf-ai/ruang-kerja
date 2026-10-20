<?php

namespace Database\Seeders;

use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollRule;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Gaji harian demo (keputusan pemilik 20 Okt 2026): every active employee of
 * the demo company without a wage gets an example daily wage from 1 January
 * (Rp120.000–Rp250.000, deterministic per email), plus the default pay
 * rules with a Rp25.000 deduction per late day. Idempotent.
 */
class PayrollDemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = DemoCompany::ensure();

        PayrollRule::query()->firstOrCreate(['company_id' => $company->id], ['late_deduction' => 25_000]);

        User::query()
            ->where('company_id', $company->id)
            ->where('status', UserStatus::Active)
            ->whereDoesntHave('roles', fn ($query) => $query->where('name', 'direksi'))
            ->whereNotIn('id', EmployeeWage::query()->select('user_id'))
            ->orderBy('email')
            ->each(function (User $user) use ($company): void {
                EmployeeWage::query()->create([
                    'company_id' => $company->id,
                    'user_id' => $user->id,
                    // Rp120.000–Rp250.000 in steps of Rp5.000, stable per email.
                    'daily_wage' => 120_000 + (crc32($user->email) % 27) * 5_000,
                    'effective_from' => '2026-01-01',
                    'note' => 'Data demo',
                ]);
            });
    }
}
