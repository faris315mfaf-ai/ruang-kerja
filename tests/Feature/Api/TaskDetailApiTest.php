<?php

use App\Domain\Google\Jobs\UploadToDrive;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\Attachment;
use App\Models\ChecklistItem;
use App\Models\DriveFile;
use App\Models\Label;
use App\Models\SavedView;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\TaskPolicy;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — B3-A1 "Tugas": the full detail payload (can / locked_reason /
| banner), plan, saved views, checklist, sub-tasks, watchers, attachments and
| the activity feed. The fixture mirrors the 9 Oct rule: "Deploy rilis" is a
| task the lead assigned to Rizky (titipan) — he works on it but cannot edit.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-13 09:00', 'Asia/Jakarta'));
    Notification::fake();

    $this->lead = User::factory()->create(['name' => 'Dimas Pemimpin']);
    $this->manager = User::factory()->create(['name' => 'Rudi Manajer']);
    $this->rizky = User::factory()->managedBy($this->manager)->create(['name' => 'Rizky Staf']);
    $this->maya = User::factory()->create(['name' => 'Maya Rekan']);
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Direksi']);
    $this->stranger = User::factory()->create(['name' => 'Orang Luar']);

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->rizky);
    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS']);
    addMember($this->team, $this->rizky);
    addMember($this->team, $this->manager);
    addMember($this->team, $this->maya);

    $this->bug = Label::factory()->create(['workspace_id' => $this->team->id, 'name' => 'Bug', 'color' => 'red']);

    // Titipan: made by the lead, received by Rizky.
    $this->assigned = app(CreateTask::class)->handle($this->team, $this->lead, [
        'title' => 'Deploy rilis',
        'due_date' => '2026-10-14',
        'priority' => 2,
        'assignee_ids' => [$this->rizky->id],
        'label_ids' => [$this->bug->id],
    ]);
    // Rizky's own team task and personal task.
    $this->own = app(CreateTask::class)->handle($this->team, $this->rizky, ['title' => 'Tugas Rizky sendiri']);
    $this->mine = app(CreateTask::class)->handle($this->personal, $this->rizky, ['title' => 'Catatan pribadi']);

    Sanctum::actingAs($this->rizky);
});

// ------------------------------------------------------------------ detail

test('the detail carries everything the screen shows and the rights as the policies answer', function () {
    ChecklistItem::query()->create(['task_id' => $this->own->id, 'title' => 'Siapkan data', 'position' => 'a']);
    app(CreateTask::class)->handle($this->team, $this->rizky, ['title' => 'Sub tugas A', 'parent_id' => $this->own->id]);

    $task = $this->getJson("/api/v1/tugas/{$this->own->id}")->assertOk()->json('task');

    expect($task)->toMatchArray([
        'id' => $this->own->id,
        'key' => 'TMS-'.$this->own->number,
        'title' => 'Tugas Rizky sendiri',
        'am_watching' => true,
        'banner' => null,
        'view_only' => false,
    ])
        ->and($task['workspace'])->toMatchArray(['key' => 'TMS', 'type' => 'team', 'archived' => false])
        ->and($task['status']['category'])->toBe('todo')
        ->and(array_column($task['statuses'], 'category'))->toBe(['backlog', 'todo', 'in_progress', 'review', 'done'])
        ->and($task['checklist'])->toBe(['done' => 0, 'total' => 1])
        ->and($task['checklist_items'][0])->toMatchArray(['title' => 'Siapkan data', 'is_done' => false])
        ->and($task['subtasks'])->toHaveCount(1)
        ->and($task['subtasks'][0])->toMatchArray(['title' => 'Sub tugas A', 'group' => 'tanpa-tenggat'])
        ->and($task['workspace_labels'])->toBe([['id' => $this->bug->id, 'name' => 'Bug', 'color' => 'red']])
        ->and($task['watchers'][0]['id'])->toBe($this->rizky->id)
        ->and($task['attachments'])->toBe([])
        ->and($task['comments'])->toBe(['count' => 0, 'unread' => false])
        ->and($task['plan'])->toBe(['bucket' => null, 'planned_for' => null])
        ->and($task['activity_preview'][0]['event'])->toBe('task.subtask_added')
        ->and($task['can'])->toMatchArray(['edit' => true, 'delete' => true, 'comment' => true, 'work' => true, 'plan' => false, 'move' => true, 'watch' => true, 'track_reads' => true])
        ->and($task['locked_reason']['edit'])->toBeNull();
});

