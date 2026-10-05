<?php

use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Each upload session reserves server disk space until it finishes: starts are
 * throttled and each user has a cap on open sessions and pending bytes.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('local');
    $this->drive = FakeDriveClient::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $root = $this->drive->seedFolder('Proyek [PLQ]');
    $this->workspace->forceFill(['drive_folder_id' => $root->id])->saveQuietly();
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
});

function startUpload(User $user, int $size = 1024)
{
    return test()->actingAs($user)->postJson('/w/PLQ/file/unggah', ['name' => 'a.bin', 'size' => $size]);
}

it('caps the number of unfinished upload sessions per user', function () {
    config(['google.upload.max_open_sessions' => 2]);

    $first = startUpload($this->member)->assertCreated()->json('id');
    startUpload($this->member)->assertCreated();
    startUpload($this->member)
        ->assertStatus(429)
        ->assertJsonPath('code', 'drive_upload_quota');

    // Other people are not affected; cancelling frees a slot.
    startUpload($this->owner)->assertCreated();
    $this->actingAs($this->member)->deleteJson("/unggah/{$first}")->assertOk();
    startUpload($this->member)->assertCreated();
});

it('caps the bytes a user may have pending on the server', function () {
    config(['google.upload.max_pending_bytes' => 50 * 1024 * 1024]);

    startUpload($this->member, 30 * 1024 * 1024)->assertCreated();
    startUpload($this->member, 30 * 1024 * 1024)->assertStatus(429);
    startUpload($this->member, 20 * 1024 * 1024)->assertCreated();
});

it('throttles starting upload sessions', function () {
    config(['google.upload.starts_per_minute' => 3, 'google.upload.max_open_sessions' => 100]);

    foreach (range(1, 3) as $i) {
        startUpload($this->member, 10)->assertCreated();
    }

    startUpload($this->member, 10)->assertTooManyRequests();
});
