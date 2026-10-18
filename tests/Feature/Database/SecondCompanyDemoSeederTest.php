<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Organization\Demo\DemoCompany;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\Meeting;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\SecondCompanyDemoSeeder;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Second demo company for manual multi-company checks (Fase 1 multi-perusahaan).
 */

function seedSecondCompany(): Company
{
    $seeder = new SecondCompanyDemoSeeder;
    $seeder->targetEmployees = 12;
    $seeder->days = 7;
    $seeder->setContainer(app())->__invoke();

    return Company::query()->where('google_domain', SecondCompanyDemoSeeder::GOOGLE_DOMAIN)->sole();
}

beforeEach(function () {
    // Wednesday 09.00 WITA.
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Makassar'));
});

it('seeds PT Contoh Mitra next to the demo company, idempotently and without touching it', function () {
    $this->seed(DatabaseSeeder::class);
    $demo = DemoCompany::ensure();
    $demoUsers = User::query()->where('company_id', $demo->id)->count();
    $demoRequests = EmployeeRequest::query()->where('company_id', $demo->id)->count();

    $company = seedSecondCompany();
    $counts = fn (): array => [
        User::query()->where('company_id', $company->id)->count(),
        Workspace::query()->where('company_id', $company->id)->count(),
        Task::query()->whereIn('workspace_id', Workspace::query()->where('company_id', $company->id)->select('id'))->count(),
        EmployeeRequest::query()->where('company_id', $company->id)->count(),
        Meeting::query()->where('company_id', $company->id)->count(),
        AttendanceDay::query()->whereIn('user_id', User::query()->where('company_id', $company->id)->select('id'))->count(),
    ];
    $first = $counts();
    seedSecondCompany();

    expect($counts())->toBe($first)
        ->and($company->name)->toBe('PT Contoh Mitra')
        ->and($company->timezone)->toBe('Asia/Makassar')
        ->and($first[0])->toBe(12)
        ->and($first[3])->toBe(2)
        ->and($first[4])->toBe(2)
        ->and($first[5])->toBeGreaterThan(20)
        // The demo company is untouched.
        ->and(User::query()->where('company_id', $demo->id)->count())->toBe($demoUsers)
        ->and(EmployeeRequest::query()->where('company_id', $demo->id)->count())->toBe($demoRequests);

    // Per-company keys: both companies have a KEU division workspace, request numbers start at 0001.
    expect(Workspace::query()->where('key', 'KEU')->pluck('company_id')->sort()->values()->all())
        ->toBe(collect([$demo->id, $company->id])->sort()->values()->all());

    $numbers = EmployeeRequest::query()->where('company_id', $company->id)->orderBy('number')->pluck('number')->all();
    expect($numbers[0])->toEndWith('-0001')->and($numbers[1])->toEndWith('-0002');

    // Today's meeting is at 10.00 office time (WITA = 02.00 UTC).
    expect(Meeting::query()->where('company_id', $company->id)->where('title', 'Koordinasi armada Makassar–Parepare')->sole()->starts_at->utc()->format('H:i'))->toBe('02:00');

    // Demo accounts have no password outside APP_ENV=local.
    foreach (DemoAccounts::partner() as $account) {
        $user = User::query()->where('email', $account->email)->sole();

        expect($user->company_id)->toBe($company->id)
            ->and($user->name)->toBe($account->name)
            ->and($user->getRoleNames()->all())->toBe([$account->role->value])
            ->and($user->password)->toBeNull();
    }
});

it('gives the demo accounts the demo password locally and lists them on the login page', function () {
    app()->instance('env', 'local');
    config(['app.demo_login' => true]);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->has('demoAccounts', count(DemoAccounts::all())));

    seedSecondCompany();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->has('demoAccounts', count(DemoAccounts::all()) + 3)
        ->where('demoAccounts.'.count(DemoAccounts::all()).'.email', 'admin@contoh.test'));

    expect(Hash::check('password', (string) User::query()->where('email', 'hr@contoh.test')->sole()->password))->toBeTrue();

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'admin@contoh.test'])
        ->assertRedirect('/dashboard');
    $this->assertAuthenticatedAs(User::query()->where('email', 'admin@contoh.test')->sole());
});

it('does not run in production', function () {
    app()->instance('env', 'production');

    (new SecondCompanyDemoSeeder)->setContainer(app())->__invoke();

    expect(Company::query()->where('google_domain', SecondCompanyDemoSeeder::GOOGLE_DOMAIN)->exists())->toBeFalse();
});
