<?php

use App\Domain\Auth\Actions\RequestPasswordReset;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\EmployeeProfile;
use App\Models\InboxNotification;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Timebox;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — B5-B HR & admin (Bagian 5): Karyawan (daftar + profil), permintaan
| reset kata sandi (setujui/tolak) dan struktur organisasi. Policy web:
| UserPolicy (HR/Direksi/SA semua, Kadiv divisinya, staf 403),
| PasswordResetRequestPolicy (HR/SA; permintaan SA hanya SA lain),
| DivisionPolicy::viewChart (staf 404). Selasa 13 Okt 2026 09.40 WIB.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-13 09:40', 'Asia/Jakarta'));
    $this->org = F::org();
    // The API requires TOTP for Super Admins (EnsureApiAccountUsable).
    $this->org['admin']->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_recovery_codes' => encrypt('[]'), 'two_factor_confirmed_at' => now()])->save();

    // The timebox only equalizes timing; skip its sleep in tests.
    $this->app->bind(Timebox::class, fn () => new class extends Timebox
    {
        public function call(callable $callback, int $microseconds)
        {
            return $callback($this);
        }
    });
});

function resetRequestFor(User $user): PasswordResetRequest
{
    app(RequestPasswordReset::class)->handle($user->email);

    return PasswordResetRequest::query()->where('user_id', $user->id)->where('status', 'pending')->sole();
}

// --- Karyawan: daftar ---

test('HR lists the company with counts, division options and pagination', function () {
    $this->org['budi']->update(['status' => 'inactive']);
    Sanctum::actingAs($this->org['hr']);

    $response = $this->getJson('/api/v1/admin/karyawan?per_page=25')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 25)
        ->assertJsonPath('meta.total', 8)
        ->assertJsonPath('counts', ['active' => 7, 'inactive' => 1])
        ->assertJsonPath('can.manage', true)
        ->assertJsonPath('can.decide_password_resets', true)
        ->assertJsonPath('password_resets_pending', 0)
        ->assertJsonPath('web_path', '/admin/karyawan')
        ->assertJsonCount(2, 'divisions');

    expect($response->json('employees.0'))->toHaveKeys(['id', 'name', 'email', 'avatar_url', 'division', 'team', 'position', 'manager', 'work_mode', 'roles', 'status', 'joined_at', 'can'])
        ->and($response->json('employees.0'))->not->toHaveKey('nik')
        ->and(collect($response->json('options.statuses'))->pluck('value')->all())->toBe(['active', 'inactive', 'resigned']);

    $this->getJson('/api/v1/admin/karyawan?search=rizky')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('employees.0.name', 'Rizky Aditya');
    $this->getJson('/api/v1/admin/karyawan?division='.$this->org['ops']->id)->assertOk()->assertJsonPath('meta.total', 3);
    $this->getJson('/api/v1/admin/karyawan?status=inactive')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('employees.0.name', 'Budi Keu');
    $this->getJson('/api/v1/admin/karyawan?role=kepala_divisi&sort=name&direction=desc')->assertOk()
        ->assertJsonPath('meta.total', 2)->assertJsonPath('employees.0.name', 'Lestari Keu');
    $this->getJson('/api/v1/admin/karyawan?per_page=10&page=2')->assertOk()->assertJsonCount(0, 'employees')->assertJsonPath('meta.current_page', 2);
});

test('Direksi reads everyone without manage rights, a Kepala Divisi only the own division, staff get 403', function () {
    Sanctum::actingAs($this->org['direksi']);
    $this->getJson('/api/v1/admin/karyawan')->assertOk()
        ->assertJsonPath('meta.total', 8)
        ->assertJsonPath('can.manage', false)
        ->assertJsonPath('can.decide_password_resets', false)
        ->assertJsonPath('password_resets_pending', null);

    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson('/api/v1/admin/karyawan')->assertOk()
        ->assertJsonPath('meta.total', 3)
        ->assertJsonCount(1, 'divisions')
        ->assertJsonPath('divisions.0.id', $this->org['ops']->id);

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/admin/karyawan')->assertForbidden();
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['sari']->id)->assertForbidden();
});

test('the employee list needs a token', function () {
    $this->getJson('/api/v1/admin/karyawan')->assertUnauthorized();
});

// --- Karyawan: profil ---

