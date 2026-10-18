<?php

namespace App\Console\Commands;

use App\Domain\Tenancy\Actions\ConfigureCompany;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Domain\Tenancy\Support\CompanyLookup;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

/**
 * Per-company integrations (Fase 1 multi-perusahaan; the settings UI is
 * Fase 3): the WhatsApp group of the attendance copies, the Google Shared
 * Drive of the workspace folders, and the office timezone column.
 *
 *   php artisan company:configure spkd.store --whatsapp-group=1203…@g.us --shared-drive=0AB… --shared-drive-name="RuangKerja"
 *
 * An empty value (`--whatsapp-group=`) removes the setting. Every change is
 * written to audit_logs (`company.configured`).
 */
#[Signature('company:configure
    {company : ID, domain Google, atau nama perusahaan (lihat company:list)}
    {--whatsapp-group= : Jid grup WhatsApp salinan absensi (…@g.us); kosong = hapus}
    {--whatsapp= : on/off — salinan absensi ke grup perusahaan ini}
    {--shared-drive= : ID Shared Drive Google untuk folder workspace; kosong = hapus (Drive nonaktif bila ada perusahaan lain)}
    {--shared-drive-name= : Nama Shared Drive yang ditampilkan di tab File}
    {--timezone= : Zona waktu kantor, mis. Asia/Jakarta (hanya kolom companies.timezone)}')]
#[Description('Atur integrasi per perusahaan: grup WhatsApp absensi, Shared Drive Google, zona waktu')]
class CompanyConfigureCommand extends Command
{
    public function handle(ConfigureCompany $configure): int
    {
        $company = CompanyLookup::find((string) $this->argument('company'));

        if ($company === null) {
            $this->components->error('Perusahaan tidak ditemukan (atau nama tidak unik). Lihat php artisan company:list.');

            return self::FAILURE;
        }

        $settings = [];

        foreach ([
            'whatsapp-group' => CompanySettings::WHATSAPP_GROUP_JID,
            'shared-drive' => CompanySettings::SHARED_DRIVE_ID,
            'shared-drive-name' => CompanySettings::SHARED_DRIVE_NAME,
        ] as $option => $key) {
            if ($this->optionGiven($option)) {
                $settings[$key] = (string) $this->option($option);
            }
        }

        if ($this->optionGiven('whatsapp')) {
            $switch = strtolower(trim((string) $this->option('whatsapp')));

            if (! in_array($switch, ['on', 'off'], true)) {
                $this->components->error('--whatsapp harus on atau off.');

                return self::FAILURE;
            }

            // "on" = the default (no key); "off" stores false.
            $settings[CompanySettings::WHATSAPP_ENABLED] = $switch === 'off' ? false : null;
        }

        $timezone = $this->optionGiven('timezone') ? trim((string) $this->option('timezone')) : null;

        if ($settings === [] && $timezone === null) {
            $this->components->warn('Tidak ada opsi yang diberikan. Contoh: company:configure '.$company->google_domain.' --whatsapp-group=1203…@g.us');
            $this->summary($company->id, $company->name);

            return self::FAILURE;
        }

        try {
            $changes = $configure->handle($company, $settings, $timezone === '' ? null : $timezone);
        } catch (InvalidArgumentException $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        if ($changes['new'] === []) {
            $this->components->info("Tidak ada perubahan untuk {$company->name}.");
        } else {
            $this->components->info("Pengaturan {$company->name} diperbarui (tercatat di audit log).");

            foreach (array_keys($changes['new']) as $key) {
                $this->components->twoColumnDetail($key, self::display($changes['old'][$key] ?? null).' → '.self::display($changes['new'][$key]));
            }
        }

        $this->summary($company->id, $company->name);

        return self::SUCCESS;
    }

    private function summary(string $companyId, string $name): void
    {
        $settings = CompanySettings::resolve();
        $fallback = $settings->usesGlobalFallback($companyId);

        $this->line('');
        $this->line("<options=bold>Berlaku untuk {$name}</>".($fallback ? ' <fg=gray>(satu-satunya perusahaan: nilai .env dipakai bila kosong)</>' : ''));
        $this->components->twoColumnDetail('Grup WhatsApp absensi', $settings->whatsappGroupJid($companyId) ?? '— (tidak dikirim)');
        $this->components->twoColumnDetail('Shared Drive', $settings->sharedDriveId($companyId) ?? '— (Drive nonaktif)');
        $this->components->twoColumnDetail('Nama Shared Drive', $settings->sharedDriveName($companyId));
    }

    private function optionGiven(string $name): bool
    {
        return $this->option($name) !== null;
    }

    private static function display(mixed $value): string
    {
        return match (true) {
            $value === null => '—',
            is_bool($value) => $value ? 'on' : 'off',
            is_scalar($value) => (string) $value,
            default => (string) json_encode($value),
        };
    }
}
