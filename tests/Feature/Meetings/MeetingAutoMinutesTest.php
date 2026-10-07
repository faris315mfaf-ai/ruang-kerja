<?php

use App\Domain\Meetings\Services\NotulenBridge;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * "Notulen otomatis" in the schedule form (meetings.auto_minutes, video only,
 * docs/fitur/notulen-otomatis-kontrak.md §6) and the `notulen` prop
 * (NotulenSummary) of the detail, pre-join and room pages.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'test-secret-that-is-at-least-32-characters',
        'notulen.transcriber.url' => 'http://worker.test:8090',
        'notulen.transcriber.secret' => str_repeat('a', 40),
        'notulen.transcriber.callback_secret' => str_repeat('b', 40),
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
});

it('schedules a video meeting with automatic minutes and offers the toggle in the form', function () {
    $this->actingAs($this->dimas)->get('/rapat/baru')
        ->assertInertia(fn (Assert $page) => $page->where('form.auto_minutes_enabled', true));

    $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
        'platform' => 'video', 'join_url' => null, 'participant_ids' => [$this->rizky->id], 'auto_minutes' => true,
    ]))->assertRedirect();

    $meeting = Meeting::query()->where('title', 'Review vendor logistik')->sole();
    expect($meeting->auto_minutes)->toBeTrue();

    $this->actingAs($this->dimas)->get("/rapat/{$meeting->id}/ubah")
        ->assertInertia(fn (Assert $page) => $page->where('form.meeting.auto_minutes', true));
    $this->actingAs($this->dimas)->get("/rapat/{$meeting->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('detail.meeting.auto_minutes', true)
            ->where('notulen.available', true)
            ->where('notulen.auto_minutes', true));
});

it('refuses automatic minutes for other platforms and without a transcription server', function () {
    $this->actingAs($this->dimas)->post('/rapat', meetingPayload(['participant_ids' => [$this->rizky->id], 'auto_minutes' => true]))
        ->assertSessionHasErrors(['auto_minutes' => 'Notulen otomatis hanya untuk rapat Video RuangKerja.']);

    config(['notulen.transcriber.url' => '']);
    $this->actingAs($this->dimas)->get('/rapat/baru')
        ->assertInertia(fn (Assert $page) => $page->where('form.auto_minutes_enabled', false));
    $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
        'platform' => 'video', 'join_url' => null, 'participant_ids' => [$this->rizky->id], 'auto_minutes' => true,
    ]))->assertSessionHasErrors(['auto_minutes' => 'Notulen otomatis belum disiapkan admin di server ini.']);

    expect(Meeting::query()->where('title', 'Review vendor logistik')->exists())->toBeFalse();
});

it('keeps, changes (audited) and clears the setting on update', function () {
    $meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-06 13:30')->withParticipants([$this->rizky])
        ->create(['title' => 'Review vendor logistik', 'auto_minutes' => true]);
    $payload = meetingPayload(['platform' => 'video', 'join_url' => null, 'participant_ids' => [$this->rizky->id]]);

    // Missing from the request: kept (also while the server is not configured).
    config(['notulen.transcriber.url' => '']);
    $this->actingAs($this->dimas)->patch("/rapat/{$meeting->id}", $payload)->assertRedirect();
    expect($meeting->fresh()->auto_minutes)->toBeTrue();
    $this->actingAs($this->dimas)->patch("/rapat/{$meeting->id}", [...$payload, 'auto_minutes' => true])->assertRedirect();

    $this->actingAs($this->dimas)->patch("/rapat/{$meeting->id}", [...$payload, 'auto_minutes' => false])->assertRedirect();
    expect($meeting->fresh()->auto_minutes)->toBeFalse()
        ->and(AuditLog::query()->where('action', 'meeting.auto_minutes_changed')->sole()->new_values)->toBe(['auto_minutes' => false]);

    // Moving the meeting off the video platform always clears it.
    $meeting->forceFill(['auto_minutes' => true])->save();
    $this->actingAs($this->dimas)->patch("/rapat/{$meeting->id}", meetingPayload(['participant_ids' => [$this->rizky->id]]))->assertRedirect();
    expect($meeting->fresh()->auto_minutes)->toBeFalse();
});

it('gives the real NotulenSummary to the detail, pre-join and room pages, null for other platforms', function () {
    $video = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 08:30')->withParticipants([$this->rizky])->create(['auto_minutes' => true]);
    $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 13:00')->withParticipants([$this->rizky])->create();

    foreach (['gabung' => 'meetings/join', 'ruang' => 'meetings/room'] as $path => $component) {
        $this->actingAs($this->rizky)->get("/rapat/{$video->id}/{$path}")
            ->assertInertia(fn (Assert $page) => $page
                ->component($component)
                ->where('notulen.available', true)
                ->where('notulen.auto_minutes', true)
                ->where('notulen.consent.can_change', true)
                ->where('notulen.links.status', "/rapat/{$video->id}/notulen-otomatis/status?tanggal=2026-10-05")
                ->where('notulen.transcript', null)
                ->has('notulen.notice')
                ->where('room.features.auto_minutes', true));
    }

    $this->actingAs($this->rizky)->get("/rapat/{$meet->id}")
        ->assertInertia(fn (Assert $page) => $page->where('notulen', null));
    expect(app(NotulenBridge::class)->summary(occurrenceOf($meet), $this->rizky))->toBeNull();

    // The 30 s video poll does not compute it.
    $this->actingAs($this->rizky)->get("/rapat/{$video->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->has('notulen.links')
            ->reloadOnly('video', fn (Assert $reload) => $reload->missing('notulen')->missing('detail')));
});
