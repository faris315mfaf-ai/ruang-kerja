<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RouteToDelegates;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\ApprovalDelegation;
use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

function leaveDates(): array
{
    return ['start_date' => '2026-10-12', 'end_date' => '2026-10-14'];
}

it('runs a complete two-step flow: direct manager then HR', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, leaveDates());

    expect($request->status)->toBe(RequestStatus::Pending)
        ->and($request->number)->toBe('CUT-2026-10-0001')
        ->and($request->days)->toBe(3.0)
        ->and($request->current_step)->toBe(1);

    $steps = $request->currentSteps();
    expect($steps)->toHaveCount(2)
        ->and($steps[0]->status)->toBe(ApprovalStatus::Waiting)
        ->and($steps[0]->approver_id)->toBe($s->manager->id)
        ->and($steps[1]->status)->toBe(ApprovalStatus::Queued);

    $balance = LeaveBalance::query()->where('user_id', $s->employee->id)->sole();
    expect($balance->pending_days)->toBe(3.0)->and($balance->used_days)->toBe(0.0);

    $request = $s->approve($s->manager, $request);
    $steps = $request->currentSteps();

    expect($request->status)->toBe(RequestStatus::Pending)
        ->and($request->current_step)->toBe(2)
        ->and($steps[0]->status)->toBe(ApprovalStatus::Approved)
        ->and($steps[1]->status)->toBe(ApprovalStatus::Waiting)
        ->and($steps[1]->approver_id)->toBeNull()
        ->and($steps[1]->approver_role)->toBe(Role::Hr->value);

    $request = $s->approve($s->hr, $request, 'Selamat berlibur.');

    expect($request->status)->toBe(RequestStatus::Approved)
        ->and($request->decided_at)->not->toBeNull()
        ->and($request->current_step)->toBeNull()
        ->and($request->currentSteps()[1]->approver_id)->toBe($s->hr->id);

    $balance->refresh();
    expect($balance->pending_days)->toBe(0.0)->and($balance->used_days)->toBe(3.0)->and($balance->available())->toBe(9.0);

    expect(AuditLog::query()->where('auditable_id', $request->id)->pluck('action')->all())
        ->toContain('request.submitted', 'request.step_approved', 'request.approved');
});

it('stops the flow when step 1 rejects', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, leaveDates());

    app(RejectStep::class)->handle($s->manager, $request, 'Sedang audit stok.');
    $request->refresh()->load('approvals');
    $steps = $request->currentSteps();

    expect($request->status)->toBe(RequestStatus::Rejected)
        ->and($steps[0]->status)->toBe(ApprovalStatus::Rejected)
        ->and($steps[0]->note)->toBe('Sedang audit stok.')
        ->and($steps[1]->status)->toBe(ApprovalStatus::Skipped)
        ->and($steps[1]->activated_at)->toBeNull()
        ->and(LeaveBalance::query()->where('user_id', $s->employee->id)->sole()->pending_days)->toBe(0.0);

    expect(fn () => app(ApproveStep::class)->handle($s->hr, $request))->toThrow(AuthorizationException::class);
    expect(app(ApprovalQueue::class)->count($s->hr))->toBe(0);
});

it('requires a reason to reject', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, leaveDates());

    expect(fn () => app(RejectStep::class)->handle($s->manager, $request, '  '))->toThrow(ValidationException::class);
});

it('adds the Direksi step only when monthly overtime exceeds 40 hours', function () {
    $s = $this->s;
    $s->useFlow($s->overtime, [
        [ApproverType::DirectManager],
        [ApproverType::Role, Role::Hr],
        [ApproverType::Role, Role::Direksi, ['overtime_month_minutes_gt' => 2400]],
    ]);

    // 36 hours already approved this month (12 × 3 h).
    foreach (range(1, 12) as $i) {
        $day = CarbonImmutable::parse('2026-10-01')->addDays($i - 1)->toDateString();
        $r = $s->submit($s->employee, $s->overtime, ['date' => $day, 'start_time' => '17:00', 'end_time' => '20:00']);
        $s->approve($s->hr, $s->approve($s->manager, $r));
    }

    // +2 h = 38 h → Direksi skipped.
    $small = $s->submit($s->employee, $s->overtime, ['date' => '2026-10-13', 'start_time' => '17:00', 'end_time' => '19:00']);
    expect($small->currentSteps()[2]->status)->toBe(ApprovalStatus::Skipped)
        ->and($small->currentSteps()[2]->note)->toContain('38 jam, tidak lebih dari 40 jam');

    // +4 h = 42 h (38 pending + 4) → Direksi required after HR.
    $big = $s->submit($s->employee, $s->overtime, ['date' => '2026-10-14', 'start_time' => '17:00', 'end_time' => '21:00']);
    expect($big->currentSteps()[2]->status)->toBe(ApprovalStatus::Queued);

    $big = $s->approve($s->hr, $s->approve($s->manager, $big));
    expect($big->status)->toBe(RequestStatus::Pending)
        ->and($big->currentSteps()[2]->status)->toBe(ApprovalStatus::Waiting)
        ->and(app(ApprovalQueue::class)->waitingFor($s->direksi)->pluck('request_id')->all())->toBe([$big->id]);

    expect($s->approve($s->direksi, $big)->status)->toBe(RequestStatus::Approved);
});

