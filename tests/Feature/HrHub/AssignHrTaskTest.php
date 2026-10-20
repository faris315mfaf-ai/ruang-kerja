<?php

use App\Domain\HrHub\Actions\AssignHrTask;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Notifications\TaskAssignedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceMember;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/*
 * "Beri tugas" (Ruang HR › Penugasan, keputusan pemilik 20 Okt 2026).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana HR']);
    $this->ops = Division::factory()->create(['name' => 'Operasional']);
    $this->warehouse = Division::factory()->childOf($this->ops)->create(['name' => 'Gudang']);
    $this->team = Team::factory()->create(['division_id' => $this->ops->id, 'name' => 'Tim Kirim']);
    $this->a = User::factory()->withRole(Role::Anggota)->inDivision($this->ops)->create(['name' => 'Andi']);
    $this->b = User::factory()->withRole(Role::Anggota)->inDivision($this->warehouse)->create(['name' => 'Budi']);
    $this->c = User::factory()->withRole(Role::Anggota)->create(['name' => 'Citra', 'team_id' => $this->team->id]);
    $this->gone = User::factory()->withRole(Role::Anggota)->inDivision($this->ops)->inactive()->create(['name' => 'Dodi']);
});

it('gives one task per person with the checklist and makes recipients plain members', function () {
    $tasks = app(AssignHrTask::class)->handle($this->hr, [
        'user_ids' => [$this->a->id, $this->b->id, $this->a->id],
        'mode' => 'per_person',
        'title' => 'Lengkapi data BPJS',
        'description_text' => 'Unggah kartu BPJS terbaru.',
        'due_date' => '2026-10-30',
        'priority' => 2,
        'checklist' => ['Foto kartu', '  ', 'Nomor KK'],
    ]);

    expect($tasks)->toHaveCount(2);

    foreach ($tasks as $task) {
        $task->refresh()->load(['assignees', 'checklistItems', 'workspace']);
        expect($task->workspace->name)->toBe('Penugasan HR')
            ->and($task->assignees)->toHaveCount(1)
            ->and($task->checklistItems->pluck('title')->all())->toBe(['Foto kartu', 'Nomor KK'])
            ->and($task->due_date?->toDateString())->toBe('2026-10-30')
            ->and($task->description_text)->toBe('Unggah kartu BPJS terbaru.')
            ->and($task->created_by)->toBe($this->hr->id);
    }

    $workspaceId = $tasks[0]->workspace_id;
    $rows = WorkspaceMember::query()->where('workspace_id', $workspaceId)->whereIn('user_id', [$this->a->id, $this->b->id])->get();
    expect($rows)->toHaveCount(2)
        ->and($rows->every(fn (WorkspaceMember $row): bool => $row->role === WorkspaceRole::Member && ! $row->is_synced))->toBeTrue();

    $audit = AuditLog::query()->where('action', 'hr.task_assigned')->sole();
    expect($audit->new_values)->toMatchArray(['mode' => 'per_person', 'recipients' => 2])
        ->and($audit->new_values['task_ids'])->toHaveCount(2);

    Notification::assertSentTo($this->a, TaskAssignedNotification::class);
});

it('expands divisions with sub-divisions and teams into one shared task, without inactive people', function () {
    $tasks = app(AssignHrTask::class)->handle($this->hr, [
        'division_ids' => [$this->ops->id],
        'team_ids' => [$this->team->id],
        'mode' => 'shared',
        'title' => 'Pelatihan K3',
    ]);

    expect($tasks)->toHaveCount(1)
        ->and($tasks[0]->assignees()->pluck('users.id')->sort()->values()->all())
        ->toBe(collect([$this->a->id, $this->b->id, $this->c->id])->sort()->values()->all());
});

it('ignores people of another company and refuses empty or oversized recipient lists', function () {
    $foreign = Company::factory()->foreign()->create();
    $stranger = User::factory()->forCompany($foreign)->withRole(Role::Anggota)->create();

    expect(fn () => app(AssignHrTask::class)->handle($this->hr, ['user_ids' => [$stranger->id, $this->gone->id], 'mode' => 'shared', 'title' => 'X']))
        ->toThrow(ValidationException::class);

    expect(fn () => app(AssignHrTask::class)->handle($this->hr, [
        'user_ids' => [$this->a->id], 'mode' => 'shared', 'title' => 'X', 'checklist' => array_fill(0, 21, 'butir'),
    ]))->toThrow(ValidationException::class);

    expect(Task::query()->count())->toBe(0);
});

it('is only for HR and Super Admin', function () {
    expect(fn () => app(AssignHrTask::class)->handle($this->a, ['user_ids' => [$this->b->id], 'mode' => 'shared', 'title' => 'X']))
        ->toThrow(AuthorizationException::class);

    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    expect(app(AssignHrTask::class)->handle($admin, ['user_ids' => [$this->b->id], 'mode' => 'shared', 'title' => 'Dari admin']))->toHaveCount(1);
});
