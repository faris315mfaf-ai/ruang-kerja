<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\CancelApprovedRequest;
use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Notifications\RequestCanceledAfterApproval;
use App\Domain\Requests\Notifications\RequestNotification;
use App\Domain\Requests\Services\ApprovedCancellationPreview;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();

    // Mon–Fri 08.00–17.00.
    $this->shift = Shift::factory()->create();
    ShiftAssignment::factory()->for($this->s->employee)->for($this->shift)->between('2026-01-01')->create();
});

const VOID_REASON = 'Karyawan dipanggil kembali untuk audit stok.';

function approvedFully(RequestScenario $s, EmployeeRequest $request): EmployeeRequest
{
    return $s->approve($s->hr, $s->approve($s->manager, $request));
}

function voidRequest(User $actor, EmployeeRequest $request, string $reason = VOID_REASON): EmployeeRequest
{
    return app(CancelApprovedRequest::class)->handle($actor, $request, $reason);
}

function annualBalance(RequestScenario $s): LeaveBalance
{
    return LeaveBalance::query()->where(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026])->sole();
}

function dayOf(User $user, string $date): ?AttendanceDay
{
    return AttendanceDay::query()->where('user_id', $user->id)->whereDate('work_date', $date)->first();
}

it('cancels an approved leave: status, balance refund, attendance rows and audit', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']));

    expect(annualBalance($s)->used_days)->toBe(3.0)
        ->and(AttendanceDay::query()->where('request_id', $request->id)->count())->toBe(3);

    $canceled = voidRequest($s->hr, $request);

    expect($canceled->status)->toBe(RequestStatus::Canceled)
        ->and($canceled->canceled_by_id)->toBe($s->hr->id)
        ->and($canceled->canceled_at?->equalTo(now()))->toBeTrue()
        ->and($canceled->cancel_reason)->toBe(VOID_REASON)
        ->and($canceled->wasCanceledAfterApproval())->toBeTrue()
        ->and(annualBalance($s)->used_days)->toBe(0.0)
        ->and(annualBalance($s)->pending_days)->toBe(0.0)
        ->and(AttendanceDay::query()->where('user_id', $s->employee->id)->count())->toBe(0);

    $audit = AuditLog::query()->where('action', 'request.canceled_approved')->sole();

    expect($audit->user_id)->toBe($s->hr->id)
        ->and($audit->auditable_id)->toBe($request->id)
        ->and($audit->old_values)->toBe(['status' => 'approved'])
        ->and($audit->new_values)->toMatchArray(['status' => 'canceled', 'refunded_days' => 3, 'removed_dates' => ['2026-10-12', '2026-10-13', '2026-10-14'], 'has_reason' => true])
        ->and(json_encode($audit->new_values))->not->toContain('audit stok');
});

it('refunds exactly the days of the request and nothing else', function () {
    $s = $this->s;
    $half = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]));
    approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-19', 'end_date' => '2026-10-20']));
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-26', 'end_date' => '2026-10-26']);

    expect(annualBalance($s)->used_days)->toBe(2.5)->and(annualBalance($s)->pending_days)->toBe(1.0);

    voidRequest($s->hr, $half);

    expect(annualBalance($s)->used_days)->toBe(2.0)
        ->and(annualBalance($s)->pending_days)->toBe(1.0)
        ->and(annualBalance($s)->remaining())->toBe(10.0);
});

it('closes past dates again after a leave is canceled (no check-in = Alpha)', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']));

    $this->travelTo(CarbonImmutable::parse('2026-10-14 10:00', 'Asia/Jakarta'));
    foreach (['2026-10-12', '2026-10-13'] as $date) {
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse($date, 'Asia/Jakarta'));
        expect(dayOf($s->employee, $date)?->status)->toBe(AttendanceStatus::Leave);
    }

    // The confirm dialog warns about the dates that already passed.
    expect(app(ApprovedCancellationPreview::class)->for($request)['past_dates'])->toBe(['2026-10-12', '2026-10-13']);

    voidRequest($s->hr, $request);

    expect(dayOf($s->employee, '2026-10-12')?->status)->toBe(AttendanceStatus::Absent)
        ->and(dayOf($s->employee, '2026-10-13')?->status)->toBe(AttendanceStatus::Absent)
        // Today is closed by tonight's run, not now.
        ->and(dayOf($s->employee, '2026-10-14'))->toBeNull();
});

