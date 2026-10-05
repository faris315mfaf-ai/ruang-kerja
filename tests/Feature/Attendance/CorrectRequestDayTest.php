<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;
use Tests\Support\RequestScenario;

/*
 * Lead item (g): HR's manual correction works on half-day leave and business
 * trip days (e.g. a forgotten check-out) and keeps the request link/status.
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

function approveTripOrLeave(RequestScenario $s, EmployeeRequest $request): EmployeeRequest
{
    return $s->approve($s->hr, $s->approve($s->manager, $request));
}

function hrCorrectsDay(RequestScenario $s, array $fields): void
{
    test()->actingAs($s->hr)
        ->post(route('attendance.corrections.store'), ['user_id' => $s->employee->id, 'reason' => 'Lupa check-out, dikonfirmasi atasan', ...$fields])
        ->assertSessionHasNoErrors();
}

function requestDayOf(RequestScenario $s, string $date): AttendanceDay
{
    return AttendanceDay::query()->where('user_id', $s->employee->id)->whereDate('work_date', $date)->sole();
}

it('corrects a forgotten check-out on a half-day leave and keeps the request', function () {
    $s = $this->s;
    $request = approveTripOrLeave($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]));

    $this->travelTo(F::at('2026-10-12 12:55'));
    F::checkIn($s->employee)->assertCreated();

    $this->travelTo(F::at('2026-10-13 09:00'));
    hrCorrectsDay($s, ['work_date' => '2026-10-12', 'check_out' => '15:00']);

    $day = requestDayOf($s, '2026-10-12');
    expect($day->status)->toBe(AttendanceStatus::Leave)
        ->and($day->request_id)->toBe($request->id)
        ->and($day->request_portion)->toBe(RequestPortion::HalfDay)
        ->and($day->check_out_at?->equalTo(F::at('2026-10-12 15:00')))->toBeTrue()
        ->and($day->late_minutes)->toBe(0)
        ->and($day->early_leave_minutes)->toBe(0)
        ->and($day->work_minutes)->toBeGreaterThan(0);
});

it('corrects a forgotten check-out on a business trip and keeps Dinas', function () {
    $s = $this->s;
    $trip = approveTripOrLeave($s, $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'destination' => 'Bandung']));

    $this->travelTo(F::at('2026-10-12 08:20'));
    F::checkIn($s->employee, ['latitude' => F::northOfOffice(120_000), 'note' => 'Kunjungan gudang'])->assertCreated();

    $this->travelTo(F::at('2026-10-13 00:30'));
    app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-12', 'Asia/Jakarta'));
    expect(requestDayOf($s, '2026-10-12')->status)->toBe(AttendanceStatus::BusinessTrip);

    $this->travelTo(F::at('2026-10-13 09:00'));
    hrCorrectsDay($s, ['work_date' => '2026-10-12', 'check_out' => '16:00']);

    $day = requestDayOf($s, '2026-10-12');
    expect($day->status)->toBe(AttendanceStatus::BusinessTrip)
        ->and($day->request_id)->toBe($trip->id)
        ->and($day->late_minutes)->toBe(0)
        ->and($day->early_leave_minutes)->toBe(0);
});

it('still refuses to correct a full-day leave', function () {
    $s = $this->s;
    approveTripOrLeave($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));

    $this->travelTo(F::at('2026-10-13 09:00'));
    $this->actingAs($s->hr)
        ->post(route('attendance.corrections.store'), ['user_id' => $s->employee->id, 'work_date' => '2026-10-12', 'check_in' => '08:00', 'reason' => 'Ternyata masuk'])
        ->assertSessionHasErrors('work_date');

    expect(requestDayOf($s, '2026-10-12')->status)->toBe(AttendanceStatus::Leave);
});

it('corrects a half day approved after the check-in without late or early minutes', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]);

    $this->travelTo(F::at('2026-10-12 07:55'));
    F::checkIn($s->employee)->assertCreated();
    $request = approveTripOrLeave($s, $request);

    $this->travelTo(F::at('2026-10-13 09:00'));
    hrCorrectsDay($s, ['work_date' => '2026-10-12', 'check_in' => '08:30', 'check_out' => '12:00']);

    $day = requestDayOf($s, '2026-10-12');
    expect($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->request_id)->toBe($request->id)
        ->and($day->late_minutes)->toBe(0)
        ->and($day->early_leave_minutes)->toBe(0);
});
