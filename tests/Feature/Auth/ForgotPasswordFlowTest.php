<?php

use App\Domain\Auth\Actions\CompletePasswordReset;
use App\Domain\Auth\Actions\RequestPasswordReset;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Notifications\PasswordResetRequestedNotification;
use App\Domain\Auth\Rules\NotDefaultPassword;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\InboxNotification;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Timebox;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * "Lupa kata sandi" with HR approval (owner decision 6 Oct 2026):
 * request → waiting page polls → HR approves → new password → signed in.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create();
    $this->hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create(['name' => 'Hana Personalia']);
    $this->admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['name' => 'Admin Sistem']);
    $this->employee = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create([
        'name' => 'Rizky Aditya',
        'email' => 'rizky@kantor.test',
    ]);

    // The timebox only equalizes timing; skip the sleep in tests (asserted separately).
    $this->app->bind(Timebox::class, fn () => new class extends Timebox
    {
        public function call(callable $callback, int $microseconds)
        {
            return $callback($this);
        }
    });
});

function requestReset(string $email): TestResponse
{
    return test()->from(route('password-reset.create'))->post(route('password-reset.store'), ['email' => $email]);
}

function resetStatus(): TestResponse
{
    return test()->getJson(route('password-reset.status'));
}

function pendingRequestOf(User $user): PasswordResetRequest
{
    return PasswordResetRequest::query()->where('user_id', $user->id)->where('status', 'pending')->sole();
}

/**
 * HR's decision only (no switch back to the employee's browser), to assert
 * validation errors.
 */
function postDecision(User $actor, PasswordResetRequest $request, bool $approve, string $reason = 'Tidak bisa dikonfirmasi'): TestResponse
{
    return test()->actingAs($actor)
        ->from(route('admin.employees.index'))
        ->post($approve
            ? route('admin.employees.password-resets.approve', $request->id)
            : route('admin.employees.password-resets.reject', $request->id), $approve ? [] : ['reason' => $reason]);
}

function decideReset(User $actor, PasswordResetRequest $request, bool $approve, string $reason = 'Tidak bisa dikonfirmasi'): TestResponse
{
    $session = session()->all();

    $response = test()->actingAs($actor)
        ->from(route('admin.employees.index'))
        ->post($approve
            ? route('admin.employees.password-resets.approve', $request->id)
            : route('admin.employees.password-resets.reject', $request->id), $approve ? [] : ['reason' => $reason]);

    // Back to the employee's browser: a guest with its own session.
    auth()->logout();
    test()->flushSession();
    test()->withSession($session);

    return $response;
}

