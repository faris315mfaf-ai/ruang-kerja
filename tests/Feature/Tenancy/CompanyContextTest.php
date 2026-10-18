<?php

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Tenancy\CompanyContext;
use App\Http\Middleware\RestrictKioskDevice;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\Support\Tenancy\CompanyProbeJob;
use Tests\Support\Tenancy\CompanyProbeNotification;

/*
 * Fase 1 multi-perusahaan, Langkah 1: CompanyContext, ResolveCompanyContext
 * and CompanyAware (docs/sesi/fase1.md).
 */

beforeEach(function () {
    $this->home = Company::factory()->create(['timezone' => 'Asia/Jakarta']);
    $this->foreign = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    CompanyProbeJob::$seen = [];
    CompanyProbeNotification::$seen = [];

    $probe = fn () => response()->json(['company' => app(CompanyContext::class)->id()]);
    Route::middleware('web')->get('_uji/konteks', $probe);
    Route::middleware('web')->get('_uji/kiosk', $probe)->name('kiosk.uji-konteks');
    Route::middleware(['api', 'auth:sanctum'])->get('api/_uji/konteks', $probe);
});

test('run() switches the company and restores the previous one, also on exceptions', function () {
    $context = app(CompanyContext::class);
    $context->set($this->home);

    expect($context->run($this->foreign->id, fn () => $context->id()))->toBe($this->foreign->id)
        ->and($context->id())->toBe($this->home->id);

    expect(fn () => $context->run($this->foreign, fn () => throw new RuntimeException('x')))->toThrow(RuntimeException::class);
    expect($context->id())->toBe($this->home->id)
        ->and($context->company()?->id)->toBe($this->home->id);
});

test('timezone() reads companies.timezone with the app timezone as fallback', function () {
    $context = app(CompanyContext::class);

    expect($context->timezone())->toBe(config('app.office_timezone'));

    $context->set($this->foreign->id);
    expect($context->timezone())->toBe('Asia/Makassar');
});

test('web requests run in the signed-in employee\'s company; guests have none', function () {
    $this->get('/_uji/konteks')->assertJson(['company' => null]);

    $user = User::factory()->create(['company_id' => $this->foreign->id]);

    $this->actingAs($user)->get('/_uji/konteks')->assertJson(['company' => $this->foreign->id]);
});

test('API requests run in the token user\'s company', function () {
    Sanctum::actingAs(User::factory()->create(['company_id' => $this->foreign->id]));

    $this->getJson('/api/_uji/konteks')->assertJson(['company' => $this->foreign->id]);
});

test('kiosk devices run in the kiosk\'s company', function () {
    $office = OfficeLocation::factory()->create(['company_id' => $this->foreign->id]);
    $kiosk = Kiosk::factory()->at($office)->paired()->create();

    Auth::guard('kiosk')->setUser($kiosk);

    $this->withSession([RestrictKioskDevice::SESSION_KEY => RestrictKioskDevice::marker($kiosk)])
        ->get('/_uji/kiosk')
        ->assertJson(['company' => $this->foreign->id]);
});

test('queued jobs run in the company they were dispatched in, then restore the caller\'s', function () {
    $context = app(CompanyContext::class);
    $context->set($this->home);

    // A statement, not an arrow fn: PendingDispatch dispatches when destructed.
    $context->run($this->foreign, function (): void {
        CompanyProbeJob::dispatch();
    });

    expect(CompanyProbeJob::$seen)->toBe([$this->foreign->id])
        ->and($context->id())->toBe($this->home->id);
});

test('without a context, a job takes the company of its first model', function () {
    $user = User::factory()->create(['company_id' => $this->foreign->id]);

    CompanyProbeJob::dispatch($user);
    CompanyProbeJob::dispatch();

    expect(CompanyProbeJob::$seen)->toBe([$this->foreign->id, null])
        ->and(app(CompanyContext::class)->id())->toBeNull();
});

test('queued notifications render in the recipient\'s company', function () {
    $user = User::factory()->create(['company_id' => $this->foreign->id]);

    $user->notify(new CompanyProbeNotification);

    expect(CompanyProbeNotification::$seen)->not->toBeEmpty()
        ->each->toBe($this->foreign->id);
});
