<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\CreateWorkPlanTasks;
use App\Domain\Tasks\Enums\TaskSource;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * "Rencana kerja jadi tugas otomatis" (keputusan pemilik 9 Okt 2026): each
 * work-plan point of a check-in becomes a task in the employee's own personal
 * workspace for the same work date — one task per point, idempotent, inside
 * the check-in transaction. Event::fake() also skips User::created, so these
 * tests prove the action creates the personal workspace itself.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Event::fake();
    $this->office = F::office();
});

test('creates one task per work-plan point in the personal workspace', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan', 'Meeting klien 14.00']])->assertCreated();

    $day = AttendanceDay::query()->sole();
    $personal = Workspace::query()
        ->where('type', WorkspaceType::Personal->value)
        ->where('owner_id', $user->id)
        ->firstOrFail();

    $tasks = Task::query()->where('workspace_id', $personal->id)->with('assignees')->orderBy('number')->get();

    expect($tasks)->toHaveCount(2)
        ->and($tasks[0]->title)->toBe('Selesaikan laporan mingguan')
        ->and($tasks[1]->title)->toBe('Meeting klien 14.00')
        ->and($tasks->pluck('source')->unique()->values()->all())->toBe([TaskSource::Attendance])
        ->and($tasks->pluck('source_id')->unique()->values()->all())->toBe([$day->id])
        ->and($tasks->pluck('created_by')->unique()->values()->all())->toBe([$user->id])
        ->and($tasks[0]->due_date?->toDateString())->toBe('2026-10-05')
        ->and($tasks[1]->due_date?->toDateString())->toBe('2026-10-05');

    foreach ($tasks as $task) {
        expect($task->assignees->modelKeys())->toBe([$user->id]);
    }
});

test('a check-in without a plan creates no tasks (QR/kiosk paths)', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user)->assertCreated();

    expect(Task::query()->count())->toBe(0);
});

test('a retried check-in does not duplicate the tasks', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Satu', 'Dua']])->assertCreated();

    $this->travelTo(F::at('2026-10-05 09:00'));
    F::checkIn($user, ['work_plan' => ['Satu', 'Dua']])->assertUnprocessable();

    expect(Task::query()->fromAttendance()->count())->toBe(2);
});

test('replaying the work-plan action is idempotent, including identical points', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Rapat', 'Rapat', 'Laporan']])->assertCreated();

    $day = AttendanceDay::query()->sole();

    app(CreateWorkPlanTasks::class)->handle($day);
    app(CreateWorkPlanTasks::class)->handle($day);

    $titles = Task::query()->fromAttendance()->orderBy('number')->pluck('title')->all();

    expect($titles)->toBe(['Rapat', 'Rapat', 'Laporan']);
});

test('a point longer than the task title keeps its full text as the description', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $point = str_repeat('a', 300);

    F::checkIn($user, ['work_plan' => [$point]])->assertCreated();

    $task = Task::query()->fromAttendance()->sole();

    expect(mb_strlen($task->title))->toBe(255)
        ->and($task->description_text)->toBe($point);
});

test('a trashed personal workspace is restored to hold the work-plan tasks', function () {
    $user = F::employee();
    $personal = app(EnsurePersonalWorkspace::class)->handle($user);
    $personal->delete();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Satu poin']])->assertCreated();

    expect($personal->fresh()->trashed())->toBeFalse()
        ->and($personal->tasks()->count())->toBe(1);
});

test('CreateTask keeps source_id when the source arrives as its string value', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Satu poin']])->assertCreated();
    $day = AttendanceDay::query()->sole();
    $personal = app(EnsurePersonalWorkspace::class)->handle($user);

    $task = app(CreateTask::class)->handle($personal, $user, [
        'title' => 'Dari string',
        'source' => 'attendance',
        'source_id' => $day->id,
    ]);

    expect($task->source)->toBe(TaskSource::Attendance)
        ->and($task->source_id)->toBe($day->id);

    // A manual task never keeps a source_id.
    $manual = app(CreateTask::class)->handle($personal, $user, ['title' => 'Manual', 'source' => 'manual', 'source_id' => $day->id]);

    expect($manual->source)->toBe(TaskSource::Manual)
        ->and($manual->source_id)->toBeNull();
});
