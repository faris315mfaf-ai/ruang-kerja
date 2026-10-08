<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Inertia;

/*
 * Audit R-14: Permissions-Policy applies per document, and an Inertia
 * navigation keeps the previous (restricted) document alive. EnsureFullPageLoad
 * therefore answers Inertia visits of the video pages with 409 +
 * X-Inertia-Location (the client follows it as window.location) and lets
 * partial reloads of the page itself through. Other pages keep normal Inertia
 * behavior.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true, 'livekit.url' => null]);
    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->meeting = Meeting::factory()->by($this->organizer)->video()->create();
    $this->base = "/rapat/{$this->meeting->id}";
});

it('renders the video pages as a normal document for a plain GET', function (string $path) {
    $this->actingAs($this->organizer)
        ->get("{$this->base}/{$path}")
        ->assertOk()
        ->assertHeaderMissing('X-Inertia-Location');
})->with(['pre-join' => ['gabung'], 'room' => ['ruang']]);

it('answers an Inertia visit with a full page load redirect', function (string $path) {
    $this->actingAs($this->organizer)
        ->get("{$this->base}/{$path}", ['X-Inertia' => 'true'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location', url("{$this->base}/{$path}"));
})->with(['pre-join' => ['gabung'], 'room' => ['ruang']]);

it('keeps partial reloads of the room page working', function () {
    // A first visit primes Inertia's asset version, like the browser boot does.
    $this->actingAs($this->organizer)->get("{$this->base}/ruang")->assertOk();

    $response = $this->actingAs($this->organizer)
        ->get("{$this->base}/ruang", [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => Inertia::getVersion(),
            'X-Inertia-Partial-Component' => 'meetings/room',
            'X-Inertia-Partial-Data' => 'room',
        ])
        ->assertOk()
        ->assertHeaderMissing('X-Inertia-Location');

    // Served by Inertia as a partial reload of the room page itself.
    expect($response->json('component'))->toBe('meetings/room')
        ->and($response->json('props'))->toHaveKey('room');
});

it('leaves Inertia visits outside the video routes untouched', function (string $uri) {
    $this->actingAs($this->organizer)->get($uri)->assertOk();

    $this->actingAs($this->organizer)
        ->get($uri, ['X-Inertia' => 'true', 'X-Inertia-Version' => Inertia::getVersion()])
        ->assertOk()
        ->assertHeaderMissing('X-Inertia-Location');
})->with(['/rapat', '/dashboard']);
