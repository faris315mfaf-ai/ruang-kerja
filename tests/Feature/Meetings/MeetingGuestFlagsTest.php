<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * Server-side rights flags of the external-guest UI (docs/sesi/rapat-tamu-eksternal.md):
 * `can.manage_guests` / `can.manage_lobby` on the web detail, the room pages and
 * API v1, `guest_id` / `guest_name` on guest rows only for who manages guests,
 * and `guest_names` of the edit form.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'guest-livekit-secret-at-least-32-characters',
        'livekit.token_ttl' => 600,
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:50', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->taker = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->rizky, $this->taker])
        ->create(['title' => 'Sinkron mitra', 'leadership' => true, 'minute_taker_id' => $this->taker->id]);
    $this->base = '/rapat/'.$this->meeting->id;

    $this->actingAs($this->dimas)->postJson($this->base.'/tamu', ['email' => 'budi@mitra.test', 'name' => 'Budi Mitra'])->assertSuccessful();
    $this->actingAs($this->dimas)->postJson($this->base.'/tamu', ['email' => 'tanpa@nama.test'])->assertSuccessful();
    $this->guest = MeetingParticipant::query()->where('email', 'budi@mitra.test')->sole();
});

/** @return array<string, array{0: string, 1: bool, 2: bool}> actor → manage_guests, manage_lobby */
dataset('guestFlagActors', [
    'penyelenggara' => ['dimas', true, true],
    'notulis' => ['taker', false, true],
    'peserta internal' => ['rizky', false, true],
    'pengamat rapat pimpinan' => ['direksi', false, false],
    'non-peserta' => ['outsider', false, false],
]);

it('sends the guest flags to the web detail only as true for who may', function (string $actor, bool $guests, bool $lobby) {
    $user = $this->{$actor};
    $request = $this->actingAs($user)->get($this->base);

    if ($actor === 'outsider') {
        $request->assertNotFound();

        return;
    }

    $request->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('detail.can.manage_guests', $guests)
        ->where('detail.can.manage_lobby', $lobby)
        // keys that already existed stay.
        ->has('detail.can.update')->has('detail.can.respond')->has('detail.can.write_minutes'));
})->with('guestFlagActors');

it('shows guest_id and guest_name on web guest rows only to the organizer', function () {
    $this->actingAs($this->dimas)->get($this->base)->assertInertia(function (Assert $page) {
        $rows = collect($page->toArray()['props']['detail']['meeting']['participants']);
        $named = $rows->firstWhere('email', 'budi@mitra.test');
        $unnamed = $rows->firstWhere('email', 'tanpa@nama.test');

        expect($named['guest_id'])->toBe($this->guest->id)
            ->and($named['guest_name'])->toBe('Budi Mitra')
            ->and($unnamed['guest_name'])->toBeNull()
            // employees never get the keys
            ->and($rows->firstWhere('user_id', $this->rizky->id))->not->toHaveKeys(['guest_id', 'guest_name']);
        $page->etc();
    });

    foreach (['rizky', 'taker', 'direksi'] as $actor) {
        $this->actingAs($this->{$actor})->get($this->base)->assertInertia(function (Assert $page) {
            $rows = collect($page->toArray()['props']['detail']['meeting']['participants']);
            foreach ($rows as $row) {
                expect($row)->not->toHaveKeys(['guest_id', 'guest_name']);
            }
            $page->etc();
        });
    }
});

it('does not let the guest list keys or flags leak for other platforms', function () {
    $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 11:00')->withParticipants([$this->rizky])->create(['platform' => 'meet', 'join_url' => 'https://meet.google.com/abc-defg-hij']);

    $this->actingAs($this->dimas)->get('/rapat/'.$meet->id)->assertInertia(fn (Assert $page) => $page
        ->where('detail.can.manage_guests', false)
        ->where('detail.can.manage_lobby', false));
});

