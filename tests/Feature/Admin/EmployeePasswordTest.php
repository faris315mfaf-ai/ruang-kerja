<?php

use App\Domain\Auth\Actions\SetEmployeePassword;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\InboxNotification;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Admin › Karyawan › Atur kata sandi (owner decision 6 Oct 2026).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create();
    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['name' => 'Hana Personalia']);
    $this->employee = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create([
        'name' => 'Rizky Aditya',
        'email' => 'rizky@kantor.test',
    ]);
});

function setPassword(User $actor, User $employee, array $data): TestResponse
{
    return test()->actingAs($actor)
        ->from(route('admin.employees.show', $employee))
        ->post(route('admin.employees.password', $employee), $data);
}

it('lets HR type a new password, signs the employee out everywhere and audits without the value', function () {
    $oldRemember = 'token-lama';
    $this->employee->forceFill(['remember_token' => $oldRemember])->saveQuietly();

    setPassword($this->hr, $this->employee, [
        'mode' => 'manual',
        'password' => 'sandi-dari-hr-1',
        'password_confirmation' => 'sandi-dari-hr-1',
        'must_change' => false,
    ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.employees.show', $this->employee));

    $employee = $this->employee->refresh();
    expect(Hash::check('sandi-dari-hr-1', (string) $employee->password))->toBeTrue()
        ->and($employee->password_change_required)->toBeFalse()
        ->and($employee->remember_token)->not->toBe($oldRemember);

    $audit = AuditLog::query()->where('action', 'user.password_set_by_hr')->sole();
    expect($audit->user_id)->toBe($this->hr->id)
        ->and($audit->auditable_id)->toBe($employee->id)
        ->and($audit->new_values)->toBe(['mode' => 'manual', 'must_change' => false])
        ->and(json_encode([$audit->old_values, $audit->new_values]))->not->toContain('sandi-dari-hr-1')
        ->and(AuditLog::query()->where('action', 'user.updated')->count())->toBe(0);
});

it('no longer generates a random password (mode removed)', function () {
    $this->actingAs($this->hr)
        ->postJson(route('admin.employees.password', $this->employee), ['mode' => 'generate', 'must_change' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mode');

    expect(Hash::check('password', (string) $this->employee->refresh()->password))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'user.password_set_by_hr')->exists())->toBeFalse()
        ->and(session()->get(SessionKey::FLASH_DATA, []))->not->toHaveKey('generatedPassword');
});

it('validates a typed password (confirmed, a known mode)', function (array $data, string $field) {
    setPassword($this->hr, $this->employee, ['mode' => 'manual', 'must_change' => true, ...$data])
        ->assertSessionHasErrors($field);

    expect(Hash::check('password', (string) $this->employee->refresh()->password))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'user.password_set_by_hr')->exists())->toBeFalse();
})->with([
    'empty' => [['password' => '', 'password_confirmation' => ''], 'password'],
    'not confirmed' => [['password' => 'sandi-baru-1', 'password_confirmation' => 'beda-sandi-1'], 'password'],
    'no mode' => [['mode' => 'acak', 'password' => 'sandi-baru-1', 'password_confirmation' => 'sandi-baru-1'], 'mode'],
    'default while off' => [['mode' => 'default'], 'mode'],
]);

it('notifies the employee in-app and by email without the password', function () {
    Notification::fake();

    setPassword($this->hr, $this->employee, [
        'mode' => 'manual',
        'password' => 'sandi-dari-hr-1',
        'password_confirmation' => 'sandi-dari-hr-1',
        'must_change' => true,
    ]);

    Notification::assertSentTo($this->employee, PasswordSetByHrNotification::class, function (PasswordSetByHrNotification $notification, array $channels) {
        $payload = $notification->payload($this->employee);

        return $notification->type() === NotificationType::PasswordSetByHr
            && in_array('mail', $channels, true)
            && $payload->title === 'Kata sandi Anda diatur ulang oleh HR'
            && ! str_contains(json_encode($payload->toArray($notification->type())), 'sandi-dari-hr-1');
    });
});

it('writes the in-app notification for the employee', function () {
    setPassword($this->hr, $this->employee, ['mode' => 'manual', 'password' => 'sandi-dari-hr-1', 'password_confirmation' => 'sandi-dari-hr-1', 'must_change' => true]);

    expect(InboxNotification::query()->where('notifiable_id', $this->employee->id)->sole()->type)
        ->toBe('account.password_set_by_hr');
});

it('keeps the security email on even when the employee switched email off elsewhere', function () {
    $event = NotificationType::PasswordSetByHr->event();

    expect($event->isLocked(NotificationChannel::Email))->toBeTrue()
        ->and($event->isLocked(NotificationChannel::InApp))->toBeTrue();
});

it('signs out the employee\'s existing sessions', function () {
    // The employee's browser is signed in (its session stores the password hash).
    $this->actingAs($this->employee)->get('/dashboard')->assertOk();

    app(SetEmployeePassword::class)->handle($this->hr, $this->employee->fresh(), 'sandi-dari-hr-1', false);

    // That browser's next request: the stored hash no longer matches.
    Auth::forgetGuards();
    $this->actingAs(User::query()->findOrFail($this->employee->id))
        ->get('/dashboard')
        ->assertRedirect(route('login'));

    $this->assertGuest();
});

it('closes an open "Lupa kata sandi" request of the employee and resolves HR\'s item', function () {
    $request = PasswordResetRequest::query()->create([
        'company_id' => $this->company->id,
        'user_id' => $this->employee->id,
        'email' => $this->employee->email,
        'request_token_hash' => hash('sha256', 'x'),
        'expires_at' => CarbonImmutable::now()->addDay(),
    ]);

    setPassword($this->hr, $this->employee, ['mode' => 'manual', 'password' => 'sandi-dari-hr-1', 'password_confirmation' => 'sandi-dari-hr-1', 'must_change' => true]);

    expect($request->refresh()->status)->toBe(PasswordResetStatus::Canceled);
});

