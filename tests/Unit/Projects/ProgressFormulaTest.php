<?php

use App\Domain\Analytics\Projects\ActualProgress;
use App\Domain\Analytics\Projects\PlannedProgress;
use App\Domain\Analytics\Projects\ProjectFlags;
use App\Domain\Analytics\Projects\TaskTotals;
use App\Domain\Projects\Enums\ProjectFlag;
use Carbon\CarbonImmutable;

/*
 * PRD M10 formulas with hand-computed expectations.
 */

/**
 * @param  list<array{0: string, 1?: float|int|null}>  $rows  [category, estimate]
 */
function totals(array $rows): TaskTotals
{
    return TaskTotals::fromTasks(array_map(fn (array $row): array => ['category' => $row[0], 'estimate_hours' => $row[1] ?? null], $rows));
}

describe('actual progress', function () {
    it('is null without tasks', function () {
        expect(ActualProgress::calculate(new TaskTotals))->toBeNull()
            ->and(ActualProgress::calculate(totals([['canceled'], ['canceled']])))->toBeNull();
    });

    it('divides done tasks by all non-canceled tasks', function () {
        // 3 done of 8 non-canceled (2 canceled ignored) = 37.5%.
        $rows = [['done'], ['done'], ['done'], ['todo'], ['todo'], ['in_progress'], ['review'], ['backlog'], ['canceled'], ['canceled']];

        expect(ActualProgress::calculate(totals($rows)))->toBe(37.5);
    });

    it('stays within 0–100%', function () {
        expect(ActualProgress::calculate(totals([['todo'], ['backlog']])))->toBe(0.0)
            ->and(ActualProgress::calculate(totals([['done'], ['done'], ['canceled']])))->toBe(100.0)
            ->and(ActualProgress::clamp(120.0))->toBe(100.0)
            ->and(ActualProgress::clamp(-3.0))->toBe(0.0)
            // Inconsistent aggregates still clamp.
            ->and(ActualProgress::calculate(new TaskTotals(scope: 2, done: 3)))->toBe(100.0);
    });

    it('weights by estimate when exactly 80% of the scope has one', function () {
        // 4 of 5 estimated (80%): done 8h + 2h, open 6h + 4h, unestimated open task weighs the average 5h.
        // done = 10, total = 20 + 5 = 25 → 40%. Unweighted would be 2/5 = 40% too, so tilt it:
        $rows = [['done', 8], ['done', 2], ['todo', 6], ['todo', 4], ['todo', null]];
        expect(ActualProgress::usesEstimates(totals($rows)))->toBeTrue()
            ->and(ActualProgress::calculate(totals($rows)))->toBe(40.0);

        // done 18h of (18 + 1 + 1 + 1) + avg 5.25 → 18 / 26.25 = 68.57%; unweighted 1/5 = 20%.
        $rows = [['done', 18], ['todo', 1], ['todo', 1], ['todo', 1], ['todo', null]];
        expect(ActualProgress::calculate(totals($rows)))->toBe(68.57);
    });

    it('gives an unestimated done task the average weight', function () {
        // estimated: done 2h, open 6h, open 4h, open 8h (avg 5h); unestimated done → 5h.
        // done = 2 + 5 = 7; total = 20 + 5 = 25 → 28%.
        $rows = [['done', 2], ['todo', 6], ['todo', 4], ['todo', 8], ['done', null]];

        expect(ActualProgress::calculate(totals($rows)))->toBe(28.0);
    });

    it('counts tasks when fewer than 80% have an estimate', function () {
        // 3 of 5 estimated (60%) → 1 done of 5 = 20%, the 40h estimate is ignored.
        $rows = [['done', 40], ['todo', 1], ['todo', 1], ['todo'], ['todo']];

        expect(ActualProgress::usesEstimates(totals($rows)))->toBeFalse()
            ->and(ActualProgress::calculate(totals($rows)))->toBe(20.0);
    });

    it('ignores canceled tasks for the 80% rule and the weights', function () {
        // non-canceled: 4, all estimated → weighted: done 3h of 3+1+1+1 = 6h → 50%.
        $rows = [['done', 3], ['todo', 1], ['todo', 1], ['todo', 1], ['canceled'], ['canceled', 100]];

        expect(ActualProgress::calculate(totals($rows)))->toBe(50.0);
    });
});