test('a task handed to me is a titipan: I work on it, the edit is locked with the reason', function () {
    $task = $this->getJson("/api/v1/tugas/{$this->assigned->id}")->assertOk()->json('task');

    expect($task['can'])->toMatchArray(['edit' => false, 'delete' => false, 'work' => true, 'move' => true, 'plan' => true, 'comment' => true, 'watch' => true])
        ->and($task['locked_reason']['edit'])->toBe(TaskPolicy::ASSIGNED_BY_OTHER)
        ->and($task['locked_reason']['delete'])->toBe(TaskPolicy::ASSIGNED_BY_OTHER)
        ->and($task['locked_reason']['work'])->toBeNull()
        ->and($task['banner']['kind'])->toBe('titipan')
        ->and($task['banner']['message'])->toContain('Dimas Pemimpin')
        ->and($task['banner']['assigned_by']['id'])->toBe($this->lead->id)
        ->and($task['creator']['name'])->toBe('Dimas Pemimpin')
        ->and($task['labels'])->toBe([['id' => $this->bug->id, 'name' => 'Bug', 'color' => 'red']]);
});

test('management that is not a member sees the view-only banner and every action closed', function () {
    Sanctum::actingAs($this->direksi);

    $task = $this->getJson("/api/v1/tugas/{$this->assigned->id}")->assertOk()->json('task');

    expect($task['view_only'])->toBeTrue()
        ->and($task['banner']['kind'])->toBe('lihat_saja')
        ->and($task['banner']['message'])->toBe(TaskPolicy::VIEW_ONLY)
        ->and($task['can'])->toMatchArray(['comment' => false, 'watch' => false, 'track_reads' => false, 'work' => false, 'edit' => false])
        ->and($task['locked_reason']['comment'])->toBe(TaskPolicy::VIEW_ONLY)
        ->and($task['locked_reason']['watch'])->toBe(TaskPolicy::VIEW_ONLY)
        ->and($task['am_watching'])->toBeFalse();
});

test('an archived workspace is read only with its own banner', function () {
    $this->team->forceFill(['archived_at' => now()])->save();

    $task = $this->getJson("/api/v1/tugas/{$this->own->id}")->assertOk()->json('task');

    expect($task['banner']['kind'])->toBe('arsip')
        ->and($task['can']['comment'])->toBeFalse()
        ->and($task['workspace']['archived'])->toBeTrue()
        ->and($task['locked_reason']['comment'])->toContain('diarsipkan');
});

test('a task I may not see is a 404 on every route of the package', function () {
    $secret = app(CreateTask::class)->handle(app(EnsurePersonalWorkspace::class)->handle($this->stranger), $this->stranger, ['title' => 'Rahasia']);
    $id = $secret->id;

    foreach ([
        ['getJson', "/api/v1/tugas/{$id}"],
        ['getJson', "/api/v1/tugas/{$id}/subtugas"],
        ['postJson', "/api/v1/tugas/{$id}/subtugas", ['title' => 'x']],
        ['postJson', "/api/v1/tugas/{$id}/checklist", ['title' => 'x']],
        ['postJson', "/api/v1/tugas/{$id}/amati"],
        ['getJson', "/api/v1/tugas/{$id}/lampiran"],
        ['getJson', "/api/v1/tugas/{$id}/aktivitas"],
        ['getJson', "/api/v1/tugas/{$id}/dibaca-oleh"],
        ['getJson', "/api/v1/tugas/{$id}/mention"],
        ['putJson', "/api/v1/tugas/{$id}/rencana", ['bucket' => 'today']],
    ] as $call) {
        $this->{$call[0]}($call[1], $call[2] ?? [])->assertNotFound();
    }
});

