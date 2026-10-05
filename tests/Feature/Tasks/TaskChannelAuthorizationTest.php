<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Real channel authorization over POST /broadcasting/auth with the Reverb
 * (Pusher protocol) broadcaster, as the browser does it.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Landing page']);

    // Switch to Reverb only for the auth requests (nothing is broadcast from here on).
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    Broadcast::forgetDrivers();
    require base_path('routes/channels.php');
});

function channelAuth(User $user, string $channel): TestResponse
{
    return test()->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => $channel,
        'socket_id' => '1234.5678',
    ]);
}

it('authorizes the private workspace channel for people who can see the workspace', function () {
    $channel = 'private-workspace.'.$this->workspace->id;

    channelAuth($this->member, $channel)->assertOk()->assertJsonStructure(['auth']);
    channelAuth(User::factory()->withRole(Role::Direksi)->create(), $channel)->assertOk();
    channelAuth(User::factory()->create(), $channel)->assertForbidden();
});

it('keeps personal workspace channels closed even to Super Admin', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();

    channelAuth($this->owner, 'private-workspace.'.$personal->id)->assertOk();
    channelAuth(User::factory()->withRole(Role::SuperAdmin)->create(), 'private-workspace.'.$personal->id)->assertForbidden();
});

it('authorizes the task presence channel with the viewer identity', function () {
    $response = channelAuth($this->member, 'presence-task.'.$this->task->id)->assertOk();
    $data = json_decode((string) $response->json('channel_data'), true);

    expect($data['user_id'])->toBe($this->member->id)
        ->and($data['user_info'])->toBe(['id' => $this->member->id, 'name' => $this->member->name, 'avatar' => null]);

    channelAuth(User::factory()->create(), 'presence-task.'.$this->task->id)->assertForbidden();
});

it('denies unknown tasks and workspaces', function () {
    expect(channelAuth($this->owner, 'presence-task.01k6x0000000000000000000zz')->status())->toBeIn([403, 404])
        ->and(channelAuth($this->owner, 'private-workspace.01k6x0000000000000000000zz')->status())->toBeIn([403, 404]);
});
