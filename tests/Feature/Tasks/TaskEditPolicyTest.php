<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Matrix sunting/hapus tugas (keputusan pemilik 9 Okt 2026):
 * - tugas pribadi buatan sendiri (termasuk hasil absensi) → boleh sendiri;
 * - tugas yang DITUGASKAN orang lain → hanya pembuat/atasan (admin workspace
 *   atau manajer langsung penerima tugas); penerima tetap bisa move (menyelesaikan);
 * - tugas tim lainnya → kebijakan workspace yang ada (editTasks).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->lead = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMW']);
    $this->worker = addMember($this->team, User::factory()->managedBy($this->lead)->create());
});

function taskVerdict(User $user, string $ability, Task $task): string
{
    $response = Gate::forUser($user)->inspect($ability, $task);

    return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
}

test('own tasks in the personal workspace are editable by their owner', function () {
    $personal = app(EnsurePersonalWorkspace::class)->handle($this->worker);
    $own = app(CreateTask::class)->handle($personal, $this->worker, ['title' => 'Catatan sendiri']);
    $outsider = User::factory()->create();

    expect(taskVerdict($this->worker, 'update', $own))->toBe('allow')
        ->and(taskVerdict($this->worker, 'delete', $own))->toBe('allow')
        ->and(taskVerdict($this->worker, 'move', $own))->toBe('allow')
        ->and(taskVerdict($outsider, 'update', $own))->toBe('hidden');
});

test('a task assigned by someone else is closed to its assignee', function () {
    $assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Tugas dari atasan',
        'assignee_ids' => [$this->worker->id],
    ]);

    // The assignee works on the task but cannot edit or delete it.
    expect(taskVerdict($this->worker, 'update', $assigned))->toBe('deny')
        ->and(taskVerdict($this->worker, 'delete', $assigned))->toBe('deny')
        ->and(taskVerdict($this->worker, 'move', $assigned))->toBe('allow')
        ->and(taskVerdict($this->worker, 'plan', $assigned))->toBe('allow')
        ->and(taskVerdict($this->worker, 'comment', $assigned))->toBe('allow');
});

test('the creator and workspace superiors may edit and delete an assigned task', function () {
    $assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Tugas dari atasan',
        'assignee_ids' => [$this->worker->id],
    ]);

    $admin = memberWithRole($this->team, WorkspaceRole::Admin);

    // Pembuat (owner workspace) dan admin workspace.
    expect(taskVerdict($this->lead, 'update', $assigned))->toBe('allow')
        ->and(taskVerdict($this->lead, 'delete', $assigned))->toBe('allow')
        ->and(taskVerdict($admin, 'update', $assigned))->toBe('allow')
        ->and(taskVerdict($admin, 'delete', $assigned))->toBe('allow');
});

test('the direct manager of an assignee may edit and delete an assigned task', function () {
    $manager = addMember($this->team, User::factory()->create());
    $worker = addMember($this->team, User::factory()->managedBy($manager)->create());

    $assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Untuk bawahan manager',
        'assignee_ids' => [$worker->id],
    ]);

    expect(taskVerdict($manager, 'update', $assigned))->toBe('allow')
        ->and(taskVerdict($manager, 'delete', $assigned))->toBe('allow')
        ->and(taskVerdict($worker, 'update', $assigned))->toBe('deny');
});

test('self-created tasks stay editable by their creator, even when assigned', function () {
    $own = app(CreateTask::class)->handle($this->team, $this->worker, [
        'title' => 'Inisiatif sendiri',
        'assignee_ids' => [$this->worker->id],
    ]);

    expect(taskVerdict($this->worker, 'update', $own))->toBe('allow')
        ->and(taskVerdict($this->worker, 'delete', $own))->toBe('allow');
});

test('team tasks keep the workspace editTasks policy', function () {
    // Unassigned team task: any member may edit it, deletion stays creator/admin.
    $unassigned = app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Tugas tim']);
    $member = memberWithRole($this->team, WorkspaceRole::Member);
    $viewer = memberWithRole($this->team, WorkspaceRole::Viewer);

    expect(taskVerdict($member, 'update', $unassigned))->toBe('allow')
        ->and(taskVerdict($viewer, 'update', $unassigned))->toBe('deny')
        ->and(taskVerdict($member, 'delete', $unassigned))->toBe('deny')
        ->and(taskVerdict($this->lead, 'delete', $unassigned))->toBe('allow');

    // A member who is not the assignee may still edit a colleague's task.
    $assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Untanggota lain',
        'assignee_ids' => [$this->worker->id],
    ]);

    expect(taskVerdict($member, 'update', $assigned))->toBe('allow');
});

test('an archived workspace is read-only for everyone', function () {
    $assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Tugas dari atasan',
        'assignee_ids' => [$this->worker->id],
    ]);

    $this->team->forceFill(['archived_at' => now()])->save();

    expect(taskVerdict($this->lead, 'update', $assigned))->toBe('deny')
        ->and(taskVerdict($this->worker, 'move', $assigned))->toBe('deny');
});