test('the rich description is exposed as safe HTML, plain descriptions stay editable', function () {
    $this->own->forceFill(['description' => richDoc('Halo ', ['@', $this->maya], ' <script>x</script>')])->save();

    $task = $this->getJson("/api/v1/tugas/{$this->own->id}")->assertOk()->json('task');

    expect($task['description_html'])->toContain('<p>')->toContain('data-id="'.$this->maya->id.'"')
        ->not->toContain('<script>')
        ->and($task['description_plain'])->toBeFalse();

    $plain = $this->getJson("/api/v1/tugas/{$this->mine->id}")->assertOk()->json('task');
    expect($plain['description_html'])->toBeNull()->and($plain['description_plain'])->toBeTrue();
});

test('PATCH takes the new fields and answers with a fresh can', function () {
    $this->patchJson("/api/v1/tugas/{$this->own->id}", [
        'start_date' => '2026-10-13',
        'due_date' => '2026-10-20',
        'estimate_hours' => 3.5,
        'label_ids' => [$this->bug->id],
    ])->assertOk()
        ->assertJsonPath('task.start_date', '2026-10-13')
        ->assertJsonPath('task.estimate_hours', 3.5)
        ->assertJsonPath('task.labels.0.name', 'Bug')
        ->assertJsonPath('task.can.edit', true);

    // Handing the task to a colleague keeps it Rizky's (creator) but the answer already reflects who works on it.
    $this->patchJson("/api/v1/tugas/{$this->own->id}", ['assignee_ids' => [$this->maya->id]])->assertOk()
        ->assertJsonPath('task.assignee_people.0.name', 'Maya Rekan')
        ->assertJsonPath('task.can.edit', true)
        ->assertJsonPath('task.can.plan', false);

    $this->patchJson("/api/v1/tugas/{$this->own->id}", ['start_date' => '2026-10-30', 'due_date' => '2026-10-20'])
        ->assertUnprocessable()->assertJsonValidationErrors('due_date');
    $this->patchJson("/api/v1/tugas/{$this->own->id}", ['label_ids' => [Label::factory()->create()->id]])
        ->assertUnprocessable()->assertJsonValidationErrors(['label_ids.0' => 'Label tidak ada di workspace ini.']);

    // A titipan edit is still refused with the policy message.
    $this->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'Coba ubah'])->assertForbidden();
});

test('create accepts column, labels, start date, estimate and parent', function () {
    $review = statusOf($this->team, 'review');

    $this->postJson('/api/v1/tugas', [
        'workspace_id' => $this->team->id,
        'title' => 'Sub lewat POST',
        'status_id' => $review->id,
        'label_ids' => [$this->bug->id],
        'start_date' => '2026-10-13',
        'estimate_hours' => 2,
        'parent_id' => $this->own->id,
    ])->assertCreated()
        ->assertJsonPath('task.status.id', $review->id)
        ->assertJsonPath('task.labels.0.id', $this->bug->id)
        ->assertJsonPath('task.estimate_hours', 2)
        ->assertJsonPath('task.parent.id', $this->own->id)
        ->assertJsonPath('task.can.edit', true);

    $this->postJson('/api/v1/tugas', ['workspace_id' => $this->team->id, 'title' => 'x', 'parent_id' => $this->assigned->id.'zz'])
        ->assertUnprocessable();
});

// -------------------------------------------------------------------- rencana

test('rencana returns the three lanes, tugas baru and the labels', function () {
    $response = $this->getJson('/api/v1/tugas/rencana')->assertOk();

    expect($response->json('today'))->toBe('2026-10-13')
        ->and($response->json('lane_labels'))->toBe(['today' => 'Hari ini', 'week' => 'Minggu ini', 'later' => 'Nanti'])
        ->and(array_keys($response->json('lanes')))->toBe(['today', 'week', 'later'])
        ->and(collect($response->json('incoming'))->pluck('title')->all())->toBe(['Deploy rilis'])
        // A fresh assignment waits in "tugas baru" until it is accepted or planned.
        ->and($response->json('lanes.week'))->toBe([])
        ->and($response->json('lanes.later.0.title'))->toBe('Catatan pribadi');
});

