<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('finds Drive documents only in workspaces the viewer may see', function () {
    $owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $visible = Workspace::factory()->ownedBy($owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $hidden = Workspace::factory()->ownedBy($owner)->create(['key' => 'RHS']);
    $member = memberWithRole($visible, WorkspaceRole::Viewer);

    DriveFile::factory()->create(['workspace_id' => $visible->id, 'name' => 'Brief landing page']);
    DriveFile::factory()->pdf()->create(['workspace_id' => $visible->id, 'name' => 'Landing wireframe.pdf']);
    DriveFile::factory()->create(['workspace_id' => $hidden->id, 'name' => 'Landing rahasia']);
    DriveFile::factory()->create(['workspace_id' => $visible->id, 'name' => 'Landing folder', 'kind' => 'folder', 'mime_type' => 'application/vnd.google-apps.folder']);

    $response = $this->actingAs($member)->getJson('/cari/hasil?q=landing&group=documents')->assertOk();
    $group = collect($response->json('groups'))->firstWhere('key', 'documents');

    expect($group['label'])->toBe('Dokumen')
        ->and(array_column($group['items'], 'title'))->toBe(['Brief landing page', 'Landing wireframe.pdf'])
        ->and($group['items'][0])->toMatchArray(['code' => 'PLQ', 'icon' => 'file-text', 'external' => true, 'subtitle' => 'Google Docs · Proyek Peluncuran Q4']);
});
