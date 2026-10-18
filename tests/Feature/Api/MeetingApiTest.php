<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — rapat & kalender untuk ponsel: agenda tiga rentang (MeetingFeed
| web tanpa N+1), detail kemunculan + RSVP diri sendiri (UpdateRsvp web),
| notulen baca-saja (MeetingPresenter web; yang tak terlihat → 404 seperti
| web — isi tidak bocor), kalender gabungan (CalendarFeed web). Di balik
| flag features.meetings seperti web; ruang video v1 dibuka lewat browser
| (join_href web, tanpa token LiveKit di API).
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', str_repeat('ab', 32));
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true]);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta')); // Senin

    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->fitri = User::factory()->withRole(Role::Anggota)->create(['name' => 'Fitri Anggraini']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create(['name' => 'Orang Luar']);

    $this->workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS', 'name' => 'Divisi Operasional']);
    addMember($this->workspace, $this->rizky);
    addMember($this->workspace, $this->fitri); // anggota workspace, BUKAN peserta rapat

    // Stand-up seri Sen/Rab/Jum pekan lalu–Jumat ini + rapat tunggal hari ini.
    $this->standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri, '2026-10-09')
        ->withParticipants([$this->rizky])->create(['title' => 'Stand-up']);
    $this->koordinasi = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:30')
        ->withParticipants([$this->rizky])->create([
            'title' => 'Koordinasi peluncuran',
            'workspace_id' => $this->workspace->id,
            'minute_taker_id' => $this->dimas->id,
        ]);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukRapat(string $email): string
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
 * Calls as a (different) token: drop the cached guards first (see
 * AuthApiTest::sebagaiToken).
 */