test('planning a task moves it to the lane, accepts the assignment and can be undone', function () {
    $this->putJson("/api/v1/tugas/{$this->assigned->id}/rencana", ['bucket' => 'today'])->assertOk()
        ->assertJsonPath('plan.bucket', 'today')
        ->assertJsonPath('plan.planned_for', '2026-10-13')
        ->assertJsonPath('planner.lanes.today.0.title', 'Deploy rilis')
        ->assertJsonPath('planner.counts.incoming', 0);

    // Second task at position 0 goes above the first.
    $this->putJson("/api/v1/tugas/{$this->mine->id}/rencana", ['bucket' => 'today', 'position' => 0])->assertOk()
        ->assertJsonPath('planner.lanes.today.0.title', 'Catatan pribadi')
        ->assertJsonPath('planner.lanes.today.1.title', 'Deploy rilis');

    $this->putJson("/api/v1/tugas/{$this->mine->id}/rencana", ['bucket' => 'today', 'after_id' => $this->assigned->id])->assertOk()
        ->assertJsonPath('planner.lanes.today.1.title', 'Catatan pribadi');

    $this->putJson("/api/v1/tugas/{$this->assigned->id}/rencana", ['bucket' => null])->assertOk()
        ->assertJsonPath('plan.bucket', null)
        ->assertJsonPath('planner.counts.incoming', 0)
        ->assertJsonPath('planner.lanes.week.0.auto', true);

    expect(TaskPlan::query()->where('user_id', $this->rizky->id)->count())->toBe(2);
});

test('only my own tasks can be planned and the plan stays private', function () {
    // Not assigned to Rizky and not in his personal workspace.
    $this->putJson("/api/v1/tugas/{$this->own->id}/rencana", ['bucket' => 'today'])->assertForbidden();
    $theirs = app(CreateTask::class)->handle($this->team, $this->lead, ['title' => 'Milik Dimas', 'assignee_ids' => [$this->maya->id]]);
    $this->putJson("/api/v1/tugas/{$theirs->id}/rencana", ['bucket' => 'today'])->assertForbidden();

    $this->putJson("/api/v1/tugas/{$this->mine->id}/rencana", ['bucket' => 'besok'])->assertUnprocessable();
    $this->putJson("/api/v1/tugas/{$this->mine->id}/rencana", [])->assertUnprocessable()->assertJsonValidationErrors('bucket');

    Sanctum::actingAs($this->maya);
    expect($this->getJson('/api/v1/tugas/rencana')->assertOk()->json('lanes.today'))->toBe([]);
});

// -------------------------------------------------------------------- tampilan

test('personal cross-workspace views: create, list, update, delete', function () {
    $filters = ['workspaces' => ['TMS'], 'statuses' => ['todo', 'in_progress'], 'priorities' => [1, 2], 'due' => 'week', 'due_from' => '2026-10-13', 'q' => 'rilis'];

    $id = $this->postJson('/api/v1/tugas/tampilan', ['name' => 'Fokus minggu ini', 'filters' => $filters])->assertCreated()
        ->assertJsonPath('view.layout', 'list')
        ->assertJsonPath('view.workspace_id', null)
        ->assertJsonPath('view.mine', true)
        ->assertJsonPath('view.filters.workspaces', ['TMS'])
        ->assertJsonPath('view.filters.statuses', ['todo', 'in_progress'])
        ->assertJsonPath('view.filters.due_from', '2026-10-13')
        ->json('view.id');

    $this->getJson('/api/v1/tugas/tampilan')->assertOk()->assertJsonCount(1, 'views')->assertJsonPath('views.0.name', 'Fokus minggu ini');

    $this->patchJson("/api/v1/tugas/tampilan/{$id}", ['name' => 'Fokus', 'filters' => ['priorities' => [1]]])->assertOk()
        ->assertJsonPath('view.name', 'Fokus')
        ->assertJsonPath('view.filters.priorities', [1])
        ->assertJsonPath('view.filters.q', '');

    $this->deleteJson("/api/v1/tugas/tampilan/{$id}")->assertNoContent();
    $this->getJson('/api/v1/tugas/tampilan')->assertOk()->assertJsonCount(0, 'views');
});