it('keeps days the employee worked on and unlinks them from a canceled business trip', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'destination' => 'Bandung']));
    dayOf($s->employee, '2026-10-12')?->update(['check_in_at' => CarbonImmutable::parse('2026-10-12 07:55', 'Asia/Jakarta')->utc()]);

    voidRequest($s->hr, $request);
    $worked = dayOf($s->employee, '2026-10-12');

    expect($worked?->status)->toBe(AttendanceStatus::Present)
        ->and($worked?->request_id)->toBeNull()
        ->and($worked?->request_portion)->toBeNull()
        ->and(dayOf($s->employee, '2026-10-13'))->toBeNull();
});

it('recalculates overtime minutes when approved overtime is canceled', function () {
    $s = $this->s;
    $day = AttendanceDay::factory()->for($s->employee)->on('2026-10-02')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-02 07:55', 'Asia/Jakarta')->utc(),
        'check_out_at' => CarbonImmutable::parse('2026-10-02 20:05', 'Asia/Jakarta')->utc(),
    ]);
    $first = approvedFully($s, $s->submit($s->employee, $s->overtime, ['date' => '2026-10-02', 'start_time' => '17:00', 'end_time' => '19:00']));
    approvedFully($s, $s->submit($s->employee, $s->overtime, ['date' => '2026-10-02', 'start_time' => '19:00', 'end_time' => '20:00']));
    expect($day->refresh()->overtime_minutes)->toBe(180);

    voidRequest($s->hr, $first);

    expect($day->refresh()->overtime_minutes)->toBe(60)
        ->and($day->status)->toBe(AttendanceStatus::Present);
});

it('restores the original times of a canceled attendance correction', function () {
    $s = $this->s;
    $day = AttendanceDay::factory()->for($s->employee)->on('2026-10-02')->create([
        'status' => AttendanceStatus::NeedsCorrection,
        'shift_id' => $this->shift->id,
        'scheduled_start' => CarbonImmutable::parse('2026-10-02 08:00', 'Asia/Jakarta')->utc(),
        'scheduled_end' => CarbonImmutable::parse('2026-10-02 17:00', 'Asia/Jakarta')->utc(),
        'check_in_at' => CarbonImmutable::parse('2026-10-02 07:55', 'Asia/Jakarta')->utc(),
        'note' => 'Lupa check-out',
    ]);
    $request = approvedFully($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-02', 'check_out' => '17:10']));
    expect($day->refresh()->status)->toBe(AttendanceStatus::Present)->and($day->work_minutes)->toBe(495);

    voidRequest($s->hr, $request);
    $day->refresh();

    expect($day->status)->toBe(AttendanceStatus::NeedsCorrection)
        ->and($day->check_in_at?->equalTo(CarbonImmutable::parse('2026-10-02 07:55', 'Asia/Jakarta')))->toBeTrue()
        ->and($day->check_out_at)->toBeNull()
        ->and($day->work_minutes)->toBe(0)
        ->and($day->note)->toBe('Lupa check-out')
        ->and(AuditLog::query()->where('action', 'attendance_day.correction_reverted')->where('auditable_id', $day->id)->exists())->toBeTrue();
});

it('removes a day a canceled correction created and closes it again', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-01', 'check_in' => '08:00', 'check_out' => '17:00']));
    expect(dayOf($s->employee, '2026-10-01')?->status)->toBe(AttendanceStatus::Present);

    voidRequest($s->hr, $request);

    // Re-closed: scheduled, no check-in → Alpha.
    expect(dayOf($s->employee, '2026-10-01')?->status)->toBe(AttendanceStatus::Absent)
        ->and(dayOf($s->employee, '2026-10-01')?->check_in_at)->toBeNull();
});

