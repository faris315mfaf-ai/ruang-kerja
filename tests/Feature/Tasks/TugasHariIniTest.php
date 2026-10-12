<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Queries\TugasHariIni;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * "Tugas hari ini" (dashboard): tasks of the viewer due today — office date
 * — in three segments: pribadi (own personal workspace, termasuk hasil
 * absensi), tim (non-personal workspaces the viewer is a member of) and
 * semua. Not a member or archived → not in `tim`; other people's personal
 * workspaces stay invisible.
 */
beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00', 'Asia/Jakarta'));

    $this->viewer = User::factory()->create();
    $this->lead = User::factory()->create();

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->viewer);
    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMH']);
    addMember($this->team, $this->viewer);

    // Pribadi: dua tugas jatuh tempo hari ini, satu besok (tidak dihitung).
    app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Pribadi A', 'due_date' => '2026-10-06']);
    app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Pribadi B', 'due_date' => '2026-10-06']);
    app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Pribadi besok', 'due_date' => '2026-10-07']);

    // Tim: satu tugas jatuh tempo hari ini untuk viewer, satu kemarin.
    app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Tim hari ini', 'due_date' => '2026-10-06', 'assignee_ids' => [$this->viewer->id]]);
    app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Tim kemarin', 'due_date' => '2026-10-05']);
});

test('splits the tasks due today into pribadi, tim and semua', function () {
    $payload = app(TugasHariIni::class)->for($this->viewer);

    expect($payload['today'])->toBe('2026-10-06')
        ->and(array_column($payload['pribadi'], 'title'))->toBe(['Pribadi A', 'Pribadi B'])
        ->and(array_column($payload['tim'], 'title'))->toBe(['Tim hari ini'])
        ->and(array_column($payload['semua'], 'title'))->toBe(['Pribadi A', 'Pribadi B', 'Tim hari ini'])
        ->and($payload['counts'])->toBe(['pribadi' => 2, 'tim' => 1, 'semua' => 3]);

    $tim = $payload['tim'][0];

    expect($tim['workspace'])->toBe(['key' => 'TMH', 'name' => $this->team->name])
        ->and($tim['key'])->toBe('TMH-1')
        ->and($tim['url'])->toBe('/w/TMH/tasks/1')
        ->and($tim['assignees'])->toBe([$this->viewer->name]);
});

test('workspaces the viewer is not a member of, archived ones and other personal workspaces are excluded', function () {
    // Internal workspace: visible to everyone, but the viewer is not a member.
    $internal = Workspace::factory()->team()->internal()->ownedBy($this->lead)->create(['key' => 'INT']);
    app(CreateTask::class)->handle($internal, $this->lead, ['title' => 'Internal bukan anggota', 'due_date' => '2026-10-06']);

    // Archived team workspace where the viewer IS a member.
    $archived = Workspace::factory()->team()->ownedBy($this->lead)->archived()->create(['key' => 'ARC']);
    addMember($archived, $this->viewer);
    app(CreateTask::class)->handle($archived, $this->lead, ['title' => 'Tim diarsipkan', 'due_date' => '2026-10-06']);

    // Someone else's personal workspace: invisible to the viewer.
    $colleague = User::factory()->create();
    $other = app(EnsurePersonalWorkspace::class)->handle($colleague);
    app(CreateTask::class)->handle($other, $colleague, ['title' => 'Pribadi orang lain', 'due_date' => '2026-10-06']);

    $payload = app(TugasHariIni::class)->for($this->viewer);

    expect(array_column($payload['semua'], 'title'))->toBe(['Pribadi A', 'Pribadi B', 'Tim hari ini'])
        ->and($payload['counts'])->toBe(['pribadi' => 2, 'tim' => 1, 'semua' => 3]);
});

test('tim lists only tasks assigned to the viewer, flags assignments by others, and puts "tanpa prioritas" last', function () {
    // A colleague's task due today in the same team: not the viewer's to do.
    $colleague = addMember($this->team, User::factory()->create());
    app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Tugas rekan', 'due_date' => '2026-10-06', 'assignee_ids' => [$colleague->id]]);
    // Unassigned team task due today: not listed either.
    app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Tanpa penerima', 'due_date' => '2026-10-06']);
    // The viewer's own team task, self-assigned, urgent (1) → before "tanpa" (0).
    app(CreateTask::class)->handle($this->team, $this->viewer, ['title' => 'Inisiatif sendiri', 'due_date' => '2026-10-06', 'priority' => 1, 'assignee_ids' => [$this->viewer->id]]);
    // Personal: low priority (4) before "tanpa prioritas" (0).
    app(CreateTask::class)->handle($this->personal, $this->viewer, ['title' => 'Pribadi rendah', 'due_date' => '2026-10-06', 'priority' => 4]);

    $payload = app(TugasHariIni::class)->for($this->viewer);
    $byTitle = collect($payload['semua'])->keyBy('title');

    expect(array_column($payload['tim'], 'title'))->toBe(['Inisiatif sendiri', 'Tim hari ini'])
        ->and(array_column($payload['pribadi'], 'title'))->toBe(['Pribadi rendah', 'Pribadi A', 'Pribadi B'])
        ->and($byTitle['Tim hari ini']['assigned_by_other'])->toBeTrue()
        ->and($byTitle['Inisiatif sendiri']['assigned_by_other'])->toBeFalse()
        ->and($byTitle['Pribadi A']['assigned_by_other'])->toBeFalse();
});