test('a view without workspace can never be shared and is capped', function () {
    $this->postJson('/api/v1/tugas/tampilan', ['name' => 'Bersama', 'is_shared' => true])
        ->assertUnprocessable()->assertJsonPath('errors.is_shared.0', 'Tampilan lintas workspace hanya bisa pribadi.');
    $this->postJson('/api/v1/tugas/tampilan', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson('/api/v1/tugas/tampilan', ['name' => 'A', 'filters' => ['statuses' => ['hilang']]])->assertUnprocessable();

    SavedView::factory()->count(20)->create(['user_id' => $this->rizky->id, 'workspace_id' => null]);
    $this->postJson('/api/v1/tugas/tampilan', ['name' => 'Ke-21'])->assertUnprocessable()->assertJsonValidationErrors('name');
});

test('views of other people stay hidden and workspace views follow the web policy', function () {
    $others = SavedView::factory()->create(['user_id' => $this->maya->id, 'workspace_id' => null, 'name' => 'Milik Maya']);
    $this->patchJson("/api/v1/tugas/tampilan/{$others->id}", ['name' => 'Curian'])->assertNotFound();
    $this->deleteJson("/api/v1/tugas/tampilan/{$others->id}")->assertNotFound();
    $this->getJson('/api/v1/tugas/tampilan')->assertOk()->assertJsonCount(0, 'views');

    // A shared view of a workspace is visible to its members; sharing needs edit rights.
    $shared = $this->postJson('/api/v1/tugas/tampilan', ['name' => 'Tim', 'workspace_id' => $this->team->id, 'layout' => 'board', 'is_shared' => true])
        ->assertCreated()->assertJsonPath('view.is_shared', true)->json('view.id');

    Sanctum::actingAs($this->maya);
    $this->getJson('/api/v1/tugas/tampilan?workspace_id='.$this->team->id)->assertOk()
        ->assertJsonPath('views.0.id', $shared)->assertJsonPath('views.0.mine', false)->assertJsonPath('views.0.owner', 'Rizky Staf');
    $this->patchJson("/api/v1/tugas/tampilan/{$shared}", ['name' => 'Curian'])->assertForbidden();

    Sanctum::actingAs($this->stranger);
    $this->getJson('/api/v1/tugas/tampilan?workspace_id='.$this->team->id)->assertNotFound();
    $this->postJson('/api/v1/tugas/tampilan', ['name' => 'X', 'workspace_id' => $this->team->id])->assertNotFound();
});

// ------------------------------------------------------------------- checklist

test('the assignee of a titipan works the checklist: add, tick, rename, reorder, delete', function () {
    $base = "/api/v1/tugas/{$this->assigned->id}/checklist";

    $first = $this->postJson($base, ['title' => 'Backup database'])->assertCreated()
        ->assertJsonPath('checklist', ['done' => 0, 'total' => 1])->json('item.id');
    $second = $this->postJson($base, ['title' => 'Deploy staging'])->assertCreated()->json('item.id');
    $third = $this->postJson($base, ['title' => 'Deploy produksi'])->assertCreated()->json('item.id');

    $this->patchJson("{$base}/{$first}", ['is_done' => true])->assertOk()
        ->assertJsonPath('item.is_done', true)
        ->assertJsonPath('item.done_by', $this->rizky->id)
        ->assertJsonPath('checklist', ['done' => 1, 'total' => 3]);

    $this->patchJson("{$base}/{$second}", ['title' => 'Deploy staging 2'])->assertOk()->assertJsonPath('item.title', 'Deploy staging 2');

    // Move the last line to the top (before the first).
    $order = $this->patchJson("{$base}/{$third}", ['before_id' => $first])->assertOk()->json('items');
    expect(array_column($order, 'id'))->toBe([$third, $first, $second]);

    $order = $this->patchJson("{$base}/{$third}", ['after_id' => $second])->assertOk()->json('items');
    expect(array_column($order, 'id'))->toBe([$first, $second, $third]);

    $this->deleteJson("{$base}/{$second}")->assertOk()->assertJsonPath('removed', true)->assertJsonPath('checklist', ['done' => 1, 'total' => 2]);

    // The same assignee still cannot edit the task itself.
    $this->patchJson("/api/v1/tugas/{$this->assigned->id}", ['title' => 'x'])->assertForbidden();
    $this->postJson($base, ['title' => ''])->assertUnprocessable()->assertJsonPath('errors.title.0', 'Isi checklist wajib diisi.');
});

test('checklist rights follow the task: view only is refused and lines of another task are not found', function () {
    $line = ChecklistItem::query()->create(['task_id' => $this->own->id, 'title' => 'Satu', 'position' => 'a']);

    // Line of another task under this task's URL.
    $this->patchJson("/api/v1/tugas/{$this->assigned->id}/checklist/{$line->id}", ['is_done' => true])->assertNotFound();

    Sanctum::actingAs($this->direksi);
    $this->postJson("/api/v1/tugas/{$this->own->id}/checklist", ['title' => 'Coba'])->assertForbidden();
    $this->patchJson("/api/v1/tugas/{$this->own->id}/checklist/{$line->id}", ['is_done' => true])->assertForbidden();
    $this->deleteJson("/api/v1/tugas/{$this->own->id}/checklist/{$line->id}")->assertForbidden();
    expect($line->fresh()->is_done)->toBeFalse();
});

// --------------------------------------------------------------------- subtugas

test('sub-tasks are listed and created under the parent with the web numbering and activity', function () {
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/subtugas", [
        'title' => 'Siapkan skrip migrasi',
        'assignee_ids' => [$this->maya->id],
        'due_date' => '2026-10-14',
        'priority' => 1,
    ])->assertCreated()
        ->assertJsonPath('subtask.title', 'Siapkan skrip migrasi')
        ->assertJsonPath('subtask.workspace.key', 'TMS')
        ->assertJsonPath('subtask.assignee_people.0.name', 'Maya Rekan')
        ->assertJsonPath('subtask.group', 'minggu-ini');

    $list = $this->getJson("/api/v1/tugas/{$this->assigned->id}/subtugas")->assertOk()
        ->assertJsonPath('parent.title', 'Deploy rilis')
        ->assertJsonCount(1, 'subtasks');

    expect(Task::query()->where('parent_id', $this->assigned->id)->count())->toBe(1);
    $this->getJson("/api/v1/tugas/{$this->assigned->id}/aktivitas")->assertOk()
        ->assertJsonPath('activities.0.event', 'task.subtask_added');

    // The sub-task shows up in the parent detail too, and the title is required.
    expect($this->getJson("/api/v1/tugas/{$this->assigned->id}")->json('task.subtasks.0.title'))->toBe('Siapkan skrip migrasi');
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/subtugas", ['title' => ' '])->assertUnprocessable()->assertJsonValidationErrors('title');
});

