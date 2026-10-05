<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Notifications\Services\QuietHours;
use Carbon\CarbonImmutable;

/*
 * Review fix Sprint 3–9 #27: holidays HR maintains (Admin › hari libur) are
 * quiet all day, like weekends.
 */

it('treats a holiday as quiet and delays email to the next working day', function () {
    // Thu 24 Dec and Fri 25 Dec 2026 are holidays (cuti bersama + Natal).
    Holiday::factory()->on('2026-12-24', 'Cuti bersama Natal')->create();
    Holiday::factory()->on('2026-12-25', 'Hari Raya Natal')->create();
    $quiet = app(QuietHours::class);

    // Thu 24 Dec 10.00 WIB: a weekday, but a holiday.
    $at = CarbonImmutable::parse('2026-12-24 10:00', 'Asia/Jakarta');

    expect($quiet->isQuiet($at))->toBeTrue()
        // Skips the holiday Friday and the weekend: Monday 28 Dec 07.00 WIB.
        ->and($quiet->nextAllowed($at)->setTimezone('Asia/Jakarta')->format('D Y-m-d H:i'))->toBe('Mon 2026-12-28 07:00');

    // Wed 23 Dec evening: the next morning is a holiday too.
    expect($quiet->nextAllowed(CarbonImmutable::parse('2026-12-23 20:00', 'Asia/Jakarta'))->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'))->toBe('2026-12-28 07:00')
        // An ordinary working day stays as it was.
        ->and($quiet->isQuiet(CarbonImmutable::parse('2026-12-23 10:00', 'Asia/Jakarta')))->toBeFalse();
});
