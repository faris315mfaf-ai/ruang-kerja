<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApproverType;
use App\Models\ApprovalFlow;
use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

dataset('admin pages', ['/admin/pengajuan', '/admin/saldo-cuti']);

it('lets only HR and Super Admin open the admin pages', function (string $uri, Role $role, bool $allowed) {
    $user = User::factory()->withRole($role)->create();

    $response = $this->actingAs($user)->get($uri);
    $allowed ? $response->assertOk() : $response->assertForbidden();
})->with('admin pages')->with([
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('renders leave types, flows and options', function () {
    $this->actingAs($this->s->hr)
        ->get('/admin/pengajuan')
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/request-types')
            ->has('types', 6)
            ->where('flows.0.is_default', true)
            ->has('flows.0.steps', 2)
            ->where('options.role_holders.hr', ['Hana Pratiwi']),
        );
});

it('creates, updates and deletes a leave type', function () {
    $hr = $this->s->hr;

    $this->actingAs($hr)->post('/admin/pengajuan/jenis', [
        'code' => 'cbr', 'name' => 'Cuti besar', 'category' => 'leave', 'annual_quota_days' => 30,
        'carry_over_max_days' => null, 'min_service_months' => 72, 'is_paid' => true, 'is_active' => true,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $type = LeaveType::query()->where('code', 'CBR')->sole();
    expect($type->annual_quota_days)->toBe(30.0)->and($type->min_service_months)->toBe(72);

    $this->actingAs($hr)->post('/admin/pengajuan/jenis', ['code' => 'CBR', 'name' => 'Lain', 'category' => 'leave'])
        ->assertSessionHasErrors(['code' => 'Kode sudah dipakai jenis lain.']);

    // Quota is ignored for non-leave categories.
    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->sick->id}", [
        'code' => 'SKT', 'name' => 'Sakit', 'category' => 'sick', 'annual_quota_days' => 10, 'requires_attachment_after_days' => 2,
    ])->assertSessionHasNoErrors();
    expect($this->s->sick->refresh()->annual_quota_days)->toBeNull()->and($this->s->sick->requires_attachment_after_days)->toBe(2);

    $this->actingAs($hr)->delete("/admin/pengajuan/jenis/{$type->id}")->assertRedirect();
    expect($type->fresh()?->trashed())->toBeTrue();
    expect(AuditLog::query()->where('action', 'leave_type.deleted')->count())->toBe(1);
});

it('saves a flow with a condition and assigns it to the type', function () {
    $s = $this->s;

    $this->actingAs($s->hr)->post('/admin/pengajuan/alur', [
        'name' => 'Alur lembur',
        'leave_type_id' => $s->overtime->id,
        'skip_self_approval' => true,
        'allow_delegation' => false,
        'steps' => [
            ['approver_type' => 'direct_manager'],
            ['approver_type' => 'role', 'approver_role' => 'hr'],
            ['approver_type' => 'role', 'approver_role' => 'direksi', 'condition' => ['overtime_month_minutes_gt' => 2400]],
        ],
    ])->assertRedirect()->assertSessionHasNoErrors();

    $flow = ApprovalFlow::query()->where('name', 'Alur lembur')->sole();
    expect($s->overtime->refresh()->approval_flow_id)->toBe($flow->id)
        ->and($flow->allow_delegation)->toBeFalse()
        ->and($flow->steps)->toHaveCount(3)
        ->and($flow->steps[2]->condition)->toBe(['overtime_month_minutes_gt' => 2400]);

    $this->actingAs($s->hr)->put("/admin/pengajuan/alur/{$flow->id}", [
        'name' => 'Alur lembur', 'steps' => [['approver_type' => 'role', 'approver_role' => 'hr', 'condition' => ['bogus_gt' => 1]]],
    ])->assertSessionHasErrors('steps.0.condition');

    $this->actingAs($s->hr)->put("/admin/pengajuan/alur/{$flow->id}", ['name' => 'Alur lembur', 'steps' => []])
        ->assertSessionHasErrors('steps');

    $this->actingAs($s->hr)->delete("/admin/pengajuan/alur/{$flow->id}")->assertSessionHasErrors('flow');
    $this->actingAs($s->hr)->delete("/admin/pengajuan/alur/{$s->flow->id}")->assertSessionHasErrors(['flow' => 'Alur default tidak bisa dihapus.']);

    expect(AuditLog::query()->where('action', 'approval_flow.steps_updated')->count())->toBe(1);
});

it('previews unsaved steps for a sample employee', function () {
    $s = $this->s;

    $this->actingAs($s->hr)
        ->getJson('/admin/pengajuan/pratinjau?'.http_build_query([
            'leave_type_id' => $s->overtime->id,
            'user_id' => $s->employee->id,
            'steps' => [
                ['approver_type' => 'direct_manager'],
                ['approver_type' => 'role', 'approver_role' => 'direksi', 'condition' => ['overtime_month_minutes_gt' => 2400]],
            ],
        ]))
        ->assertOk()
        ->assertJsonPath('steps.0.approver.name', 'Dimas Pratama')
        ->assertJsonPath('steps.1.status', 'skipped')
        ->assertJsonPath('overtime_month_minutes', 0);

    $this->actingAs($s->employee)->getJson('/admin/pengajuan/pratinjau')->assertForbidden();
});

it('lists, adjusts and generates leave balances', function () {
    $s = $this->s;
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);
    $balance = LeaveBalance::query()->where('user_id', $s->employee->id)->sole();

    $this->actingAs($s->hr)->get('/admin/saldo-cuti')
        ->assertInertia(fn (Assert $page) => $page->component('admin/leave-balances')->where('year', 2026)->where('type.code', 'CUT'));

    $this->actingAs($s->hr)->put("/admin/saldo-cuti/{$balance->id}", ['entitled_days' => 2, 'carried_over_days' => 0])
        ->assertSessionHasErrors('entitled_days');
    $this->actingAs($s->hr)->put("/admin/saldo-cuti/{$balance->id}", ['entitled_days' => 14, 'carried_over_days' => 1.5])
        ->assertSessionHasNoErrors();
    expect($balance->refresh()->entitled_days)->toBe(14.0)
        ->and(AuditLog::query()->where('action', 'leave_balance.updated')->count())->toBe(1);

    $this->actingAs($s->hr)->post('/admin/saldo-cuti/buat', ['year' => 2027])->assertRedirect();
    expect(LeaveBalance::query()->where('year', 2027)->count())->toBe(User::query()->active()->count());

    $this->actingAs($s->employee)->put("/admin/saldo-cuti/{$balance->id}", ['entitled_days' => 30, 'carried_over_days' => 0])->assertForbidden();
});

it('still applies flows saved through the admin', function () {
    $s = $this->s;
    $s->useFlow($s->trip, [[ApproverType::User, $s->direksi]]);

    $request = $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'destination' => 'Surabaya']);
    expect($request->currentSteps()[0]->approver_id)->toBe($s->direksi->id);
});