test('view-only management cannot add sub-tasks', function () {
    Sanctum::actingAs($this->direksi);

    $this->getJson("/api/v1/tugas/{$this->assigned->id}/subtugas")->assertOk();
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/subtugas", ['title' => 'Nyelonong'])->assertForbidden();
});

// ---------------------------------------------------------------------- pengamat

test('watching is idempotent and answers with the watcher list', function () {
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/amati")->assertOk()->assertJsonPath('watching', true);
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/amati")->assertOk()->assertJsonPath('watching', true);
    expect($this->getJson("/api/v1/tugas/{$this->assigned->id}")->json('task.am_watching'))->toBeTrue();

    $response = $this->deleteJson("/api/v1/tugas/{$this->assigned->id}/amati")->assertOk()->assertJsonPath('watching', false);
    expect(collect($response->json('watchers'))->pluck('id')->all())->toBe([$this->lead->id]);

    Sanctum::actingAs($this->direksi);
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/amati")->assertForbidden();
});

// ----------------------------------------------------------------------- lampiran

test('attachments are listed with their Drive link and removed under the task rights', function () {
    $file = DriveFile::factory()->pdf()->create(['workspace_id' => $this->team->id, 'name' => 'Laporan.pdf']);
    $attachment = Attachment::factory()->create([
        'attachable_type' => $this->assigned->getMorphClass(),
        'attachable_id' => $this->assigned->id,
        'drive_file_id' => $file->id,
        'filename' => 'Laporan.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 2_400_000,
        'uploaded_by' => $this->lead->id,
    ]);

    $list = $this->getJson("/api/v1/tugas/{$this->assigned->id}/lampiran")->assertOk()
        ->assertJsonPath('attachments_can_edit', true)
        ->assertJsonPath('attachments.0.name', 'Laporan.pdf')
        ->assertJsonPath('attachments.0.kind', 'pdf')
        ->assertJsonPath('attachments.0.can_remove', true);
    expect($list->json('attachments.0.link'))->toStartWith('https://drive.google.com/file/d/');
    expect($this->getJson("/api/v1/tugas/{$this->assigned->id}")->json('task.attachments.0.id'))->toBe($attachment->id);

    // Of another task under this URL: not found. View-only management: forbidden.
    $this->deleteJson("/api/v1/tugas/{$this->own->id}/lampiran/{$attachment->id}")->assertNotFound();
    Sanctum::actingAs($this->direksi);
    $this->deleteJson("/api/v1/tugas/{$this->assigned->id}/lampiran/{$attachment->id}")->assertForbidden();

    Sanctum::actingAs($this->rizky);
    $this->deleteJson("/api/v1/tugas/{$this->assigned->id}/lampiran/{$attachment->id}")->assertOk()
        ->assertJsonPath('removed', true)
        ->assertJsonPath('attachments', []);
});

