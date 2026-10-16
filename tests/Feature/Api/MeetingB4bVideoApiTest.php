<?php

use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingSpeakingTime;
use App\Models\MeetingTranscript;
use App\Models\MeetingTranscriptConsent;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
| API v1 — Bagian 4 paket B4-B (video & notulen otomatis): token LiveKit
| (jendela gabung, dikeluarkan, 503 bila belum disiapkan), data ruang,
| moderasi penyelenggara (Room Service API dipalsukan Http::fake), angkat
| tangan, waktu bicara, kehadiran, notulen otomatis (sakelar, persetujuan,
| transkrip diaudit, masukkan/buang draf). LiveKit/worker tidak pernah
| dipanggil sungguhan.
*/

function b4bLiveKitSecret(): string
{
    return 'b4b-livekit-secret-at-least-32-characters';
}

function b4bConfigureVideo(): void
{
    config([
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => b4bLiveKitSecret(),
        'livekit.token_ttl' => 600,
        'notulen.transcriber.url' => 'http://worker.test:8090',
        'notulen.transcriber.secret' => 'b4b-notulen-secret-0123456789-abcdef',
        'notulen.transcriber.callback_secret' => 'b4b-notulen-callback-9876543210-fedcba',
        'notulen.llm.api_key' => '',
    ]);
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Bus::fake();
    config(['features.meetings' => true]);
    b4bConfigureVideo();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:50', 'Asia/Jakarta'));

    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->sari = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->rizky, $this->sari])
        ->create(['title' => 'Sinkron mingguan', 'minute_taker_id' => $this->sari->id, 'agenda' => ['Status', 'Rencana']]);
    $this->base = '/api/v1/rapat/'.$this->meeting->id;
});