describe('requesting', function () {
    it('renders the form for guests and sends signed-in users away', function () {
        $this->get(route('password-reset.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('auth/forgot-password')->where('email', null));

        $this->actingAs($this->employee)->get(route('password-reset.create'))->assertRedirect();
    });

    it('creates a pending request for an active employee and keeps only the token hash', function () {
        $this->travelTo(now()->setDateTime(2026, 10, 6, 2, 0));

        requestReset('  Rizky@Kantor.test ')->assertRedirect(route('password-reset.waiting'));

        $request = pendingRequestOf($this->employee);
        $token = PasswordResetSession::from(session()->driver())?->token;

        expect($request->company_id)->toBe($this->company->id)
            ->and($request->email)->toBe('rizky@kantor.test')
            ->and($request->request_token_hash)->toBe(hash('sha256', (string) $token))
            ->and($request->request_token_hash)->not->toBe($token)
            ->and($request->expires_at->toIso8601String())->toBe(now()->addDay()->toIso8601String())
            ->and($request->ip)->toBe('127.0.0.1');
    });

    it('answers exactly the same for unknown and inactive addresses, without a row', function (string $email) {
        User::factory()->forCompany($this->company)->inactive()->withRole(Role::Anggota)->create(['email' => 'nonaktif@kantor.test']);

        $known = requestReset($this->employee->email);
        $knownWaiting = $this->get(route('password-reset.waiting'));
        $knownStatus = resetStatus()->json();
        $this->flushSession();

        $other = requestReset($email);
        $otherWaiting = $this->get(route('password-reset.waiting'));

        expect($other->headers->get('Location'))->toBe($known->headers->get('Location'))
            ->and($other->getStatusCode())->toBe($known->getStatusCode())
            ->and(resetStatus()->json())->toBe($knownStatus)->toBe(['status' => 'pending'])
            ->and(PasswordResetRequest::query()->count())->toBe(1);

        $props = fn (TestResponse $response): array => collect($response->viewData('page')['props'])
            ->only(['status', 'reason'])->all();
        expect($props($otherWaiting))->toBe($props($knownWaiting));
        $otherWaiting->assertInertia(fn (Assert $page) => $page
            ->component('auth/password-reset-waiting')
            ->where('email', $email)
            ->where('status', 'pending'));
    })->with(['tidak-ada@kantor.test', 'nonaktif@kantor.test']);

    it('runs every request inside the same 400 ms timebox', function (string $email) {
        $calls = [];
        $this->app->bind(Timebox::class, function () use (&$calls) {
            return new class($calls) extends Timebox
            {
                public function __construct(private array &$calls) {}

                public function call(callable $callback, int $microseconds)
                {
                    $this->calls[] = $microseconds;

                    return $callback($this);
                }
            };
        });

        requestReset($email);

        expect($calls)->toBe([RequestPasswordReset::TIMEBOX_MICROSECONDS])
            ->and(RequestPasswordReset::TIMEBOX_MICROSECONDS)->toBe(400_000);
    })->with(['rizky@kantor.test', 'tidak-ada@kantor.test']);

    it('notifies HR (action required), not the Super Admin', function () {
        Notification::fake();

        requestReset($this->employee->email);

        Notification::assertSentTo($this->hr, PasswordResetRequestedNotification::class, function ($notification, array $channels) {
            return $notification->requiresAction() && in_array('mail', $channels, true);
        });
        Notification::assertNotSentTo([$this->admin, $this->employee], PasswordResetRequestedNotification::class);
    });

    it('sends a Super Admin\'s request to the other Super Admins only', function () {
        Notification::fake();
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();

        requestReset($this->admin->email);

        Notification::assertSentTo($otherAdmin, PasswordResetRequestedNotification::class);
        Notification::assertNotSentTo([$this->hr, $this->admin], PasswordResetRequestedNotification::class);
    });

    it('falls back to the Super Admins when the company has no active HR', function () {
        Notification::fake();
        $this->hr->forceFill(['status' => 'inactive'])->saveQuietly();

        requestReset($this->employee->email);

        Notification::assertSentTo($this->admin, PasswordResetRequestedNotification::class);
    });

    it('keeps one open request per employee: a new one cancels the previous (without telling the old browser)', function () {
        requestReset($this->employee->email);
        $first = pendingRequestOf($this->employee);
        $firstSession = session()->all();

        $this->flushSession();
        requestReset($this->employee->email);
        $second = pendingRequestOf($this->employee);

        expect($first->refresh()->status)->toBe(PasswordResetStatus::Canceled)
            ->and($second->id)->not->toBe($first->id)
            ->and(PasswordResetRequest::query()->where('status', 'pending')->count())->toBe(1)
            ->and(InboxNotification::query()->where('subject_id', $first->id)->whereNull('resolved_at')->count())->toBe(0);

        // The first browser still reads "pending" (a canceled row must not reveal the account).
        $this->flushSession();
        $this->withSession($firstSession);
        resetStatus()->assertExactJson(['status' => 'pending']);
    });

    it('validates the email format only', function () {
        requestReset('bukan-email')->assertSessionHasErrors('email');
        expect(PasswordResetRequest::query()->count())->toBe(0);
    });

    it('is throttled per IP', function () {
        foreach (range(1, 5) as $attempt) {
            requestReset("orang{$attempt}@kantor.test")->assertRedirect();
        }

        requestReset('lagi@kantor.test')->assertTooManyRequests();
    });

    it('is throttled per address (5 per hour), across IPs', function () {
        foreach (range(1, 5) as $attempt) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$attempt}"]);
            requestReset($this->employee->email)->assertRedirect();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.99']);
        requestReset('RIZKY@kantor.test')->assertTooManyRequests();
    });
});

describe('waiting page and status', function () {
    it('sends a browser without a request back to the form', function () {
        $this->get(route('password-reset.waiting'))->assertRedirect(route('password-reset.create'));
        resetStatus()->assertExactJson(['status' => 'expired']);
    });

    it('answers {status} only, pending while HR has not decided', function () {
        requestReset($this->employee->email);

        resetStatus()->assertOk()->assertExactJson(['status' => 'pending']);
        $this->get(route('password-reset.waiting'))->assertInertia(fn (Assert $page) => $page
            ->where('status', 'pending')
            ->where('reason', null)
            ->has('expiresAt'));
    });

    it('expires after 24 hours, known or unknown address, and resolves HR\'s item', function (string $email) {
        requestReset($email);

        $this->travel(23)->hours();
        resetStatus()->assertExactJson(['status' => 'pending']);

        $this->travel(61)->minutes();
        resetStatus()->assertExactJson(['status' => 'expired']);

        if ($email === 'rizky@kantor.test') {
            $request = PasswordResetRequest::query()->sole();
            expect($request->status)->toBe(PasswordResetStatus::Expired)
                ->and(InboxNotification::query()->where('subject_id', $request->id)->sole()->resolved_at)->not->toBeNull();
        }
    })->with(['rizky@kantor.test', 'tidak-ada@kantor.test']);

    it('is throttled to 30 checks per minute per session', function () {
        requestReset($this->employee->email);

        foreach (range(1, 30) as $check) {
            resetStatus()->assertOk();
        }

        resetStatus()->assertTooManyRequests();
    });
});

describe('HR decision', function () {
    beforeEach(function () {
        requestReset($this->employee->email);
        $this->resetRequest = pendingRequestOf($this->employee);
    });

    it('shows pending requests to HR on Admin › Karyawan and on the profile', function () {
        $this->actingAs($this->hr)->get(route('admin.employees.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('passwordResets', 1)
                ->where('passwordResets.0.id', $this->resetRequest->id)
                ->where('passwordResets.0.employee.name', 'Rizky Aditya'));

        $this->actingAs($this->hr)->get(route('admin.employees.show', $this->employee))
            ->assertInertia(fn (Assert $page) => $page->where('passwordReset.id', $this->resetRequest->id));
    });

    it('hides requests from roles that cannot decide them', function (Role $role) {
        $viewer = User::factory()->forCompany($this->company)->withRole($role)->create();

        $this->actingAs($viewer)->get(route('admin.employees.index'))
            ->assertInertia(fn (Assert $page) => $page->where('passwordResets', []));
    })->with([Role::Direksi, Role::KepalaDivisi]);

    it('lets HR approve; the waiting browser moves on and sets the new password, then is signed in', function () {
        $this->travelTo(now()->setDateTime(2026, 10, 6, 3, 0));

        decideReset($this->hr, $this->resetRequest, true)->assertSessionHasNoErrors()->assertRedirect();

        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Approved)
            ->and($this->resetRequest->decided_by)->toBe($this->hr->id)
            ->and(InboxNotification::query()->where('subject_id', $this->resetRequest->id)->whereNull('resolved_at')->count())->toBe(0);

        // Polling sees the approval; the page then redirects to the form.
        resetStatus()->assertExactJson(['status' => 'approved']);
        $this->get(route('password-reset.waiting'))->assertRedirect(route('password-reset.edit'));
        $this->get(route('password-reset.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('auth/password-reset-new')
                ->where('email', 'rizky@kantor.test')
                ->where('expiresAt', now()->addMinutes(30)->toIso8601String()));

        $this->post(route('password-reset.update'), [
            'password' => 'sandi-baru-rizky',
            'password_confirmation' => 'sandi-baru-rizky',
        ])->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($this->employee);
        expect(session(LoginMethod::SESSION_KEY))->toBe('password')
            ->and(Hash::check('sandi-baru-rizky', (string) $this->employee->refresh()->password))->toBeTrue()
            ->and($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Used)
            ->and($this->resetRequest->setup_token_hash)->toBeNull()
            ->and(session(PasswordResetSession::KEY))->toBeNull();

        $this->get('/dashboard')->assertOk();

        // The new password works for a normal sign-in too.
        auth()->logout();
        $this->post(route('login.store'), ['email' => 'rizky@kantor.test', 'password' => 'sandi-baru-rizky'])
            ->assertRedirect('/dashboard');
    });

    it('audits every step without the password', function () {
        decideReset($this->hr, $this->resetRequest, true);
        resetStatus();
        $this->post(route('password-reset.update'), [
            'password' => 'sandi-baru-rizky',
            'password_confirmation' => 'sandi-baru-rizky',
        ]);

        $approved = AuditLog::query()->where('action', 'user.password_reset_approved')->sole();
        $completed = AuditLog::query()->where('action', 'user.password_reset_completed')->sole();

        expect($approved->user_id)->toBe($this->hr->id)
            ->and($approved->auditable_id)->toBe($this->employee->id)
            ->and($completed->user_id)->toBe($this->employee->id)
            ->and($completed->new_values)->toBe(['request_id' => $this->resetRequest->id])
            ->and(AuditLog::query()->get()->pluck('new_values')->toJson())->not->toContain('sandi-baru-rizky');
    });

    it('signs out the employee\'s other devices when the new password is saved', function () {
        $user = $this->employee;
        $user->forceFill(['remember_token' => 'token-lama'])->saveQuietly();

        decideReset($this->hr, $this->resetRequest, true);
        resetStatus();
        $this->post(route('password-reset.update'), [
            'password' => 'sandi-baru-rizky',
            'password_confirmation' => 'sandi-baru-rizky',
        ]);

        expect($user->refresh()->remember_token)->not->toBe('token-lama');
    });

    it('rejects with a required reason that the waiting page shows', function () {
        postDecision($this->hr, $this->resetRequest, false, '')->assertSessionHasErrors('reason');
        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Pending);

        decideReset($this->hr, $this->resetRequest, false, 'Tidak bisa dikonfirmasi lewat telepon')->assertRedirect();

        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Rejected)
            ->and(AuditLog::query()->where('action', 'user.password_reset_rejected')->sole()->new_values)
            ->toMatchArray(['status' => 'rejected', 'reason' => 'Tidak bisa dikonfirmasi lewat telepon']);

        resetStatus()->assertExactJson(['status' => 'rejected']);
        $this->get(route('password-reset.waiting'))->assertInertia(fn (Assert $page) => $page
            ->where('status', 'rejected')
            ->where('reason', 'Tidak bisa dikonfirmasi lewat telepon'));
        $this->get(route('password-reset.edit'))->assertRedirect(route('password-reset.waiting'));
    });

    it('cannot be decided twice', function () {
        decideReset($this->hr, $this->resetRequest, true);

        postDecision($this->hr, $this->resetRequest, false)->assertSessionHasErrors('request');
        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Approved);
    });

    it('cannot be approved after 24 hours', function () {
        $this->travel(25)->hours();

        postDecision($this->hr, $this->resetRequest, true)->assertSessionHasErrors('request');
        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Expired);
    });

    it('cannot approve a request of an employee deactivated meanwhile', function () {
        $this->employee->forceFill(['status' => 'inactive'])->saveQuietly();

        postDecision($this->hr, $this->resetRequest, true)->assertSessionHasErrors('request');
    });

    it('expires 30 minutes after approval when no password was set', function () {
        decideReset($this->hr, $this->resetRequest, true);
        resetStatus()->assertExactJson(['status' => 'approved']);

        $this->travel(31)->minutes();

        $this->get(route('password-reset.edit'))->assertRedirect(route('password-reset.waiting'));
        resetStatus()->assertExactJson(['status' => 'expired']);
        $this->post(route('password-reset.update'), [
            'password' => 'sandi-baru-rizky',
            'password_confirmation' => 'sandi-baru-rizky',
        ])->assertRedirect(route('password-reset.waiting'));

        expect(Hash::check('password', (string) $this->employee->refresh()->password))->toBeTrue()
            ->and($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Expired);
    });

    it('binds the setup token to the requesting browser: another session gets nothing', function () {
        decideReset($this->hr, $this->resetRequest, true);

        // Another browser (no request token) cannot reach the form nor read the status.
        $this->flushSession();
        $this->get(route('password-reset.edit'))->assertRedirect(route('password-reset.create'));
        resetStatus()->assertExactJson(['status' => 'expired']);
        $this->post(route('password-reset.update'), [
            'password' => 'sandi-penyusup-1',
            'password_confirmation' => 'sandi-penyusup-1',
        ])->assertRedirect(route('password-reset.waiting'));

        expect(Hash::check('password', (string) $this->employee->refresh()->password))->toBeTrue();
    });

    it('accepts the setup token only once', function () {
        decideReset($this->hr, $this->resetRequest, true);
        resetStatus();
        $setupToken = PasswordResetSession::from(session()->driver())?->setupToken;

        $this->post(route('password-reset.update'), [
            'password' => 'sandi-baru-rizky',
            'password_confirmation' => 'sandi-baru-rizky',
        ]);
        auth()->logout();

        // Replaying the same setup token in a fresh session is refused.
        $this->flushSession();
        $this->withSession([PasswordResetSession::KEY => [
            'token' => 'apa-saja', 'email' => 'rizky@kantor.test', 'requested_at' => now()->getTimestamp(), 'setup_token' => $setupToken,
        ]]);
        $this->post(route('password-reset.update'), [
            'password' => 'sandi-lain-12345',
            'password_confirmation' => 'sandi-lain-12345',
        ])->assertRedirect(route('password-reset.waiting'));

        expect(Hash::check('sandi-baru-rizky', (string) $this->employee->refresh()->password))->toBeTrue();
        $this->assertGuest();
    });

    it('applies the password rules to the new password', function (string $password, string $confirmation) {
        decideReset($this->hr, $this->resetRequest, true);
        resetStatus();

        $this->from(route('password-reset.edit'))->post(route('password-reset.update'), [
            'password' => $password,
            'password_confirmation' => $confirmation,
        ])->assertSessionHasErrors('password');

        expect($this->resetRequest->refresh()->status)->toBe(PasswordResetStatus::Approved);
        $this->assertGuest();
    })->with([
        'empty' => ['', ''],
        'not confirmed' => ['sandi-baru-1', 'sandi-baru-2'],
        'too long' => [str_repeat('a', 256), str_repeat('a', 256)],
    ]);

    it('uses the free employee rules: no strength hint, short ok, never the default password', function () {
        config(['auth.employee_default_password' => 'ContohSandi123']);
        decideReset($this->hr, $this->resetRequest, true);
        resetStatus();

        $this->get(route('password-reset.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('passwordRules', null)
            ->where('passwordHint', 'Bebas, asal bukan kata sandi bawaan perusahaan.'));

        $this->from(route('password-reset.edit'))->post(route('password-reset.update'), [
            'password' => 'ContohSandi123',
            'password_confirmation' => 'ContohSandi123',
        ])->assertSessionHasErrors(['password' => NotDefaultPassword::MESSAGE]);
        $this->assertGuest();

        $this->post(route('password-reset.update'), [
            'password' => 'kopi',
            'password_confirmation' => 'kopi',
        ])->assertSessionHasNoErrors()->assertRedirect(route('dashboard'));

        expect(Hash::check('kopi', (string) $this->employee->refresh()->password))->toBeTrue();
    });

    it('keeps the strict rules for a Super Admin\'s new password', function () {
        requestReset($this->admin->email);
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();
        decideReset($otherAdmin, pendingRequestOf($this->admin), true);
        resetStatus();

        $this->get(route('password-reset.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('passwordRules', fn (?string $rules) => is_string($rules) && str_contains($rules, 'minlength'))
            ->where('passwordHint', 'Minimal 8 karakter dan tidak sama dengan alamat email.'));

        $this->from(route('password-reset.edit'))->post(route('password-reset.update'), [
            'password' => 'kopi',
            'password_confirmation' => 'kopi',
        ])->assertSessionHasErrors('password');
    });

    it('refuses the action when the request is no longer approved', function () {
        expect(fn () => app(CompletePasswordReset::class)->handle($this->resetRequest, 'sandi-baru-123'))
            ->toThrow(ValidationException::class);
    });
});

