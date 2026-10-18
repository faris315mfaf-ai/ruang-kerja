<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tenancy\CompanyContext;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * C1 (docs/sesi/fase1-celah.md): audit entries belong to one company
 * (audit_logs.company_id); system entries of company B never reach company A.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->home = Company::query()->findOrFail(User::factory()->create()->company_id);
    $this->foreign = Company::factory()->foreign()->create();
    $this->admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $this->foreigner = User::factory()->forCompany($this->foreign)->create();
    AuditLog::query()->delete();
});

it('stores the actor company, else the context, else the subject company', function () {
    $audit = app(AuditLogger::class);

    $byActor = $audit->log('user.updated', $this->foreigner, actor: $this->admin);
    $bySubject = $audit->log('attendance.closed', $this->foreigner);
    $byContext = app(CompanyContext::class)->run($this->home, fn () => $audit->log('system.ran'));
    $platform = $audit->log('system.ran');

    expect($byActor->company_id)->toBe($this->home->id)
        ->and($bySubject->company_id)->toBe($this->foreign->id)
        ->and($byContext->company_id)->toBe($this->home->id)
        ->and($platform->company_id)->toBeNull();
});

it('shows only the entries of the auditor company, system entries included', function () {
    $audit = app(AuditLogger::class);
    $audit->log('attendance.closed', $this->foreigner);
    $audit->log('user.updated', $this->foreigner, actor: $this->foreigner);
    $audit->log('system.platform');
    $own = $audit->log('attendance.closed', $this->admin);

    $this->actingAs($this->admin)
        ->get('/admin/audit')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('logs.total', 1)
            ->where('logs.data.0.id', $own->id)
            ->where('options.actions', ['attendance.closed']));
});

it('denies viewing an entry of another company or of the platform', function () {
    $audit = app(AuditLogger::class);
    $foreign = $audit->log('attendance.closed', $this->foreigner);
    $platform = $audit->log('system.platform');
    $own = $audit->log('attendance.closed', $this->admin);

    expect(Gate::forUser($this->admin)->allows('view', $own))->toBeTrue()
        ->and(Gate::forUser($this->admin)->allows('view', $foreign))->toBeFalse()
        ->and(Gate::forUser($this->admin)->allows('view', $platform))->toBeFalse();
});
