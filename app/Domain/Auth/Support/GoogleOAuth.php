<?php

namespace App\Domain\Auth\Support;

use App\Domain\Tenancy\Support\SoleCompany;

/**
 * Google OAuth client settings (config/services.php `google`).
 */
final class GoogleOAuth
{
    /**
     * True when client id, secret and redirect URI are all set.
     */
    public static function configured(): bool
    {
        foreach (['client_id', 'client_secret', 'redirect'] as $key) {
            $value = config("services.google.{$key}");

            if (! is_string($value) || trim($value) === '') {
                return false;
            }
        }

        return true;
    }

    /**
     * Workspace domain passed to Google as the `hd` hint (account chooser filter):
     * only for a single-company installation — with several companies any of
     * their domains may sign in. The hint is UX only — the callback re-checks.
     */
    public static function hintDomain(): ?string
    {
        $domain = SoleCompany::get(['id', 'google_domain'])?->google_domain;

        return is_string($domain) ? $domain : null;
    }
}
