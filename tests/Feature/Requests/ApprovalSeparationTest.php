<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\RouteToDelegates;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\ApprovalDelegation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;

/*
 * Review finding 1: one person may approve at most one step of a round.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();

    // Kepala Divisi HR: holds the HR role and is the employee's direct manager.
    $this->kadivHr = User::factory()->withRole(Role::KepalaDivisi, Role::Hr)->managedBy($this->s->direksi)->create(['name' => 'Kadiv HR']);
    $this->s->employee->update(['manager_id' => $this->kadivHr->id]);
});

function separationDates(): array
{
    return ['start_date' => '2026-10-12', 'end_date' => '2026-10-13'];
}

it('does not let the Kadiv HR approve the direct-manager step and then the HR step', function () {
    $s = $this->s;
    $request = $s->approve($this->kadivHr, $s->submit($s->employee, $s->annual, separationDates()));

    $step = $request->currentSteps()[1];
    expect($step->status)->toBe(ApprovalStatus::Waiting)
        ->and($step->approver_role)->toBe(Role::Hr->value)
        ->and(app(ApprovalQueue::class)->canDecide($this->kadivHr, $step))->toBeFalse()
        ->and(app(ApprovalQueue::class)->count($this->kadivHr))->toBe(0)
        ->and($this->kadivHr->can('decide', $request))->toBeFalse()
        ->and(app(ApprovalQueue::class)->count($s->hr))->toBe(1);

    expect(fn () => app(ApproveStep::class)->handle($this->kadivHr, $request))->toThrow(AuthorizationException::class);

    expect($s->approve($s->hr, $request)->status)->toBe(RequestStatus::Approved);
});

it('moves an HR step to Direksi when the only HR holder already approved', function () {
    $s = $this->s;
    $s->hr->removeRole(Role::Hr->value);

    $request = $s->approve($this->kadivHr, $s->submit($s->employee, $s->annual, separationDates()));
    $step = $request->currentSteps()[1];

    expect($step->status)->toBe(ApprovalStatus::Waiting)
        ->and($step->approver_role)->toBe(Role::Direksi->value)
        ->and($step->note)->toContain('dialihkan ke Direksi')
        ->and(app(ApprovalQueue::class)->count($this->kadivHr))->toBe(0)
        ->and(app(ApprovalQueue::class)->count($s->direksi))->toBe(1);

    expect($s->approve($s->direksi, $request)->status)->toBe(RequestStatus::Approved);
});

it('keeps the step with the approver when their delegate already approved this round', function () {
    $s = $this->s;
    $s->useFlow($s->annual, [[ApproverType::User, $s->hr], [ApproverType::DirectManager]]);
    ApprovalDelegation::factory()->create([
        'delegator_id' => $this->kadivHr->id,
        'delegate_id' => $s->hr->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-09',
    ]);

    $request = $s->approve($s->hr, $s->submit($s->employee, $s->annual, separationDates()));
    $step = $request->currentSteps()[1];

    expect($step->status)->toBe(ApprovalStatus::Waiting)
        ->and($step->approver_id)->toBe($this->kadivHr->id)
        ->and($step->delegated_from_id)->toBeNull()
        ->and(app(ApprovalQueue::class)->count($s->hr))->toBe(0);

    // The daily routing job does not hand it to the earlier approver either.
    app(RouteToDelegates::class)->handle();
    expect($request->fresh('approvals')?->currentSteps()[1]->approver_id)->toBe($this->kadivHr->id);
});

it('rejects a delegate who approved an earlier step even if routed to them', function () {
    $s = $this->s;
    $s->useFlow($s->annual, [[ApproverType::User, $s->hr], [ApproverType::DirectManager]]);

    $request = $s->approve($s->hr, $s->submit($s->employee, $s->annual, separationDates()));
    $step = $request->currentSteps()[1];
    // Simulate a step that ended up with the earlier approver (e.g. legacy data).
    $step->update(['approver_id' => $s->hr->id, 'delegated_from_id' => $this->kadivHr->id]);

    $request = $request->fresh(['approvals', 'user']);
    expect(app(ApprovalQueue::class)->count($s->hr))->toBe(0)
        ->and(fn () => app(ApproveStep::class)->handle($s->hr, $request))->toThrow(AuthorizationException::class);
});

it('does not let a delegator approve again after their delegate decided for them', function () {
    $s = $this->s;
    $s->useFlow($s->annual, [[ApproverType::DirectManager], [ApproverType::Role, Role::Hr]]);
    $stand = User::factory()->create(['name' => 'Pengganti']);
    ApprovalDelegation::factory()->create([
        'delegator_id' => $this->kadivHr->id,
        'delegate_id' => $stand->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-09',
    ]);

    $request = $s->approve($stand, $s->submit($s->employee, $s->annual, separationDates()));

    expect($request->currentSteps()[1]->status)->toBe(ApprovalStatus::Waiting)
        ->and(app(ApprovalQueue::class)->count($this->kadivHr))->toBe(0)
        ->and(fn () => app(ApproveStep::class)->handle($this->kadivHr, $request))->toThrow(AuthorizationException::class);
});
