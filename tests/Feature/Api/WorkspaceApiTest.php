<?php

use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — workspace picker for the mobile app (Tahap 1): everything the
| caller may see (Workspace::visibleTo, like the web directory), in the web
| groups Pribadi · Divisi & tim · Proyek yang diikuti · Lainnya. Someone
| else's personal workspace never appears.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->viewer = User::factory()->create(['email' => 'viewer@kantor.test']);
    $this->lead = User::factory()->create();

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->viewer);

    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS', 'name' => 'Tim Operasional']);
    addMember($this->team, $this->viewer);

    $this->project = Workspace::factory()->project()->ownedBy($this->lead)->create(['key' => 'PRJ', 'name' => 'Riset Pasar']);
    addMember($this->project, $this->viewer);

    // Visible to everyone in the company although the viewer is not a member.
    $this->internal = Workspace::factory()->team()->internal()->ownedBy($this->lead)->create(['key' => 'INT', 'name' => 'Papan Umum']);

    // Member too, but archived (the web directory shows it with a pill).
    $this->arsip = Workspace::factory()->team()->archived()->ownedBy($this->lead)->create(['key' => 'ARS', 'name' => 'Proyek Lama']);
    addMember($this->arsip, $this->viewer);

    // Other people's personal workspaces are invisible.
    $outsider = User::factory()->create(['email' => 'outsider@kantor.test']);
    $this->rahasia = app(EnsurePersonalWorkspace::class)->handle($outsider);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukWorkspace(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * Starts calling as a (different) token. Between requests of one test the
 * sanctum guard instance — and its cached user — survives, so switching
 * tokens must drop the cached guards first (see AuthApiTest).
 */
function sebagaiTokenWorkspace(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('the four web groups carry only the visible workspaces', function () {
    $token = masukWorkspace('viewer@kantor.test');

    $response = test()->withToken($token)->getJson('/api/v1/workspace');

    $response->assertOk()->assertJsonCount(4, 'groups');

    expect($response->json('groups'))->toBe([
        ['jenis' => 'pribadi', 'label' => 'Pribadi', 'items' => [
            ['id' => $this->personal->id, 'key' => $this->personal->key, 'name' => $this->personal->name, 'arsip' => false],
        ]],
        ['jenis' => 'divisi', 'label' => 'Divisi & tim', 'items' => [
            ['id' => $this->arsip->id, 'key' => 'ARS', 'name' => 'Proyek Lama', 'arsip' => true],
            ['id' => $this->team->id, 'key' => 'TMS', 'name' => 'Tim Operasional', 'arsip' => false],
        ]],
        ['jenis' => 'proyek', 'label' => 'Proyek yang diikuti', 'items' => [
            ['id' => $this->project->id, 'key' => 'PRJ', 'name' => 'Riset Pasar', 'arsip' => false],
        ]],
        ['jenis' => 'lainnya', 'label' => 'Lainnya (lihat saja)', 'items' => [
            ['id' => $this->internal->id, 'key' => 'INT', 'name' => 'Papan Umum', 'arsip' => false],
        ]],
    ]);
});

test('every workspace list stays scoped to its owner', function () {
    $tokenViewer = masukWorkspace('viewer@kantor.test');
    $tokenOutsider = masukWorkspace('outsider@kantor.test');

    $idsViewer = collect(test()->withToken($tokenViewer)->getJson('/api/v1/workspace')->json('groups'))
        ->flatMap(fn (array $group): array => array_column($group['items'], 'id'));

    expect($idsViewer)->toContain($this->personal->id, $this->team->id, $this->project->id, $this->internal->id, $this->arsip->id)
        ->not->toContain($this->rahasia->id);

    // The outsider only sees the shared workspaces, never the viewer's personal one.
    $idsOutsider = collect(sebagaiTokenWorkspace($tokenOutsider)->getJson('/api/v1/workspace')->json('groups'))
        ->flatMap(fn (array $group): array => array_column($group['items'], 'id'));

    expect($idsOutsider)->toContain($this->rahasia->id, $this->internal->id)
        ->not->toContain($this->personal->id, $this->team->id, $this->project->id, $this->arsip->id);
});

test('workspace endpoints reject requests without a token', function () {
    test()->getJson('/api/v1/workspace')->assertUnauthorized();
});
