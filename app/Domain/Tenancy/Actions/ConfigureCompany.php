<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Models\Company;
use DateTimeZone;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Writes a company's integration settings (`companies.settings`, keys of
 * CompanySettings) and its timezone column, used by
 * `php artisan company:configure` (Fase 1 multi-perusahaan; the settings UI
 * is Fase 3). Only the timezone column is written here — how it is used is
 * the business of the time helpers.
 *
 * Row lock + one audit row `company.configured` with the changed keys only.
 */
final class ConfigureCompany
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<string, string|bool|null>  $settings  CompanySettings key → value; null or '' removes the key
     * @return array{old: array<string, mixed>, new: array<string, mixed>} changed values (empty when nothing changed)
     *
     * @throws InvalidArgumentException with an Indonesian message on invalid input
     */
    public function handle(Company $company, array $settings = [], ?string $timezone = null): array
    {
        $settings = array_map(fn (string|bool|null $value): string|bool|null => is_string($value) && trim($value) === '' ? null : (is_string($value) ? trim($value) : $value), $settings);

        foreach ($settings as $key => $value) {
            self::validate($key, $value);
        }

        if ($timezone !== null && ! in_array($timezone, DateTimeZone::listIdentifiers(), true)) {
            throw new InvalidArgumentException("Zona waktu \"{$timezone}\" tidak dikenal (contoh: Asia/Jakarta, Asia/Makassar, Asia/Jayapura).");
        }

        $result = DB::transaction(function () use ($company, $settings, $timezone): array {
            $locked = Company::query()->lockForUpdate()->findOrFail($company->id);
            $current = $locked->settings;
            [$old, $new] = [[], []];

            foreach ($settings as $key => $value) {
                $before = data_get($current, $key);

                if ($before === $value) {
                    continue;
                }

                if ($value === null) {
                    Arr::forget($current, $key);
                    $group = explode('.', $key)[0];

                    if (($current[$group] ?? null) === []) {
                        unset($current[$group]);
                    }
                } else {
                    data_set($current, $key, $value);
                }

                [$old[$key], $new[$key]] = [$before, $value];
            }

            if ($timezone !== null && $timezone !== $locked->timezone) {
                [$old['timezone'], $new['timezone']] = [$locked->timezone, $timezone];
                $locked->timezone = $timezone;
            }

            if ($new === []) {
                return ['old' => [], 'new' => []];
            }

            $locked->settings = $current;
            $locked->saveQuietly();

            app(CompanyContext::class)->run($locked->id, fn () => $this->audit->log('company.configured', $locked, $old, $new));

            return ['old' => $old, 'new' => $new];
        });

        CompanySettings::resolve()->flush();
        $company->refresh();

        return $result;
    }

    private static function validate(string $key, string|bool|null $value): void
    {
        if (! in_array($key, [CompanySettings::WHATSAPP_GROUP_JID, CompanySettings::WHATSAPP_ENABLED, CompanySettings::SHARED_DRIVE_ID, CompanySettings::SHARED_DRIVE_NAME], true)) {
            throw new InvalidArgumentException("Pengaturan \"{$key}\" tidak dikenal.");
        }

        if ($value === null) {
            return;
        }

        $valid = match ($key) {
            CompanySettings::WHATSAPP_ENABLED => is_bool($value),
            CompanySettings::WHATSAPP_GROUP_JID => is_string($value) && preg_match('/^\d+(-\d+)?@g\.us$/', $value) === 1,
            CompanySettings::SHARED_DRIVE_ID => is_string($value) && preg_match('/^[A-Za-z0-9_-]{6,100}$/', $value) === 1,
            default => is_string($value) && mb_strlen($value) <= 100,
        };

        if (! $valid) {
            throw new InvalidArgumentException(match ($key) {
                CompanySettings::WHATSAPP_ENABLED => 'Nilai WhatsApp harus on atau off.',
                CompanySettings::WHATSAPP_GROUP_JID => 'Grup WhatsApp harus berupa jid grup, mis. 120363012345678901@g.us (lihat GET /group/fetchAllGroups di gateway).',
                CompanySettings::SHARED_DRIVE_ID => 'ID Shared Drive tidak valid (huruf, angka, - dan _; dari URL drive.google.com/drive/folders/<ID>).',
                default => 'Nama Shared Drive maksimal 100 karakter.',
            });
        }
    }
}
