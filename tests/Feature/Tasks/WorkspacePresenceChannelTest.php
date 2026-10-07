<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Board presence per card: `presence-workspace.{id}` over the real
 * POST /broadcasting/auth (Reverb / Pusher protocol), as the browser does it.
 * Same rule as the private board channel (WorkspacePolicy::view) plus the
 * `read_only` flag clients use to ignore typing hints.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);

    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    Broadcast::forgetDrivers();
    require base_path('routes/channels.php');
});

function presenceAuth(User $user, Workspace $workspace): TestResponse
{
    return test()->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-workspace.'.$workspace->id,
        'socket_id' => '1234.5678',
    ]);
}

/**
 * @return array<string, mixed>|null user_info of an allowed request, null when denied (403/404)
 */
function presenceInfo(User $user, Workspace $workspace): ?array
{
    $response = presenceAuth($user, $workspace);

    if (in_array($response->status(), [403, 404], true)) {
        return null;
    }

    $response->assertOk()->assertJsonStructure(['auth', 'channel_data']);
    $data = json_decode((string) $response->json('channel_data'), true);
    expect($data['user_id'])->toBe($user->id);

    return $data['user_info'];
}

/*
 * Matrix: actor → expected (null = denied, otherwise read_only).
 * Private shared workspace (project PLQ).
 */
dataset('shared workspace actors', [
    'owner' => [fn () => test()->owner, false],
    'admin' => [fn () => memberWithRole(test()->workspace, WorkspaceRole::Admin), false],
    'member' => [fn () => memberWithRole(test()->workspace, WorkspaceRole::Member), false],
    'viewer (may comment)' => [fn () => memberWithRole(test()->workspace, WorkspaceRole::Viewer), false],
    'Direksi member' => [fn () => memberWithRole(test()->workspace, WorkspaceRole::Member, Role::Direksi), false],
    'Direksi non-member (view_all, read-only)' => [fn () => User::factory()->withRole(Role::Direksi)->create(), true],
    'HR non-member (view_all, read-only)' => [fn () => User::factory()->withRole(Role::Hr)->create(), true],
    'Super Admin non-member (read-only)' => [fn () => User::factory()->withRole(Role::SuperAdmin)->create(), true],
    'employee outside the workspace' => [fn () => User::factory()->withRole(Role::Anggota)->create(), null],
    'Kepala Divisi without members here' => [fn () => User::factory()->withRole(Role::KepalaDivisi)->create(), null],
    'Direksi of another company' => [fn () => User::factory()->withRole(Role::Direksi)->create(['company_id' => Company::factory()->create()->id]), null],
]);

it('authorizes the workspace presence channel by workspace visibility', function (Closure $actor, ?bool $readOnly) {
    $user = $actor();
    $info = presenceInfo($user, $this->workspace);

    if ($readOnly === null) {
        expect($info)->toBeNull();

        return;
    }

    expect($info)->toBe([
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => null,
        'read_only' => $readOnly,
    ]);
})->with('shared workspace actors');

it('keeps the private board channel working with the same rule', function () {
    $channel = 'private-workspace.'.$this->workspace->id;

    $this->actingAs(memberWithRole($this->workspace, WorkspaceRole::Viewer))
        ->postJson('/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1234.5678'])
        ->assertOk()
        ->assertJsonStructure(['auth'])
        ->assertJsonMissingPath('channel_data');

    $this->actingAs(User::factory()->withRole(Role::Hr)->create())
        ->postJson('/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1234.5678'])
        ->assertOk();

    expect($this->actingAs(User::factory()->create())
        ->postJson('/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1234.5678'])
        ->status())->toBeIn([403, 404]);
});

it('opens a personal workspace only to its owner', function () {
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->owner->id)->firstOrFail();

    expect(presenceInfo($this->owner, $personal))->toMatchArray(['id' => $this->owner->id, 'read_only' => false])
        ->and(presenceInfo(User::factory()->withRole(Role::SuperAdmin)->create(), $personal))->toBeNull()
        ->and(presenceInfo(User::factory()->withRole(Role::Direksi)->create(), $personal))->toBeNull()
        ->and(presenceInfo(User::factory()->withRole(Role::Hr)->create(), $personal))->toBeNull()
        ->and(presenceInfo(memberWithRole($this->workspace, WorkspaceRole::Admin), $personal))->toBeNull();
});

it('lets every employee into an internal workspace', function () {
    $internal = Workspace::factory()->internal()->create();
    $employee = User::factory()->withRole(Role::Anggota)->create();

    expect(presenceInfo($employee, $internal))->toMatchArray(['id' => $employee->id, 'read_only' => false])
        ->and(presenceInfo(User::factory()->withRole(Role::Hr)->create(), $internal))->toMatchArray(['read_only' => true]);
});

it('marks everyone read-only in an archived workspace', function () {
    $archived = Workspace::factory()->ownedBy($this->owner)->archived()->create();
    $member = addMember($archived, User::factory()->create(), WorkspaceRole::Member);

    expect(presenceInfo($this->owner, $archived))->toMatchArray(['read_only' => true])
        ->and(presenceInfo($member, $archived))->toMatchArray(['read_only' => true])
        ->and(presenceInfo(User::factory()->create(), $archived))->toBeNull();
});

it('drops a removed member', function () {
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);
    expect(presenceInfo($member, $this->workspace))->not->toBeNull();

    $this->workspace->members()->detach($member->id);

    expect(presenceInfo($member->fresh(), $this->workspace))->toBeNull();
});

it('denies an unknown workspace', function () {
    expect($this->actingAs($this->owner)->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-workspace.01k6x0000000000000000000zz',
        'socket_id' => '1234.5678',
    ])->status())->toBeIn([403, 404]);
});

it('requires a signed-in user', function () {
    expect($this->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-workspace.'.$this->workspace->id,
        'socket_id' => '1234.5678',
    ])->status())->toBeIn([401, 403]);
});
