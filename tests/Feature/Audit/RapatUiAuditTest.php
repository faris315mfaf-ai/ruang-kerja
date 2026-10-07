<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

/*
 * Audit rapat 2026-10, fase 2 bagian 3 (docs/security/AUDIT-RAPAT-2026-10.md
 * §9, branch claude/rapat-ui): the room clears its "typing in …" presence
 * with rk_minutes_at = "" (contract), which the server must accept (B-04).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'test-secret-that-is-at-least-32-characters',
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:05', 'Asia/Jakarta'));
    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->nadia = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->organizer)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->nadia])->create();
});

it('accepts rk_minutes_at = "" and removes the attribute in LiveKit (U-01)', function () {
    Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);

    $this->actingAs($this->nadia)
        ->postJson("/rapat/{$this->meeting->id}/video/atribut", ['attributes' => ['rk_minutes_at' => 'section-2']])
        ->assertOk()->assertJsonPath('attributes.rk_minutes_at', 'section-2');
    $this->actingAs($this->nadia)
        ->postJson("/rapat/{$this->meeting->id}/video/atribut", ['attributes' => ['rk_minutes_at' => '']])
        ->assertOk()->assertJsonPath('attributes.rk_minutes_at', '');

    Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/UpdateParticipant')
        && $request['identity'] === $this->nadia->id
        && $request['attributes'] === ['rk_minutes_at' => '']);
});