it('refuses to undo a correction when the day changed afterwards', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-01', 'check_in' => '08:00', 'check_out' => '17:00']));
    dayOf($s->employee, '2026-10-01')?->update(['check_out_at' => CarbonImmutable::parse('2026-10-01 18:00', 'Asia/Jakarta')->utc()]);

    expect(fn () => voidRequest($s->hr, $request))->toThrow(ValidationException::class, 'sudah berubah setelah koreksi');

    expect($request->refresh()->status)->toBe(RequestStatus::Approved)
        ->and($request->canceled_at)->toBeNull()
        ->and(AuditLog::query()->where('action', 'request.canceled_approved')->exists())->toBeFalse();
});

it('cancels hourly permits and procurement without touching attendance', function () {
    $s = $this->s;
    $worked = AttendanceDay::factory()->for($s->employee)->on('2026-10-12')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-12 07:55', 'Asia/Jakarta')->utc(),
    ]);
    $permit = approvedFully($s, $s->submit($s->employee, $s->permit, ['mode' => 'hours', 'date' => '2026-10-12', 'start_time' => '10:00', 'end_time' => '12:00']));
    $procurement = $s->approve($s->direksi, $s->approve($s->manager, $s->submit($s->employee, $s->procurement, [
        'item_name' => 'Kursi kerja', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 1500000, 'urgency' => 'biasa',
    ])));
    expect($permit->status)->toBe(RequestStatus::Approved)->and($procurement->status)->toBe(RequestStatus::Approved);

    expect(voidRequest($s->hr, $permit)->status)->toBe(RequestStatus::Canceled)
        ->and(voidRequest($s->hr, $procurement)->status)->toBe(RequestStatus::Canceled)
        ->and($worked->refresh()->status)->toBe(AttendanceStatus::Present)
        ->and(AttendanceDay::query()->count())->toBe(1);
});

