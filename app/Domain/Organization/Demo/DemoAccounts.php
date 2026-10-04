<?php

namespace App\Domain\Organization\Demo;

use App\Domain\Organization\Enums\Role;

/**
 * Fixed list of local demo accounts (password `password`).
 *
 * Demo login is only available when APP_ENV=local AND DEMO_LOGIN_ENABLED=true.
 * Sprint 1 replaces this with Google login.
 */
final class DemoAccounts
{
    public const string PASSWORD = 'password';

    /**
     * Evaluated per request so the environment/config at request time decides.
     */
    public static function enabled(): bool
    {
        return app()->environment('local') && config()->boolean('app.demo_login');
    }

    /**
     * @return list<DemoAccount>
     */
    public static function all(): array
    {
        return [
            new DemoAccount('admin@demo.test', 'Admin Sistem', Role::SuperAdmin),
            new DemoAccount('direksi@demo.test', 'Hendra Wijaya', Role::Direksi),
            new DemoAccount('hr@demo.test', 'Hana Pratiwi', Role::Hr),
            new DemoAccount('kadiv@demo.test', 'Dimas Pratama', Role::KepalaDivisi),
            new DemoAccount('anggota@demo.test', 'Rizky Aditya', Role::Anggota),
        ];
    }

    /**
     * @return list<string>
     */
    public static function emails(): array
    {
        return array_map(fn (DemoAccount $account): string => $account->email, self::all());
    }

    /**
     * Props for the login page; empty when demo login is disabled.
     *
     * @return list<array{email: string, name: string, role_label: string}>
     */
    public static function loginPageProps(): array
    {
        if (! self::enabled()) {
            return [];
        }

        return array_map(fn (DemoAccount $account): array => $account->toProps(), self::all());
    }
}