it('applies the authorization matrix over HTTP', function (Role $actorRole, Role $targetRole, int $status) {
    $actor = User::factory()->forCompany($this->company)->withRole($actorRole)->create();
    $target = User::factory()->forCompany($this->company)->withRole($targetRole)->create();

    $response = setPassword($actor, $target, ['mode' => 'manual', 'password' => 'sandi-dari-hr-1', 'password_confirmation' => 'sandi-dari-hr-1', 'must_change' => true]);

    $status === 302 ? $response->assertRedirect() : $response->assertStatus($status);
    expect(Hash::check('password', (string) $target->refresh()->password))->toBe($status !== 302);
})->with([
    'hr → anggota' => [Role::Hr, Role::Anggota, 302],
    'hr → direksi' => [Role::Hr, Role::Direksi, 403],
    'hr → hr' => [Role::Hr, Role::Hr, 403],
    'hr → super admin' => [Role::Hr, Role::SuperAdmin, 403],
    'super admin → super admin' => [Role::SuperAdmin, Role::SuperAdmin, 302],
    'super admin → direksi' => [Role::SuperAdmin, Role::Direksi, 302],
    'super admin → hr' => [Role::SuperAdmin, Role::Hr, 302],
    'super admin → anggota' => [Role::SuperAdmin, Role::Anggota, 302],
    'direksi → anggota' => [Role::Direksi, Role::Anggota, 403],
    'kadiv → anggota' => [Role::KepalaDivisi, Role::Anggota, 403],
    'anggota → anggota' => [Role::Anggota, Role::Anggota, 403],
]);

it('does not let HR set their own password through this route', function () {
    setPassword($this->hr, $this->hr, ['mode' => 'manual', 'password' => 'sandi-dari-hr-1', 'password_confirmation' => 'sandi-dari-hr-1', 'must_change' => true])->assertForbidden();
});

it('does not let HR touch another company\'s employee', function () {
    $foreign = User::factory()->forCompany(Company::factory()->create())->withRole(Role::Anggota)->create();

    setPassword($this->hr, $foreign, ['mode' => 'manual', 'password' => 'sandi-dari-hr-1', 'password_confirmation' => 'sandi-dari-hr-1', 'must_change' => true])->assertForbidden();
});

it('shows "Atur kata sandi" and whether a password is set on the profile to HR only', function () {
    $this->actingAs($this->hr)
        ->get(route('admin.employees.show', $this->employee))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.setPassword', true)
            ->where('can.setDefaultPassword', false)
            ->where('hasPassword', true)
            ->where('passwordReset', null),
        );

    $kadiv = User::factory()->forCompany($this->company)->withRole(Role::KepalaDivisi)->create();
    $this->employee->forceFill(['manager_id' => $kadiv->id])->saveQuietly();

    $this->actingAs($kadiv)
        ->get(route('admin.employees.show', $this->employee))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.setPassword', false)
            ->where('hasPassword', null),
        );

    // Audit R-06: HR sees a direksi profile but cannot set their password there.
    $direksi = User::factory()->forCompany($this->company)->withRole(Role::Direksi)->create();

    $this->actingAs($this->hr)
        ->get(route('admin.employees.show', $direksi))
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.setPassword', false)
            ->where('can.setDefaultPassword', false),
        );
});

describe('wajib ganti saat login berikutnya', function () {
    beforeEach(function () {
        $this->employee->forceFill(['password' => 'sementara-123', 'password_change_required' => true])->saveQuietly();
    });

    it('sends the employee to the security page until they change it', function () {
        $this->actingAs($this->employee)->get('/dashboard')->assertRedirect(route('security.edit'));
        $this->actingAs($this->employee)->get(route('tasks.mine'))->assertRedirect(route('security.edit'));
        $this->actingAs($this->employee)->getJson('/cari/hasil?q=ab')->assertForbidden();
        // No data endpoint either, not even the shell's notification feed (audit R-10).
        $this->actingAs($this->employee)->getJson(route('inbox.feed'))->assertForbidden();

        $this->actingAs($this->employee)
            ->get(route('security.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('passwordChangeRequired', true));
    });

    it('still lets them sign out', function () {
        $this->actingAs($this->employee)->post(route('logout'))->assertRedirect(route('home'));
    });

    it('lets them in after choosing their own password', function () {
        $this->actingAs($this->employee)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'sementara-123',
                'password' => 'sandi-sendiri-1',
                'password_confirmation' => 'sandi-sendiri-1',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('dashboard'));

        expect($this->employee->refresh()->password_change_required)->toBeFalse()
            ->and(AuditLog::query()->where('action', 'user.password_changed')->sole()->new_values)
            ->toBe(['required_change' => true]);

        $this->actingAs($this->employee)->get('/dashboard')->assertOk();
    });

    it('applies after signing in with the temporary password', function () {
        $this->post(route('login.store'), ['email' => $this->employee->email, 'password' => 'sementara-123'])
            ->assertRedirect('/dashboard');

        $this->get('/dashboard')
            ->assertRedirect(route('security.edit'))
            ->assertInertiaFlash('toast.message', EnsurePasswordChanged::MESSAGE);
    });

    it('uses the documented message', function () {
        expect(EnsurePasswordChanged::MESSAGE)->toContain('Ganti kata sandi bawaan atau sementara');
    });
});