test('HR sees the masked NIK, password status and history; Direksi the profile without them', function () {
    EmployeeProfile::factory()->create(['user_id' => $this->org['rizky']->id, 'nik' => '3174012345674821', 'employee_number' => 'EMP-00042']);
    Sanctum::actingAs($this->org['hr']);

    $response = $this->getJson('/api/v1/admin/karyawan/'.$this->org['rizky']->id)
        ->assertOk()
        ->assertJsonPath('employee.name', 'Rizky Aditya')
        ->assertJsonPath('employee.employee_number', 'EMP-00042')
        ->assertJsonPath('employee.nik_masked', '••••••••••••4821')
        ->assertJsonPath('employee.manager.name', 'Dimas Pratama')
        ->assertJsonPath('employee.division_head.name', 'Dimas Pratama')
        ->assertJsonPath('employee.has_password', true)
        ->assertJsonPath('password_reset', null)
        ->assertJsonPath('password_rule', null)
        ->assertJsonPath('can.manage', true)
        ->assertJsonPath('can.set_password', true)
        ->assertJsonPath('can.view_attendance', true)
        ->assertJsonPath('web_path', '/admin/karyawan/'.$this->org['rizky']->id);

    expect($response->json('audit'))->toBeArray()
        ->and($response->getContent())->not->toContain('3174012345674821');

    Sanctum::actingAs($this->org['direksi']);
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['rizky']->id)
        ->assertOk()
        ->assertJsonPath('employee.nik_masked', null)
        ->assertJsonPath('employee.has_password', null)
        ->assertJsonPath('audit', null)
        ->assertJsonPath('can.manage', false)
        ->assertJsonPath('can.set_password', false);
});

test('a Kepala Divisi opens own division profiles only (others are 404) and lists direct reports', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/admin/karyawan/'.$this->org['kadiv']->id)
        ->assertOk()
        ->assertJsonCount(2, 'direct_reports')
        ->assertJsonPath('employee.nik_masked', null)
        ->assertJsonPath('audit', null);
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['budi']->id)->assertNotFound();

    $otherCompany = User::factory()->forCompany(Company::factory()->create())->create();
    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/admin/karyawan/'.$otherCompany->id)->assertNotFound();
});

test('Direksi/HR accounts carry the R-06 rule for HR and are open to a Super Admin', function () {
    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['direksi']->id)
        ->assertOk()
        ->assertJsonPath('can.set_password', false)
        ->assertJsonPath('password_rule', 'Kata sandi akun Direksi, HR, dan Super Admin hanya bisa diatur oleh Super Admin.');

    Sanctum::actingAs($this->org['admin']);
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['direksi']->id)
        ->assertOk()
        ->assertJsonPath('can.set_password', true)
        ->assertJsonPath('password_rule', null);
});

// --- Permintaan reset kata sandi ---

test('HR lists pending requests and approves one: audited, the HR task resolved', function () {
    $request = resetRequestFor($this->org['rizky']);
    expect(InboxNotification::query()->where('subject_id', $request->id)->whereNull('resolved_at')->count())->toBeGreaterThan(0);

    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/admin/permintaan-sandi')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('requests.0.id', $request->id)
        ->assertJsonPath('requests.0.employee.name', 'Rizky Aditya')
        ->assertJsonPath('requests.0.privileged_account', false)
        ->assertJsonPath('requests.0.can.decide', true);
    $this->getJson('/api/v1/admin/karyawan')->assertJsonPath('password_resets_pending', 1);
    $this->getJson('/api/v1/admin/karyawan/'.$this->org['rizky']->id)->assertJsonPath('password_reset.id', $request->id);

    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/setujui")
        ->assertOk()
        ->assertJsonPath('message', 'Permintaan Rizky Aditya disetujui. Ia bisa membuat kata sandi baru dalam 30 menit.')
        ->assertJsonPath('request.status', 'approved')
        ->assertJsonPath('request.setup_expires_at', now()->addMinutes(30)->toIso8601String());

    expect($request->refresh()->status)->toBe(PasswordResetStatus::Approved)
        ->and($request->decided_by)->toBe($this->org['hr']->id)
        ->and(AuditLog::query()->where('action', 'user.password_reset_approved')->where('auditable_id', $this->org['rizky']->id)->exists())->toBeTrue()
        ->and(InboxNotification::query()->where('subject_id', $request->id)->whereNull('resolved_at')->count())->toBe(0);

    // Already decided (e.g. by another HR) → 422 with the web message.
    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/setujui")
        ->assertUnprocessable()
        ->assertJsonPath('errors.request.0', 'Permintaan ini sudah diputus, dibatalkan, atau kedaluwarsa.');
    $this->getJson('/api/v1/admin/permintaan-sandi')->assertJsonPath('total', 0);
});