describe('LiveKit token', function () {
    it('issues a token with role, rights and people inside the join window', function () {
        Sanctum::actingAs($this->rizky);

        $response = $this->postJson($this->base.'/video/token?tanggal=2026-10-05')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('url', 'wss://rapat.example.test')
            ->assertJsonPath('room', 'rk-'.$this->meeting->id.'-20261005')
            ->assertJsonPath('identity', $this->rizky->id)
            ->assertJsonPath('role', 'participant')
            ->assertJsonPath('can', ['moderate' => false, 'manage_guests' => false, 'manage_lobby' => true, 'call_participants' => false, 'edit_minutes' => false]);

        JWT::$timestamp = CarbonImmutable::now()->getTimestamp();
        $claims = JWT::decode($response->json('token'), new Key(b4bLiveKitSecret(), 'HS256'));
        JWT::$timestamp = null;

        expect($claims->sub)->toBe($this->rizky->id)
            ->and($claims->video->room)->toBe('rk-'.$this->meeting->id.'-20261005')
            ->and(collect($response->json('people'))->pluck('name')->all())->toContain('Dimas Pratama');

        Sanctum::actingAs($this->dimas);
        $this->postJson($this->base.'/video/token')->assertOk()
            ->assertJsonPath('role', 'organizer')
            ->assertJsonPath('can.moderate', true);
    });

    it('refuses outside the window, after removal and for non-invited people', function () {
        Sanctum::actingAs($this->rizky);

        $this->travelTo(CarbonImmutable::parse('2026-10-05 09:30', 'Asia/Jakarta'));
        $this->postJson($this->base.'/video/token')->assertForbidden()
            ->assertJsonPath('code', 'ruang_belum_dibuka')
            ->assertJsonPath('message', 'Ruang rapat dibuka pukul 09.45.');

        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:30', 'Asia/Jakarta'));
        $this->postJson($this->base.'/video/token')->assertForbidden()->assertJsonPath('code', 'ruang_ditutup');

        // The organizer may join any time.
        Sanctum::actingAs($this->dimas);
        $this->postJson($this->base.'/video/token')->assertOk();

        $this->travelTo(CarbonImmutable::parse('2026-10-05 10:05', 'Asia/Jakarta'));
        MeetingVideoRemoval::query()->create(['meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'user_id' => $this->rizky->id, 'removed_by' => $this->dimas->id]);
        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/video/token')->assertForbidden()
            ->assertJsonPath('code', 'dikeluarkan')
            ->assertJsonPath('message', 'Penyelenggara mengeluarkan Anda dari rapat ini.');

        Sanctum::actingAs($this->outsider);
        $this->postJson($this->base.'/video/token')->assertNotFound();

        // Not a video meeting → 404 like the web.
        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:00')->withParticipants([$this->rizky])->create();
        Sanctum::actingAs($this->rizky);
        $this->postJson('/api/v1/rapat/'.$meet->id.'/video/token')->assertNotFound();
    });

    it('answers 503 video_belum_siap without LiveKit', function () {
        config(['livekit.url' => null]);
        Sanctum::actingAs($this->rizky);

        $this->postJson($this->base.'/video/token')
            ->assertStatus(503)
            ->assertJsonPath('code', 'video_belum_siap');
    });

    it('serves the room data like the web pre-join page', function () {
        Sanctum::actingAs($this->sari);

        $this->getJson($this->base.'/video/ruang')
            ->assertOk()
            ->assertJsonPath('room.meeting.title', 'Sinkron mingguan')
            ->assertJsonPath('room.can.call_participants', true)
            ->assertJsonPath('room.can.choose_notes_source', true)
            ->assertJsonPath('room.channel', 'meeting.'.$this->meeting->id);
    });
});

describe('moderation and room actions', function () {
    it('mutes, removes and readmits through the Room Service API (organizer only)', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);

        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/video/keluarkan', ['user_id' => $this->sari->id])->assertForbidden();

        Sanctum::actingAs($this->dimas);
        $this->postJson($this->base.'/video/bisukan', ['user_id' => $this->rizky->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.track_sid.0', 'Mikrofon peserta tidak ditemukan.');
        $this->postJson($this->base.'/video/bisukan', ['user_id' => $this->rizky->id, 'track_sid' => 'TR_abc123'])
            ->assertOk()->assertJsonPath('ok', true);
        $this->postJson($this->base.'/video/keluarkan', ['user_id' => $this->rizky->id])->assertOk();
        $this->postJson($this->base.'/video/keluarkan', ['user_id' => $this->dimas->id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Pakai tombol di bilah kontrol untuk diri Anda sendiri.');

        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/MutePublishedTrack')
            && $request['track_sid'] === 'TR_abc123');
        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/RemoveParticipant')
            && $request['identity'] === $this->rizky->id);
        expect(MeetingVideoRemoval::query()->where('user_id', $this->rizky->id)->exists())->toBeTrue();

        $this->postJson($this->base.'/video/izinkan-masuk', ['user_id' => $this->rizky->id])
            ->assertOk()->assertJsonPath('readmitted', true);
        expect(MeetingVideoRemoval::query()->exists())->toBeFalse();
    });

    it('reports a LiveKit failure as 502', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response(['code' => 'unavailable'], 503)]);
        Sanctum::actingAs($this->dimas);

        $this->postJson($this->base.'/video/keluarkan', ['user_id' => $this->rizky->id])
            ->assertStatus(502)
            ->assertJsonPath('code', 'server_rapat_gagal');
    });

    it('raises a hand server-side and records speaking time and attendance', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);
        Sanctum::actingAs($this->rizky);

        $hand = $this->postJson($this->base.'/video/tangan', ['raised' => true])->assertOk();
        expect($hand->json('hand'))->toBe((string) CarbonImmutable::now()->getTimestampMs());
        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/UpdateParticipant')
            && $request['attributes'] === ['hand' => $hand->json('hand')]);

        $this->getJson($this->base.'/video/waktu-bicara')->assertOk()->assertJsonPath('mine_ms', 0)->assertJsonPath('interval_seconds', 15);
        $this->postJson($this->base.'/video/waktu-bicara', ['ms' => 30_000])->assertOk()->assertJsonPath('accepted_ms', 30_000);
        expect(MeetingSpeakingTime::query()->where('user_id', $this->rizky->id)->value('ms_spoken'))->toBe(30_000);

        MeetingAttendance::query()->create([
            'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'user_id' => $this->rizky->id,
            'room' => 'rk-'.$this->meeting->id.'-20261005', 'participant_sid' => 'PA_1', 'joined_at' => now(),
        ]);
        $this->getJson($this->base.'/video/kehadiran')
            ->assertOk()
            ->assertJsonPath('in_room', 1)
            ->assertJsonPath('late_grace_minutes', VideoAttendance::LATE_GRACE_MINUTES);
    });

    it('lets the minute taker call a missing participant once per minute', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 10:05', 'Asia/Jakarta'));
        Sanctum::actingAs($this->sari);

        $this->postJson($this->base.'/video/panggil/'.$this->rizky->id)->assertOk()->assertJsonPath('called.user_id', $this->rizky->id);
        $this->postJson($this->base.'/video/panggil/'.$this->rizky->id)->assertStatus(429)->assertJsonStructure(['message', 'retry_after']);

        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/video/panggil/'.$this->sari->id)->assertForbidden();
    });

    it('chooses the notes source once (minute taker)', function () {
        Sanctum::actingAs($this->sari);

        $this->postJson($this->base.'/sumber-notulen', ['source' => 'template'])
            ->assertOk()
            ->assertJsonPath('applied', true)
            ->assertJsonPath('notulen.source', 'template');
        $this->postJson($this->base.'/sumber-notulen', ['source' => 'blank'])
            ->assertOk()
            ->assertJsonPath('applied', false)
            ->assertJsonPath('notulen.source', 'template');

        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/sumber-notulen', ['source' => 'blank'])->assertForbidden();
    });
});

