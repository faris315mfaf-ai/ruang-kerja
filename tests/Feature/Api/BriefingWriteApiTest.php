<?php

use App\Domain\Briefings\Jobs\SendBriefingNotifications;
use App\Models\Briefing;
use App\Models\BriefingDelegation;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — briefing pagi & sore, sisi menulis (Bagian 2 / B2-B): jendela,
| simpan (SaveBriefing: jendela, pencatat/delegasi, upsert, notifikasi sekali)
| dan delegasi (DelegateBriefing). Selasa 6 Okt 2026 09.00 WIB = jendela pagi.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    $this->org = F::org();
});

test('HR sees the window card and a plain employee sees none', function () {
    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/briefing/jendela')->assertOk()
        ->assertJsonPath('can_delegate', true)
        ->assertJsonPath('jendela.date', '2026-10-06')
        ->assertJsonPath('jendela.current', 'pagi')
        ->assertJsonPath('jendela.can_record', true)
        ->assertJsonPath('jendela.periods.0', ['value' => 'pagi', 'label' => 'Briefing pagi', 'starts_at' => '08:00', 'ends_at' => '11:00', 'status' => 'open'])
        ->assertJsonPath('jendela.periods.1.status', 'before')
        ->assertJsonMissingPath('jendela.urls');

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/briefing/jendela')->assertOk()
        ->assertJsonPath('jendela', null)
        ->assertJsonPath('can_delegate', false);
});

test('HR saves the note: 201 the first time, 200 and no second notification afterwards', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => "Target hari ini:\n- stok gudang"])
        ->assertCreated()
        ->assertJsonPath('created', true)
        ->assertJsonPath('message', 'Briefing tersimpan dan dikirim ke semua karyawan.')
        ->assertJsonPath('briefing.period', 'pagi')
        ->assertJsonPath('briefing.oleh', 'Hana HR')
        ->assertJsonPath('briefing.content', "Target hari ini:\n- stok gudang");

    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => 'Revisi catatan.'])
        ->assertOk()
        ->assertJsonPath('created', false)
        ->assertJsonPath('briefing.content', 'Revisi catatan.');

    expect(Briefing::query()->count())->toBe(1);
    Queue::assertPushed(SendBriefingNotifications::class, 1);

    // Immediately visible to every employee.
    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/briefing/terakhir')->assertOk()->assertJsonPath('briefing.content', 'Revisi catatan.');
});

test('saving is refused outside the window, without content, and for plain employees', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->postJson('/api/v1/briefing', ['period' => 'sore', 'content' => 'Terlalu cepat.'])
        ->assertUnprocessable()->assertJsonValidationErrors('period');
    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => '   '])
        ->assertUnprocessable()->assertJsonValidationErrors('content');
    $this->postJson('/api/v1/briefing', ['period' => 'malam', 'content' => 'x'])
        ->assertUnprocessable()->assertJsonValidationErrors('period');

    Sanctum::actingAs($this->org['rizky']);
    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => 'Coba-coba.'])->assertForbidden();

    expect(Briefing::query()->count())->toBe(0);
});

test('HR appoints a delegate who can then record only that period', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['rizky']->id, 'period' => 'pagi'])
        ->assertOk()
        ->assertJsonPath('delegation', [
            'date' => '2026-10-06',
            'period' => 'pagi',
            'to' => ['id' => $this->org['rizky']->id, 'name' => 'Rizky Aditya'],
            'by' => ['id' => $this->org['hr']->id, 'name' => 'Hana HR'],
        ]);

    // Appointing again replaces the target (one delegation per period).
    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['sari']->id, 'period' => 'pagi'])->assertOk();
    expect(BriefingDelegation::query()->count())->toBe(1);

    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['rizky']->id, 'period' => 'pagi'])->assertOk();

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/briefing/jendela')->assertOk()
        ->assertJsonPath('jendela.is_recorder', false)
        ->assertJsonPath('jendela.can_record', true)
        ->assertJsonPath('can_delegate', false)
        ->assertJsonPath('jendela.delegations.pagi.to.name', 'Rizky Aditya');

    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => 'Dicatat oleh yang ditunjuk.'])
        ->assertCreated()
        ->assertJsonPath('briefing.oleh', 'Rizky Aditya');
    expect(Briefing::query()->firstOrFail()->delegated_from)->toBe($this->org['hr']->id);

    // The one who lost the appointment cannot record.
    Sanctum::actingAs($this->org['sari']);
    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => 'Tidak berhak.'])->assertForbidden();
});

test('delegation rules: HR only, active colleague of the company, not yourself, window not over', function () {
    Sanctum::actingAs($this->org['rizky']);
    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['sari']->id, 'period' => 'pagi'])->assertForbidden();

    Sanctum::actingAs($this->org['hr']);
    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['hr']->id, 'period' => 'pagi'])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');

    $outsider = User::factory()->forCompany(Company::factory()->create())->create();
    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $outsider->id, 'period' => 'pagi'])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');

    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => 'bukan-ulid', 'period' => 'pagi'])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');

    $this->travelTo(CarbonImmutable::parse('2026-10-06 12:00', 'Asia/Jakarta'));
    $this->postJson('/api/v1/briefing/delegasi', ['user_id' => $this->org['rizky']->id, 'period' => 'pagi'])
        ->assertUnprocessable()->assertJsonValidationErrors('period');

    expect(BriefingDelegation::query()->count())->toBe(0);
});

test('briefing writing needs a token', function () {
    $this->getJson('/api/v1/briefing/jendela')->assertUnauthorized();
    $this->postJson('/api/v1/briefing', ['period' => 'pagi', 'content' => 'x'])->assertUnauthorized();
    $this->postJson('/api/v1/briefing/delegasi', [])->assertUnauthorized();
});
