<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

test('the Absensi page shows today, allowed locations and consent state', function () {
    $user = F::employee(consent: false);
    OfficeLocation::factory()->inactive()->create();
    $this->travelTo(F::at('2026-10-05 07:52'));

    $this->actingAs($user)->get(route('attendance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/index')
            ->where('today.action', 'check_in')
            ->where('today.schedule.workDate', '2026-10-05')
            ->where('today.schedule.shiftName', 'Reguler')
            ->where('today.schedule.hours', '08.00–17.00')
            ->where('today.schedule.start', '2026-10-05T01:00:00Z')
            ->where('today.schedule.checkInOpensAt', '2026-10-04T23:00:00Z')
            ->where('today.schedule.lateThreshold', '2026-10-05T01:10:00Z')
            ->where('today.schedule.workModeLabel', 'Kantor')
            ->where('today.day', null)
            ->has('today.locations', 1)
            ->where('today.locations.0.name', 'Kantor Pusat')
            ->where('today.locations.0.radiusM', 100)
            ->where('consent.granted', false)
            ->where('consent.version', config('attendance.consent.version'))
            ->where('serverTime', '2026-10-05T00:52:00Z')
            ->missing('history')
            ->loadDeferredProps(fn (Assert $reload) => $reload->has('history', 0)));
});

test('after check-in the page offers check-out and the history lists the last 30 days', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-09-01')->create(); // older than 30 days
    AttendanceDay::factory()->for($user)->on('2026-10-02')->status(AttendanceStatus::Wfh)->create();
    AttendanceDay::factory()->for($user)->on('2026-10-01')->status(AttendanceStatus::Late)->create(['late_minutes' => 12]);

    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();
    $this->flushHeaders();

    $this->actingAs($user)->get(route('attendance.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('today.action', 'check_out')
            ->where('today.day.status', 'present')
            ->where('today.day.checkIn.locationName', 'Kantor Pusat')
            ->where('today.day.checkIn.methodLabel', 'GPS + selfie')
            ->where('today.day.checkIn.selfieUrl', fn ($url) => is_string($url) && str_contains($url, 'signature='))
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('history', 3)
                ->where('history.0.workDate', '2026-10-05')
                ->where('history.1.statusLabel', 'WFH')
                ->where('history.2.lateMinutes', 12)
                ->where('history.2.checkIn', null)));
});

test('the shell status follows the day', function () {
    $user = F::employee();
    $status = fn () => app(MyAttendance::class)->status($user, now()->toImmutable());

    $this->travelTo(F::at('2026-10-05 07:40'));
    expect($status())->toMatchArray(['action' => 'check_in', 'startLabel' => '08.00', 'shiftName' => 'Reguler', 'checkInAt' => null]);

    F::checkIn($user)->assertCreated();
    expect($status())->toMatchArray(['action' => 'check_out', 'locationName' => 'Kantor Pusat', 'status' => 'present', 'checkInAt' => '2026-10-05T00:40:00Z']);

    $this->travelTo(F::at('2026-10-05 17:10'));
    F::checkIn($user, type: 'out')->assertCreated();
    expect($status())->toMatchArray(['action' => 'done', 'checkOutAt' => '2026-10-05T10:10:00Z']);
});

test('the shell status loads the open day logs eagerly when yesterday was worked too', function () {
    $user = F::employee();

    $this->travelTo(F::at('2026-10-05 07:50'));
    F::checkIn($user)->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, type: 'out')->assertCreated();

    // Yesterday and today come back in one query: strict mode forbids lazy loading them.
    $this->travelTo(F::at('2026-10-06 07:45'));
    F::checkIn($user)->assertCreated();
    $this->flushHeaders();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('attendanceStatus.action', 'check_out')
            ->where('attendanceStatus.locationName', 'Kantor Pusat'));
});

test('the shell status shows holidays and request days', function () {
    $user = F::employee();
    Holiday::factory()->on('2026-10-05')->create();
    AttendanceDay::factory()->for($user)->on('2026-10-06')->status(AttendanceStatus::Sick)->create();
    $status = fn () => app(MyAttendance::class)->status($user, now()->toImmutable());

    $this->travelTo(F::at('2026-10-05 09:00'));
    expect($status())->toMatchArray(['action' => 'check_in', 'isHoliday' => true, 'shiftName' => null]);

    $this->travelTo(F::at('2026-10-06 09:00'));
    expect($status())->toMatchArray(['action' => 'unavailable', 'statusLabel' => 'Sakit']);
});

test('the shell status is shared once with every page', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:40'));

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('attendanceStatus.action', 'check_in')->where('attendanceStatus.startLabel', '08.00'));
});

test('guests are redirected to login', function () {
    $this->get(route('attendance.index'))->assertRedirect(route('login'));
});

test('an employee without schedule or locations still sees the page', function () {
    OfficeLocation::query()->delete();
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('attendance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('today.schedule.isWorkday', false)->has('today.locations', 0));
});

test('the shell status once-prop is keyed by user, so the guest null is never reused after login', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:40'));

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('attendanceStatus', null));

    $guestPage = $this->get(route('login'), ['X-Inertia' => 'true', 'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request())])->json();
    expect(array_keys($guestPage['onceProps']))->toContain('attendanceStatus:guest');

    $headers = fn (string $loaded): array => [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
        'X-Inertia-Except-Once-Props' => $loaded,
    ];

    // After signing in, the client still remembers the guest key: the status is resolved.
    $signedIn = $this->actingAs($user)->get(route('dashboard'), $headers('attendanceStatus:guest'))->json();
    expect($signedIn['props']['attendanceStatus']['action'] ?? null)->toBe('check_in')
        ->and(array_keys($signedIn['onceProps']))->toContain('attendanceStatus:'.$user->company_id.':'.$user->id);

    // Once the client holds this user's status, it is not sent again.
    $again = $this->actingAs($user)->get(route('dashboard'), $headers('attendanceStatus:'.$user->company_id.':'.$user->id))->json();
    expect($again['props'])->not->toHaveKey('attendanceStatus');
});
