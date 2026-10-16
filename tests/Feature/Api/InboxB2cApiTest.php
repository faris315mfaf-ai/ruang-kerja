<?php

use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;

/*
| API v1 — Bagian 2 B2-C: Inbox lengkap untuk aplikasi (tab, filter, hitungan,
| target tujuan, kanal Android, aksi satu/massal). Aksi memakai Action web yang
| sama; notifikasi orang lain tidak pernah terlihat (404).
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->rizky = User::factory()->create(['name' => 'Rizky Aditya']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);

    $this->tugas = InboxNotification::factory()->recipient($this->rizky)->ofType(NotificationType::TaskAssigned)
        ->withData(['title' => 'Ditugaskan ke Anda', 'url' => '/w/TMS/tasks/7#komentar-01ABC', 'subject' => ['type' => 'App\Models\Task', 'id' => '01TASKULID', 'code' => 'TMS-7', 'title' => 'Siapkan laporan']])
        ->create(['created_at' => now()->subMinutes(5)]);
    $this->persetujuan = InboxNotification::factory()->recipient($this->rizky)->ofType(NotificationType::RequestSubmitted)
        ->withData(['title' => 'Pengajuan baru', 'url' => '/persetujuan/01REQ', 'subject' => ['type' => 'App\Models\EmployeeRequest', 'id' => '01REQ', 'code' => 'CUT-1', 'title' => 'Cuti']])
        ->create(['created_at' => now()->subMinutes(10)]);
    $this->hadir = InboxNotification::factory()->recipient($this->rizky)->ofType(NotificationType::CheckInReminder)
        ->withData(['url' => '/absensi'])->read()->create(['created_at' => now()->subMinutes(20)]);
    $this->arsip = InboxNotification::factory()->recipient($this->rizky)->ofType(NotificationType::Mention)
        ->archived()->create(['created_at' => now()->subMinutes(30)]);
    $this->milikSari = InboxNotification::factory()->recipient($this->sari)->create();

    Sanctum::actingAs($this->rizky);
});

test('the default tab lists active items with target, android channel and per-tab counts', function () {
    $response = $this->getJson('/api/v1/inbox')->assertOk();

    expect(collect($response->json('items'))->pluck('id')->all())->toBe([$this->tugas->id, $this->persetujuan->id, $this->hadir->id]);

    $response
        ->assertJsonPath('unread', 2)
        ->assertJsonPath('meta.counts', ['semua' => 3, 'perlu_tindakan' => 1, 'diarsipkan' => 1, 'belum_dibaca' => 2])
        ->assertJsonPath('items.0.android_channel', 'rk_tugas')
        ->assertJsonPath('items.0.target.type', 'tugas')
        ->assertJsonPath('items.0.target.id', '01TASKULID')
        ->assertJsonPath('items.0.target.anchor', 'komentar-01ABC')
        ->assertJsonPath('items.1.android_channel', 'rk_mendesak')
        ->assertJsonPath('items.1.target.type', 'persetujuan')
        ->assertJsonPath('items.1.target.id', '01REQ')
        ->assertJsonPath('items.1.action_required', true)
        ->assertJsonPath('items.2.target.type', 'absensi')
        ->assertJsonPath('items.2.target.id', null)
        ->assertJsonPath('items.2.android_channel', 'rk_pengingat');
});

test('tab perlu-tindakan, diarsipkan and the chips combine', function () {
    expect(collect($this->getJson('/api/v1/inbox?tab=perlu-tindakan')->assertOk()->json('items'))->pluck('id')->all())
        ->toBe([$this->persetujuan->id]);

    expect(collect($this->getJson('/api/v1/inbox?tab=diarsipkan')->assertOk()->json('items'))->pluck('id')->all())
        ->toBe([$this->arsip->id]);

    // "Belum dibaca" over Semua leaves the two unread ones; the kind chip narrows further.
    expect(collect($this->getJson('/api/v1/inbox?belum-dibaca=1')->json('items'))->pluck('id')->all())
        ->toBe([$this->tugas->id, $this->persetujuan->id]);
    expect(collect($this->getJson('/api/v1/inbox?belum-dibaca=1&jenis=request')->json('items'))->pluck('id')->all())
        ->toBe([$this->persetujuan->id]);
    expect(collect($this->getJson('/api/v1/inbox?jenis=attendance')->json('items'))->pluck('id')->all())
        ->toBe([$this->hadir->id]);
    expect(collect($this->getJson('/api/v1/inbox?tab=diarsipkan&jenis=mention')->json('items'))->pluck('id')->all())
        ->toBe([$this->arsip->id]);
});

test('per_page narrows the page and validation answers 422 in Indonesian', function () {
    $this->getJson('/api/v1/inbox?per_page=2')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 2)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(2, 'items');

    $this->getJson('/api/v1/inbox?tab=lain')->assertUnprocessable()->assertJsonValidationErrors(['tab']);
    $this->getJson('/api/v1/inbox?jenis=xyz')->assertUnprocessable()->assertJsonPath('errors.jenis.0', 'Jenis notifikasi tidak dikenal.');
    $this->getJson('/api/v1/inbox?per_page=500')->assertUnprocessable()->assertJsonValidationErrors(['per_page']);
});

test('detail returns the full item and 404 for someone elses notification', function () {
    $body = str_repeat('Poin briefing. ', 200);
    $briefing = InboxNotification::factory()->recipient($this->rizky)->ofType(NotificationType::BriefingPosted)
        ->withData(['body' => $body, 'url' => '/inbox', 'subject' => ['type' => 'App\Models\Briefing', 'id' => '01BRF', 'code' => null, 'title' => 'Briefing pagi']])
        ->create();

    $this->getJson("/api/v1/inbox/{$briefing->id}")
        ->assertOk()
        ->assertJsonPath('item.id', $briefing->id)
        ->assertJsonPath('item.body', $body)
        ->assertJsonPath('item.android_channel', 'rk_info')
        ->assertJsonPath('item.target', ['type' => 'briefing', 'id' => '01BRF', 'anchor' => null, 'params' => []])
        ->assertJsonPath('unread', 3);

    $this->getJson("/api/v1/inbox/{$this->milikSari->id}")->assertNotFound();
});

test('belum-baca, arsip and batal-arsip use the web actions and return counters', function () {
    $this->postJson("/api/v1/inbox/{$this->hadir->id}/belum-baca")
        ->assertOk()
        ->assertJsonPath('item.read_at', null)
        ->assertJsonPath('unread', 3);
    expect($this->hadir->fresh()->read_at)->toBeNull();

    $this->postJson("/api/v1/inbox/{$this->tugas->id}/arsip")
        ->assertOk()
        ->assertJsonPath('item.archived_at', fn (string $at) => $at !== '')
        ->assertJsonPath('counts.semua', 2)
        ->assertJsonPath('counts.diarsipkan', 2)
        ->assertJsonPath('unread', 2);
    expect($this->tugas->fresh()->archived_at)->not->toBeNull()->and($this->tugas->fresh()->read_at)->not->toBeNull();

    $this->postJson("/api/v1/inbox/{$this->arsip->id}/batal-arsip")
        ->assertOk()
        ->assertJsonPath('item.archived_at', null)
        ->assertJsonPath('counts.diarsipkan', 1);
    expect($this->arsip->fresh()->archived_at)->toBeNull();
});

test('actions on someone elses notification answer 404 and change nothing', function () {
    foreach (['belum-baca', 'arsip', 'batal-arsip'] as $action) {
        $this->postJson("/api/v1/inbox/{$this->milikSari->id}/{$action}")->assertNotFound();
    }

    expect($this->milikSari->fresh()->archived_at)->toBeNull();
});

test('baca-semua marks everything unread, or only what the tab/kind lists', function () {
    $this->postJson('/api/v1/inbox/baca-semua?jenis=request')
        ->assertOk()
        ->assertJsonPath('marked', 1)
        ->assertJsonPath('unread', 1);
    expect($this->persetujuan->fresh()->read_at)->not->toBeNull()->and($this->tugas->fresh()->read_at)->toBeNull();

    $this->postJson('/api/v1/inbox/baca-semua')
        ->assertOk()
        ->assertJsonPath('marked', 1)
        ->assertJsonPath('unread', 0)
        ->assertJsonPath('counts.belum_dibaca', 0);

    // Marking all read never resolves "Perlu tindakan" and never touches other people's Inbox.
    expect($this->persetujuan->fresh()->isActionPending())->toBeTrue()
        ->and($this->milikSari->fresh()->read_at)->toBeNull();
});

test('massal applies one action to the selection and skips foreign ids', function () {
    $unknown = '00000000-0000-4000-8000-000000000000';

    $this->postJson('/api/v1/inbox/massal', [
        'ids' => [$this->tugas->id, $this->persetujuan->id, $this->milikSari->id, $unknown],
        'aksi' => 'arsip',
    ])
        ->assertOk()
        ->assertJsonPath('affected', 2)
        ->assertJsonPath('skipped', [$this->milikSari->id, $unknown])
        ->assertJsonPath('unread', 0)
        ->assertJsonPath('counts.diarsipkan', 3);

    expect($this->milikSari->fresh()->archived_at)->toBeNull();

    $this->postJson('/api/v1/inbox/massal', ['ids' => [$this->tugas->id], 'aksi' => 'belum-baca'])->assertOk()->assertJsonPath('affected', 1);
    expect($this->tugas->fresh()->read_at)->toBeNull();

    $this->postJson('/api/v1/inbox/massal', ['ids' => [$this->tugas->id], 'aksi' => 'baca'])->assertOk();
    expect($this->tugas->fresh()->read_at)->not->toBeNull();
});

test('massal validates the selection', function () {
    $this->postJson('/api/v1/inbox/massal', ['ids' => [], 'aksi' => 'arsip'])->assertUnprocessable()->assertJsonValidationErrors(['ids']);
    $this->postJson('/api/v1/inbox/massal', ['ids' => ['bukan-uuid'], 'aksi' => 'arsip'])->assertUnprocessable()->assertJsonValidationErrors(['ids.0']);
    $this->postJson('/api/v1/inbox/massal', ['ids' => [$this->tugas->id], 'aksi' => 'hapus'])->assertUnprocessable()->assertJsonValidationErrors(['aksi']);
    $this->postJson('/api/v1/inbox/massal', ['ids' => array_fill(0, 51, $this->tugas->id), 'aksi' => 'baca'])->assertUnprocessable();
});

test('the new inbox endpoints reject requests without a token', function () {
    $id = $this->tugas->id;

    // Drop the Sanctum user set in beforeEach.
    foreach ([['GET', "/api/v1/inbox/{$id}"], ['POST', "/api/v1/inbox/{$id}/arsip"], ['POST', '/api/v1/inbox/baca-semua'], ['POST', '/api/v1/inbox/massal']] as [$method, $url]) {
        $this->refreshApplication();
        $this->json($method, $url)->assertUnauthorized();
    }
});

test('every notification type has an Android channel and the definitions list each type once', function () {
    foreach (NotificationType::cases() as $type) {
        expect(AndroidChannel::forType($type))->toBeInstanceOf(AndroidChannel::class);
    }

    $definitions = AndroidChannel::definitions();
    $mapped = collect($definitions)->pluck('types')->flatten()->all();

    expect($mapped)->toHaveCount(count(NotificationType::cases()))
        ->and(array_unique($mapped))->toHaveCount(count(NotificationType::cases()))
        ->and(collect($definitions)->pluck('id')->all())->toBe([
            'rk_mendesak', 'rk_tugas', 'rk_obrolan', 'rk_rapat', 'rk_pengajuan', 'rk_pengingat', 'rk_proyek', 'rk_info', 'rk_keamanan', 'rk_sinkron',
        ])
        // Sample of the owner's table (spec 10 §6).
        ->and(AndroidChannel::forType(NotificationType::TaskOverdue))->toBe(AndroidChannel::Mendesak)
        ->and(AndroidChannel::forType(NotificationType::RequestApproved))->toBe(AndroidChannel::Pengajuan)
        ->and(AndroidChannel::forType(NotificationType::ConsentRevoked))->toBe(AndroidChannel::Keamanan)
        ->and(AndroidChannel::forType(NotificationType::BriefingPosted))->toBe(AndroidChannel::Info);
});
