<?php

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Queries\FindConflicts;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/meeting-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    // Monday 5 Oct 2026, 08.00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->bayu = User::factory()->withRole(Role::Anggota)->create(['name' => 'Bayu Saputra']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
});

/**
 * @return list<string> "YYYY-MM-DD HH:MM" office time
 */
function occurrenceTimes(Meeting $meeting, string $from, string $to): array
{
    $tz = 'Asia/Jakarta';

    return array_map(
        fn (Occurrence $occurrence): string => $occurrence->startsAt->setTimezone($tz)->format('Y-m-d H:i'),
        app(MeetingOccurrences::class)->expand($meeting, CarbonImmutable::parse($from, $tz)->utc(), CarbonImmutable::parse($to, $tz)->utc()),
    );
}

it('expands Monday-Wednesday-Friday stand-ups at the same office time', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-10-05 09:00', 30)->recurring(Recurrence::MonWedFri)->create();

    expect(occurrenceTimes($standup, '2026-10-05', '2026-10-12'))
        ->toBe(['2026-10-05 09:00', '2026-10-07 09:00', '2026-10-09 09:00'])
        ->and(occurrenceTimes($standup, '2026-10-01', '2026-10-05'))->toBe([]);
});

it('expands weekdays and weekly series until their last date', function () {
    $daily = Meeting::factory()->by($this->dimas)->at('2026-10-07 16:00', 15)->recurring(Recurrence::Weekdays, '2026-10-13')->create();
    $weekly = Meeting::factory()->by($this->dimas)->at('2026-10-06 10:00')->recurring(Recurrence::Weekly)->create();

    expect(occurrenceTimes($daily, '2026-10-05', '2026-10-20'))
        ->toBe(['2026-10-07 16:00', '2026-10-08 16:00', '2026-10-09 16:00', '2026-10-12 16:00', '2026-10-13 16:00'])
        ->and(occurrenceTimes($weekly, '2026-10-05', '2026-10-28'))
        ->toBe(['2026-10-06 10:00', '2026-10-13 10:00', '2026-10-20 10:00', '2026-10-27 10:00']);
});

it('resolves the occurrence a link opens: requested date, else today or the next one', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri)->create();
    $occurrences = app(MeetingOccurrences::class);

    expect($occurrences->resolve($standup, '2026-09-30')->date)->toBe('2026-09-30')
        ->and($occurrences->resolve($standup, '2026-10-06')->date)->toBe('2026-10-05') // Tuesday is not an occurrence
        ->and($occurrences->resolve($standup, null)->date)->toBe('2026-10-05');

    $this->travelTo(CarbonImmutable::parse('2026-10-06 12:00', 'Asia/Jakarta'));
    expect($occurrences->resolve($standup, null)->date)->toBe('2026-10-07');

    $ended = Meeting::factory()->by($this->dimas)->at('2026-09-14 09:00')->recurring(Recurrence::Weekly, '2026-09-28')->create();
    expect($occurrences->resolve($ended, null)->date)->toBe('2026-09-28');
});

it('reports conflicts of participants with their meetings and suggests a free slot', function () {
    Meeting::factory()->by($this->rizky)->at('2026-10-06 13:00')->withParticipants([$this->bayu])->create(['title' => 'Rapat gudang']);
    Meeting::factory()->by($this->rizky)->at('2026-10-06 14:00', 30)->withParticipants([$this->bayu], Rsvp::No)->create();
    Meeting::factory()->by($this->rizky)->at('2026-10-06 14:00', 30)->withParticipants([$this->bayu])->create(['canceled_at' => now()]);

    $result = app(FindConflicts::class)->handle(
        $this->dimas,
        [$this->dimas->id, $this->bayu->id],
        CarbonImmutable::parse('2026-10-06 13:30', 'Asia/Jakarta')->utc(),
        CarbonImmutable::parse('2026-10-06 14:30', 'Asia/Jakarta')->utc(),
    );

    // Dimas cannot see Rizky's meeting: its title is hidden. Declined and canceled meetings are ignored.
    expect($result['conflicts'])->toHaveCount(1)
        ->and($result['conflicts'][0])->toMatchArray(['user_id' => $this->bayu->id, 'title' => 'Rapat lain'])
        ->and($result['suggestion'])->toBe('14:00');
});

it('finds conflicts with recurring meetings and ignores the meeting being edited', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri)
        ->withParticipants([$this->bayu])->create(['title' => 'Stand-up Operasional']);

    $check = fn (?string $ignore) => app(FindConflicts::class)->handle(
        $this->dimas,
        [$this->bayu->id],
        CarbonImmutable::parse('2026-10-07 09:15', 'Asia/Jakarta')->utc(),
        CarbonImmutable::parse('2026-10-07 10:15', 'Asia/Jakarta')->utc(),
        $ignore,
    );

    expect($check(null)['conflicts'][0]['title'])->toBe('Stand-up Operasional')
        ->and($check(null)['suggestion'])->toBe('09:30')
        ->and($check($standup->id)['conflicts'])->toBe([]);
});

it('suggests nothing when the day is full until 17.00', function () {
    Meeting::factory()->by($this->rizky)->at('2026-10-06 13:00', 240)->withParticipants([$this->bayu])->create();

    $result = app(FindConflicts::class)->handle(
        $this->dimas,
        [$this->bayu->id],
        CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Jakarta')->utc(),
        CarbonImmutable::parse('2026-10-06 16:00', 'Asia/Jakarta')->utc(),
    );

    expect($result['conflicts'])->toHaveCount(1)->and($result['suggestion'])->toBeNull();
});
