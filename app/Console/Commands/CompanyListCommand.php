<?php

namespace App\Console\Commands;

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Models\Company;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Companies with their integration settings as they apply right now
 * (own value, or the .env fallback while there is only one company).
 */
#[Signature('company:list')]
#[Description('Daftar perusahaan beserta zona waktu, grup WhatsApp absensi, dan Shared Drive')]
class CompanyListCommand extends Command
{
    public function handle(): int
    {
        $companies = Company::query()->orderBy('created_at')->orderBy('id')->get(['id', 'name', 'google_domain', 'timezone']);

        if ($companies->isEmpty()) {
            $this->components->warn('Belum ada perusahaan.');

            return self::SUCCESS;
        }

        $active = User::query()
            ->where('status', UserStatus::Active->value)
            ->whereIn('company_id', $companies->modelKeys())
            ->selectRaw('company_id, count(*) as total')
            ->groupBy('company_id')
            ->pluck('total', 'company_id');

        $settings = CompanySettings::resolve();

        $this->table(
            ['ID', 'Nama', 'Domain', 'Zona waktu', 'Karyawan aktif', 'Grup WhatsApp', 'Shared Drive'],
            $companies->map(fn (Company $company): array => [
                $company->id,
                $company->name,
                $company->google_domain,
                $company->timezone,
                (int) ($active[$company->id] ?? 0),
                self::source($settings->whatsappGroupJid($company->id), $settings->own($company->id, CompanySettings::WHATSAPP_GROUP_JID)),
                self::source($settings->sharedDriveId($company->id), $settings->own($company->id, CompanySettings::SHARED_DRIVE_ID)),
            ])->all(),
        );

        return self::SUCCESS;
    }

    private static function source(?string $effective, ?string $own): string
    {
        return match (true) {
            $effective === null => '—',
            $own === null => $effective.' (.env)',
            default => $effective,
        };
    }
}
