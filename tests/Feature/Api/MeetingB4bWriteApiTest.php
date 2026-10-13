<?php

use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Notifications\ActionItemDueNotification;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Meetings\Notifications\MinutesFinalizedNotification;
use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingMinuteVersion;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — Bagian 4 paket B4-B (tulis): jadwalkan/ubah/batalkan rapat
| (SaveMeetingRequest + ScheduleMeeting/UpdateMeeting/CancelMeeting web),
| formulir + pemilih peserta + bentrok, notulen tulis/final/buka + riwayat
| versi + penanda menyunting, tindak lanjut (tambah/ubah/centang/hapus,
| jadikan tugas idempoten, ingatkan sekali sehari) dan jadwal manajemen.
| Semua di balik features.meetings; rapat tak terlihat → 404.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true]);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta')); // Senin

    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->sari = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Wulandari']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create(['name' => 'Orang Luar']);
    $this->hendra = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Direktur']);

    $this->workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS', 'name' => 'Divisi Operasional']);
    addMember($this->workspace, $this->rizky);
    addMember($this->workspace, $this->sari);

    $this->meeting = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:00')
        ->withParticipants([$this->rizky, $this->sari])
        ->create([
            'title' => 'Koordinasi peluncuran',
            'minute_taker_id' => $this->sari->id,
            'agenda' => ['Status pengiriman', 'Materi promosi'],
        ]);
    $this->base = '/api/v1/rapat/'.$this->meeting->id;
});

function b4bPayload(array $overrides = []): array
{
    return meetingPayload([
        'participant_ids' => [test()->rizky->id, test()->sari->id],
        ...$overrides,
    ]);
}

