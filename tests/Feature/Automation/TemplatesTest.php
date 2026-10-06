<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Templates (F2-4): task template → task (checklist, labels, estimate, due
 * date), workspace template → workspace (columns, labels, unique key), and
 * "Simpan sebagai template" from Pengaturan workspace.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.automation' => true]);
    Queue::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'type' => WorkspaceType::Team]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->template = TaskTemplate::factory()->create([
        'name' => 'Kunjungan klien',
        'title' => 'Kunjungan [klien]',
        'priority' => 2,
        'estimate_hours' => 3.5,
        'checklist' => ['Siapkan bahan', 'Kunjungi', 'Tulis laporan'],
        'labels' => [['name' => 'Klien', 'color' => 'blue'], ['name' => 'Lapangan', 'color' => 'amber']],
        'created_by' => $this->owner->id,
    ]);
});

it('creates a task with checklist, labels, estimate and the chosen due date', function () {
    Label::factory()->create(['workspace_id' => $this->workspace->id, 'name' => 'klien', 'color' => 'teal']);

    $this->actingAs($this->owner)
        ->post("/otomasi/template/tugas/{$this->template->id}/pakai", [
            'workspace_id' => $this->workspace->id,
            'title' => 'Kunjungan PT Sinar',
            'due_date' => '2026-10-20',
        ])
        ->assertRedirect()
        ->assertInertiaFlash('toast.message', 'Tugas OPS-1 dibuat dari template "Kunjungan klien".');

    $task = Task::query()->where('workspace_id', $this->workspace->id)->sole();
    expect($task->title)->toBe('Kunjungan PT Sinar')
        ->and($task->priority->value)->toBe(2)
        ->and((float) $task->estimate_hours)->toBe(3.5)
        ->and($task->due_date?->toDateString())->toBe('2026-10-20')
        ->and($task->checklistItems()->orderBy('position')->pluck('title')->all())->toBe(['Siapkan bahan', 'Kunjungi', 'Tulis laporan'])
        // "klien" matched case-insensitively, "Lapangan" created (the owner manages the workspace).
        ->and($task->labels()->pluck('name')->sort()->values()->all())->toBe(['Lapangan', 'klien'])
        ->and($this->template->fresh()->used_count)->toBe(1);
});

it('skips missing labels for members who cannot manage labels', function () {
    $this->actingAs($this->member)
        ->post("/otomasi/template/tugas/{$this->template->id}/pakai", [
            'workspace_id' => $this->workspace->id,
            'title' => 'Kunjungan PT Sinar',
        ])
        ->assertInertiaFlash('toast.message', 'Tugas OPS-1 dibuat dari template "Kunjungan klien". Label Klien, Lapangan tidak ada di workspace ini dan dilewati.');

    expect(Label::query()->where('workspace_id', $this->workspace->id)->count())->toBe(0)
        ->and(Task::query()->sole()->due_date)->toBeNull();
});

it('refuses viewers and outsiders', function () {
    $viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->post("/otomasi/template/tugas/{$this->template->id}/pakai", ['workspace_id' => $this->workspace->id, 'title' => 'X'])
        ->assertForbidden();

    $this->actingAs(User::factory()->create())
        ->post("/otomasi/template/tugas/{$this->template->id}/pakai", ['workspace_id' => $this->workspace->id, 'title' => 'X'])
        ->assertNotFound();

    expect(Task::query()->count())->toBe(0);
});

it('validates a new task template with the same estimate rule as its message', function (mixed $estimate, bool $valid) {
    $response = $this->actingAs($this->owner)->post('/otomasi/template/tugas', [
        'workspace_id' => null,
        'name' => 'Laporan bulanan',
        'title' => 'Laporan [bulan]',
        'priority' => 3,
        'estimate_hours' => $estimate,
        'checklist' => ['Kumpulkan data', ' ', 'Kirim'],
        'labels' => [],
    ]);

    if ($valid) {
        $response->assertSessionHasNoErrors();
        expect(TaskTemplate::query()->where('name', 'Laporan bulanan')->sole()->checklist)->toBe(['Kumpulkan data', 'Kirim']);
    } else {
        $response->assertSessionHasErrors(['estimate_hours' => 'Estimasi 0,5–999 jam.']);
    }
})->with([
    'none' => [null, true],
    'half an hour' => [0.5, true],
    '999 hours' => [999, true],
    'zero' => [0, false],
    'a quarter' => [0.25, false],
    'too long' => [1000, false],
]);

it('keeps company-wide templates for the roles that may start workspaces', function () {
    $this->actingAs($this->member)
        ->post('/otomasi/template/tugas', ['name' => 'X', 'title' => 'Y', 'priority' => 0, 'checklist' => [], 'labels' => []])
        ->assertForbidden();

    // In a workspace the member manages (their own personal workspace) it works.
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->member->id)->first()
        ?? Workspace::factory()->personal($this->member)->create();

    $this->actingAs($this->member)
        ->post('/otomasi/template/tugas', ['workspace_id' => $personal->id, 'name' => 'X', 'title' => 'Y', 'priority' => 0, 'checklist' => [], 'labels' => []])
        ->assertSessionHasNoErrors();

    expect(TaskTemplate::query()->where('workspace_id', $personal->id)->count())->toBe(1);
});