it('sends the flags to the pre-join and room pages', function (string $actor, bool $guests, bool $lobby) {
    if ($actor === 'direksi' || $actor === 'outsider') {
        $this->actingAs($this->{$actor})->get($this->base.'/gabung')->assertStatus($actor === 'outsider' ? 404 : 403);

        return;
    }

    foreach (['/gabung', '/ruang'] as $page) {
        $this->actingAs($this->{$actor})->get($this->base.$page)->assertOk()->assertInertia(fn (Assert $inertia) => $inertia
            ->where('room.can.manage_guests', $guests)
            ->where('room.can.manage_lobby', $lobby)
            ->has('room.can.moderate'));
    }
})->with('guestFlagActors');

it('sends the flags in API v1 detail, room data and token', function (string $actor, bool $guests, bool $lobby) {
    Sanctum::actingAs($this->{$actor});
    $api = '/api/v1/rapat/'.$this->meeting->id;

    $detail = $this->getJson($api);

    if ($actor === 'outsider') {
        $detail->assertNotFound();

        return;
    }

    $detail->assertOk()
        ->assertJsonPath('can.manage_guests', $guests)
        ->assertJsonPath('can.manage_lobby', $lobby)
        ->assertJsonPath('can.edit', $actor === 'dimas')
        ->assertJsonPath('video.is_organizer', $actor === 'dimas');

    if ($actor === 'direksi') {
        $this->getJson($api.'/video/ruang')->assertForbidden();

        return;
    }

    $this->getJson($api.'/video/ruang')->assertOk()
        ->assertJsonPath('room.can.manage_guests', $guests)
        ->assertJsonPath('room.can.manage_lobby', $lobby);

    $this->postJson($api.'/video/token')->assertOk()
        ->assertJsonPath('can.manage_guests', $guests)
        ->assertJsonPath('can.manage_lobby', $lobby)
        ->assertJsonPath('can.moderate', $actor === 'dimas');
})->with('guestFlagActors');

it('gives guest_id and guest_name in API v1 detail only to the organizer', function () {
    $api = '/api/v1/rapat/'.$this->meeting->id;

    Sanctum::actingAs($this->dimas);
    $rows = collect($this->getJson($api)->assertOk()->json('meeting.participants'));
    $named = $rows->firstWhere('email', 'budi@mitra.test');

    expect($named['guest_id'])->toBe($this->guest->id)
        ->and($named['guest_name'])->toBe('Budi Mitra')
        ->and($rows->firstWhere('email', 'tanpa@nama.test')['guest_name'])->toBeNull()
        ->and($rows->firstWhere('user_id', $this->rizky->id))->not->toHaveKeys(['guest_id', 'guest_name']);

    foreach (['rizky', 'taker', 'direksi'] as $actor) {
        Sanctum::actingAs($this->{$actor});
        $json = $this->getJson($api)->assertOk();
        foreach ($json->json('meeting.participants') as $row) {
            expect($row)->not->toHaveKeys(['guest_id', 'guest_name']);
        }
        // no link, nonce or hash ever
        expect($json->getContent())->not->toContain('link_url')->not->toContain('link_nonce')->not->toContain('link_token_hash');
    }
});

it('returns the guest names of the edit form on web and API v1', function () {
    $this->actingAs($this->dimas)->get($this->base.'/ubah')->assertInertia(fn (Assert $page) => $page
        ->where('form.meeting.guest_names', ['budi@mitra.test' => 'Budi Mitra']));

    Sanctum::actingAs($this->dimas);
    $this->getJson('/api/v1/rapat/formulir?rapat='.$this->meeting->id)->assertOk()
        ->assertJsonPath('meeting.guest_emails', ['budi@mitra.test', 'tanpa@nama.test'])
        ->assertJsonPath('meeting.guest_names', ['budi@mitra.test' => 'Budi Mitra']);

    // a meeting without named guests answers an empty object, not a list
    $plain = Meeting::factory()->by($this->dimas)->at('2026-10-06 11:00')->withParticipants([$this->rizky])->create();
    $body = $this->getJson('/api/v1/rapat/formulir?rapat='.$plain->id)->assertOk()->getContent();
    expect($body)->toContain('"guest_names":{}');
});
