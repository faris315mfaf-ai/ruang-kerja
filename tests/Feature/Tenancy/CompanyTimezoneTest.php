<?php

use App\Domain\Analytics\Data\Period;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Briefings\Support\BriefingDay;
use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Reports\Support\ReportDay;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

/*
 * Fase 1 multi-perusahaan, Langkah 2b: every office date and clock time is
 * computed in the timezone of the current company (companies.timezone),
 * with config('app.office_timezone') when there is no company.
 */

beforeEach(function () {
    $this->jakarta = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $this->makassar = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    $this->jayapura = Company::factory()->create(['timezone' => 'Asia/Jayapura']);

    // 23.30 WIB = 00.30 WITA = 01.30 WIT the next day.
    $this->travelTo(CarbonImmutable::parse('2026-10-20 16:30:00', 'UTC'));
});

test('office helpers follow the company of the context', function () {
    $context = app(CompanyContext::class);
    $instant = CarbonImmutable::now();

    $dates = fn (): array => [
        CurrentCompany::timezone(),
        OfficeTime::todayString(),
        OfficeClock::time($instant),
        ProjectClock::today()->toDateString(),
        ScheduleResolver::officeDate($instant)->toDateString(),
        Period::officeDate($instant)->toDateString(),
        ReportDay::today(),
        BriefingDay::today(),
    ];

    expect($dates())->toBe(['Asia/Jakarta', '2026-10-20', '23.30', '2026-10-20', '2026-10-20', '2026-10-20', '2026-10-20', '2026-10-20'])
        ->and($context->run($this->makassar, $dates))->toBe(['Asia/Makassar', '2026-10-21', '00.30', '2026-10-21', '2026-10-21', '2026-10-21', '2026-10-21', '2026-10-21'])
        ->and($context->run($this->jayapura, $dates))->toBe(['Asia/Jayapura', '2026-10-21', '01.30', '2026-10-21', '2026-10-21', '2026-10-21', '2026-10-21', '2026-10-21'])
        ->and(OfficeTime::at('2026-10-21', '08:00')->toIso8601String())->toBe('2026-10-21T01:00:00+00:00')
        ->and($context->run($this->jayapura, fn () => OfficeTime::at('2026-10-21', '08:00')->toIso8601String()))->toBe('2026-10-20T23:00:00+00:00');
});

test('requests of an employee use the timezone of their company', function () {
    Route::middleware('web')->get('_uji/zona', fn () => response()->json(['zone' => CurrentCompany::timezone(), 'today' => OfficeTime::todayString()]));

    $this->actingAs(User::factory()->create(['company_id' => $this->makassar->id]))
        ->get('/_uji/zona')
        ->assertJson(['zone' => 'Asia/Makassar', 'today' => '2026-10-21']);
});

test('a company only accepts an IANA timezone', function () {
    expect(fn () => Company::factory()->create(['timezone' => 'WITA']))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->makassar->update(['timezone' => 'GMT+8']))->toThrow(InvalidArgumentException::class)
        ->and($this->makassar->fresh()?->timezone)->toBe('Asia/Makassar')
        ->and(Company::factory()->create()->timezone)->toBe('Asia/Jakarta');
});

test('an invalid stored timezone falls back to the app timezone', function () {
    DB::table('companies')->where('id', $this->makassar->id)->update(['timezone' => 'Bukan/Zona']);

    expect(app(CompanyContext::class)->run($this->makassar->id, fn () => CurrentCompany::timezone()))
        ->toBe(config('app.office_timezone'));
});

test('the web shell and the app receive the company\'s office timezone', function () {
    $this->seed(RoleSeeder::class);
    $employee = User::factory()->forCompany($this->makassar)->withRole(Role::Anggota)->create();

    $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('officeTimezone', config('app.office_timezone')));
    $this->actingAs($employee)->get('/dashboard')->assertInertia(fn (Assert $page) => $page->where('officeTimezone', 'Asia/Makassar'));

    Sanctum::actingAs($employee);
    $this->getJson('/api/v1/auth/saya')->assertOk()->assertJsonPath('user.office_timezone', 'Asia/Makassar');
});
