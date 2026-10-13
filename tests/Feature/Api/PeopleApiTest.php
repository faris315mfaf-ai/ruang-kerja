<?php

use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — GET /orang?q= (Bagian 2 / B2-B): pemilih orang dengan cakupan
| User::visibleTo yang sama dengan pencarian "Orang" web (HR/Direksi/Super
| Admin melihat semua, selain itu diri sendiri + bawahan langsung + divisi
| yang dipimpin), karyawan aktif saja, maks. 20, tanpa email.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->org = F::org();
});

test('HR finds colleagues by name or email, active ones only, as picker rows', function () {
    User::factory()->inactive()->create(['company_id' => $this->org['hr']->company_id, 'name' => 'Rina Nonaktif']);
    $this->org['rizky']->update(['email' => 'rizky.aditya@kantor.test']);

    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/orang?q=riz')->assertOk()
        ->assertJsonCount(1, 'orang')
        ->assertJsonPath('orang.0.id', $this->org['rizky']->id)
        ->assertJsonPath('orang.0.name', 'Rizky Aditya')
        ->assertJsonPath('orang.0.initials', 'RA')
        ->assertJsonPath('orang.0.division', 'Operasional')
        ->assertJsonMissingPath('orang.0.email');

    $this->getJson('/api/v1/orang?q=kantor.test')->assertOk()->assertJsonPath('orang.0.id', $this->org['rizky']->id);
    $this->getJson('/api/v1/orang?q=Nonaktif')->assertOk()->assertJsonCount(0, 'orang');
});

test('the list is capped at 20 and an empty query lists the first 20', function () {
    User::factory()->count(25)->create(['company_id' => $this->org['hr']->company_id]);
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/orang')->assertOk()->assertJsonCount(20, 'orang');
    $this->getJson('/api/v1/orang?q=')->assertOk()->assertJsonCount(20, 'orang');
});

test('an ordinary employee only finds themself and direct reports; a division head their division', function () {
    Sanctum::actingAs($this->org['rizky']);
    expect(collect($this->getJson('/api/v1/orang')->assertOk()->json('orang'))->pluck('id')->all())->toBe([$this->org['rizky']->id]);
    $this->getJson('/api/v1/orang?q=Budi')->assertOk()->assertJsonCount(0, 'orang');

    Sanctum::actingAs($this->org['kadiv']);
    expect(collect($this->getJson('/api/v1/orang')->assertOk()->json('orang'))->pluck('name')->all())
        ->toEqualCanonicalizing(['Dimas Pratama', 'Rizky Aditya', 'Sari Wulandari']);
});

test("another company's people never show up", function () {
    User::factory()->forCompany(Company::factory()->create())->create(['name' => 'Rizky Luar Perusahaan']);
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/orang?q=Luar Perusahaan')->assertOk()->assertJsonCount(0, 'orang');
});

test('the query is validated', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/orang?q='.str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');
});

test('people search needs a token', function () {
    $this->getJson('/api/v1/orang')->assertUnauthorized();
});
