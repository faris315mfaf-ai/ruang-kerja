<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Providers\RequestSearchProvider;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Tests\Support\RequestScenario;

/*
 * ⌘K "Pengajuan": own requests and requests waiting for the viewer's decision.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->request = $this->s->submit($this->s->employee, $this->s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'reason' => 'Acara keluarga di Solo']);
});

it('finds own requests by number, type or reason', function () {
    $provider = app(RequestSearchProvider::class);
    $employee = $this->s->employee;

    foreach ([$this->request->number, 'cuti tahunan', 'solo'] as $term) {
        $results = $provider->search($employee, (string) $term, 10);
        expect($results)->toHaveCount(1)
            ->and($results[0]->url)->toBe('/pengajuan/'.$this->request->id)
            ->and($results[0]->code)->toBe($this->request->number)
            ->and($results[0]->meta)->toBe('Menunggu');
    }
});

it('finds requests the viewer can decide, linking to the approval page', function () {
    $results = app(RequestSearchProvider::class)->search($this->s->manager, $this->s->employee->name, 10);

    expect($results)->toHaveCount(1)
        ->and($results[0]->url)->toBe('/persetujuan/'.$this->request->id)
        ->and($results[0]->meta)->toBe('Menunggu keputusan Anda')
        ->and($results[0]->title)->toContain($this->s->employee->name);
});

it('hides requests the viewer neither owns nor decides', function () {
    $provider = app(RequestSearchProvider::class);
    $colleague = User::factory()->withRole(Role::Anggota)->create();
    $outsider = User::factory()->withRole(Role::KepalaDivisi)->forCompany(Company::factory()->create())->create();

    expect($provider->search($colleague, 'cuti', 10))->toBe([])
        ->and($provider->search($outsider, 'cuti', 10))->toBe([])
        // HR decides at step 2 only: nothing waits for HR yet.
        ->and($provider->search($this->s->hr, 'cuti', 10))->toBe([]);

    // After the manager approves, the request waits for HR.
    $this->s->approve($this->s->manager, $this->request);
    expect(collect($provider->search($this->s->hr, 'cuti', 10))->pluck('url')->all())->toBe(['/persetujuan/'.$this->request->id])
        ->and($provider->search($this->s->manager, 'cuti', 10))->toBe([]);
});

it('is a group of the search endpoint', function () {
    $this->actingAs($this->s->employee)
        ->getJson('/cari/hasil?q=solo')
        ->assertOk()
        ->assertJsonFragment(['key' => 'requests', 'label' => 'Pengajuan'])
        ->assertJsonFragment(['url' => '/pengajuan/'.$this->request->id]);
});
