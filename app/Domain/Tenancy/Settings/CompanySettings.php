<?php

namespace App\Domain\Tenancy\Settings;

use App\Models\Company;
use Illuminate\Container\Attributes\Scoped;
use WeakReference;

/**
 * Per-company integration settings stored in `companies.settings` (Fase 1
 * multi-perusahaan, langkah 2c, docs/sesi/fase1.md):
 *
 *   {"whatsapp": {"group_jid": "1203…@g.us", "enabled": true},
 *    "google":   {"shared_drive_id": "0AB…", "shared_drive_name": "RuangKerja"}}
 *
 * Filled with `php artisan company:configure` (UI = Fase 3). The gateway and
 * service-account credentials stay global (one Evolution gateway, one Google
 * service account); only the destination differs per company.
 *
 * Compatibility fallback: while the company is the only one in the database
 * and its own value is empty, the old global config (env) is used, so a
 * single-company install keeps working without running the command. With a
 * second company, a company without its own value gets nothing — never the
 * first company's group or Shared Drive.
 *
 * Scoped (one per request/job): rows and the "only company" check are read
 * once per request; Company model events and ConfigureCompany flush the memo
 * (Company::booted).
 */
#[Scoped]
final class CompanySettings
{
    public const string WHATSAPP_GROUP_JID = 'whatsapp.group_jid';

    /** false = attendance copies off for this company even with a group set. */
    public const string WHATSAPP_ENABLED = 'whatsapp.enabled';

    public const string SHARED_DRIVE_ID = 'google.shared_drive_id';

    public const string SHARED_DRIVE_NAME = 'google.shared_drive_name';

    /**
     * Company key → global config read while the company is the only one.
     *
     * @var array<string, string>
     */
    public const array CONFIG_FALLBACK = [
        self::WHATSAPP_GROUP_JID => 'notifications.channels.whatsapp.group_jid',
        self::SHARED_DRIVE_ID => 'google.shared_drive_id',
        self::SHARED_DRIVE_NAME => 'google.shared_drive_name',
    ];

    public const string DEFAULT_SHARED_DRIVE_NAME = 'RuangKerja';

    /** @var array<string, array<string, mixed>> company id → settings */
    private array $settings = [];

    /** @var array<string, bool> company id → is the only (non-deleted) company */
    private array $only = [];

    /** @var WeakReference<object>|null request the memo belongs to */
    private ?WeakReference $request = null;

    public static function resolve(): self
    {
        return app(self::class);
    }

    /**
     * WhatsApp group (jid "…@g.us") receiving the company's attendance copies,
     * or null when none is set or the company switched the copies off.
     */
    public function whatsappGroupJid(string $companyId): ?string
    {
        if ($this->value($companyId, self::WHATSAPP_ENABLED) === false) {
            return null;
        }

        return $this->withFallback($companyId, self::WHATSAPP_GROUP_JID);
    }

    /**
     * Shared Drive holding the company's workspace folders, or null (Drive
     * features are then off for its workspaces).
     */
    public function sharedDriveId(string $companyId): ?string
    {
        return $this->withFallback($companyId, self::SHARED_DRIVE_ID);
    }

    public function sharedDriveName(string $companyId): string
    {
        return $this->withFallback($companyId, self::SHARED_DRIVE_NAME) ?? self::DEFAULT_SHARED_DRIVE_NAME;
    }

    /**
     * The company's own non-empty string value (no fallback).
     */
    public function own(string $companyId, string $key): ?string
    {
        $value = $this->value($companyId, $key);

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    /**
     * Whether the global config still stands in for this company's empty
     * values: it is the only company (soft-deleted ones aside).
     */
    public function usesGlobalFallback(string $companyId): bool
    {
        $this->forgetOtherRequests();

        return $this->only[$companyId] ??= Company::query()->whereKeyNot($companyId)->doesntExist();
    }

    /**
     * Forget everything read so far (Company saved/deleted/restored).
     */
    public function flush(): void
    {
        [$this->settings, $this->only] = [[], []];
    }

    private function withFallback(string $companyId, string $key): ?string
    {
        $own = $this->own($companyId, $key);

        if ($own !== null || ! $this->usesGlobalFallback($companyId)) {
            return $own;
        }

        $config = config(self::CONFIG_FALLBACK[$key]);

        return is_string($config) && trim($config) !== '' ? trim($config) : null;
    }

    /**
     * The memo lives for one HTTP request: a scoped instance is not reset
     * between requests handled by the same container (tests, long-running
     * workers outside Octane), so a new request object starts afresh.
     */
    private function forgetOtherRequests(): void
    {
        $request = app()->bound('request') ? app('request') : null;

        if (! is_object($request) || $this->request?->get() === $request) {
            return;
        }

        $this->flush();
        $this->request = WeakReference::create($request);
    }

    private function value(string $companyId, string $key): mixed
    {
        $this->forgetOtherRequests();

        if (! array_key_exists($companyId, $this->settings)) {
            $raw = Company::query()->whereKey($companyId)->value('settings');
            $decoded = is_string($raw) ? json_decode($raw, true) : $raw;

            $this->settings[$companyId] = is_array($decoded) ? $decoded : [];
        }

        return data_get($this->settings[$companyId], $key);
    }
}
