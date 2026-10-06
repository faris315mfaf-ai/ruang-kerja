<?php

use App\Domain\Okr\Actions\CloseObjective;
use App\Domain\Okr\Actions\CreateKeyResult;
use App\Domain\Okr\Actions\CreateObjective;
use App\Domain\Okr\Actions\DeleteKeyResult;
use App\Domain\Okr\Actions\LinkTaskToKeyResult;
use App\Domain\Okr\Actions\RecordKeyResultCheckin;
use App\Domain\Okr\Actions\UnlinkTaskFromKeyResult;
use App\Domain\Okr\Actions\UpdateKeyResult;
use App\Domain\Okr\Actions\UpdateObjective;
use App\Domain\Okr\Enums\KeyResultUnit;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Enums\OkrStatus;
use App\Domain\Okr\Notifications\ObjectiveAtRiskNotification;
use App\Domain\Okr\Services\ObjectiveHealth;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/okr-helpers.php';

beforeEach(function () {
    // Friday of week 2 of Q4 2026 (elapsed 9/92 ≈ 9.8%).
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Jakarta'));
    Notification::fake();
    $this->w = okrWorld();
});

/**
 * @return array{title: string, unit: KeyResultUnit, unit_label: string, start_value: float, target_value: float, current_value: float, weight: float, owner_id: string}
 */
function krData(User $owner, array $overrides = []): array
{
    return [
        'title' => 'Bug kritis terbuka',
        'unit' => KeyResultUnit::Number,
        'unit_label' => 'bug',
        'start_value' => 2.0,
        'target_value' => 0.0,
        'current_value' => 2.0,
        'weight' => 30.0,
        'owner_id' => $owner->id,
        ...$overrides,
    ];
}

it('creates, edits, reopens and closes objectives', function () {
    $objective = app(CreateObjective::class)->handle($this->w->prg, [
        'quarter' => '2027-Q1',
        'title' => 'Kualitas rilis naik',
        'description' => null,
        'owner_id' => $this->w->prgKadiv->id,
        'status' => ObjectiveStatus::Closed, // closing goes through CloseObjective
    ]);

    expect($objective->company_id)->toBe($this->w->prg->company_id)
        ->and($objective->division_id)->toBe($this->w->prg->id)
        ->and($objective->status)->toBe(ObjectiveStatus::Active)
        ->and($objective->closed_at)->toBeNull();

    app(CloseObjective::class)->handle($objective);
    $closedAt = $objective->fresh()->closed_at;
    app(CloseObjective::class)->handle($objective->fresh());

    expect($objective->fresh()->status)->toBe(ObjectiveStatus::Closed)
        ->and($objective->fresh()->closed_at?->equalTo($closedAt))->toBeTrue();

    app(UpdateObjective::class)->handle($objective->fresh(), [
        'quarter' => '2027-Q1',
        'title' => 'Kualitas rilis naik signifikan',
        'description' => 'Fokus test otomatis.',
        'owner_id' => $this->w->prgMember->id,
        'status' => ObjectiveStatus::Draft,
    ]);

    expect($objective->fresh())
        ->status->toBe(ObjectiveStatus::Draft)
        ->closed_at->toBeNull()
        ->title->toBe('Kualitas rilis naik signifikan')
        ->owner_id->toBe($this->w->prgMember->id);
});

it('adds key results at the end and clears the unit label of non-number units', function () {
    $first = app(CreateKeyResult::class)->handle($this->w->objective, krData($this->w->member));
    $second = app(CreateKeyResult::class)->handle($this->w->objective, krData($this->w->colleague, [
        'title' => 'Tugas tercatat',
        'unit' => KeyResultUnit::Percent,
        'unit_label' => 'abaikan',
        'start_value' => 70.0,
        'target_value' => 95.0,
        'current_value' => 74.0,
    ]));

    expect($first->position)->toBe($this->w->keyResult->position + 1)
        ->and($second->position)->toBe($first->position + 1)
        ->and($second->unit_label)->toBe('')
        ->and($this->w->objective->keyResults()->pluck('title')->all())->toBe(['Skenario UAT lulus', 'Bug kritis terbuka', 'Tugas tercatat']);

    app(UpdateKeyResult::class)->handle($first, krData($this->w->member, ['title' => 'Bug kritis di produksi', 'current_value' => 1.0, 'weight' => 50.0]));

    expect($first->fresh())->title->toBe('Bug kritis di produksi')->current_value->toBe(1.0)->weight->toBe(50.0);
});

it('records a check-in on the office date and updates the current value', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 23:30', 'Asia/Jakarta'));
    $checkin = app(RecordKeyResultCheckin::class)->handle($this->w->keyResult, $this->w->member, 156.0, 8, '  Sesi 3 lulus.  ');

    expect($checkin->checked_on->toDateString())->toBe('2026-10-09')
        ->and($checkin->note)->toBe('Sesi 3 lulus.')
        ->and($checkin->author_id)->toBe($this->w->member->id)
        ->and($this->w->keyResult->fresh()->current_value)->toBe(156.0);

    $this->travelTo(CarbonImmutable::parse('2026-10-10 00:30', 'Asia/Jakarta'));
    $next = app(RecordKeyResultCheckin::class)->handle($this->w->keyResult->fresh(), $this->w->member, 158.0, null, '');

    expect($next->checked_on->toDateString())->toBe('2026-10-10')
        ->and($next->note)->toBeNull()
        ->and($next->confidence)->toBeNull()
        ->and(KeyResultCheckin::query()->count())->toBe(2)
        ->and(fn () => $next->forceFill(['value' => 1])->save())->toThrow(LogicException::class);
});