it('creates a workspace with the template columns and labels', function () {
    $template = WorkspaceTemplate::factory()->create(['name' => 'Peluncuran', 'type' => WorkspaceType::Project]);

    $this->actingAs($this->owner)
        ->post("/otomasi/template/workspace/{$template->id}/pakai", [
            'name' => 'Peluncuran Produk X',
            'key' => 'ppx',
            'visibility' => 'internal',
        ])
        ->assertRedirect('/w/PPX')
        ->assertInertiaFlash('toast.message', 'Workspace PPX dibuat dengan 4 kolom dari template.');

    $workspace = Workspace::query()->where('key', 'PPX')->sole();
    expect($workspace->type)->toBe(WorkspaceType::Project)
        ->and($workspace->visibility->value)->toBe('internal')
        ->and($workspace->roleOf($this->owner))->toBe(WorkspaceRole::Owner)
        ->and(TaskStatus::query()->where('workspace_id', $workspace->id)->orderBy('position')->get()->map(fn (TaskStatus $status) => [$status->name, $status->category->value])->all())
        ->toBe([['Ide', 'backlog'], ['Rencana', 'todo'], ['Dikerjakan', 'in_progress'], ['Rampung', 'done']])
        ->and(Label::query()->where('workspace_id', $workspace->id)->pluck('name')->sort()->values()->all())->toBe(['Desain', 'Konten'])
        ->and($template->fresh()->used_count)->toBe(1);
});

it('validates the workspace key: format and unique including previous keys', function (string $key, string $message) {
    Workspace::factory()->ownedBy($this->owner)->create(['key' => 'LAMA2', 'previous_keys' => ['LAMA']]);
    $template = WorkspaceTemplate::factory()->create();

    $this->actingAs($this->owner)
        ->post("/otomasi/template/workspace/{$template->id}/pakai", ['name' => 'Baru', 'key' => $key, 'visibility' => 'private'])
        ->assertSessionHasErrors(['key' => $message]);
})->with([
    'taken' => ['OPS', 'Kode sudah dipakai workspace lain.'],
    'previous key' => ['lama', 'Kode sudah dipakai workspace lain.'],
    'starts with a digit' => ['1AB', 'Kode 2–10 huruf besar/angka, diawali huruf.'],
    'too short' => ['A', 'Kode 2–10 huruf besar/angka, diawali huruf.'],
    'too long' => ['ABCDEFGHIJK', 'Kode 2–10 huruf besar/angka, diawali huruf.'],
]);

it('refuses a workspace template to people who cannot create that type', function () {
    $template = WorkspaceTemplate::factory()->create(['type' => WorkspaceType::Team]);

    $this->actingAs($this->member)
        ->post("/otomasi/template/workspace/{$template->id}/pakai", ['name' => 'Baru', 'key' => 'BRU', 'visibility' => 'private'])
        ->assertForbidden();

    expect(Workspace::query()->where('key', 'BRU')->exists())->toBeFalse();
});

it('saves a workspace as a template from its settings', function () {
    $review = statusOf($this->workspace, 'review');
    $review->update(['name' => 'Cek Kadiv', 'color' => 'violet']);
    Label::factory()->create(['workspace_id' => $this->workspace->id, 'name' => 'Gudang', 'color' => 'amber']);

    $this->actingAs($this->owner)
        ->post("/otomasi/template/workspace/dari/{$this->workspace->id}", ['name' => 'Tim operasional', 'description' => 'Kolom standar'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $template = WorkspaceTemplate::query()->sole();
    expect($template->type)->toBe(WorkspaceType::Team)
        ->and($template->source_workspace_id)->toBe($this->workspace->id)
        ->and(collect($template->statuses)->pluck('name')->all())->toBe(['Backlog', 'Todo', 'Sedang dikerjakan', 'Cek Kadiv', 'Selesai'])
        ->and(collect($template->statuses)->firstWhere('name', 'Cek Kadiv'))->toEqual(['name' => 'Cek Kadiv', 'category' => 'review', 'color' => 'violet'])
        ->and($template->labels)->toEqual([['name' => 'Gudang', 'color' => 'amber']]);

    $this->actingAs($this->member)
        ->post("/otomasi/template/workspace/dari/{$this->workspace->id}", ['name' => 'X'])
        ->assertForbidden();
});

it('deletes templates only for their managers', function () {
    $this->actingAs($this->member)->delete("/otomasi/template/tugas/{$this->template->id}")->assertForbidden();
    $this->actingAs($this->owner)->delete("/otomasi/template/tugas/{$this->template->id}")->assertRedirect();

    expect(TaskTemplate::query()->count())->toBe(0);
});
