<?php

use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;
use Tests\TestCase;

/*
| API v1 — "Pengajuan saya" for the mobile app (Tahap 1): the caller's own
| list (web row presenter), the types they may request (web form machinery,
| locked/ineligible excluded) and submission through the web SubmitRequest
| action — approval flow, numbering and the approver notification included.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));

    $this->s = RequestScenario::make();
    $this->s->employee->update(['email' => 'rizky@kantor.test']);
    $this->s->manager->update(['email' => 'dimas@kantor.test']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukPengajuan(string $email): string
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
function sebagaiTokenPengajuan(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('the list answers only my requests with the web row fields', function () {
    $s = $this->s;
    $izin = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    $dinas = $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-19', 'end_date' => '2026-10-20', 'destination' => 'Surabaya']);
    $milikManager = $s->submit($s->manager, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    $token = masukPengajuan('rizky@kantor.test');

    $response = test()->withToken($token)->getJson('/api/v1/pengajuan');

    $response->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('requests.0.id', $dinas->id)
        ->assertJsonPath('requests.0.type.name', 'Dinas luar')
        ->assertJsonPath('requests.0.status', 'pending')
        ->assertJsonPath('requests.0.status_label', 'Menunggu')
        ->assertJsonPath('requests.0.days', 2)
        ->assertJsonPath('requests.0.start_at', $dinas->start_at->toIso8601String())
        ->assertJsonPath('requests.1.id', $izin->id)
        ->assertJsonPath('requests.1.waiting.approver.name', 'Dimas Pratama')
        ->assertJsonPath('requests.1.decision_note', null);

    expect(collect($response->json('requests'))->pluck('id'))
        ->not->toContain($milikManager->id);
});

test('jenis lists the categories the employee may request, without locked or ineligible types', function () {
    $s = $this->s;
    $s->annual->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);
    $s->overtime->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);
    $s->employee->update(['joined_at' => '2026-09-01']); // belum 60 bulan layanan
    LeaveType::factory()->category($s->sick->category)->withFlow($s->flow)->create([
        'code' => 'SK2',
        'name' => 'Sakit lanjut',
        'min_service_months' => 60,
    ]);

    $token = masukPengajuan('rizky@kantor.test');

    $response = test()->withToken($token)->getJson('/api/v1/pengajuan/jenis');

    $response->assertOk();

    $categories = collect($response->json('categories'));
    $names = $categories->flatMap(fn (array $category): array => array_column($category['types'], 'name'));

    expect($categories->pluck('value')->all())->toBe(['permit', 'sick', 'correction', 'business_trip', 'procurement'])
        ->and($names)->toContain('Izin', 'Sakit', 'Koreksi absensi', 'Dinas luar')
        ->and($names)->not->toContain('Lembur', 'Cuti tahunan', 'Sakit lanjut');

    // The web type fields (the form "schema": half day, attachment rule, quota…).
    $izin = $categories->firstWhere('value', 'permit')['types'][0];

    expect($izin)->toBeArray()
        ->and($izin['id'])->toBe($s->permit->id)
        ->and($izin['allow_half_day'])->toBeTrue()
        ->and($izin['category_label'])->toBe('Izin');

    // The manager sees the same catalogue of the company.
    $tokenDimas = masukPengajuan('dimas@kantor.test');

    expect(
        collect(sebagaiTokenPengajuan($tokenDimas)->getJson('/api/v1/pengajuan/jenis')->json('categories'))
            ->flatMap(fn (array $category): array => array_column($category['types'], 'name'))
    )->not->toContain('Lembur');
});

test('submitting a request answers 201 pending and notifies the first approver', function () {
    $s = $this->s;
    $token = masukPengajuan('rizky@kantor.test');

    $response = test()->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $s->permit->id,
        'reason' => 'Keperluan keluarga.',
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-13',
    ]);

    $row = EmployeeRequest::query()->ownedBy($s->employee)->first();

    $response->assertCreated()
        ->assertJsonPath('request.status', 'pending')
        ->assertJsonPath('request.status_label', 'Menunggu')
        ->assertJsonPath('request.type.name', 'Izin')
        ->assertJsonPath('request.days', 2)
        ->assertJsonPath('request.waiting.approver.name', 'Dimas Pratama');

    expect($row)->not->toBeNull()
        ->and($row->status)->toBe(RequestStatus::Pending)
        ->and($row->number)->not->toBeNull();

    Notification::assertSentTo($s->manager, RequestAwaitingApproval::class);
    Notification::assertNotSentTo($s->hr, RequestAwaitingApproval::class);
});

test('validation and business rules answer the web 422 messages', function () {
    $s = $this->s;
    $token = masukPengajuan('rizky@kantor.test');

    // Alasan wajib untuk kirim.
    test()->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $s->permit->id,
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-13',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.reason.0', 'Alasan wajib diisi.');

    // Jenis tak dikenal.
    test()->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => '01H8Y0TA6RKQ7Y4Q4W3J8XRZB4',
        'reason' => 'Apa pun.',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.leave_type_id.0', 'Jenis pengajuan tidak tersedia.');

    // Jenis terkunci ditolak oleh mesin web.
    $s->overtime->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);

    test()->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $s->overtime->id,
        'reason' => 'Lembur rilis.',
        'date' => '2026-10-06',
        'start_time' => '17:00',
        'end_time' => '20:00',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.leave_type_id.0', 'Lembur belum bisa diajukan. '.LeaveType::SOP_LOCK_REASON);

    // Tumpang tindih dengan pengajuan sendiri.
    $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    test()->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $s->permit->id,
        'reason' => 'Bertabrakan.',
        'start_date' => '2026-10-13',
        'end_date' => '2026-10-14',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.start_date.0', fn (string $message): bool => str_starts_with($message, 'Tumpang tindih dengan pengajuan IZN-2026-10-0001'));

    expect(EmployeeRequest::query()->ownedBy($s->employee)->count())->toBe(1);
});

test('request endpoints reject requests without a token', function () {
    $s = $this->s;

    test()->getJson('/api/v1/pengajuan')->assertUnauthorized();
    test()->getJson('/api/v1/pengajuan/jenis')->assertUnauthorized();
    test()->postJson('/api/v1/pengajuan', ['type' => $s->permit->id])->assertUnauthorized();
});
