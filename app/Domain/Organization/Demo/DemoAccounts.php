<?php

namespace App\Domain\Organization\Demo;

use App\Domain\Organization\Enums\Role;

/**
 * Fixed list of local demo accounts (password `password`). Five of them are
 * personas of the account switcher at the top of the shell (switcher()).
 *
 * Demo login is only available when APP_ENV=local AND DEMO_LOGIN_ENABLED=true.
 * Production sign-in is Google Workspace (GoogleLoginController).
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
            new DemoAccount('admin@demo.test', 'Admin Sistem', Role::SuperAdmin, 'Admin'),
            new DemoAccount('direksi@demo.test', 'Hendra Wijaya', Role::Direksi, 'Direksi & manajemen'),
            new DemoAccount('hr@demo.test', 'Hana Pratiwi', Role::Hr, 'Staf admin & HR'),
            new DemoAccount('kadiv@demo.test', 'Dimas Pratama', Role::KepalaDivisi),
            new DemoAccount('anggota@demo.test', 'Rizky Aditya', Role::Anggota),
            new DemoAccount('programmer@demo.test', 'Arif Nugroho', Role::Anggota, 'Staf programmer'),
            new DemoAccount('maya.lestari@demo.test', 'Maya Lestari', Role::Anggota, 'Staf sosial media, branding & marketing'),
            // Hiring (6 Oct 2026): default final approvers of new positions (HiringDemoSeeder).
            new DemoAccount('faris@demo.test', 'Faris', Role::Direksi, 'Penyetuju akhir hiring'),
            new DemoAccount('dio@demo.test', 'Dio', Role::Direksi, 'Penyetuju akhir hiring'),
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
     * Personas of the shell's account switcher, in menu order (staff first).
     *
     * @return list<DemoAccount>
     */
    public static function switcher(): array
    {
        $order = ['programmer@demo.test', 'hr@demo.test', 'maya.lestari@demo.test', 'admin@demo.test', 'direksi@demo.test', 'faris@demo.test', 'dio@demo.test'];
        $accounts = array_column(array_map(fn (DemoAccount $account): array => [$account->email, $account], self::all()), 1, 0);

        return array_map(fn (string $email): DemoAccount => $accounts[$email], $order);
    }

    /**
     * Shared prop `demoSwitcher` (account switcher at the top of the shell);
     * null when demo login is disabled.
     *
     * @return list<array{email: string, name: string, persona: string, role_label: string, current: bool}>|null
     */
    public static function switcherProps(?string $currentEmail): ?array
    {
        if (! self::enabled()) {
            return null;
        }

        return array_map(fn (DemoAccount $account): array => [
            'email' => $account->email,
            'name' => $account->name,
            'persona' => (string) $account->persona,
            'role_label' => $account->role->label(),
            'current' => $account->email === $currentEmail,
        ], self::switcher());
    }

    /**
     * Props for the login page; empty when demo login is disabled.
     *
     * @return list<array{email: string, name: string, role_label: string, persona: string|null}>
     */
    public static function loginPageProps(): array
    {
        if (! self::enabled()) {
            return [];
        }

        return array_map(fn (DemoAccount $account): array => $account->toProps(), self::all());
    }
}