it('lets only HR and Super Admin cancel approved requests of someone else in their company', function (Role $role, bool $allowed) {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));
    $actor = match ($role) {
        Role::Hr => $s->hr,
        Role::Direksi => $s->direksi,
        Role::KepalaDivisi => $s->manager,
        default => User::factory()->withRole($role)->create(),
    };

    expect($actor->can('cancelApproved', $request))->toBe($allowed);

    if ($allowed) {
        expect(voidRequest($actor, $request)->status)->toBe(RequestStatus::Canceled);
    } else {
        expect(fn () => voidRequest($actor, $request))->toThrow(AuthorizationException::class);
        expect($request->refresh()->status)->toBe(RequestStatus::Approved);
    }
})->with([
    'hr' => [Role::Hr, true],
    'super admin' => [Role::SuperAdmin, true],
    'direksi' => [Role::Direksi, false],
    'kepala divisi (approver)' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('never lets HR cancel their own request or one of another company', function () {
    $s = $this->s;
    $secondHr = User::factory()->withRole(Role::Hr)->managedBy($s->direksi)->create();
    $own = $s->approve($secondHr, $s->approve($s->direksi, $s->submit($s->hr, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12'])));
    expect($own->status)->toBe(RequestStatus::Approved);

    $outsider = User::factory()->withRole(Role::Hr)->forCompany(Company::factory()->create())->create();
    $theirs = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']));

    expect($s->hr->can('cancelApproved', $own))->toBeFalse()
        ->and($secondHr->can('cancelApproved', $own))->toBeTrue()
        ->and($outsider->can('cancelApproved', $theirs))->toBeFalse()
        ->and(fn () => voidRequest($s->hr, $own))->toThrow(AuthorizationException::class)
        ->and(fn () => voidRequest($outsider, $theirs))->toThrow(AuthorizationException::class);
});

it('only cancels approved requests and requires a reason', function () {
    $s = $this->s;
    $pending = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $rejected = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    app(RejectStep::class)->handle($s->manager, $rejected, 'Stok opname.');
    $approved = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']));

    expect(fn () => voidRequest($s->hr, $pending))->toThrow(ValidationException::class, 'Hanya pengajuan yang sudah disetujui')
        ->and(fn () => voidRequest($s->hr, $rejected))->toThrow(ValidationException::class, 'Hanya pengajuan yang sudah disetujui')
        ->and(fn () => voidRequest($s->hr, $approved, '  singkat  '))->toThrow(ValidationException::class, 'minimal 10 karakter')
        ->and(fn () => voidRequest($s->hr, $approved, str_repeat('a', 501)))->toThrow(ValidationException::class, 'maksimal 500 karakter')
        ->and($s->hr->can('cancelApproved', $pending))->toBeFalse()
        ->and($approved->refresh()->status)->toBe(RequestStatus::Approved);
});

it('refunds once when two cancels race on the same request', function () {
    $s = $this->s;
    $request = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']));
    $secondHr = User::factory()->withRole(Role::Hr)->managedBy($s->direksi)->create();
    // Both actors loaded the request while it was approved; the action re-reads it under a row lock.
    $staleA = EmployeeRequest::query()->findOrFail($request->id);
    $staleB = EmployeeRequest::query()->findOrFail($request->id);

    voidRequest($s->hr, $staleA);

    expect(fn () => voidRequest($secondHr, $staleB, 'Dibatalkan dua kali oleh HR lain.'))->toThrow(ValidationException::class, 'sudah dibatalkan');
    expect(annualBalance($s)->used_days)->toBe(0.0)
        ->and($request->refresh()->canceled_by_id)->toBe($s->hr->id)
        ->and(AuditLog::query()->where('action', 'request.canceled_approved')->count())->toBe(1);
});

it('notifies requester, approvers and substitute without the reason outside the app', function () {
    $s = $this->s;
    $substitute = User::factory()->managedBy($s->manager)->create(['name' => 'Bayu Saputra']);
    $request = approvedFully($s, $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));
    $leave = approvedFully($s, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-19', 'end_date' => '2026-10-19', 'substitute_id' => $substitute->id]));

    voidRequest($s->hr, $request);
    voidRequest($s->hr, $leave);

    Notification::assertSentTo($s->employee, RequestCanceledAfterApproval::class, function (RequestCanceledAfterApproval $n) use ($s, $request) {
        if ($n->request->id !== $request->id) {
            return false;
        }

        $external = $n->externalPayload($s->employee);
        $mail = $n->toMail($s->employee);

        expect($n->type())->toBe(NotificationType::RequestVoided)
            ->and($n->via($s->employee))->toContain(InAppChannel::class, 'mail')
            ->and($n->toArray($s->employee)['body'])->toBe(VOID_REASON)
            ->and($n->toArray($s->employee)['url'])->toBe('/pengajuan/'.$n->request->id)
            ->and($external->title)->toBe('Pengajuan Anda dibatalkan oleh Hana Pratiwi')
            ->and($external->body)->toBe(RequestNotification::NOTE_IN_APP)
            ->and((string) $mail->subject)->not->toContain('Sakit')
            ->and(json_encode($mail->viewData))->not->toContain('audit stok');

        return true;
    });

    foreach ([$s->manager, $substitute] as $other) {
        Notification::assertSentTo($other, RequestCanceledAfterApproval::class, function (RequestCanceledAfterApproval $n) use ($other) {
            expect($n->type())->toBe(NotificationType::RequestCanceled)
                ->and($n->toArray($other)['body'])->not->toContain('audit stok')
                ->and($n->toArray($other)['url'])->toBe('/persetujuan/'.$n->request->id);

            return true;
        });
    }

    // The canceling HR is not told about their own action.
    Notification::assertNotSentTo($s->hr, RequestCanceledAfterApproval::class);
});

it('records who canceled when the requester cancels before the decision', function () {
    $s = $this->s;
    $request = app(CancelRequest::class)->handle($s->employee, $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']));

    expect($request->canceled_by_id)->toBe($s->employee->id)
        ->and($request->canceled_at)->not->toBeNull()
        ->and($request->cancel_reason)->toBeNull()
        ->and($request->wasCanceledAfterApproval())->toBeFalse();
});