it('routes the step to an active delegate', function () {
    $s = $this->s;
    $delegate = User::factory()->create(['name' => 'Sari Wulandari']);
    ApprovalDelegation::factory()->create([
        'delegator_id' => $s->manager->id,
        'delegate_id' => $delegate->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-09',
    ]);

    $request = $s->submit($s->employee, $s->annual, leaveDates());
    $step = $request->currentSteps()[0];

    expect($step->approver_id)->toBe($delegate->id)
        ->and($step->delegated_from_id)->toBe($s->manager->id)
        ->and(app(ApprovalQueue::class)->count($s->manager))->toBe(0)
        ->and(app(ApprovalQueue::class)->count($delegate))->toBe(1);

    expect(fn () => app(ApproveStep::class)->handle($s->manager, $request))->toThrow(AuthorizationException::class);
    expect($s->approve($delegate, $request)->currentSteps()[1]->status)->toBe(ApprovalStatus::Waiting);
});

it('ignores delegations outside their period and when the flow disallows them', function () {
    $s = $this->s;
    $delegate = User::factory()->create();
    ApprovalDelegation::factory()->create([
        'delegator_id' => $s->manager->id, 'delegate_id' => $delegate->id,
        'starts_on' => '2026-10-06', 'ends_on' => '2026-10-09',
    ]);

    $request = $s->submit($s->employee, $s->annual, leaveDates());
    expect($request->currentSteps()[0]->approver_id)->toBe($s->manager->id);

    // Next day the delegation starts: the daily job moves the waiting step.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:10', 'Asia/Jakarta'));
    expect(app(RouteToDelegates::class)->handle())->toBe(1);
    expect($request->fresh('approvals')->currentSteps()[0]->approver_id)->toBe($delegate->id);

    $s->flow->update(['allow_delegation' => false]);
    $other = $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);
    expect($other->currentSteps()[0]->approver_id)->toBe($s->manager->id)
        ->and($other->currentSteps()[0]->delegated_from_id)->toBeNull();
});

it('never lets a requester approve their own request', function () {
    $s = $this->s;
    $otherHr = User::factory()->withRole(Role::Hr)->create();

    // HR requests leave: step 1 = their manager (direksi), step 2 = role HR.
    $request = $s->submit($s->hr, $s->annual, leaveDates());
    $request = $s->approve($s->direksi, $request);

    expect(app(ApprovalQueue::class)->count($s->hr))->toBe(0)
        ->and($s->hr->can('decide', $request))->toBeFalse()
        ->and($otherHr->can('decide', $request))->toBeTrue();
    expect(fn () => app(ApproveStep::class)->handle($s->hr, $request))->toThrow(AuthorizationException::class);

    expect($s->approve($otherHr, $request)->status)->toBe(RequestStatus::Approved);
});

it('skips a step whose approver is the requester', function () {
    $s = $this->s;
    $s->useFlow($s->overtime, [[ApproverType::DivisionHead], [ApproverType::Role, Role::Hr]]);

    // The Kepala Divisi requests overtime: he heads his own division.
    $request = $s->submit($s->manager, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00']);
    $steps = $request->currentSteps();

    expect($steps[0]->status)->toBe(ApprovalStatus::Skipped)
        ->and($steps[0]->note)->toBe('Penyetuju adalah pemohon sendiri.')
        ->and($steps[1]->status)->toBe(ApprovalStatus::Waiting);
});

it('escalates to the manager when self-skip is off', function () {
    $s = $this->s;
    $s->useFlow($s->overtime, [[ApproverType::DivisionHead], [ApproverType::Role, Role::Hr]], ['skip_self_approval' => false]);

    $request = $s->submit($s->manager, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00']);

    expect($request->currentSteps()[0]->status)->toBe(ApprovalStatus::Waiting)
        ->and($request->currentSteps()[0]->approver_id)->toBe($s->direksi->id);
});

it('skips a step whose approver already approved this request', function () {
    $s = $this->s;
    $s->useFlow($s->annual, [[ApproverType::DirectManager], [ApproverType::DivisionHead], [ApproverType::Role, Role::Hr]]);

    $request = $s->approve($s->manager, $s->submit($s->employee, $s->annual, leaveDates()));
    $steps = $request->currentSteps();

    expect($steps[1]->status)->toBe(ApprovalStatus::Skipped)
        ->and($steps[1]->note)->toContain('Sudah disetujui Dimas Pratama')
        ->and($steps[2]->status)->toBe(ApprovalStatus::Waiting);
});

it('falls back to another role when every step is skipped', function () {
    $s = $this->s;

    // Direksi has no manager, and is not HR: step 1 skipped, step 2 HR decides.
    $request = $s->submit($s->direksi, $s->annual, leaveDates());
    expect($request->currentSteps()[0]->status)->toBe(ApprovalStatus::Skipped)
        ->and($request->currentSteps()[1]->status)->toBe(ApprovalStatus::Waiting);

    // Sole HR without manager: both skipped → fallback to Direksi.
    $s->hr->update(['manager_id' => null]);
    $own = $s->submit($s->hr, $s->sick, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);
    $steps = $own->currentSteps();

    expect($steps)->toHaveCount(3)
        ->and($steps[2]->approver_role)->toBe(Role::Direksi->value)
        ->and($steps[2]->status)->toBe(ApprovalStatus::Waiting);
});

it('uses the built-in Atasan langsung → HR flow when none is configured', function () {
    $s = $this->s;
    $s->annual->update(['approval_flow_id' => null]);
    $s->flow->delete();

    $request = $s->submit($s->employee, $s->annual, leaveDates());

    expect($request->currentSteps()->map->approver_type->all())->toBe([ApproverType::DirectManager, ApproverType::Role]);
});