describe('schedule, edit and cancel', function () {
    it('schedules a meeting like the web form and answers the detail', function () {
        Sanctum::actingAs($this->dimas);

        $response = $this->postJson('/api/v1/rapat', b4bPayload(['minute_taker_id' => $this->sari->id, 'workspace_id' => $this->workspace->id]))
            ->assertCreated()
            ->assertJsonPath('message', 'Undangan rapat terkirim ke 2 peserta.')
            ->assertJsonPath('invited', 2)
            ->assertJsonPath('meeting.title', 'Review vendor logistik')
            ->assertJsonPath('can.edit', true)
            ->assertJsonPath('auto_minutes_notice', null);

        $meeting = Meeting::query()->findOrFail($response->json('meeting.id'));

        expect($meeting->organizer_id)->toBe($this->dimas->id)
            ->and($meeting->minute_taker_id)->toBe($this->sari->id)
            ->and($meeting->starts_at->toIso8601ZuluString())->toBe('2026-10-06T06:30:00Z');

        Notification::assertSentTo($this->rizky, MeetingInvitedNotification::class);
    });

    it('returns the web validation messages in Indonesian', function () {
        Sanctum::actingAs($this->dimas);

        $this->postJson('/api/v1/rapat', b4bPayload(['participant_ids' => [], 'agenda' => [''], 'platform' => 'zoom', 'join_url' => null]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.participant_ids.0', 'Undang minimal satu peserta selain Anda.')
            ->assertJsonPath('errors.agenda.0', 'Tambahkan minimal satu butir agenda.')
            ->assertJsonPath('errors.join_url.0', 'Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.');

        // Video RuangKerja needs LiveKit.
        config(['livekit.url' => null]);
        $this->postJson('/api/v1/rapat', b4bPayload(['platform' => 'video', 'join_url' => null]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.platform.0', 'Video RuangKerja belum disiapkan di server ini. Pilih Google Meet atau Zoom.');
    });

    it('edits the whole series as the organizer only', function () {
        $series = Meeting::factory()->by($this->dimas)->at('2026-10-05 09:00', 30)->recurring(Recurrence::MonWedFri, '2026-10-30')
            ->withParticipants([$this->rizky])->create(['title' => 'Stand-up', 'agenda' => ['Update']]);

        Sanctum::actingAs($this->rizky);
        $this->patchJson('/api/v1/rapat/'.$series->id, b4bPayload(['date' => '2026-10-05', 'start' => '09:30', 'duration' => 30, 'recurrence' => 'mon_wed_fri', 'recurrence_until' => '2026-10-30']))
            ->assertForbidden()
            ->assertJsonPath('message', 'Hanya penyelenggara yang dapat mengubah rapat ini.');

        Sanctum::actingAs($this->dimas);
        $this->patchJson('/api/v1/rapat/'.$series->id, b4bPayload(['title' => 'Stand-up pagi', 'date' => '2026-10-05', 'start' => '09:30', 'duration' => 30, 'recurrence' => 'mon_wed_fri', 'recurrence_until' => '2026-10-30']))
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan rapat disimpan.')
            ->assertJsonPath('meeting.title', 'Stand-up pagi');

        expect($series->refresh()->starts_at->toIso8601ZuluString())->toBe('2026-10-05T02:30:00Z')
            ->and($series->recurrence)->toBe(Recurrence::MonWedFri);

        Sanctum::actingAs($this->outsider);
        $this->patchJson('/api/v1/rapat/'.$series->id, b4bPayload())->assertNotFound();
    });

    it('cancels the meeting (POST /batal and DELETE)', function () {
        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/batal')->assertForbidden();

        Sanctum::actingAs($this->dimas);
        $this->postJson($this->base.'/batal')
            ->assertOk()
            ->assertJsonPath('message', 'Rapat dibatalkan. Peserta sudah diberi tahu.')
            ->assertJsonPath('meeting.canceled', true);

        expect($this->meeting->refresh()->isCanceled())->toBeTrue();

        // A canceled meeting cannot be changed or canceled again.
        $this->deleteJson($this->base)->assertForbidden()->assertJsonPath('message', 'Rapat ini sudah dibatalkan.');
    });

    it('serves the form, the people picker and the conflict check', function () {
        Sanctum::actingAs($this->rizky);

        $this->getJson('/api/v1/rapat/formulir')
            ->assertOk()
            ->assertJsonPath('can_lead', false)
            ->assertJsonPath('durations', [15, 30, 45, 60, 90, 120, 180, 240])
            ->assertJsonPath('meeting', null)
            ->assertJsonCount(5, 'people');

        // Editing someone else's meeting: 403; invisible: 404.
        $this->getJson('/api/v1/rapat/formulir?rapat='.$this->meeting->id)->assertForbidden();
        Sanctum::actingAs($this->outsider);
        $this->getJson('/api/v1/rapat/formulir?rapat='.$this->meeting->id)->assertNotFound();

        Sanctum::actingAs($this->dimas);
        $this->getJson('/api/v1/rapat/formulir?rapat='.$this->meeting->id)
            ->assertOk()
            ->assertJsonPath('meeting.title', 'Koordinasi peluncuran')
            ->assertJsonPath('meeting.start', '10:00')
            ->assertJsonPath('meeting.minute_taker_id', $this->sari->id);

        $this->getJson('/api/v1/rapat/peserta?q=wulan')
            ->assertOk()
            ->assertJsonCount(1, 'people')
            ->assertJsonPath('people.0.id', $this->sari->id);

        $this->getJson('/api/v1/rapat/bentrok?'.http_build_query(['peserta' => [$this->rizky->id], 'tanggal' => '2026-10-05', 'mulai' => '10:30', 'durasi' => 60]))
            ->assertOk()
            ->assertJsonPath('conflicts.0.user_id', $this->rizky->id)
            ->assertJsonPath('conflicts.0.title', 'Koordinasi peluncuran');
    });
});

describe('minutes', function () {
    it('saves, versions, finalizes with a problem list and reopens', function () {
        Sanctum::actingAs($this->rizky);
        $this->putJson($this->base.'/notulen', ['attendance' => [], 'sections' => [], 'decisions' => []])
            ->assertForbidden()
            ->assertJsonPath('message', 'Hanya notulis atau penyelenggara yang dapat menulis notulen.');

        Sanctum::actingAs($this->sari);
        $this->putJson($this->base.'/notulen', [
            'attendance' => [['user_id' => $this->rizky->id, 'present' => false, 'reason' => 'Sakit']],
            'sections' => [['title' => 'Status pengiriman', 'body' => 'Terlambat tiga hari.'], ['title' => 'Materi promosi', 'body' => '']],
            'decisions' => ['Kampanye mulai 20 Oktober'],
        ])->assertOk()
            ->assertJsonPath('notulen.status', 'draft')
            ->assertJsonPath('notulen.sections.0.body', 'Terlambat tiga hari.')
            ->assertJsonPath('notulen.decisions.0', 'Kampanye mulai 20 Oktober');

        // A follow-up without owner/due date + nobody present → 422 with every problem.
        $this->postJson($this->base.'/tindak-lanjut', ['text' => 'Hubungi vendor'])->assertCreated();
        $this->postJson($this->base.'/notulen/final')
            ->assertUnprocessable()
            ->assertJsonPath('errors.minutes', [
                'Tandai minimal satu peserta yang hadir.',
                'Tindak lanjut 1 belum punya penanggung jawab.',
                'Tindak lanjut 1 belum punya tenggat.',
            ]);

        $item = MeetingActionItem::query()->sole();
        $this->patchJson($this->base.'/tindak-lanjut/'.$item->id, ['assignee_id' => $this->rizky->id, 'due_date' => '2026-10-09'])->assertOk();
        $this->putJson($this->base.'/notulen', ['attendance' => [['user_id' => $this->rizky->id, 'present' => true]], 'attendance_only' => true])
            ->assertOk()
            ->assertJsonPath('notulen.sections.0.body', 'Terlambat tiga hari.');

        $this->postJson($this->base.'/notulen/final')
            ->assertOk()
            ->assertJsonPath('notulen.status', 'final')
            ->assertJsonPath('message', 'Notulen final dan dibagikan ke peserta.');
        Notification::assertSentTo($this->rizky, MinutesFinalizedNotification::class);

        // Final minutes: no more edits; only the organizer reopens.
        $this->putJson($this->base.'/notulen', ['attendance' => [], 'sections' => [], 'decisions' => []])
            ->assertForbidden()
            ->assertJsonPath('message', 'Notulen sudah final. Buka kembali draf untuk mengubahnya.');
        $this->postJson($this->base.'/notulen/buka')->assertForbidden();

        Sanctum::actingAs($this->dimas);
        $this->postJson($this->base.'/notulen/buka')->assertOk()->assertJsonPath('notulen.status', 'draft');
        expect(MeetingMinutes::query()->sole()->status)->toBe(MinutesStatus::Draft);

        // Versions: readable by participants, newest first, with content.
        Sanctum::actingAs($this->rizky);
        $versions = $this->getJson($this->base.'/notulen/versi')->assertOk();
        $count = MeetingMinuteVersion::query()->count();

        expect($count)->toBeGreaterThanOrEqual(2)
            ->and($versions->json('versions'))->toHaveCount($count)
            ->and($versions->json('versions.0.number'))->toBe($count)
            ->and($versions->json('versions.0.created_by.name'))->toBeString();

        $this->getJson($this->base.'/notulen/versi/'.$versions->json('versions.0.id'))
            ->assertOk()
            ->assertJsonPath('version.sections.0.title', 'Status pengiriman')
            ->assertJsonPath('version.decisions.0', 'Kampanye mulai 20 Oktober');

        $this->getJson($this->base.'/notulen/versi/'.strtolower((string) Str::ulid()))->assertNotFound();

        Sanctum::actingAs($this->outsider);
        $this->getJson($this->base.'/notulen/versi')->assertNotFound();
    });

    it('reports the editing heartbeat', function () {
        Sanctum::actingAs($this->sari);

        $this->postJson($this->base.'/notulen/menyunting', ['active' => true])
            ->assertOk()
            ->assertJsonPath('editing.user_id', $this->sari->id);
    });
});

describe('follow-ups', function () {
    beforeEach(function () {
        Sanctum::actingAs($this->sari);
        $this->postJson($this->base.'/tindak-lanjut', ['text' => 'Hubungi vendor', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-09'])->assertCreated();
        $this->postJson($this->base.'/tindak-lanjut', ['text' => 'Siapkan anggaran', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-12'])->assertCreated();
        [$this->first, $this->second] = MeetingActionItem::query()->orderBy('position')->get()->all();
    });

    it('lists, ticks (assignee) and removes follow-ups', function () {
        Sanctum::actingAs($this->rizky);
        $this->getJson($this->base.'/tindak-lanjut')
            ->assertOk()
            ->assertJsonCount(2, 'items')
            ->assertJsonPath('can.edit', false)
            ->assertJsonPath('can.manage', false);

        $this->patchJson($this->base.'/tindak-lanjut/'.$this->first->id, ['done' => true])->assertOk()->assertJsonPath('item.done', true);
        $this->patchJson($this->base.'/tindak-lanjut/'.$this->first->id, ['text' => 'Ubah'])->assertForbidden();
        $this->deleteJson($this->base.'/tindak-lanjut/'.$this->first->id)->assertForbidden();

        // A follow-up of another meeting is 404 here.
        $other = Meeting::factory()->by($this->dimas)->at('2026-10-06 10:00')->withParticipants([$this->rizky])->create();
        $this->patchJson('/api/v1/rapat/'.$other->id.'/tindak-lanjut/'.$this->first->id, ['done' => true])->assertNotFound();

        Sanctum::actingAs($this->sari);
        $this->deleteJson($this->base.'/tindak-lanjut/'.$this->second->id)->assertOk()->assertJsonPath('deleted', true);
        expect(MeetingActionItem::query()->count())->toBe(1);
    });

    it('turns one follow-up into a task, idempotently', function () {
        $this->meeting->forceFill(['workspace_id' => $this->workspace->id])->save();

        $this->postJson($this->base.'/tindak-lanjut/'.$this->first->id.'/jadikan-tugas')
            ->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('item.task_key', 'OPS-1');
        $this->postJson($this->base.'/tindak-lanjut/'.$this->first->id.'/jadikan-tugas')
            ->assertOk()
            ->assertJsonPath('created', 0)
            ->assertJsonPath('item.task_key', 'OPS-1');

        expect(Task::query()->count())->toBe(1);

        $this->postJson($this->base.'/tindak-lanjut/jadikan-semua', ['item_ids' => [$this->first->id, $this->second->id]])
            ->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('notulen.action_items.1.task_key', 'OPS-2');

        Sanctum::actingAs($this->rizky);
        $this->postJson($this->base.'/tindak-lanjut/'.$this->first->id.'/jadikan-tugas')->assertForbidden();
    });

    it('asks for a workspace when the meeting has none', function () {
        $this->postJson($this->base.'/tindak-lanjut/'.$this->first->id.'/jadikan-tugas')
            ->assertUnprocessable()
            ->assertJsonPath('errors.workspace_id.0', 'Pilih workspace untuk tugas tindak lanjut.');

        $this->postJson($this->base.'/tindak-lanjut/'.$this->first->id.'/jadikan-tugas', ['workspace_id' => $this->workspace->id])
            ->assertOk()
            ->assertJsonPath('created', 1);
    });

    it('reminds the owners at most once per day', function () {
        $this->postJson($this->base.'/tindak-lanjut/ingatkan')
            ->assertOk()
            ->assertJsonPath('reminded', [$this->rizky->id])
            ->assertJsonPath('message', 'Pengingat terkirim ke 1 penanggung jawab.');
        $this->postJson($this->base.'/tindak-lanjut/ingatkan')
            ->assertOk()
            ->assertJsonPath('reminded', [])
            ->assertJsonPath('message', 'Tidak ada penanggung jawab yang perlu diingatkan hari ini.');

        Notification::assertSentToTimes($this->rizky, ActionItemDueNotification::class, 2); // one per follow-up
    });
});

describe('management schedule and feature flag', function () {
    it('lists leadership meetings for Direksi only', function () {
        Meeting::factory()->by($this->dimas)->leadership()->at('2026-10-06 14:00')->withParticipants([$this->rizky])
            ->create(['title' => 'Rapat pimpinan']);

        Sanctum::actingAs($this->hendra);
        $this->getJson('/api/v1/manajemen/jadwal')
            ->assertOk()
            ->assertJsonPath('week_start', '2026-10-05')
            ->assertJsonPath('viewer_id', $this->hendra->id)
            ->assertJsonPath('meetings.0.title', 'Rapat pimpinan');

        $this->getJson('/api/v1/manajemen/jadwal?minggu=2026-10-14')->assertOk()->assertJsonPath('week_start', '2026-10-12');

        Sanctum::actingAs($this->rizky);
        $this->getJson('/api/v1/manajemen/jadwal')->assertForbidden();
    });

    it('answers 404 while meetings are off and 401 without a token', function () {
        $this->postJson('/api/v1/rapat', b4bPayload())->assertUnauthorized();

        config(['features.meetings' => false]);
        Sanctum::actingAs($this->dimas);

        $this->postJson('/api/v1/rapat', b4bPayload())->assertNotFound();
        $this->putJson($this->base.'/notulen', [])->assertNotFound();
        $this->getJson('/api/v1/manajemen/jadwal')->assertNotFound();
    });
});
