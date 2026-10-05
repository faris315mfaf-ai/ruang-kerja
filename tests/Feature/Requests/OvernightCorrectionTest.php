<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Requests\Services\RequestDurationCalculator;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

/*
 * Review finding 3: attendance corrections for night shifts (check-out on the
 * next morning).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->calc = app(RequestDurationCalculator::class);
});

function nightShiftFor(RequestScenario $s): void
{
    ShiftAssignment::factory()->for($s->employee)->for(Shift::factory()->night()->create())->between('2026-01-01')->create();
}

it('accepts a check-out after midnight for a night shift and applies it on the next day', function () {
    $s = $this->s;
    nightShiftFor($s);

    $period = $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-01', 'check_in' => '22:05', 'check_out' => '06:10']));
    expect($period->payload)->toBe(['date' => '2026-10-01', 'check_in' => '22:05', 'check_out' => '06:10']);

    $request = $s->submit($s->employee, $s->correction, ['date' => '2026-10-01', 'check_in' => '22:05', 'check_out' => '06:10']);
    $s->approve($s->hr, $s->approve($s->manager, $request));

    $day = AttendanceDay::query()->where('user_id', $s->employee->id)->sole();
    expect($day->check_in_at?->equalTo(CarbonImmutable::parse('2026-10-01 22:05', 'Asia/Jakarta')))->toBeTrue()
        ->and($day->check_out_at?->equalTo(CarbonImmutable::parse('2026-10-02 06:10', 'Asia/Jakarta')))->toBeTrue()
        ->and($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->work_minutes)->toBe(8 * 60 + 5 - 30);
});

it('caps an overnight correction at 16 hours', function () {
    $s = $this->s;
    nightShiftFor($s);

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-01', 'check_in' => '13:00', 'check_out' => '06:00'])))
        ->toThrow(ValidationException::class, 'Jam kerja lintas tengah malam maksimal 16 jam.');
});

it('still rejects check-out before check-in for a day shift', function () {
    $s = $this->s;
    ShiftAssignment::factory()->for($s->employee)->for(Shift::factory()->create())->between('2026-01-01')->create();

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-01', 'check_in' => '22:00', 'check_out' => '06:00'])))
        ->toThrow(ValidationException::class, 'Jam pulang harus setelah jam masuk');
    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-01', 'check_in' => '08:00', 'check_out' => '08:00'])))
        ->toThrow(ValidationException::class);
});
