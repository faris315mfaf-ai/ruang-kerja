<?php

use App\Domain\Automation\Actions\CreateTaskFromRecurring;
use App\Domain\Automation\Jobs\CreateRecurringTasks;
use App\Domain\Automation\Services\RecurrenceSchedule;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Recurring tasks (F2-4): RecurrenceSchedule equals recurrence.ts (shared
 * fixture), the 07.00 job is idempotent per (recurring task, date) and
 * "Buat sekarang" creates an extra task.
 */

/**
 * @return array{occurrences: list<array<string, mixed>>, descriptions: list<array<string, mixed>>}
 */
function recurrenceCases(): array
{
    return json_decode((string) file_get_contents(__DIR__.'/../../../resources/js/features/automation/recurrence-cases.json'), true, flags: JSON_THROW_ON_ERROR);
}

it('computes the same dates as recurrence.ts', function (array $case) {
    $rule = $case['rule'];

    expect(RecurrenceSchedule::nextOccurrences($rule['pattern'], $rule['starts_on'], $rule['ends_on'], $case['from'], $case['count']))
        ->toBe($case['expected']);
})->with(fn () => array_map(fn (array $case): array => [$case], array_column(recurrenceCases()['occurrences'], null, 'name')));

it('describes patterns like recurrence.ts', function () {
    foreach (recurrenceCases()['descriptions'] as $case) {
        expect(RecurrenceSchedule::describe($case['pattern']))->toBe($case['expected']);
    }
});

it('knows whether a date falls on the pattern', function () {
    $pattern = ['kind' => 'weekly', 'weekdays' => [1, 4]];

    expect(RecurrenceSchedule::occursOn($pattern, '2026-10-01', null, '2026-10-05'))->toBeTrue()
        ->and(RecurrenceSchedule::occursOn($pattern, '2026-10-01', null, '2026-10-06'))->toBeFalse()
        ->and(RecurrenceSchedule::occursOn($pattern, '2026-10-01', '2026-10-04', '2026-10-05'))->toBeFalse()
        ->and(RecurrenceSchedule::occursOn($pattern, '2026-10-06', null, '2026-10-05'))->toBeFalse();
});

describe('the 07.00 job', function () {
    beforeEach(function () {
        $this->seed(RoleSeeder::class);
        config(['features.automation' => true]);
        $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
        $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'GDG', 'type' => WorkspaceType::Team]);
        $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
        $this->recurring = RecurringTask::factory()->forWorkspace($this->workspace)->create([
            'title' => 'Rekap stok mingguan',
            'assignee_id' => $this->member->id,
            'priority' => 2,
            'pattern' => ['kind' => 'weekly', 'weekdays' => [1, 3]],
            'starts_on' => '2026-10-01',
        ]);
    });

    it('creates the task once per scheduled date', function () {
        // Monday 5 Oct 2026, 07.00 WIB.
        $this->travelTo(CarbonImmutable::parse('2026-10-05 07:00', 'Asia/Jakarta'));

        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(1)
            ->and(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(0);

        $task = Task::query()->where('workspace_id', $this->workspace->id)->sole();
        expect($task->title)->toBe('Rekap stok mingguan')
            ->and($task->number)->toBe(1)
            ->and($task->priority->value)->toBe(2)
            ->and($task->due_date?->toDateString())->toBe('2026-10-05')
            ->and($task->assignees()->pluck('users.id')->all())->toBe([$this->member->id])
            ->and($this->recurring->fresh()->created_count)->toBe(1)
            ->and($this->recurring->fresh()->last_created_on?->toDateString())->toBe('2026-10-05')
            ->and(DB::table('recurring_task_occurrences')->value('task_id'))->toBe($task->id);

        // Tuesday: not on the pattern. Wednesday: the next one.
        $this->travelTo(CarbonImmutable::parse('2026-10-06 07:00', 'Asia/Jakarta'));
        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(0);
        $this->travelTo(CarbonImmutable::parse('2026-10-07 07:00', 'Asia/Jakarta'));
        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(1);
        expect(Task::query()->where('workspace_id', $this->workspace->id)->count())->toBe(2);
    });

    it('skips paused, ended and archived recurring tasks', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 07:00', 'Asia/Jakarta'));
        $this->recurring->update(['is_active' => false]);
        RecurringTask::factory()->forWorkspace($this->workspace)->create(['pattern' => ['kind' => 'daily', 'weekdays_only' => false], 'starts_on' => '2026-09-01', 'ends_on' => '2026-10-04']);
        $archived = Workspace::factory()->ownedBy($this->owner)->create(['archived_at' => now()]);
        RecurringTask::factory()->forWorkspace($archived)->create(['pattern' => ['kind' => 'daily', 'weekdays_only' => false]]);

        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(0)
            ->and(Task::query()->count())->toBe(0);
    });

    it('runs as the workspace owner when the creator lost access', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 07:00', 'Asia/Jakarta'));
        $this->recurring->update(['created_by' => $this->member->id]);
        addMember($this->workspace, $this->member, WorkspaceRole::Viewer);

        app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class));

        expect(Task::query()->where('workspace_id', $this->workspace->id)->sole()->created_by)->toBe($this->owner->id);
    });

    it('does nothing while the feature is off', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 07:00', 'Asia/Jakarta'));
        config(['features.automation' => false]);

        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(0);
    });

    it('creates an extra task now without touching the schedule', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta'));

        $this->actingAs($this->owner)
            ->post("/otomasi/berulang/{$this->recurring->id}/buat-sekarang")
            ->assertRedirect()
            ->assertInertiaFlash('toast.message', 'Tugas GDG-1 "Rekap stok mingguan" dibuat.');

        expect(DB::table('recurring_task_occurrences')->count())->toBe(0)
            ->and($this->recurring->fresh()->created_count)->toBe(1);

        // The scheduled run of the same day still happens.
        expect(app(CreateRecurringTasks::class)->handle(app(CreateTaskFromRecurring::class)))->toBe(1);
    });
});
