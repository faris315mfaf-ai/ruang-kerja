<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\HrHub\Actions\AssignHrTask;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Notifications\MentionNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Mention;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/tenancy-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Penugasan HR keeps tasks private (keputusan pemilik 20 Okt 2026): an
 * employee sees only the tasks assigned to them — on every web and API path
 * that lists or opens tasks — while HR (workspace admins) see all of them.
 */

beforeEach(function () {
    Event::fake([AttendanceRecorded::class]);
    $this->home = homeWorld();
    $this->ayu = User::factory()->withRole(Role::Anggota)->create(['name' => 'Ayu Penerima']);
    $this->bima = User::factory()->withRole(Role::Anggota)->create(['name' => 'Bima Penerima']);

    $assign = app(AssignHrTask::class);
    [$this->taskA] = $assign->handle($this->home->hr, ['user_ids' => [$this->ayu->id], 'mode' => 'per_person', 'title' => 'Rahasia ZZPRIVA', 'checklist' => ['Butir ZZPRIVA']]);
    [$this->taskB] = $assign->handle($this->home->hr, ['user_ids' => [$this->bima->id], 'mode' => 'per_person', 'title' => 'Rahasia ZZPRIVB']);
    $this->workspace = Workspace::query()->findOrFail($this->taskA->workspace_id);
    $this->taskA->load('workspace');

    // HR discusses Ayu's task.
    $this->actingAs($this->home->hr)
        ->postJson(route('comments.store', $this->taskA), ['body' => richDoc('Catatan ZZPRIVA untuk ayu')])
        ->assertSuccessful();
});

/** Every page/endpoint an employee could use to reach Ayu's task. */
function privateTaskReads(Task $task, Workspace $workspace): array
{
    $key = $workspace->key;

    return [
        "/w/{$key}",
        "/w/{$key}?tampilan=list",
        "/w/{$key}/aktivitas",
        "/w/{$key}/rujukan?type=tasks&q=Rahasia",
        '/tugas',
        '/tugas?tab=watching',
        '/dashboard',
        '/kalender',
        '/cari/hasil?q=Rahasia',
        '/laporan/tugas?q=Rahasia',
    ];
}

it('never shows Ayu\'s task to Bima on any web page', function () {
    foreach (privateTaskReads($this->taskA, $this->workspace) as $url) {
        $response = $this->actingAs($this->bima)->get($url);

        expect($response->status())->toBe(200, $url)
            ->and(stripos((string) $response->getContent(), 'ZZPRIVA'))->toBeFalse("{$url} shows Ayu's task to Bima");
    }

    // Control: the same lists do show the task to Ayu herself.
    foreach (["/w/{$this->workspace->key}", '/tugas', '/cari/hasil?q=Rahasia', '/laporan/tugas?q=Rahasia', "/w/{$this->workspace->key}/rujukan?type=tasks&q=Rahasia"] as $url) {
        expect((string) $this->actingAs($this->ayu)->get($url)->getContent())->toContain('ZZPRIVA');
    }

    $this->actingAs($this->bima)->get("/w/{$this->workspace->key}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.create_tasks', false)
            ->where('tasks.0.title', 'Rahasia ZZPRIVB')
            ->has('tasks', 1));
});

it('answers 404 to Bima for every action on Ayu\'s task', function () {
    $todo = TaskStatus::query()->where('workspace_id', $this->workspace->id)->orderBy('position')->first();
    $as = $this->actingAs($this->bima);

    $as->get("/w/{$this->workspace->key}/tasks/{$this->taskA->number}")->assertNotFound();
    $as->getJson("/tugas/{$this->taskA->id}")->assertNotFound();
    $as->getJson("/tugas/{$this->taskA->id}?view=card")->assertNotFound();
    $as->postJson(route('comments.store', $this->taskA), ['body' => richDoc('hai')])->assertNotFound();
    $as->postJson(route('comments.read', $this->taskA))->assertNotFound();
    $as->patchJson(route('tasks.move', $this->taskA), ['status_id' => $todo->id])->assertNotFound();
    $as->patchJson(route('tasks.update', $this->taskA), ['title' => 'Diubah'])->assertNotFound();
    $as->deleteJson(route('tasks.destroy', $this->taskA))->assertNotFound();
    $as->postJson(route('tasks.watch', $this->taskA))->assertNotFound();
    $as->postJson(route('tasks.checklist.store', $this->taskA), ['title' => 'x'])->assertNotFound();

    // Bima cannot add tasks to Penugasan HR either (HR only), but works on his own.
    $as->postJson("/w/{$this->workspace->key}/tugas", ['title' => 'Tugas sendiri'])->assertForbidden();
    $as->patchJson(route('tasks.move', $this->taskB), ['status_id' => $todo->id])->assertSuccessful();
    $as->getJson("/tugas/{$this->taskB->id}?view=card")->assertOk();
});