it('tells the owner and Kepala Divisi once when the objective status drops', function () {
    $objective = $this->w->objective;
    $objective->forceFill(['owner_id' => $this->w->colleague->id])->save();
    $health = app(ObjectiveHealth::class);

    expect($health->statusOf($objective))->toBe(OkrStatus::OnTrack);

    // 148 → 120 moves away from the target: behind.
    app(RecordKeyResultCheckin::class)->handle($this->w->keyResult, $this->w->member, 120.0, 4, null);

    Notification::assertSentTo($this->w->kadiv, ObjectiveAtRiskNotification::class, fn ($n) => $n->status === OkrStatus::Behind);
    Notification::assertSentTo($this->w->colleague, ObjectiveAtRiskNotification::class);
    Notification::assertNotSentTo($this->w->member, ObjectiveAtRiskNotification::class);
    Notification::assertCount(2);

    // Still behind: nothing new.
    app(RecordKeyResultCheckin::class)->handle($this->w->keyResult->fresh(), $this->w->member, 118.0, 4, null);
    Notification::assertCount(2);

    // Back on track releases the claims; a later drop notifies again.
    app(RecordKeyResultCheckin::class)->handle($this->w->keyResult->fresh(), $this->w->member, 160.0, 7, null);
    app(UpdateKeyResult::class)->handle($this->w->keyResult->fresh(), krData($this->w->member, [
        'title' => 'Skenario UAT lulus', 'start_value' => 140.0, 'target_value' => 190.0, 'current_value' => 110.0, 'weight' => 40.0,
    ]), $this->w->kadiv);

    Notification::assertSentToTimes($this->w->colleague, ObjectiveAtRiskNotification::class, 2);
    Notification::assertSentToTimes($this->w->kadiv, ObjectiveAtRiskNotification::class, 1);
});

it('does not warn about draft or closed objectives', function () {
    $this->w->objective->forceFill(['status' => ObjectiveStatus::Draft])->save();

    app(RecordKeyResultCheckin::class)->handle($this->w->keyResult->fresh(), $this->w->member, 100.0, 3, null);

    Notification::assertNothingSent();
});

it('deletes a key result with its check-ins and task links, not the tasks', function () {
    $workspace = okrDivisionWorkspace($this->w->ops, false);
    $task = Task::factory()->create(['workspace_id' => $workspace->id]);
    app(LinkTaskToKeyResult::class)->handle($this->w->keyResult, $task, $this->w->kadiv);
    app(RecordKeyResultCheckin::class)->handle($this->w->keyResult, $this->w->member, 150.0, 7, null);

    app(DeleteKeyResult::class)->handle($this->w->keyResult->fresh());

    expect(KeyResult::query()->count())->toBe(0)
        ->and(KeyResultCheckin::query()->count())->toBe(0)
        ->and(DB::table('key_result_tasks')->count())->toBe(0)
        ->and($task->fresh())->not->toBeNull();
});

it('links only visible tasks of the objective division', function () {
    $team = Team::factory()->create(['division_id' => $this->w->ops->id]);
    $division = okrDivisionWorkspace($this->w->ops);
    $teamSpace = Workspace::factory()->team($team)->internal()->create();
    $project = Workspace::factory()->project()->internal()->create(['division_id' => $this->w->ops->id]);
    $otherDivision = okrDivisionWorkspace($this->w->prg);
    $privateOps = Workspace::factory()->project()->create(['division_id' => $this->w->ops->id]);
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->w->member->id)->firstOrFail();
    $archived = Workspace::factory()->project()->internal()->archived()->create(['division_id' => $this->w->ops->id]);

    $link = fn (Workspace $workspace) => app(LinkTaskToKeyResult::class)->handle(
        $this->w->keyResult,
        Task::factory()->create(['workspace_id' => $workspace->id]),
        $this->w->member,
    );

    $link($division);
    $link($teamSpace);
    $link($project);

    expect($this->w->keyResult->tasks()->count())->toBe(3);

    foreach ([$otherDivision, $privateOps, $personal, $archived] as $workspace) {
        expect(fn () => $link($workspace))->toThrow(ValidationException::class);
    }

    // Linking twice is a no-op; unlinking keeps the task.
    $task = $this->w->keyResult->tasks()->firstOrFail();
    app(LinkTaskToKeyResult::class)->handle($this->w->keyResult, $task, $this->w->member);

    expect($this->w->keyResult->tasks()->count())->toBe(3)
        ->and(app(UnlinkTaskFromKeyResult::class)->handle($this->w->keyResult, $task->id))->toBeTrue()
        ->and(app(UnlinkTaskFromKeyResult::class)->handle($this->w->keyResult, $task->id))->toBeFalse()
        ->and($this->w->keyResult->tasks()->count())->toBe(2);
});
