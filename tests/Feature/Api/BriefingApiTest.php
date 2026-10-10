<?php

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Organization\Enums\Role;
use App\Models\Briefing;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;

/*
| API v1 — "Briefing terakhir" of the mobile home screen (Tahap 1): the
| newest note of the caller's company (every active employee may read it —
| BriefingPolicy::view), or 204 when none exists. Recording and delegation
| stay on the web.
*/

const HASH_PONSEL = 'abababababababababababababababababababababababababababababababab'; // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana Pratiwi']);
    $this->employee = User::factory()->create(['name' => 'Rizky Aditya', 'email' => 'rizky@kantor.test']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukBriefing(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

test('an employee reads the latest briefing of the company', function () {
    Briefing::query()->create([
        'company_id' => $this->hr->company_id,
        'period' => BriefingPeriod::Pagi,
        'briefing_date' => '2026-10-09',
        'content' => 'Briefing pagi: target hari ini.',
        'created_by' => $this->hr->id,
    ]);
    Briefing::query()->create([
        'company_id' => $this->hr->company_id,
        'period' => BriefingPeriod::Sore,
        'briefing_date' => '2026-10-09',
        'content' => 'Briefing sore: evaluasi sore ini.',
        'created_by' => $this->hr->id,
    ]);
    Briefing::query()->create([
        'company_id' => $this->hr->company_id,
        'period' => BriefingPeriod::Sore,
        'briefing_date' => '2026-10-08',
        'content' => 'Kemarin.',
        'created_by' => $this->hr->id,
    ]);

    $token = masukBriefing('rizky@kantor.test');

    test()->withToken($token)->getJson('/api/v1/briefing/terakhir')
        ->assertOk()
        ->assertJsonPath('briefing.period', 'sore')
        ->assertJsonPath('briefing.label', 'Briefing sore')
        ->assertJsonPath('briefing.date', '2026-10-09')
        ->assertJsonPath('briefing.content', 'Briefing sore: evaluasi sore ini.')
        ->assertJsonPath('briefing.oleh', 'Hana Pratiwi')
        ->assertJsonPath('briefing.updated_at', fn (string $at): bool => $at !== '');
});

test('the endpoint answers 204 when the company has no briefing yet', function () {
    $token = masukBriefing('rizky@kantor.test');

    test()->withToken($token)->getJson('/api/v1/briefing/terakhir')->assertNoContent();
});

test("another company's briefing never shows up", function () {
    $outsider = User::factory()->forCompany(Company::factory()->create())->create(['name' => 'Eksternal']);

    Briefing::query()->create([
        'company_id' => $outsider->company_id,
        'period' => BriefingPeriod::Pagi,
        'briefing_date' => '2026-10-10',
        'content' => 'Rahasia perusahaan lain.',
        'created_by' => $outsider->id,
    ]);

    $token = masukBriefing('rizky@kantor.test');

    // Only the other company has one → still empty for us.
    test()->withToken($token)->getJson('/api/v1/briefing/terakhir')->assertNoContent();

    // Ours is older, but it is ours that shows up.
    Briefing::query()->create([
        'company_id' => $this->employee->company_id,
        'period' => BriefingPeriod::Pagi,
        'briefing_date' => '2026-10-07',
        'content' => 'Milik kita.',
        'created_by' => $this->hr->id,
    ]);

    test()->withToken($token)->getJson('/api/v1/briefing/terakhir')
        ->assertOk()
        ->assertJsonPath('briefing.content', 'Milik kita.');
});

test('the briefing endpoint rejects requests without a token', function () {
    test()->getJson('/api/v1/briefing/terakhir')->assertUnauthorized();
});
