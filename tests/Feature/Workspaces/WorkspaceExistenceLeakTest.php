<?php

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Review finding 10: someone who may not see a private workspace gets 404
 * everywhere — no redirect for an old key, no validation errors first.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->workspace = Workspace::factory()->create(['key' => 'RHS', 'previous_keys' => ['LAMA']]);
    $this->task = Task::factory()->create(['workspace_id' => $this->workspace->id]);
    $this->outsider = User::factory()->create(['company_id' => $this->workspace->company_id]);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
});

it('does not redirect an old or lower-case key for someone who may not see the workspace', function () {
    $this->actingAs($this->outsider)->get('/w/LAMA')->assertNotFound();
    $this->actingAs($this->outsider)->get('/w/rhs/aktivitas')->assertNotFound();

    // Members still get the canonical redirect.
    $this->actingAs($this->viewer)->get('/w/LAMA')->assertStatus(301)->assertRedirect('/w/RHS');
});

it('answers 404 before validating workspace forms for non-viewers', function () {
    $json = fn (User $user) => $this->actingAs($user)->withHeader('Accept', 'application/json');

    $json($this->outsider)->patch('/w/RHS', ['name' => ''])->assertNotFound();
    $json($this->outsider)->post('/w/RHS/label', ['name' => ''])->assertNotFound();
    $json($this->outsider)->post('/w/RHS/status', ['name' => ''])->assertNotFound();
    $json($this->outsider)->post('/w/RHS/anggota', ['user_id' => 'x'])->assertNotFound();
    $json($this->outsider)->post('/w/RHS/tugas', ['title' => ''])->assertNotFound();

    // A viewer sees the workspace: validation runs, then the controller says 403.
    $json($this->viewer)->patch('/w/RHS', ['name' => ''])->assertUnprocessable();
    $json($this->viewer)->patch('/w/RHS', ['name' => 'Baru'])->assertForbidden();
});

it('answers 404 before validating task forms for non-viewers', function () {
    $json = fn (User $user) => $this->actingAs($user)->withHeader('Accept', 'application/json');

    $json($this->outsider)->patch("/tugas/{$this->task->id}", ['title' => ''])->assertNotFound();
    $json($this->outsider)->patch("/tugas/{$this->task->id}/move", ['status_id' => 'x'])->assertNotFound();

    $json($this->viewer)->patch("/tugas/{$this->task->id}", ['title' => ''])->assertUnprocessable();
});