test('an upload is queued for Drive and refused with drive_belum_siap while Drive is off', function () {
    Queue::fake();

    $this->post("/api/v1/tugas/{$this->assigned->id}/lampiran", ['file' => UploadedFile::fake()->create('foto.jpg', 200, 'image/jpeg')], ['Accept' => 'application/json'])
        ->assertStatus(202)->assertJsonPath('status', 'diproses');
    Queue::assertPushed(UploadToDrive::class, fn (UploadToDrive $job): bool => $job->filename === 'foto.jpg' && $job->attachable?->is($this->assigned) === true);

    $this->postJson("/api/v1/tugas/{$this->assigned->id}/lampiran", [])->assertUnprocessable()->assertJsonPath('errors.file.0', 'Pilih berkas yang akan dilampirkan.');

    config(['google.fake' => false, 'google.service_account.credentials' => null, 'google.shared_drive_id' => null]);
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/lampiran", [])->assertStatus(503)->assertJsonPath('code', 'drive_belum_siap');

    Sanctum::actingAs($this->direksi);
    $this->postJson("/api/v1/tugas/{$this->assigned->id}/lampiran", [])->assertForbidden();
});

// ---------------------------------------------------------------------- aktivitas

test('the activity feed is paged, newest first, with the web sentences and a type filter', function () {
    $update = app(UpdateTask::class);
    $update->handle($this->own, $this->rizky, ['title' => 'Judul baru', 'priority' => 1, 'due_date' => '2026-10-17']);
    $update->handle($this->own, $this->rizky, ['assignee_ids' => [$this->maya->id]]);

    $feed = $this->getJson("/api/v1/tugas/{$this->own->id}/aktivitas")->assertOk();
    $events = array_column($feed->json('activities'), 'event');

    expect($events)->toContain('task.created', 'task.renamed', 'task.priority_changed', 'task.due_date_changed', 'task.assigned')
        ->and($feed->json('activities.0.created_at'))->toBeString()
        ->and($feed->json('meta.total'))->toBe(count($events));

    $texts = array_column($feed->json('activities'), 'text', 'event');
    expect($texts['task.renamed'])->toBe('mengganti judul TMS-'.$this->own->number.' menjadi “Judul baru”')
        ->and($texts['task.priority_changed'])->toBe('mengubah prioritas TMS-'.$this->own->number.' menjadi Urgent')
        ->and($texts['task.due_date_changed'])->toBe('mengubah tenggat TMS-'.$this->own->number.' menjadi 17 Okt')
        ->and($texts['task.assigned'])->toBe('menugaskan TMS-'.$this->own->number.' ke Maya Rekan');

    expect(array_column($this->getJson("/api/v1/tugas/{$this->own->id}/aktivitas?jenis=tenggat")->json('activities'), 'event'))->toBe(['task.due_date_changed']);
    expect($this->getJson("/api/v1/tugas/{$this->own->id}/aktivitas?per_page=2")->json('activities'))->toHaveCount(2);
    $this->getJson("/api/v1/tugas/{$this->own->id}/aktivitas?jenis=ngawur")->assertUnprocessable();
});
