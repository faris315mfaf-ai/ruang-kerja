<?php

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Cache\ArrayStore;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    $this->ws = Workspace::factory()->internal()->create();
});

function overdueFor(object $test, string $who, string $query = ''): int
{
    $value = null;
    $test->actingAs($test->org[$who])->get('/dashboard/divisi'.$query)
        ->assertInertia(function (Assert $page) use (&$value): void {
            // Not an arrow fn: it would capture $value by value.
            $page->loadDeferredProps(function (Assert $reload) use (&$value): void {
                $value = $reload->toArray()['props']['metrics']['kpis']['overdue_tasks']['value'];
            });
        });

    return (int) $value;
}

it('caches metric blocks for 5 minutes', function () {
    F::task($this->ws, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-01']);
    expect(overdueFor($this, 'kadiv'))->toBe(1);

    F::task($this->ws, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-02']);
    expect(overdueFor($this, 'kadiv'))->toBe(1); // cached

    $this->travel(4)->minutes();
    expect(overdueFor($this, 'kadiv'))->toBe(1);

    $this->travel(2)->minutes();
    expect(overdueFor($this, 'kadiv'))->toBe(2); // expired after 5 minutes
});

it('keys the cache by viewer and scope, never leaking between users', function () {
    F::task($this->ws, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-01']);
    F::task($this->ws, Cat::Todo, [$this->org['budi']], ['due_date' => '2026-10-01']);
    F::task($this->ws, Cat::Todo, [$this->org['budi']], ['due_date' => '2026-10-02']);

    // Same view, same filter, different people.
    expect(overdueFor($this, 'kadiv'))->toBe(1)
        ->and(overdueFor($this, 'kadivKeu'))->toBe(2)
        ->and(overdueFor($this, 'kadiv'))->toBe(1)
        // HR: whole company, then one division — separate entries.
        ->and(overdueFor($this, 'hr'))->toBe(3)
        ->and(overdueFor($this, 'hr', '?divisi='.$this->org['ops']->id))->toBe(1);
});

it('builds keys from view, viewer, block and filter', function () {
    $a = MetricCache::key(DashboardView::Division, $this->org['kadiv'], 'metrics', ['from' => '2026-10-05', 'division' => null]);
    $b = MetricCache::key(DashboardView::Division, $this->org['kadivKeu'], 'metrics', ['from' => '2026-10-05', 'division' => null]);
    $c = MetricCache::key(DashboardView::Division, $this->org['kadiv'], 'metrics', ['division' => null, 'from' => '2026-10-05']);

    expect($a)->not->toBe($b)
        ->and($a)->toBe($c)
        ->and($a)->toStartWith('analytics:v2:'.$this->org['kadiv']->company_id.':divisi:'.$this->org['kadiv']->id.':metrics:');
});

it('does not cache the live attendance block', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->where('attendance.counts.scheduled', 0));

    F::day($this->org['rizky'], '2026-10-07', AttendanceStatus::Present, ['check_in_at' => now()]);

    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->where('attendance.counts.present', 1));

    expect(Cache::getStore())->toBeInstanceOf(ArrayStore::class);
});
