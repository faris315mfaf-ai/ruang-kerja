<?php

namespace App\Domain\Privacy\Services;

use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * The versioned privacy policy (config/privacy.php + Markdown in
 * resources/markdown). The owner edits the Markdown; HTML comments are
 * dropped and raw HTML is escaped, so the rendered page can only contain
 * what Markdown produces.
 */
final class PrivacyPolicy
{
    public function version(): string
    {
        return config()->string('privacy.policy.version');
    }

    public function effectiveDate(): string
    {
        return CarbonImmutable::parse(config()->string('privacy.policy.effective_date'))->toDateString();
    }

    /**
     * Rendered HTML for the policy page.
     */
    public function html(?User $viewer = null): string
    {
        return Str::markdown($this->markdown($viewer), [
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
        ]);
    }

    /**
     * Markdown with placeholders filled in and editor comments removed.
     */
    public function markdown(?User $viewer = null): string
    {
        $path = config()->string('privacy.policy.path');
        $source = is_file($path) ? file_get_contents($path) : false;

        if ($source === false) {
            throw new RuntimeException("Privacy policy not found at {$path}.");
        }

        $company = $viewer !== null
            ? Company::query()->whereKey($viewer->company_id)->value('name')
            : null;

        $text = (string) preg_replace('/<!--.*?-->/s', '', $source);

        return trim(strtr($text, [
            '{{aplikasi}}' => config()->string('branding.name', config()->string('app.name')),
            '{{perusahaan}}' => is_string($company) ? $company : config()->string('branding.company_name', 'perusahaan'),
            '{{versi}}' => $this->version(),
            '{{tanggal_berlaku}}' => $this->effectiveDate(),
            '{{retensi_selfie_bulan}}' => (string) config()->integer('attendance.selfie.retention_months'),
            '{{kontak}}' => config()->string('privacy.policy.contact'),
        ]));
    }
}
