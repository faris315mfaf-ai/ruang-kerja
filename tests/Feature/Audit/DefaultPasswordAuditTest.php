<?php

use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/*
 * Audit rapat 2026-10 (docs/security/AUDIT-RAPAT-2026-10.md, R-01): an
 * account must never stay on the company-wide default password without
 * "wajib ganti" — otherwise every colleague who knows the value can sign in
 * as that person indefinitely.
 */
const AUDIT_DEFAULT_PASSWORD = 'SandiBawaanAudit1';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['auth.employee_default_password' => AUDIT_DEFAULT_PASSWORD]);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create();
    $this->employee = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create(['email' => 'rizky@kantor.test']);
});

it('always requires a change when HR gives the default password, even with must_change off', function () {
    $this->actingAs($this->hr)
        ->from(route('admin.employees.show', $this->employee))
        ->post(route('admin.employees.password', $this->employee), ['mode' => 'default', 'must_change' => false])
        ->assertSessionHasNoErrors();

    $employee = $this->employee->refresh();
    expect(Hash::check(AUDIT_DEFAULT_PASSWORD, (string) $employee->password))->toBeTrue()
        ->and($employee->password_change_required)->toBeTrue();

    expect(AuditLog::query()->where('action', 'user.password_set_by_hr')->sole()->new_values)
        ->toBe(['mode' => 'default', 'must_change' => true]);
});

it('still lets HR skip the forced change for a password typed by hand', function () {
    $this->actingAs($this->hr)
        ->from(route('admin.employees.show', $this->employee))
        ->post(route('admin.employees.password', $this->employee), [
            'mode' => 'manual', 'password' => 'kopi-pagi', 'password_confirmation' => 'kopi-pagi', 'must_change' => false,
        ])
        ->assertSessionHasNoErrors();

    expect($this->employee->refresh()->password_change_required)->toBeFalse();
});

it('forces the change when someone signs in with the default password but the flag is missing', function () {
    // An account left on the default password without the flag (e.g. set before this fix).
    $this->employee->forceFill(['password' => Hash::make(AUDIT_DEFAULT_PASSWORD), 'password_change_required' => false])->saveQuietly();

    $this->post('/login', ['email' => 'rizky@kantor.test', 'password' => AUDIT_DEFAULT_PASSWORD]);

    $this->assertAuthenticatedAs($this->employee);
    expect($this->employee->refresh()->password_change_required)->toBeTrue();
    $this->get(route('dashboard'))->assertRedirect(route('security.edit'));
});

it('does not touch accounts that sign in with their own password', function () {
    $this->employee->forceFill(['password' => Hash::make('milik-sendiri'), 'password_change_required' => false])->saveQuietly();

    $this->post('/login', ['email' => 'rizky@kantor.test', 'password' => 'milik-sendiri']);

    $this->assertAuthenticatedAs($this->employee);
    expect($this->employee->refresh()->password_change_required)->toBeFalse();
});