describe('planned progress', function () {
    $start = CarbonImmutable::parse('2026-09-01');
    $target = CarbonImmutable::parse('2026-10-27');

    it('is (today − start) ÷ (target − start)', function () use ($start, $target) {
        // 34 of 56 days = 60.714…% → 60.71.
        expect(PlannedProgress::calculate($start, $target, CarbonImmutable::parse('2026-10-05')))->toBe(60.71);
    });

    it('is clamped to 0–100%', function () use ($start, $target) {
        expect(PlannedProgress::calculate($start, $target, CarbonImmutable::parse('2026-08-15')))->toBe(0.0)
            ->and(PlannedProgress::calculate($start, $target, $start))->toBe(0.0)
            ->and(PlannedProgress::calculate($start, $target, $target))->toBe(100.0)
            ->and(PlannedProgress::calculate($start, $target, CarbonImmutable::parse('2027-01-10')))->toBe(100.0);
    });

    it('ignores the time of day', function () use ($start, $target) {
        expect(PlannedProgress::calculate($start, $target, CarbonImmutable::parse('2026-10-05 23:59:59')))->toBe(60.71);
    });

    it('handles missing dates and a target on the start day', function () use ($start) {
        expect(PlannedProgress::calculate(null, $start, $start))->toBeNull()
            ->and(PlannedProgress::calculate($start, null, $start))->toBeNull()
            ->and(PlannedProgress::calculate($start, $start, $start->subDay()))->toBe(0.0)
            ->and(PlannedProgress::calculate($start, $start, $start))->toBe(100.0);
    });
});

describe('system flags', function () {
    it('flags behind exactly at −15 points', function (float $actual, float $planned, bool $behind) {
        $flags = ProjectFlags::evaluate($actual, $planned, 0, 1, 30);

        expect(in_array(ProjectFlag::Behind, $flags, true))->toBe($behind);
    })->with([
        'exactly −15' => [45.0, 60.0, true],
        '−15.04 rounds to −15.0' => [44.96, 60.0, true],
        '−14.9' => [45.1, 60.0, false],
        '−14.96 rounds to −15.0' => [45.04, 60.0, true],
        '−14.94 rounds to −14.9' => [45.06, 60.0, false],
        'ahead' => [80.0, 60.0, false],
        '−32' => [25.0, 57.0, true],
    ]);

    it('needs both actual and planned for the behind flag', function () {
        expect(ProjectFlags::variance(null, 50.0))->toBeNull()
            ->and(ProjectFlags::evaluate(null, 90.0, 0, 1, 30))->toBe([])
            ->and(ProjectFlags::evaluate(0.0, null, 0, 1, 30))->toBe([]);
    });

    it('flags a missed milestone', function () {
        expect(ProjectFlags::evaluate(50.0, 50.0, 1, 1, 30))->toBe([ProjectFlag::MissedMilestone])
            ->and(ProjectFlags::evaluate(50.0, 50.0, 0, 1, 30))->toBe([]);
    });

    it('flags an update older than 7 days', function (?int $age, ?int $tracked, bool $stale) {
        $flags = ProjectFlags::evaluate(50.0, 50.0, 0, $age, $tracked);

        expect(in_array(ProjectFlag::StaleUpdate, $flags, true))->toBe($stale);
    })->with([
        '7 days' => [7, 60, false],
        '8 days' => [8, 60, true],
        'today' => [0, 60, false],
        'never, tracked 7 days' => [null, 7, false],
        'never, tracked 8 days' => [null, 8, true],
        'never, no dates' => [null, null, false],
    ]);

    it('counts update age in office days', function () {
        $today = CarbonImmutable::parse('2026-10-05');

        // 2026-09-27 17:30 UTC = 2026-09-28 00:30 WIB → 7 days, not 8.
        expect(ProjectFlags::updateAgeDays(CarbonImmutable::parse('2026-09-27 17:30:00', 'UTC'), $today, 'Asia/Jakarta'))->toBe(7)
            ->and(ProjectFlags::updateAgeDays(CarbonImmutable::parse('2026-09-27 16:30:00', 'UTC'), $today, 'Asia/Jakarta'))->toBe(8)
            ->and(ProjectFlags::updateAgeDays(null, $today, 'Asia/Jakarta'))->toBeNull();
    });

    it('returns all three flags in order', function () {
        expect(ProjectFlags::evaluate(25.0, 57.0, 1, 9, 40))->toBe([ProjectFlag::Behind, ProjectFlag::MissedMilestone, ProjectFlag::StaleUpdate]);
    });
});
