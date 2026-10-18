<?php

namespace App\Domain\Tenancy\Support;

use App\Domain\Tenancy\CompanyContext;
use App\Models\Company;
use App\Models\User;

/**
 * The company name printed on emails (and other non-Inertia surfaces): the
 * recipient's company, else the current CompanyContext (queued notifications
 * restore it, CompanyAware), else BRANDING_COMPANY_NAME (no company at all).
 * Never a fixed name shared by every company (Fase 1 multi-perusahaan).
 */
final class CompanyBranding
{
    public static function name(?string $explicit = null, mixed $recipient = null): ?string
    {
        if (is_string($explicit) && trim($explicit) !== '') {
            return $explicit;
        }

        $companyId = $recipient instanceof User ? ($recipient->getAttributes()['company_id'] ?? null) : null;

        if ($recipient instanceof User && is_string($companyId)) {
            $name = $recipient->relationLoaded('company')
                ? $recipient->company->name
                : Company::query()->whereKey($companyId)->value('name');

            if (is_string($name) && $name !== '') {
                return $name;
            }
        }

        $context = app(CompanyContext::class)->company()?->name;

        if (is_string($context) && $context !== '') {
            return $context;
        }

        $configured = config('branding.company_name');

        return is_string($configured) && $configured !== '' ? $configured : null;
    }
}