function sebagaiTokenRapat(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('the agenda covers the three ranges with the web occurrence expansion', function () {
    // Luar horizon minggu ini, di dalam "akan-datang" (30 hari).
    Meeting::factory()->by($this->dimas)->at('2026-10-26 09:00')->withParticipants([$this->rizky])->create(['title' => 'Retro bulanan']);
    $token = masukRapat($this->rizky->email);

    // Default & minggu-ini: Sen–Min pekan ini — 3 kemunculan stand-up + koordinasi.
    $minggu = $this->withToken($token)->getJson('/api/v1/rapat');
    $hari = $this->withToken($token)->getJson('/api/v1/rapat?rentang=hari-ini');
    $nanti = $this->withToken($token)->getJson('/api/v1/rapat?rentang=akan-datang');

    $minggu->assertOk()->assertJsonPath('rentang', 'minggu-ini')->assertJsonCount(4, 'items');
    $hari->assertOk()->assertJsonCount(2, 'items'); // stand-up Senin + koordinasi
    $nanti->assertOk()->assertJsonCount(5, 'items'); // + retro 26 Okt

    $items = collect($nanti->json('items'));

    expect($items->pluck('title')->all())->toBe(['Stand-up', 'Koordinasi peluncuran', 'Stand-up', 'Stand-up', 'Retro bulanan'])
        ->and($nanti->json('from'))->toBe('2026-10-05')
        ->and($nanti->json('hari_ini'))->toBe('2026-10-05')
        ->and($nanti->json('server_time'))->toBeString();

    $standupHariIni = collect($hari->json('items'))->firstWhere('title', 'Stand-up');

    expect($standupHariIni)->not->toBeNull()
        ->and($standupHariIni['occurrence_date'])->toBe('2026-10-05')
        ->and($standupHariIni['key'])->toBe($this->standup->id.':2026-10-05')
        ->and($standupHariIni['starts_at'])->toBe('2026-10-05T02:00:00Z') // 09.00 WIB
        ->and($standupHariIni['ends_at'])->toBe('2026-10-05T02:30:00Z')
        ->and($standupHariIni['terjadi_hari_ini'])->toBeTrue()
        ->and($standupHariIni['platform_label'])->toBe('Google Meet')
        ->and($standupHariIni['organizer'])->toBe(['id' => $this->dimas->id, 'name' => 'Dimas Pratama'])
        ->and($standupHariIni['peserta_count'])->toBe(2) // penyelenggara + rizky
        ->and($standupHariIni['rsvp_saya'])->toBe('pending')
        ->and($standupHariIni['dapat_diedit'])->toBeFalse()
        ->and($standupHariIni['minutes_status'])->toBe('none')
        ->and($standupHariIni['canceled'])->toBeFalse();

    // Rapat yang tidak melibatkan pemilik tidak pernah muncul di rentang mana pun.
    $luar = masukRapat($this->outsider->email);

    foreach (['', '?rentang=hari-ini', '?rentang=akan-datang'] as $rentang) {
        sebagaiTokenRapat($luar)->getJson('/api/v1/rapat'.$rentang)->assertOk()->assertJsonCount(0, 'items');
    }
});

test('the detail shows one occurrence with participants, rights and a minutes teaser', function () {
    $token = masukRapat($this->rizky->email);

    $response = $this->withToken($token)->getJson('/api/v1/rapat/'.$this->koordinasi->id.'?tanggal=2026-10-05');

    $response->assertOk()->assertJsonPath('meeting.occurrence_date', '2026-10-05');

    $meeting = $response->json('meeting');

    expect($meeting['title'])->toBe('Koordinasi peluncuran')
        ->and($meeting['workspace'])->toBe(['id' => $this->workspace->id, 'key' => 'OPS', 'name' => 'Divisi Operasional'])
        ->and($meeting['peserta_count'])->toBe(2)
        ->and($meeting['notulen'])->toBe(['status' => 'none', 'ada_isi' => false])
        ->and($meeting['join_url'])->toBeString();

    // Penyelenggara selalu pertama; peserta membawa nama + RSVP.
    expect($meeting['participants'])->toHaveCount(2)
        ->and($meeting['participants'][0])->toBe(['user_id' => $this->dimas->id, 'email' => null, 'nama' => 'Dimas Pratama', 'rsvp' => 'yes', 'optional' => false])
        ->and($meeting['participants'][1]['nama'])->toBe('Rizky Aditya')
        ->and($meeting['participants'][1]['rsvp'])->toBe('pending')
        ->and($meeting['rsvp_saya'])->toBe('pending');

    expect($response->json('can'))->toBe(['rsvp' => true, 'edit' => false, 'join_video' => false, 'manage_guests' => false, 'manage_lobby' => false])
        ->and($response->json('video'))->toBeNull(); // platform meet, bukan video

    // Penyelenggara boleh menyunting; ?tanggal memilih kemunculan seri lain.
    $dimas = masukRapat($this->dimas->email);

    sebagaiTokenRapat($dimas)->getJson('/api/v1/rapat/'.$this->koordinasi->id)
        ->assertOk()
        ->assertJsonPath('meeting.dapat_diedit', true)
        ->assertJsonPath('can.edit', true);

    sebagaiTokenRapat($dimas)->getJson('/api/v1/rapat/'.$this->standup->id.'?tanggal=2026-10-07')
        ->assertOk()
        ->assertJsonPath('meeting.occurrence_date', '2026-10-07')
        ->assertJsonPath('meeting.terjadi_hari_ini', false);

    // Rapat tak terlihat: peserta luar, anggota workspace biasa, ULID asing → 404.
    $fitri = masukRapat($this->fitri->email);
    $luar = masukRapat($this->outsider->email);

    sebagaiTokenRapat($fitri)->getJson('/api/v1/rapat/'.$this->koordinasi->id)->assertNotFound();
    sebagaiTokenRapat($luar)->getJson('/api/v1/rapat/'.$this->koordinasi->id)->assertNotFound();
    $this->withToken($token)->getJson('/api/v1/rapat/01AAAAAAAAAAAAAAAAAAAAAAAA')->assertNotFound();
});

test('a video meeting carries the web join link and the join verdict', function () {
    // 08.10 WIB: di dalam jendela buka (dibuka 15 menit sebelum mulai).
    $rapat = Meeting::factory()->by($this->dimas)->at('2026-10-05 08:10', 30)->video()
        ->withParticipants([$this->rizky])->create(['title' => 'Demo ke klien']);
    $token = masukRapat($this->rizky->email);

    $response = $this->withToken($token)->getJson('/api/v1/rapat/'.$rapat->id);

    $response->assertOk();

    $video = $response->json('video');

    expect($video['join_href'])->toBe('/rapat/'.$rapat->id.'/gabung')
        ->and($video['opens_at'])->toBe('2026-10-05T00:55:00Z') // 07.55 WIB
        ->and($video['closes_at'])->toBe('2026-10-05T03:40:00Z') // 10.40 WIB
        ->and($video['configured'])->toBeBool();

    expect($response->json('can.join_video'))->toBeTrue()
        ->and($video['can_join'])->toBeTrue()
        ->and($video['denied_reason'])->toBeNull();

    // Sebelum jendela buka: ditolak dengan pesan jam buka, aplikasi menampilkan alasannya.
    $pagi = Meeting::factory()->by($this->dimas)->at('2026-10-05 15:00', 30)->video()
        ->withParticipants([$this->rizky])->create(['title' => 'Sinkronisasi sore']);

    $this->withToken($token)->getJson('/api/v1/rapat/'.$pagi->id)
        ->assertOk()
        ->assertJsonPath('can.join_video', false)
        ->assertJsonPath('video.can_join', false)
        ->assertJsonPath('video.denied_reason', 'Ruang rapat dibuka pukul 14.45.');
});

test('rsvp answers the own invitation like the web action', function () {
    $token = masukRapat($this->rizky->email);

    $this->withToken($token)->postJson('/api/v1/rapat/'.$this->koordinasi->id.'/kehadiran', ['rsvp' => 'maybe'])
        ->assertOk()
        ->assertJson(['rsvp' => 'maybe']);

    $peserta = MeetingParticipant::query()->where('meeting_id', $this->koordinasi->id)->where('user_id', $this->rizky->id)->first();

    expect($peserta->rsvp)->toBe(Rsvp::Maybe)
        ->and($peserta->responded_at)->not->toBeNull();

    // Sama seperti web: RSVP tidak mengirim notifikasi apa pun — tidak ada
    // notifikasi yang "hilang" karena lewat API.
    Notification::assertNothingSent();

    // 'pending' bukan jawaban; nilai tak dikenal ditolak 422 berbahasa Indonesia.
    $this->withToken($token)->postJson('/api/v1/rapat/'.$this->koordinasi->id.'/kehadiran', ['rsvp' => 'pending'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.rsvp.0', 'Jawaban kehadiran tidak dikenal.');

    // Rapat tak terlihat → 404; yang melihat tapi tidak diundang → 403 pesan web.
    $luar = masukRapat($this->outsider->email);

    sebagaiTokenRapat($luar)->postJson('/api/v1/rapat/'.$this->koordinasi->id.'/kehadiran', ['rsvp' => 'yes'])->assertNotFound();

    $direksi = User::factory()->withRole(Role::Direksi)->create();
    $pimpinan = Meeting::factory()->by($this->dimas)->at('2026-10-05 15:00')->leadership()->create(['title' => 'Rapat direksi']);
    $tokenDireksi = masukRapat($direksi->email);

    sebagaiTokenRapat($tokenDireksi)->getJson('/api/v1/rapat/'.$pimpinan->id)->assertOk(); // boleh melihat
    sebagaiTokenRapat($tokenDireksi)->postJson('/api/v1/rapat/'.$pimpinan->id.'/kehadiran', ['rsvp' => 'yes'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak diundang ke rapat ini.');
});

test('participants read the full minutes while workspace members and outsiders get 404', function () {
    app(SaveMinutes::class)->handle(occurrenceOf($this->koordinasi), $this->dimas, [
        'attendance' => [['user_id' => $this->rizky->id, 'present' => true]],
        'sections' => [['title' => 'Pembukaan', 'body' => 'Rilis mundur ke 20 Okt.']],
        'decisions' => ['Rilis 20 Okt'],
    ]);
    app(AddActionItem::class)->handle(occurrenceOf($this->koordinasi), $this->dimas, [
        'text' => 'Rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07',
    ]);

    $token = masukRapat($this->rizky->email);

    $response = $this->withToken($token)->getJson('/api/v1/rapat/'.$this->koordinasi->id.'/notulen');

    $response->assertOk();

    $notulen = $response->json('notulen');

    expect($notulen['id'])->not->toBeNull()
        ->and($notulen['status'])->toBe('draft')
        ->and($notulen['sections'])->toBe([['title' => 'Pembukaan', 'body' => 'Rilis mundur ke 20 Okt.']])
        ->and($notulen['decisions'])->toBe(['Rilis 20 Okt'])
        ->and($notulen['attendance'][0]['user_id'])->toBe($this->rizky->id)
        ->and($notulen['action_items'][0]['text'])->toBe('Rekap stok')
        ->and($notulen['action_items'][0]['done'])->toBeFalse()
        ->and($response->json('meeting.notulen'))->toBe(['status' => 'draft', 'ada_isi' => true])
        ->and(collect($response->json('people'))->pluck('name'))->toContain('Dimas Pratama', 'Rizky Aditya');

    // ?tanggal memilih kemunculan lain dari seri; tanpa notulen → draf kosong (id null).
    $this->withToken($token)->getJson('/api/v1/rapat/'.$this->standup->id.'/notulen?tanggal=2026-10-07')
        ->assertOk()
        ->assertJsonPath('notulen.id', null)
        ->assertJsonPath('notulen.status', 'draft')
        ->assertJsonPath('notulen.sections.0.title', 'Pembukaan'); // bagian dari agenda rapat

    // Isi tidak bocor: anggota workspace yang tidak diundang & orang luar → 404.
    $fitri = masukRapat($this->fitri->email);
    $luar = masukRapat($this->outsider->email);

    sebagaiTokenRapat($fitri)->getJson('/api/v1/rapat/'.$this->koordinasi->id.'/notulen')->assertNotFound();
    sebagaiTokenRapat($luar)->getJson('/api/v1/rapat/'.$this->koordinasi->id.'/notulen')->assertNotFound();
});

test('the calendar merges meetings, task deadlines, approved leave and holidays', function () {
    $task = Task::factory()->create(['workspace_id' => $this->workspace->id, 'due_date' => '2026-10-07', 'title' => 'Rekap stok']);
    $task->assignees()->attach($this->rizky->id, ['assigned_at' => now()]);
    $cuti = LeaveType::factory()->create(['name' => 'Cuti tahunan']);
    EmployeeRequest::factory()->status(RequestStatus::Approved)->create([
        'user_id' => $this->rizky->id,
        'leave_type_id' => $cuti->id,
        'start_at' => CarbonImmutable::parse('2026-10-08 00:00', 'Asia/Jakarta')->utc(),
        'end_at' => CarbonImmutable::parse('2026-10-09 23:59', 'Asia/Jakarta')->utc(),
        'days' => 2,
    ]);
    Holiday::query()->create(['company_id' => $this->rizky->company_id, 'date' => '2026-10-23', 'name' => 'HUT perusahaan', 'type' => 'company']);

    $token = masukRapat($this->rizky->email);

    $response = $this->withToken($token)->getJson('/api/v1/kalender?bulan=2026-10');

    $response->assertOk()
        ->assertJsonPath('year', 2026)
        ->assertJsonPath('month', 10)
        ->assertJsonPath('from', '2026-09-28')
        ->assertJsonPath('to', '2026-11-01');

    $entries = collect($response->json('entries'));

    expect($entries->pluck('layer')->unique()->sort()->values()->all())->toBe(['holidays', 'leave', 'meetings', 'tasks']);

    $tenggat = $entries->firstWhere('layer', 'tasks');

    expect($tenggat['date'])->toBe('2026-10-07')
        ->and($tenggat['title'])->toBe('OPS-1 · Rekap stok')
        ->and($tenggat['meta'])->toBe('Tenggat');

    $istirahat = $entries->firstWhere('layer', 'leave');

    expect($istirahat['title'])->toBe('Rizky · Cuti tahunan')
        ->and($istirahat['date'])->toBe('2026-10-08')
        ->and($istirahat['end_date'])->toBe('2026-10-09');

    $libur = $entries->firstWhere('layer', 'holidays');

    expect($libur['date'])->toBe('2026-10-23')->and($libur['title'])->toBe('HUT perusahaan');

    $rapat = $entries->filter(fn (array $entry): bool => $entry['layer'] === 'meetings');

    expect($rapat->count())->toBe(7) // 6 kemunculan stand-up (28 Sep–9 Okt) + koordinasi
        ->and($rapat->firstWhere('title', 'Koordinasi peluncuran')['starts_at'])->toBe('2026-10-05T03:30:00Z'); // 10.30 WIB
});

test('the meetings flag off answers 404 like the web', function () {
    config(['features.meetings' => false]);
    $token = masukRapat($this->rizky->email);

    $this->withToken($token)->getJson('/api/v1/rapat')->assertNotFound();
    $this->withToken($token)->getJson('/api/v1/rapat/'.$this->koordinasi->id)->assertNotFound();
    $this->withToken($token)->postJson('/api/v1/rapat/'.$this->koordinasi->id.'/kehadiran', ['rsvp' => 'yes'])->assertNotFound();
    $this->withToken($token)->getJson('/api/v1/rapat/'.$this->koordinasi->id.'/notulen')->assertNotFound();
    $this->withToken($token)->getJson('/api/v1/kalender')->assertNotFound();
});

test('meeting endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/rapat')->assertUnauthorized();
    $this->getJson('/api/v1/rapat/'.$this->koordinasi->id)->assertUnauthorized();
    $this->postJson('/api/v1/rapat/'.$this->koordinasi->id.'/kehadiran', ['rsvp' => 'yes'])->assertUnauthorized();
    $this->getJson('/api/v1/rapat/'.$this->koordinasi->id.'/notulen')->assertUnauthorized();
    $this->getJson('/api/v1/kalender')->assertUnauthorized();
});

test('an impossible ?tanggal falls back like a missing date instead of failing', function (string $tanggal) {
    $token = masukRapat($this->rizky->email);

    $this->withToken($token)->getJson('/api/v1/rapat/'.$this->standup->id.'?tanggal='.$tanggal)->assertOk();
    $this->withToken($token)->getJson('/api/v1/rapat/'.$this->standup->id.'/notulen?tanggal='.$tanggal)->assertOk();
})->with([
    'bulan & hari di luar rentang' => '2026-99-99',
    'tanggal yang tidak ada' => '2026-02-30',
]);
