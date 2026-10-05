<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;
use Tests\Support\RequestScenario;

/*
 * Review finding 2: half-day leave and approved business trips must not block
 * the check-in, and the request link survives it.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    F::office();

    ShiftAssignment::factory()->for($this->s->employee)->for(Shift::factory()->create())->between('2026-01-01')->create();
    app(GiveAttendanceConsent::class)->handle($this->s->employee);
});

function approvedRequest(RequestScenario $s, EmployeeRequest $request): EmployeeRequest
{
    return $s->approve($s->hr, $s->approve($s->manager, $request));
}

function employeeDay(RequestScenario $s, string $date): AttendanceDay
{
    return AttendanceDay::query()->where('user_id', $s->employee->id)->whereDate('work_date', $date)->sole();
}

it('lets an employee check in and out on a half-day leave and keeps the request', function () {
    $s = $this->s;
    $request = approvedRequest($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]));

    $day = employeeDay($s, '2026-10-12');
    expect($day->status)->toBe(AttendanceStatus::Leave)
        ->and($day->request_portion)->toBe(RequestPortion::HalfDay)
        ->and($day->request_id)->toBe($request->id);

    $this->travelTo(F::at('2026-10-12 12:55'));
    expect(app(MyAttendance::class)->current($s->employee, CarbonImmutable::now())['action'])->toBe('check_in');

    F::checkIn($s->employee)->assertCreated()
        ->assertJsonPath('result.status', 'leave')
        ->assertJsonPath('result.lateMinutes', 0);

    $this->travelTo(F::at('2026-10-12 15:00'));
    F::checkIn($s->employee, type: 'out')->assertCreated()->assertJsonPath('result.status', 'leave');

    $day->refresh();
    expect($day->status)->toBe(AttendanceStatus::Leave)
        ->and($day->request_id)->toBe($request->id)
        ->and($day->request_portion)->toBe(RequestPortion::HalfDay)
        ->and($day->check_in_at)->not->toBeNull()
        ->and($day->check_out_at)->not->toBeNull()
        ->and($day->late_minutes)->toBe(0)
        ->and($day->early_leave_minutes)->toBe(0);

    // Closing the day keeps the request status.
    $this->travelTo(F::at('2026-10-13 00:30'));
    app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-12', 'Asia/Jakarta'));
    expect($day->refresh()->status)->toBe(AttendanceStatus::Leave);
});

it('still refuses a check-in on a full-day leave', function () {
    $s = $this->s;
    approvedRequest($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));

    expect(employeeDay($s, '2026-10-12')->request_portion)->toBe(RequestPortion::Full);

    $this->travelTo(F::at('2026-10-12 07:55'));
    expect(app(MyAttendance::class)->current($s->employee, CarbonImmutable::now())['action'])->toBe('unavailable');
    F::checkIn($s->employee)->assertUnprocessable()->assertJsonPath('reason', 'day_has_request');
});

it('accepts a remote check-in with a note on an approved business trip', function () {
    $s = $this->s;
    $trip = approvedRequest($s, $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'destination' => 'Bandung']));

    $this->travelTo(F::at('2026-10-12 08:20'));
    $current = app(MyAttendance::class)->current($s->employee, CarbonImmutable::now());
    expect($current['action'])->toBe('check_in')
        ->and($current['schedule']->allowsRemoteCheckIn())->toBeTrue();

    $far = ['latitude' => F::northOfOffice(120_000)];
    F::checkIn($s->employee, $far)->assertUnprocessable()->assertJsonPath('reason', 'note_required');

    F::checkIn($s->employee, [...$far, 'note' => 'Kunjungan gudang Bandung'])->assertCreated()
        ->assertJsonPath('result.method', 'wfh')
        ->assertJsonPath('result.status', 'business_trip')
        ->assertJsonPath('result.lateMinutes', 0);

    $day = employeeDay($s, '2026-10-12');
    expect($day->status)->toBe(AttendanceStatus::BusinessTrip)
        ->and($day->request_id)->toBe($trip->id)
        ->and(AttendanceLog::query()->sole()->method)->toBe(AttendanceMethod::Wfh);

    // Check-out from the field as well.
    $this->travelTo(F::at('2026-10-12 16:00'));
    F::checkIn($s->employee, [...$far, 'note' => 'Selesai kunjungan'], 'out')->assertCreated()
        ->assertJsonPath('result.status', 'business_trip');
});

it('links a half-day leave approved after the check-in without turning the day into an absence', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]);

    $this->travelTo(F::at('2026-10-12 07:55'));
    F::checkIn($s->employee)->assertCreated();

    $request = approvedRequest($s, $request);
    $day = employeeDay($s, '2026-10-12');

    expect($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->request_id)->toBe($request->id)
        ->and($day->request_portion)->toBe(RequestPortion::HalfDay);

    // Reverting the request leaves ordinary attendance.
    app(AttendanceEffects::class)->revert($request);
    expect($day->refresh()->request_id)->toBeNull()
        ->and($day->request_portion)->toBeNull()
        ->and($day->status)->toBe(AttendanceStatus::Present);
});
