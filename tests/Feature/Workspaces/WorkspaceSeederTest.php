<?php

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkspaceSeeder;

it('seeds the mockup workspaces idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(WorkspaceSeeder::class);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $keys = Workspace::query()->whereIn('type', ['division', 'team', 'project'])->orderBy('key')->pluck('key')->all();

    expect($keys)->toBe(['DIR', 'GDG', 'KEU', 'OPS', 'PLQ', 'PMS', 'SDM'])
        ->and(Workspace::query()->where('type', 'personal')->count())->toBe(User::query()->count())
        ->and(Task::query()->count())->toBe(36);

    $plq = Workspace::query()->where('key', 'PLQ')->firstOrFail();
    $divisions = $plq->members()->pluck('division_id')->filter()->unique();

    expect($plq->name)->toBe('Proyek Peluncuran Q4')
        ->and($plq->memberships()->count())->toBe(9)
        ->and($divisions)->toHaveCount(3)
        ->and($plq->roleOf($kadiv))->toBe(WorkspaceRole::Owner)
        ->and(Task::query()->where('workspace_id', $plq->id)->where('number', 18)->value('title'))->toBe('Finalisasi anggaran peluncuran')
        ->and(Task::query()->where('workspace_id', $plq->id)->where('number', 21)->firstOrFail()->checklistItems()->count())->toBe(7)
        ->and(Task::query()->where('workspace_id', $plq->id)->where('status_category', TaskStatusCategory::Done->value)->whereNull('completed_at')->exists())->toBeFalse();

    $gudang = Workspace::query()->where('key', 'GDG')->firstOrFail();
    expect($gudang->team_id)->not->toBeNull()
        // Lead + 2 team members, plus the owner row (synced since review fix #5).
        ->and($gudang->memberships()->where('is_synced', true)->count())->toBe(4);

    // The demo Kepala Divisi sees Pribadi, Divisi Operasional, Tim Gudang and the project in the sidebar.
    $this->actingAs($kadiv)->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('workspaces', fn ($list) => collect($list)->pluck('name')->sort()->values()->all() === ['Divisi Operasional', 'Pribadi', 'Proyek Peluncuran Q4', 'Tim Gudang']));
});

it('renders every workspace screen on the full demo data (strict mode: no lazy loading)', function () {
    $this->seed(DatabaseSeeder::class);

    foreach (['kadiv@demo.test', 'anggota@demo.test', 'direksi@demo.test', 'admin@demo.test'] as $email) {
        $user = User::query()->where('email', $email)->firstOrFail();

        foreach (['/w/PLQ', '/w/PLQ?view=list', '/w/PLQ?view=calendar', '/w/PLQ/aktivitas', '/w/PLQ/pengaturan', '/w/OPS', '/tugas', '/tugas?tab=watching', '/tugas?tab=created', '/workspace', '/dashboard'] as $uri) {
            $this->actingAs($user)->get($uri)->assertOk();
        }

        $this->actingAs($user)->getJson('/tugas/opsi-form')->assertOk();
        $this->actingAs($user)->getJson('/cari/hasil?q=peluncuran')->assertOk();
    }
});