describe('notulen otomatis', function () {
    it('toggles auto minutes (organizer, video only) and records consent', function () {
        Sanctum::actingAs($this->rizky);
        $this->patchJson($this->base.'/notulen-otomatis', ['enabled' => true])
            ->assertForbidden()
            ->assertJsonPath('message', 'Hanya penyelenggara yang dapat mengatur notulen otomatis.');

        Sanctum::actingAs($this->dimas);
        $this->patchJson($this->base.'/notulen-otomatis', ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('notulen.auto_minutes', true)
            ->assertJsonPath('notulen.can_configure', true);
        expect($this->meeting->refresh()->auto_minutes)->toBeTrue()
            ->and(AuditLog::query()->where('action', 'meeting.auto_minutes_changed')->count())->toBe(1);

        Sanctum::actingAs($this->rizky);
        $this->getJson($this->base.'/notulen-otomatis')->assertOk()
            ->assertJsonPath('notulen.notice_points.0', 'Audio dihapus segera setelah transkripsi.');
        $this->putJson($this->base.'/transkrip/persetujuan', ['opted_out' => true])->assertOk()->assertJsonPath('opted_out', true);
        expect(MeetingTranscriptConsent::query()->where('user_id', $this->rizky->id)->value('opted_out'))->toBeTrue();
    });

    it('shows the transcript to participants (audited) and lets the minute taker insert or discard the draft', function () {
        $this->meeting->forceFill(['auto_minutes' => true])->save();
        $this->travelTo(CarbonImmutable::parse('2026-10-05 11:30', 'Asia/Jakarta'));
        MeetingTranscript::factory()->ready([
            [$this->rizky->id, 'Rizky Aditya', 10, 'Pengiriman terlambat.'],
        ], [
            'ringkasan' => 'Ringkasan rapat.',
            'agenda' => [['judul' => 'Status', 'poin' => [['teks' => 'Pengiriman terlambat.', 'sumber' => []]]]],
            'keputusan' => [['teks' => 'Kampanye mulai 20 Oktober.', 'agenda' => null, 'sumber' => []]],
            'tindak_lanjut' => [['id' => 'tl-1', 'judul' => 'Hubungi vendor', 'agenda' => null, 'penanggung_jawab' => null, 'penanggung_jawab_teks' => null, 'tenggat' => null, 'sumber' => [], 'action_item_id' => null, 'task' => null]],
            'perlu_dicek' => [],
        ])->create(['meeting_id' => $this->meeting->id]);

        Sanctum::actingAs($this->rizky);
        $this->getJson($this->base.'/transkrip?tanggal=2026-10-05')
            ->assertOk()
            ->assertJsonPath('transkrip.segments.0.text', 'Pengiriman terlambat.')
            ->assertJsonPath('notulen.draft.ringkasan', 'Ringkasan rapat.')
            ->assertJsonPath('notulen.can_manage', false);
        $this->getJson($this->base.'/transkrip?tanggal=2026-10-05')->assertOk();
        expect(AuditLog::query()->where('action', 'meeting.transcript_viewed')->count())->toBe(1);

        $this->postJson($this->base.'/transkrip/masukkan')->assertForbidden();

        Sanctum::actingAs($this->sari);
        $this->postJson($this->base.'/transkrip/masukkan')
            ->assertOk()
            ->assertJsonPath('message', 'Draf dimasukkan ke notulen.')
            ->assertJsonCount(1, 'action_item_ids');
        expect(MeetingTranscript::query()->sole()->draft_status)->toBe(DraftStatus::Inserted);

        $this->postJson($this->base.'/transkrip/masukkan')->assertStatus(409);
        $this->postJson($this->base.'/transkrip/buang')->assertStatus(409);

        Sanctum::actingAs($this->outsider);
        $this->getJson($this->base.'/transkrip')->assertNotFound();
    });

    it('discards a ready draft and answers 409 without a transcript', function () {
        Sanctum::actingAs($this->sari);
        $this->postJson($this->base.'/transkrip/buang')->assertStatus(409)->assertJsonPath('message', 'Belum ada transkrip untuk rapat ini.');
        $this->getJson($this->base.'/transkrip')->assertOk()->assertJsonPath('transkrip', null)->assertJsonPath('notulen.transcript', null);

        MeetingTranscript::factory()->ready([[$this->rizky->id, 'Rizky Aditya', 10, 'Halo.']], [
            'ringkasan' => 'R.', 'agenda' => [], 'keputusan' => [], 'tindak_lanjut' => [], 'perlu_dicek' => [],
        ])->create(['meeting_id' => $this->meeting->id]);

        $this->postJson($this->base.'/transkrip/buang')->assertOk()->assertJsonPath('notulen.draft.status', 'discarded');
    });
});
