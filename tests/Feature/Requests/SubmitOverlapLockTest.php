<?php

use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;

/*
 * Review finding 7: the overlap check of SubmitRequest runs inside the
 * transaction under a per-user lock, so two parallel submissions of the same
 * person cannot both pass it.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

afterEach(function () {
    DB::purge('locker');
});

it('checks overlaps inside the transaction after taking the per-user lock', function () {
    $s = $this->s;
    $log = [];
    DB::listen(function (QueryExecuted $query) use (&$log): void {
        $log[] = ['sql' => $query->sql, 'level' => DB::transactionLevel()];
    });

    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    $lock = collect($log)->search(fn ($q) => str_contains($q['sql'], 'pg_advisory_xact_lock'));
    $overlap = collect($log)->search(fn ($q) => str_contains($q['sql'], 'from "requests"') && str_contains($q['sql'], '"start_at" <'));

    expect($lock)->not->toBeFalse()
        ->and($overlap)->not->toBeFalse()
        ->and($overlap)->toBeGreaterThan($lock)
        // RefreshDatabase is level 1; the action's own transaction is level 2.
        ->and($log[$lock]['level'])->toBeGreaterThanOrEqual(2)
        ->and($log[$overlap]['level'])->toBe($log[$lock]['level']);
});

it('waits for a parallel submission of the same person (and only that person)', function () {
    $s = $this->s;
    config(['database.connections.locker' => config('database.connections.'.config('database.default'))]);
    $locker = DB::connection('locker');

    // Another session is in the middle of submitting for the employee.
    $locker->select('select pg_advisory_lock(hashtextextended(?, 0))', ['requests.submit:'.$s->employee->id]);
    DB::statement("SET LOCAL lock_timeout = '300ms'");

    try {
        expect(fn () => $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']))
            ->toThrow(QueryException::class, 'lock timeout');

        // Somebody else is not blocked.
        expect($s->submit($s->manager, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13'])->number)->not->toBeNull();
    } finally {
        $locker->select('select pg_advisory_unlock_all()');
    }
});
