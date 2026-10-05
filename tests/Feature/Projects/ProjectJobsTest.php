<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Jobs\SendProjectUpdateReminders;
use App\Domain\Projects\Jobs\TakeProjectProgressSnapshots;
use App\Domain\Projects\Notifications\ProjectUpdateReminderNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\ProjectProgressSnapshot;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/project-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = makeProject($this->owner);
    $this->pic = memberWithRole($this->project, WorkspaceRole::Admin);
    $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
});

describe('daily snapshot', function () {
    it('writes one row per open project for the office date and is idempotent', function () {
        // 23.55 WIB on Monday 5 Oct = 16.55 UTC.
        $this->travelTo('2026-10-05 16:55:00');
        projectTasks($this->project, 'done', 2, ['estimate_hours' => 4]);
        projectTasks($this->project, 'todo', 3, ['estimate_hours' => 2]);
        projectTasks($this->project, 'canceled', 1);
        $completed = makeProject($this->owner, ['project_status' => ProjectStatus::Completed]);
        $archived = makeProject($this->owner, ['archived_at' => now()]);
        $team = Workspace::factory()->ownedBy($this->owner)->team()->create();

        expect(app()->call([new TakeProjectProgressSnapshots, 'handle']))->toBe(1);

        $snapshot = ProjectProgressSnapshot::query()->sole();
        expect($snapshot->workspace_id)->toBe($this->project->id)
            ->and($snapshot->date->toDateString())->toBe('2026-10-05')
            ->and($snapshot->scope_count)->toBe(5)
            ->and($snapshot->done_count)->toBe(2)
            ->and((float) $snapshot->scope_hours)->toBe(14.0)
            ->and((float) $snapshot->done_hours)->toBe(8.0);

        // Running again the same day overwrites instead of duplicating.
        projectTasks($this->project, 'done', 1);
        app()->call([new TakeProjectProgressSnapshots, 'handle']);
        app()->call([new TakeProjectProgressSnapshots, 'handle']);

        $snapshot = ProjectProgressSnapshot::query()->sole();
        expect($snapshot->scope_count)->toBe(6)->and($snapshot->done_count)->toBe(3);

        expect(ProjectProgressSnapshot::query()->whereIn('workspace_id', [$completed->id, $archived->id, $team->id])->exists())->toBeFalse();
    });

    it('adds a new row the next office day', function () {
        $this->travelTo('2026-10-05 16:55:00');
        app()->call([new TakeProjectProgressSnapshots, 'handle']);
        $this->travelTo('2026-10-06 16:55:00');
        app()->call([new TakeProjectProgressSnapshots, 'handle']);

        expect(ProjectProgressSnapshot::query()->orderBy('date')->pluck('date')->map->toDateString()->all())->toBe(['2026-10-05', '2026-10-06']);
    });

    it('is scheduled at 23.55 and Friday 15.00 office time', function () {
        $events = collect(app(Schedule::class)->events());
        $snapshot = $events->first(fn ($event) => str_contains((string) $event->description, TakeProjectProgressSnapshots::class));
        $reminder = $events->first(fn ($event) => str_contains((string) $event->description, SendProjectUpdateReminders::class));

        expect($snapshot?->expression)->toBe('55 23 * * *')
            ->and($snapshot?->timezone)->toBe('Asia/Jakarta')
            ->and($reminder?->expression)->toBe('0 15 * * 5')
            ->and($reminder?->timezone)->toBe('Asia/Jakarta');
    });
});

describe('Friday reminder', function () {
    beforeEach(function () {
        Notification::fake();
        // Friday 9 Oct 2026, 15.00 WIB.
        $this->travelTo('2026-10-09 08:00:00');
    });

    it('reminds the PIC when there is no update this week, once', function () {
        expect(app()->call([new SendProjectUpdateReminders, 'handle']))->toBe(1);
        Notification::assertSentTo($this->pic, ProjectUpdateReminderNotification::class);

        app()->call([new SendProjectUpdateReminders, 'handle']);
        Notification::assertSentToTimes($this->pic, ProjectUpdateReminderNotification::class, 1);
    });

    it('skips projects updated since Monday 00.00 office time', function () {
        // Monday 5 Oct 00.30 WIB = Sunday 17.30 UTC.
        ProjectUpdate::factory()->for($this->project, 'workspace')->create(['created_at' => '2026-10-04 17:30:00']);

        expect(app()->call([new SendProjectUpdateReminders, 'handle']))->toBe(0);
        Notification::assertNothingSent();
    });

    it('still reminds when the last update was last week', function () {
        // Sunday 4 Oct 23.30 WIB.
        ProjectUpdate::factory()->for($this->project, 'workspace')->create(['created_at' => '2026-10-04 16:30:00']);

        expect(app()->call([new SendProjectUpdateReminders, 'handle']))->toBe(1);
    });

    it('skips projects without PIC, not running, archived or not started', function () {
        $this->project->forceFill(['project_status' => ProjectStatus::OnHold])->save();
        makeProject($this->owner, ['lead_user_id' => null]);
        makeProject($this->owner, ['lead_user_id' => $this->pic->id, 'archived_at' => now()]);
        makeProject($this->owner, ['lead_user_id' => $this->pic->id, 'start_date' => '2026-10-12', 'target_date' => '2026-12-01']);
        makeProject($this->owner, ['lead_user_id' => User::factory()->inactive()->create()->id]);

        expect(app()->call([new SendProjectUpdateReminders, 'handle']))->toBe(0);
        Notification::assertNothingSent();
    });
});
