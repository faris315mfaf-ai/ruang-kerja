<?php

use App\Domain\Requests\Actions\DeleteApprovalDelegation;
use App\Domain\Requests\Actions\RouteToDelegates;
use App\Domain\Requests\Actions\SaveApprovalDelegation;
use App\Domain\Requests\Services\ApproverResolver;
use App\Models\ApprovalDelegation;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

/*
 * Review finding 6: delegation cycles, chains, expiry and deletion.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->b = User::factory()->create(['name' => 'Bima']);
    $this->c = User::factory()->create(['name' => 'Citra']);
});

/**
 * @param  array<string, string>  $extra
 */
function delegate(User $from, User $to, array $extra = []): ApprovalDelegation
{
    return app(SaveApprovalDelegation::class)->handle($from, [
        'delegate_id' => $to->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-09',
        ...$extra,
    ]);
}

function firstStep(EmployeeRequest $request): array
{
    $step = $request->fresh('approvals')?->currentSteps()[0];

    return [$step?->approver_id, $step?->delegated_from_id];
}

it('rejects direct and chained delegation cycles', function () {
    $s = $this->s;
    delegate($s->manager, $this->b);

    expect(fn () => delegate($this->b, $s->manager))
        ->toThrow(ValidationException::class, 'Delegasi tidak boleh melingkar.');

    delegate($this->b, $this->c);
    expect(fn () => delegate($this->c, $s->manager))->toThrow(ValidationException::class);

    // Not overlapping: allowed.
    expect(delegate($this->c, $s->manager, ['starts_on' => '2026-10-12', 'ends_on' => '2026-10-16'])->exists)->toBeTrue();
});

it('follows delegation chains and stops at cycles', function () {
    $s = $this->s;
    ApprovalDelegation::factory()->create(['delegator_id' => $s->manager->id, 'delegate_id' => $this->b->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09']);
    ApprovalDelegation::factory()->create(['delegator_id' => $this->b->id, 'delegate_id' => $this->c->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09']);
    // Legacy cycle back to the manager must not loop.
    ApprovalDelegation::factory()->create(['delegator_id' => $this->c->id, 'delegate_id' => $s->manager->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09']);

    expect(app(ApproverResolver::class)->activeDelegate($s->manager, '2026-10-05')?->id)->toBe($this->c->id);

    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    expect(firstStep($request))->toBe([$this->c->id, $s->manager->id]);
});

it('keeps the original approver when a delegate delegates further', function () {
    $s = $this->s;
    delegate($s->manager, $this->b);
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    expect(firstStep($request))->toBe([$this->b->id, $s->manager->id]);

    delegate($this->b, $this->c);

    expect(firstStep($request))->toBe([$this->c->id, $s->manager->id]);
});

it('returns waiting steps to the delegator when the delegation is deleted', function () {
    $s = $this->s;
    $delegation = delegate($s->manager, $this->b);
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    expect(firstStep($request))->toBe([$this->b->id, $s->manager->id]);

    app(DeleteApprovalDelegation::class)->handle($s->manager, $delegation);

    expect(firstStep($request))->toBe([$s->manager->id, null]);
});

it('returns waiting steps to the delegator when the delegation expires', function () {
    $s = $this->s;
    delegate($s->manager, $this->b);
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $this->travelTo(CarbonImmutable::parse('2026-10-10 00:10', 'Asia/Jakarta'));
    expect(app(RouteToDelegates::class)->handle())->toBe(1)
        ->and(firstStep($request))->toBe([$s->manager->id, null])
        ->and(app(RouteToDelegates::class)->handle())->toBe(0);
});
