<?php

use App\Domain\Analytics\Okr\KeyResultProgress;
use App\Domain\Analytics\Okr\ObjectiveProgress;
use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\OkrStatus;
use Carbon\CarbonImmutable;

/*
 * OKR formulas (docs/fitur/okr.md §4) with the same cases as
 * resources/js/features/okr/lib.test.ts, so server and browser agree.
 */

/**
 * @return array{start: float, target: float, current: float, weight: float}
 */
function krValues(float $start, float $target, float $current, float $weight = 1): array
{
    return ['start' => $start, 'target' => $target, 'current' => $current, 'weight' => $weight];
}

it('knows the quarter range, length, elapsed share and week', function () {
    $q4 = Quarter::parse('2026-Q4');

    expect($q4->start()->toDateString())->toBe('2026-10-01')
        ->and($q4->end()->toDateString())->toBe('2026-12-31')
        ->and($q4->days())->toBe(92)
        ->and(Quarter::parse('2026-Q1')->end()->toDateString())->toBe('2026-03-31')
        ->and(Quarter::of(CarbonImmutable::parse('2026-10-05'))->key())->toBe('2026-Q4')
        ->and($q4->elapsed(CarbonImmutable::parse('2026-10-05')))->toEqualWithDelta(5 / 92, 1e-9)
        ->and($q4->elapsed(CarbonImmutable::parse('2026-09-01')))->toBe(0.0)
        ->and(Quarter::parse('2026-Q3')->elapsed(CarbonImmutable::parse('2026-10-05')))->toBe(1.0)
        ->and($q4->week(CarbonImmutable::parse('2026-10-05')))->toBe(['week' => 1, 'weeks' => 14])
        ->and($q4->week(CarbonImmutable::parse('2026-10-08')))->toBe(['week' => 2, 'weeks' => 14])
        ->and($q4->previous()->key())->toBe('2026-Q3')
        ->and($q4->next()->key())->toBe('2027-Q1')
        ->and(Quarter::parse('2027-Q1')->previous()->key())->toBe('2026-Q4')
        ->and(Quarter::tryParse('2026-Q5'))->toBeNull()
        ->and(Quarter::tryParse(['2026-Q4']))->toBeNull();
});

it('uses the office date of a late-evening instant', function () {
    // 31 Dec 2026 20.00 WIB is still Q4 in the office, though 13.00 UTC.
    $evening = CarbonImmutable::parse('2026-12-31 20:00', 'Asia/Jakarta');

    expect(Quarter::of($evening)->key())->toBe('2026-Q4')
        ->and(Quarter::parse('2026-Q4')->elapsed($evening))->toBe(1.0);
});

it('handles rising, falling and flat targets', function () {
    expect(KeyResultProgress::display(0, 100, 50))->toBe(0.5)
        ->and(KeyResultProgress::display(14, 4, 9))->toBe(0.5)
        ->and(KeyResultProgress::raw(14, 4, 19))->toBe(-0.5)
        ->and(KeyResultProgress::display(14, 4, 19))->toBe(0.0)
        ->and(KeyResultProgress::display(0, 100, 140))->toBe(1.0)
        ->and(KeyResultProgress::raw(5, 5, 5))->toBe(1.0)
        ->and(KeyResultProgress::raw(5, 5, 4))->toBe(0.0)
        ->and(KeyResultProgress::forStatus(0, 10, -30))->toBe(-1.0);
});

it('averages by weight', function () {
    $items = [krValues(0, 100, 100, 3), krValues(0, 100, 0, 1)];
    $regressed = [krValues(0, 100, -50), krValues(0, 100, 50)];

    expect(ObjectiveProgress::weighted($items))->toBe(0.75)
        ->and(ObjectiveProgress::weighted([]))->toBe(0.0)
        // zero weights fall back to equal shares
        ->and(ObjectiveProgress::weighted(array_map(fn (array $kr): array => [...$kr, 'weight' => 0.0], $items)))->toBe(0.5)
        // the status variant lets a regression pull the average below the clamped one
        ->and(ObjectiveProgress::weighted($regressed))->toBe(0.25)
        ->and(ObjectiveProgress::weighted($regressed, true))->toBe(0.0);
});

it('derives the status from the gap to the elapsed share', function (float $progress, float $elapsed, OkrStatus $status) {
    expect(ObjectiveProgress::statusFor($progress, $elapsed))->toBe($status);
})->with([
    [0.5, 0.55, OkrStatus::OnTrack],
    [0.5, 0.6, OkrStatus::OnTrack],   // exactly −10 points
    [0.5, 0.7, OkrStatus::AtRisk],
    [0.5, 0.75, OkrStatus::AtRisk],   // exactly −25 points
    [0.5, 0.8, OkrStatus::Behind],
    [-0.3, 0.05, OkrStatus::Behind],
]);

it('summarizes the prototype objectives like the browser does', function () {
    $q4 = Quarter::parse('2026-Q4');
    $today = CarbonImmutable::parse('2026-10-05');

    // q4-ops-1: the bug count moved away from its start (2 → 3, target 0).
    $ops = ObjectiveProgress::summarize([
        krValues(140, 190, 148, 40),
        krValues(2, 0, 3, 30),
        krValues(3, 8, 3, 30),
    ], $q4, $today);

    expect($ops['status'])->toBe(OkrStatus::AtRisk)
        ->and($ops['regressed'])->toBe(1)
        ->and($ops['progress'])->toEqualWithDelta(0.4 * 0.16, 1e-9)
        ->and($ops['expected'])->toEqualWithDelta(5 / 92, 1e-9)
        ->and($ops['counts'])->toBe(['on_track' => 2, 'at_risk' => 0, 'behind' => 1]);

    // q4-imp-1: two key results behind their start → behind.
    $imp = ObjectiveProgress::summarize([
        krValues(8, 3, 11, 40),
        krValues(40, 60, 38, 30),
        krValues(70, 95, 70, 30),
    ], $q4, $today);

    expect($imp['status'])->toBe(OkrStatus::Behind)->and($imp['regressed'])->toBe(2);

    // q4-hr-1: progressing → on track.
    expect(ObjectiveProgress::summarize([krValues(90, 30, 85, 50), krValues(80, 95, 92, 50)], $q4, $today)['status'])
        ->toBe(OkrStatus::OnTrack)
        // closed quarter: elapsed 100%, the Q3 sprint objective (70%) is behind
        ->and(ObjectiveProgress::summarize([krValues(0, 240, 168, 70), krValues(0, 6, 4, 30)], Quarter::parse('2026-Q3'), $today)['status'])
        ->toBe(OkrStatus::Behind)
        ->and(ObjectiveProgress::summarize([], $q4, $today)['status'])->toBe(OkrStatus::OnTrack);
});
