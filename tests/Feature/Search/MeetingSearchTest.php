<?php

use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Providers\MeetingSearchProvider;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\OfficeTimezone;
use App\Models\Company;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;

/*
 * ⌘K / mobile "Rapat": meetings the viewer may open (Meeting::visibleTo),
 * behind the `meetings` feature flag.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.meetings' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));

    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->invited = User::factory()->withRole(Role::Anggota)->create();
    $this->stranger = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->organizer)->at('2026-10-06 13:30')->withParticipants([$this->invited])->create([
        'title' => 'Review vendor logistik',
        'description' => 'Bahas penawaran harga gudang',
        'agenda' => ['Evaluasi pengiriman'],
        'location' => 'Ruang Mawar',
    ]);
});

it('finds meetings by title, description, agenda item and place for participants', function () {
    $provider = app(MeetingSearchProvider::class);

    foreach (['vendor', 'penawaran', 'evaluasi pengiriman', 'mawar'] as $term) {
        $results = $provider->search($this->invited, $term, 10);

        expect($results)->toHaveCount(1)
            ->and($results[0]->id)->toBe('meeting:'.$this->meeting->id)
            ->and($results[0]->url)->toBe('/rapat/'.$this->meeting->id)
            ->and($results[0]->subtitle)->toBe('Sel, 6 Okt 2026 · 13.30–14.30 WIB')
            ->and($results[0]->meta)->toBe('Google Meet');
    }

    expect($provider->search($this->organizer, 'vendor', 10))->toHaveCount(1);
});

it('hides meetings the viewer is not part of, canceled ones and everything when the flag is off', function () {
    $provider = app(MeetingSearchProvider::class);

    expect($provider->search($this->stranger, 'vendor', 10))->toBe([])
        ->and($provider->search(User::factory()->create(), '%', 10))->toBe([]);

    Meeting::factory()->by($this->organizer)->at('2026-10-07 09:00')->withParticipants([$this->invited])
        ->create(['title' => 'Vendor batal', 'canceled_at' => now()]);

    expect(collect($provider->search($this->invited, 'vendor', 10))->pluck('title')->all())->toBe(['Review vendor logistik']);

    config(['features.meetings' => false]);

    expect($provider->search($this->invited, 'vendor', 10))->toBe([]);
});

it('treats % and _ literally and labels series', function () {
    Meeting::factory()->by($this->organizer)->at('2026-10-05 09:00', 30)->recurring(Recurrence::Weekdays)->withParticipants([$this->invited])
        ->create(['title' => 'Sinkron harian']);
    $provider = app(MeetingSearchProvider::class);

    expect($provider->search($this->invited, '%', 10))->toBe([]);

    $series = $provider->search($this->invited, 'sinkron', 10);

    expect($series[0]->subtitle)->toStartWith('Setiap hari kerja · mulai ');
});

it('is wired into the web search endpoint as the Rapat group', function () {
    $response = $this->actingAs($this->invited)->getJson('/cari/hasil?q=vendor')->assertOk();
    $group = collect($response->json('groups'))->firstWhere('key', 'meetings');

    expect($group['label'])->toBe('Rapat')
        ->and($group['items'][0]['title'])->toBe('Review vendor logistik');

    $this->actingAs($this->invited)->getJson('/cari/hasil?q=vendor&group=meetings')->assertOk();
    $this->actingAs($this->stranger)->getJson('/cari/hasil?q=vendor')->assertOk()->assertJsonPath('groups', []);
});

it('shows the meeting time in the zone of the company (Fase 1 multi-perusahaan)', function () {
    $makassar = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    $organizer = User::factory()->forCompany($makassar)->withRole(Role::KepalaDivisi)->create();
    // 13.30 WIB = 14.30 WITA.
    Meeting::factory()->by($organizer)->create([
        'title' => 'Review armada Makassar',
        'starts_at' => CarbonImmutable::parse('2026-10-06 13:30', 'Asia/Jakarta')->utc(),
        'ends_at' => CarbonImmutable::parse('2026-10-06 14:30', 'Asia/Jakarta')->utc(),
    ]);

    $results = app(CompanyContext::class)->run($makassar, fn () => app(MeetingSearchProvider::class)->search($organizer, 'armada', 10));

    expect($results)->toHaveCount(1)
        ->and($results[0]->subtitle)->toBe('Sel, 6 Okt 2026 · 14.30–15.30 WITA')
        ->and(OfficeTimezone::label('Asia/Jayapura'))->toBe('WIT')
        ->and(OfficeTimezone::label('Asia/Singapore'))->toBe('UTC+08:00');
});