describe('authorization', function () {
    it('applies the decision matrix', function (Role $role, int $status) {
        requestReset($this->employee->email);
        $request = pendingRequestOf($this->employee);
        $actor = User::factory()->forCompany($this->company)->withRole($role)->create();

        $response = $this->actingAs($actor)->post(route('admin.employees.password-resets.approve', $request->id));

        $status === 302 ? $response->assertRedirect() : $response->assertStatus($status);
        expect($request->refresh()->status)->toBe($status === 302 ? PasswordResetStatus::Approved : PasswordResetStatus::Pending);
    })->with([
        'hr' => [Role::Hr, 302],
        'super admin' => [Role::SuperAdmin, 302],
        'direksi' => [Role::Direksi, 403],
        'kepala divisi' => [Role::KepalaDivisi, 403],
        'anggota' => [Role::Anggota, 403],
    ]);

    it('lets only another Super Admin decide a Super Admin\'s request (404 for HR)', function () {
        requestReset($this->admin->email);
        $request = pendingRequestOf($this->admin);
        $otherAdmin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create();

        $this->actingAs($this->hr)->post(route('admin.employees.password-resets.approve', $request->id))->assertNotFound();
        $this->actingAs($this->hr)->get(route('admin.employees.index'))
            ->assertInertia(fn (Assert $page) => $page->where('passwordResets', []));

        $this->actingAs($otherAdmin)->post(route('admin.employees.password-resets.approve', $request->id))->assertRedirect();
        expect($request->refresh()->status)->toBe(PasswordResetStatus::Approved);
    });

    it('never lets someone decide their own request', function () {
        requestReset($this->hr->email);
        $request = pendingRequestOf($this->hr);

        $this->actingAs($this->hr)->post(route('admin.employees.password-resets.approve', $request->id))->assertNotFound();
        expect($request->refresh()->status)->toBe(PasswordResetStatus::Pending);
    });

    it('hides other companies\' requests', function () {
        requestReset($this->employee->email);
        $request = pendingRequestOf($this->employee);
        $foreignHr = User::factory()->forCompany(Company::factory()->create())->withRole(Role::Hr)->create();

        $this->actingAs($foreignHr)->post(route('admin.employees.password-resets.reject', $request->id), ['reason' => 'Bukan urusan'])
            ->assertNotFound();
    });

    it('rejects guests', function () {
        requestReset($this->employee->email);
        $request = pendingRequestOf($this->employee);

        $this->post(route('admin.employees.password-resets.approve', $request->id))->assertRedirect(route('login'));
    });
});

describe('Super Admin with TOTP', function () {
    it('must sign in again (password + code) after the reset instead of being signed in', function () {
        $admin = User::factory()->forCompany($this->company)->withTwoFactor()->withRole(Role::SuperAdmin)->create();
        $otherAdmin = $this->admin;

        requestReset($admin->email);
        decideReset($otherAdmin, pendingRequestOf($admin), true);
        resetStatus()->assertExactJson(['status' => 'approved']);

        $this->post(route('password-reset.update'), [
            'password' => 'sandi-admin-baru',
            'password_confirmation' => 'sandi-admin-baru',
        ])->assertRedirect(route('login'));

        $this->assertGuest();
        expect(Hash::check('sandi-admin-baru', (string) $admin->refresh()->password))->toBeTrue();

        $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'sandi-admin-baru'])
            ->assertRedirect(route('two-factor.login'));
    });
});