it('never shows Ayu\'s task to Bima through the mobile API', function () {
    Sanctum::actingAs($this->bima);
    $key = $this->workspace->key;

    foreach ([
        "/api/v1/workspace/{$key}",
        "/api/v1/workspace/{$key}/papan",
        "/api/v1/workspace/{$key}/tugas",
        "/api/v1/workspace/{$key}/kalender",
        "/api/v1/workspace/{$key}/aktivitas",
        "/api/v1/workspace/{$key}/anggota",
        '/api/v1/tugas',
        '/api/v1/tugas/hari-ini',
        '/api/v1/cari?q=Rahasia',
    ] as $url) {
        $response = $this->getJson($url);
        expect($response->status())->toBeLessThan(500, $url)
            ->and(stripos((string) $response->getContent(), 'ZZPRIVA'))->toBeFalse("{$url} shows Ayu's task to Bima")
            ->and(stripos((string) $response->getContent(), 'Ayu Penerima'))->toBeFalse("{$url} names Ayu to Bima");
    }

    $this->getJson("/api/v1/tugas/{$this->taskA->id}")->assertNotFound();
    $this->getJson("/api/v1/tugas/{$this->taskA->id}/komentar")->assertNotFound();
});

it('lists only HR and the viewer as members to an employee', function () {
    $this->actingAs($this->bima)->get("/w/{$this->workspace->key}")
        ->assertInertia(fn (Assert $page) => $page->where('members', fn ($members): bool => collect($members)->pluck('name')->doesntContain('Ayu Penerima')
            && collect($members)->pluck('name')->contains('Bima Penerima')
            && collect($members)->pluck('id')->contains($this->home->hr->id)));
});

it('shows Ayu only her own task and HR every task', function () {
    $ayu = (string) $this->actingAs($this->ayu)->get("/w/{$this->workspace->key}")->getContent();
    expect($ayu)->toContain('ZZPRIVA')->not->toContain('ZZPRIVB');
    $this->actingAs($this->ayu)->get("/w/{$this->workspace->key}/tasks/{$this->taskA->number}")->assertOk();

    $hr = (string) $this->actingAs($this->home->hr)->get("/w/{$this->workspace->key}")->getContent();
    expect($hr)->toContain('ZZPRIVA')->toContain('ZZPRIVB');

    // Direksi read every shared workspace, but not the private tasks of others.
    $direksi = (string) $this->actingAs($this->home->direksi)->get("/w/{$this->workspace->key}")->getContent();
    expect($direksi)->not->toContain('ZZPRIVA')->not->toContain('ZZPRIVB');
    $this->actingAs($this->home->direksi)->getJson("/tugas/{$this->taskA->id}")->assertNotFound();

    expect(Task::query()->visibleTo($this->bima)->pluck('id')->all())->toBe([$this->taskB->id])
        ->and(Task::query()->visibleTo($this->home->hr)->whereKey([$this->taskA->id, $this->taskB->id])->count())->toBe(2)
        ->and($this->workspace->roleOf($this->home->hr))->toBe(WorkspaceRole::Owner);
});

it('does not mention or notify an employee about a task they cannot see', function () {
    Notification::fake();

    $this->actingAs($this->home->hr)
        ->postJson(route('comments.store', $this->taskA), ['body' => richDoc('Tolong bantu ', ['@', $this->bima], ' dan ', ['@', $this->ayu])])
        ->assertSuccessful();

    expect(Mention::query()->where('mentioned_user_id', $this->bima->id)->exists())->toBeFalse()
        ->and(Mention::query()->where('mentioned_user_id', $this->ayu->id)->exists())->toBeTrue();
    Notification::assertNotSentTo($this->bima, MentionNotification::class);
    Notification::assertSentTo($this->ayu, MentionNotification::class);

    // "@" suggestions in Penugasan HR list HR only, never the other employees.
    $people = $this->actingAs($this->ayu)->getJson("/w/{$this->workspace->key}/rujukan?type=people&q=Penerima")->json('people');
    expect(collect($people)->pluck('name')->all())->toBe([]);
});
