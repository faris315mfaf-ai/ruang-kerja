<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fase 1 multi-perusahaan (langkah 2c): the WhatsApp attendance group and the
 * Google Shared Drive become per-company settings (`companies.settings`,
 * App\Domain\Tenancy\Settings\CompanySettings). The values configured today
 * (WHATSAPP_GROUP_JID, GOOGLE_SHARED_DRIVE_ID/NAME, read through config(), not
 * .env) are copied to the first company (SPKD) when it has none of its own,
 * so production keeps sending to the same group and Drive.
 *
 * Data only, no schema change; `down()` removes the copied keys while they
 * still equal the config values (values set later by company:configure stay).
 */
return new class extends Migration
{
    /** @var array<string, string> settings key → config key */
    private const array KEYS = [
        'whatsapp.group_jid' => 'notifications.channels.whatsapp.group_jid',
        'google.shared_drive_id' => 'google.shared_drive_id',
        'google.shared_drive_name' => 'google.shared_drive_name',
    ];

    public function up(): void
    {
        $company = $this->firstCompany();

        if ($company === null) {
            return;
        }

        [$id, $settings] = $company;
        $changed = false;

        foreach (self::KEYS as $key => $configKey) {
            $value = $this->configValue($configKey);
            $own = data_get($settings, $key);

            if ($value === null || (is_string($own) && trim($own) !== '')) {
                continue;
            }

            // The name alone (default "RuangKerja") is only worth copying with a drive.
            if ($key === 'google.shared_drive_name' && data_get($settings, 'google.shared_drive_id') === null) {
                continue;
            }

            data_set($settings, $key, $value);
            $changed = true;
        }

        if ($changed) {
            DB::table('companies')->where('id', $id)->update(['settings' => json_encode($settings, JSON_THROW_ON_ERROR)]);
        }
    }

    public function down(): void
    {
        $company = $this->firstCompany();

        if ($company === null) {
            return;
        }

        [$id, $settings] = $company;
        $changed = false;

        foreach (self::KEYS as $key => $configKey) {
            if (data_get($settings, $key) !== null && data_get($settings, $key) === $this->configValue($configKey)) {
                [$group, $leaf] = explode('.', $key, 2);
                unset($settings[$group][$leaf]);

                if ($settings[$group] === []) {
                    unset($settings[$group]);
                }

                $changed = true;
            }
        }

        if ($changed) {
            DB::table('companies')->where('id', $id)->update(['settings' => json_encode((object) $settings, JSON_THROW_ON_ERROR)]);
        }
    }

    /**
     * Oldest active company (SPKD in production): [id, decoded settings].
     *
     * @return array{0: string, 1: array<string, mixed>}|null
     */
    private function firstCompany(): ?array
    {
        $id = DB::table('companies')->whereNull('deleted_at')->orderBy('created_at')->orderBy('id')->value('id');

        if (! is_string($id)) {
            return null;
        }

        return [$id, $this->decode(DB::table('companies')->where('id', $id)->value('settings'))];
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(mixed $raw): array
    {
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($decoded) ? $decoded : [];
    }

    private function configValue(string $key): ?string
    {
        $value = config($key);

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
};
