<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Services\RequestDurationCalculator;
use App\Models\AuditLog;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();

    // Mon–Fri 08.00–17.00 for the employee and a colleague.
    $this->shift = Shift::factory()->create();
    $this->colleague = User::factory()->managedBy($this->s->manager)->create(['name' => 'Bayu Saputra']);

    foreach ([$this->s->employee, $this->colleague] as $user) {
        ShiftAssignment::factory()->for($user)->for($this->shift)->between('2026-01-01')->create();
    }
});

function approveFully(RequestScenario $s, EmployeeRequest $request): EmployeeRequest
{
    return $s->approve($s->hr, $s->approve($s->manager, $request));
}

it('approved leave prevents close-day alpha', function () {
    $s = $this->s;
    approveFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));

    $this->travelTo(CarbonImmutable::parse('2026-10-13 00:30', 'Asia/Jakarta'));
    $report = app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-12', 'Asia/Jakarta'));

    $leave = AttendanceDay::query()->where('user_id', $s->employee->id)->sole();
    $absent = AttendanceDay::query()->where('user_id', $this->colleague->id)->sole();

    expect($leave->status)->toBe(AttendanceStatus::Leave)
        ->and($leave->request_id)->not->toBeNull()
        ->and($absent->status)->toBe(AttendanceStatus::Absent)
        ->and($report->absent)->toBe(1);
});

it('replaces an alpha written before the leave was approved', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);

    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:30', 'Asia/Jakarta'));
    app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'));
    expect(AttendanceDay::query()->where('user_id', $s->employee->id)->sole()->status)->toBe(AttendanceStatus::Absent);

    approveFully($s, $request);

    $day = AttendanceDay::query()->where('user_id', $s->employee->id)->sole();
    expect($day->status)->toBe(AttendanceStatus::Sick)->and($day->request_id)->toBe($request->id);

    // Closing again keeps it.
    app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'));
    expect($day->refresh()->status)->toBe(AttendanceStatus::Sick);
});

it('does not write attendance for rejected requests or override a day the employee worked', function () {
    $s = $this->s;
    $rejected = $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'destination' => 'Bandung']);
    app(RejectStep::class)->handle($s->manager, $rejected, 'Tidak perlu.');
    expect(AttendanceDay::query()->count())->toBe(0);

    AttendanceDay::factory()->for($s->employee)->on('2026-10-13')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-13 07:55', 'Asia/Jakarta')->utc(),
    ]);
    approveFully($s, $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-13', 'end_date' => '2026-10-14']));

    expect(AttendanceDay::query()->whereDate('work_date', '2026-10-13')->sole()->status)->toBe(AttendanceStatus::Present)
        ->and(AttendanceDay::query()->whereDate('work_date', '2026-10-14')->sole()->status)->toBe(AttendanceStatus::Permit);
});

it('counts working days from the shift schedule and holidays', function () {
    $s = $this->s;
    Holiday::factory()->on('2026-10-13', 'Libur perusahaan')->create(['company_id' => $s->employee->company_id]);

    // Mon 12 – Wed 14 with a holiday on Tuesday = 2 working days.
    $period = app(RequestDurationCalculator::class)->compute($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']));
    expect($period->days)->toBe(2.0)->and($period->workDates)->toBe(['2026-10-12', '2026-10-14']);

    // A Saturday shift counts; without any assignment the fallback is Mon–Fri minus holidays.
    ShiftAssignment::factory()->for($s->employee)->override('2026-10-17', $this->shift)->create();
    $weekend = app(RequestDurationCalculator::class)->compute($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-16', 'end_date' => '2026-10-18']));
    expect($weekend->workDates)->toBe(['2026-10-16', '2026-10-17']);

    $noSchedule = app(RequestDurationCalculator::class)->compute($s->manager, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']));
    expect($noSchedule->workDates)->toBe(['2026-10-12', '2026-10-14']);
});

it('adds approved overtime to the attendance day, also when the day is closed later', function () {
    $s = $this->s;
    $worked = AttendanceDay::factory()->for($s->employee)->on('2026-10-02')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-02 07:55', 'Asia/Jakarta')->utc(),
        'check_out_at' => CarbonImmutable::parse('2026-10-02 20:05', 'Asia/Jakarta')->utc(),
    ]);

    approveFully($s, $s->submit($s->employee, $s->overtime, ['date' => '2026-10-02', 'start_time' => '17:00', 'end_time' => '20:00']));
    expect($worked->refresh()->overtime_minutes)->toBe(180);

    // Approved before the day: the attendance row arrives later and is synced when closing.
    approveFully($s, $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:30']));
    $later = AttendanceDay::factory()->for($s->employee)->on('2026-10-07')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-07 07:50', 'Asia/Jakarta')->utc(),
        'check_out_at' => CarbonImmutable::parse('2026-10-07 19:40', 'Asia/Jakarta')->utc(),
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-08 00:30', 'Asia/Jakarta'));
    app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-07', 'Asia/Jakarta'));

    expect($later->refresh()->overtime_minutes)->toBe(150);
});

it('applies an approved attendance correction and audits it', function () {
    $s = $this->s;
    $day = AttendanceDay::factory()->for($s->employee)->on('2026-10-02')->create([
        'status' => AttendanceStatus::NeedsCorrection,
        'shift_id' => $this->shift->id,
        'scheduled_start' => CarbonImmutable::parse('2026-10-02 08:00', 'Asia/Jakarta')->utc(),
        'scheduled_end' => CarbonImmutable::parse('2026-10-02 17:00', 'Asia/Jakarta')->utc(),
        'check_in_at' => CarbonImmutable::parse('2026-10-02 07:55', 'Asia/Jakarta')->utc(),
    ]);

    approveFully($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-02', 'check_out' => '17:10']));
    $day->refresh();

    expect($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->check_out_at?->equalTo(CarbonImmutable::parse('2026-10-02 17:10', 'Asia/Jakarta')))->toBeTrue()
        ->and($day->work_minutes)->toBe(495)
        ->and($day->note)->toStartWith('Dikoreksi lewat KOR-2026-10-0001')
        ->and(AuditLog::query()->where('action', 'attendance_day.corrected')->count())->toBe(1);

    // A late check-in correction marks the day late.
    approveFully($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-01', 'check_in' => '08:40', 'check_out' => '17:00']));
    $late = AttendanceDay::query()->whereDate('work_date', '2026-10-01')->sole();
    expect($late->status)->toBe(AttendanceStatus::Late)->and($late->late_minutes)->toBeGreaterThan(0);
});

it('reverts absence rows written for a request', function () {
    $s = $this->s;
    $request = approveFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']));
    expect(AttendanceDay::query()->where('request_id', $request->id)->count())->toBe(2);

    app(AttendanceEffects::class)->revert($request);

    expect(AttendanceDay::query()->count())->toBe(0);
});
