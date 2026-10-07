<?php

use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Audit rapat 2026-10 (docs/security/AUDIT-RAPAT-2026-10.md, R-10): while
 * "wajib ganti kata sandi" is on — e.g. someone signed in with the shared
 * default password — no route or shared prop may reveal the account's data.
 * Only the security page, the password update, Super Admin TOTP setup,
 * verification, theme and logout stay reachable.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->company = Company::factory()->create();
    $this->employee = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create();
    $this->employee->forceFill(['password' => 'sementara-123', 'password_change_required' => true])->saveQuietly();
});

it('allows only the password-change flow', function () {
    expect(EnsurePasswordChanged::ALLOWED_ROUTES)->toEqualCanonicalizing([
        'security.edit',
        'user-password.update',
        'password.confirm',
        'password.confirm.store',
        'password.confirmation',
        'two-factor.enable',
        'two-factor.confirm',
        'two-factor.disable',
        'two-factor.qr-code',
        'two-factor.secret-key',
        'two-factor.recovery-codes',
        'two-factor.regenerate-recovery-codes',
        'verification.notice',
        'verification.verify',
        'verification.send',
        'theme.update',
        'logout',
    ]);
});

it('refuses the notification feed and other JSON endpoints', function () {
    $this->actingAs($this->employee)->getJson(route('inbox.feed'))->assertForbidden();
    $this->actingAs($this->employee)->getJson('/cari/hasil?q=ab')->assertForbidden();
});

it('shares no account data on the security page', function () {
    $workspace = Workspace::factory()->create(['company_id' => $this->company->id]);
    $workspace->members()->attach($this->employee->id, ['role' => 'member']);

    $this->actingAs($this->employee)->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $this->employee->id)
            ->where('approvals', null)
            ->where('inbox', null)
            ->where('workspaces', [])
            ->where('chatUnread', null)
            ->where('attendanceStatus', null));
});

it('shares the shell data again once the password is changed', function () {
    $this->employee->forceFill(['password_change_required' => false])->saveQuietly();

    $this->actingAs($this->employee)->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 0)
            ->where('approvals.pending', 0));
});