test('rejecting needs a reason, which is stored and audited', function () {
    $request = resetRequestFor($this->org['sari']);
    Sanctum::actingAs($this->org['admin']);

    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/tolak", ['reason' => ''])
        ->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/tolak", ['reason' => str_repeat('a', 501)])
        ->assertUnprocessable()->assertJsonValidationErrors('reason');
    expect($request->refresh()->status)->toBe(PasswordResetStatus::Pending);

    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/tolak", ['reason' => 'Tidak bisa dikonfirmasi lewat telepon'])
        ->assertOk()
        ->assertJsonPath('message', 'Permintaan Sari Wulandari ditolak.')
        ->assertJsonPath('request.status', 'rejected')
        ->assertJsonPath('request.setup_expires_at', null);

    expect($request->refresh()->reject_reason)->toBe('Tidak bisa dikonfirmasi lewat telepon');
    $audit = AuditLog::query()->where('action', 'user.password_reset_rejected')->sole();
    expect($audit->user_id)->toBe($this->org['admin']->id)
        ->and($audit->new_values)->toMatchArray(['status' => 'rejected', 'reason' => 'Tidak bisa dikonfirmasi lewat telepon']);
});

test('HR may approve a Direksi account request, flagged as privileged', function () {
    $request = resetRequestFor($this->org['direksi']);
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/admin/permintaan-sandi')->assertJsonPath('requests.0.privileged_account', true);
    $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/setujui")->assertOk()->assertJsonPath('request.status', 'approved');
});

test('a Super Admin request is only visible to another Super Admin; own and foreign requests are 404', function () {
    $otherAdmin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create(['name' => 'Admin Kedua']);
    $adminRequest = resetRequestFor($otherAdmin);
    $hrRequest = resetRequestFor($this->org['hr']);

    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/admin/permintaan-sandi')->assertOk()->assertJsonPath('total', 0);
    $this->postJson("/api/v1/admin/permintaan-sandi/{$adminRequest->id}/setujui")->assertNotFound();
    $this->postJson("/api/v1/admin/permintaan-sandi/{$hrRequest->id}/setujui")->assertNotFound();

    Sanctum::actingAs($this->org['admin']);
    $this->getJson('/api/v1/admin/permintaan-sandi')->assertOk()->assertJsonPath('total', 2);
    $this->postJson("/api/v1/admin/permintaan-sandi/{$adminRequest->id}/setujui")->assertOk();

    expect($hrRequest->refresh()->status)->toBe(PasswordResetStatus::Pending);
});

test('Direksi, Kepala Divisi and staff cannot see or decide requests', function () {
    $request = resetRequestFor($this->org['rizky']);

    foreach (['direksi', 'kadiv', 'sari'] as $who) {
        Sanctum::actingAs($this->org[$who]);
        $this->getJson('/api/v1/admin/permintaan-sandi')->assertForbidden();
        $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/setujui")->assertForbidden();
        $this->postJson("/api/v1/admin/permintaan-sandi/{$request->id}/tolak", ['reason' => 'Bukan saya'])->assertForbidden();
    }

    expect($request->refresh()->status)->toBe(PasswordResetStatus::Pending);
});

// --- Struktur organisasi ---

test('the org chart is the web tree for everyone but staff (404); the PNG stays on the desktop', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $response = $this->getJson('/api/v1/organisasi/struktur')
        ->assertOk()
        ->assertJsonPath('can.png_export', false)
        ->assertJsonPath('can.manage_employees', false)
        ->assertJsonPath('web_path', '/organisasi/struktur')
        ->assertJsonPath('chart.stats.divisions', 2);

    $ops = collect($response->json('chart.divisions'))->firstWhere('id', $this->org['ops']->id);
    expect($ops['head']['name'])->toBe('Dimas Pratama')
        ->and($ops['code'])->toBe('OPS')
        ->and(collect($ops['teams'])->pluck('name')->all())->toBe(['Tim Gudang'])
        ->and($response->getContent())->not->toContain('@');

    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/organisasi/struktur')->assertOk()->assertJsonPath('can.manage_employees', true);

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/organisasi/struktur')->assertNotFound();
});
