<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Actions\SaveRequestDraft;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\SubmissionCutoff;
use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

/*
 * Batas pengajuan sakit & izin di hari-H (keputusan pemilik 14 Okt 2026):
 * before 12:00 office time on the day itself, never for past dates, any time
 * for future dates; null cutoff and other categories are untouched.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->s = RequestScenario::make();
    $this->s->sick->update(['submit_cutoff_time' => '12:00']);
    $this->s->permit->update(['submit_cutoff_time' => '12:00']);
    $this->s->sick->update(['requires_attachment_after_days' => null]);
    // Wed 14 Oct 2026, office time.
    $this->at = fn (string $time) => $this->travelTo(CarbonImmutable::parse("2026-10-14 {$time}", 'Asia/Jakarta'));
});

function sendOn(RequestScenario $s, $type, array $data): EmployeeRequest
{
    return $s->submit($s->employee, $type, $data);
}

function rejection(callable $callback): array
{
    try {
        $callback();
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('accepts sick for today before the cutoff and rejects it from 12:00:00', function (string $time, bool $accepted) {
    ($this->at)($time);

    $errors = rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14', 'reason' => 'Demam.']));

    if ($accepted) {
        expect($errors)->toBe([])->and(EmployeeRequest::query()->where('status', RequestStatus::Pending->value)->count())->toBe(1);
    } else {
        expect($errors['start_date'][0])->toBe('Batas pengajuan sakit untuk hari ini pukul 12.00 sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.')
            ->and(EmployeeRequest::query()->count())->toBe(0);
    }
})->with([
    'early morning' => ['06:30', true],
    'one minute before' => ['11:59', true],
    'last second before' => ['11:59:59', true],
    'at the cutoff' => ['12:00', false],
    'afternoon' => ['15:10', false],
    'evening' => ['23:50', false],
]);

it('applies the same rule to izin by days and by hours', function () {
    ($this->at)('12:30');

    expect(rejection(fn () => sendOn($this->s, $this->s->permit, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14'])))
        ->toHaveKey('start_date');

    $hours = rejection(fn () => sendOn($this->s, $this->s->permit, ['date' => '2026-10-14', 'start_time' => '15:00', 'end_time' => '17:00']));
    expect($hours['date'][0])->toBe('Batas pengajuan izin untuk hari ini pukul 12.00 sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.');

    ($this->at)('09:00');
    $accepted = sendOn($this->s, $this->s->permit, ['date' => '2026-10-14', 'start_time' => '15:00', 'end_time' => '17:00']);
    expect($accepted->status)->toBe(RequestStatus::Pending)->and($accepted->minutes)->toBe(120);
});

it('rejects past dates but accepts future dates at any time', function () {
    ($this->at)('09:00');

    $past = rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']));
    expect($past['start_date'][0])->toBe('Pengajuan sakit untuk tanggal yang sudah lewat tidak diterima, hari itu tercatat alpha. Hubungi HR bila perlu dikoreksi.');

    ($this->at)('18:45');
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-15', 'end_date' => '2026-10-15'])))->toBe([]);
    expect(rejection(fn () => sendOn($this->s, $this->s->permit, ['date' => '2026-10-16', 'start_time' => '10:00', 'end_time' => '11:00'])))->toBe([]);
});

it('judges a multi-day request by its start date only', function () {
    ($this->at)('14:00');

    // Starts today after the cutoff: refused although it runs on.
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-16'])))->toHaveKey('start_date');

    // Starts tomorrow: fine.
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-15', 'end_date' => '2026-10-16'])))->toBe([]);

    // Started in the past but ends today or later: still refused.
    EmployeeRequest::query()->delete();
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-12', 'end_date' => '2026-10-15'])))->toHaveKey('start_date');
});

it('has no cutoff when the type has none, and never touches cuti, lembur or dinas', function () {
    ($this->at)('15:00');
    $this->s->sick->update(['submit_cutoff_time' => null]);

    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14'])))->toBe([]);

    // Backdated annual leave, overtime and a business trip keep their own rules.
    $this->s->annual->update(['submit_cutoff_time' => '12:00']); // ignored: not sick/izin
    expect(rejection(fn () => sendOn($this->s, $this->s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12'])))->toBe([])
        ->and(rejection(fn () => sendOn($this->s, $this->s->overtime, ['date' => '2026-10-14', 'start_time' => '17:00', 'end_time' => '19:00'])))->toBe([])
        ->and(rejection(fn () => sendOn($this->s, $this->s->trip, ['start_date' => '2026-10-19', 'end_date' => '2026-10-19', 'destination' => 'Bandung'])))->toBe([]);
});

it('lets a draft be saved after the cutoff but refuses to send it', function () {
    ($this->at)('13:00');
    $input = RequestScenario::input($this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);

    $draft = app(SaveRequestDraft::class)->handle($this->s->employee, $input);
    expect($draft->status)->toBe(RequestStatus::Draft);

    expect(rejection(fn () => app(SubmitRequest::class)->handle($this->s->employee, $input, $draft)))->toHaveKey('start_date');
    expect($draft->refresh()->status)->toBe(RequestStatus::Draft)->and($draft->number)->toBeNull();

    // Moving the draft to tomorrow sends it.
    $moved = RequestScenario::input($this->s->sick, ['start_date' => '2026-10-15', 'end_date' => '2026-10-15']);
    expect(app(SubmitRequest::class)->handle($this->s->employee, $moved, $draft)->status)->toBe(RequestStatus::Pending);
});

it('keeps accepting the original date when a request is resent after a revision', function () {
    ($this->at)('09:00');
    $request = sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14', 'reason' => 'Demam.']);
    app(RequestRevision::class)->handle($this->s->manager, $request, 'Tolong jelaskan gejalanya.');

    ($this->at)('14:00');
    $same = RequestScenario::input($this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14', 'reason' => 'Demam tinggi sejak malam.']);
    $resent = app(SubmitRequest::class)->handle($this->s->employee, $same, $request->fresh());
    expect($resent->status)->toBe(RequestStatus::Pending)->and($resent->round)->toBe(2);

    // A changed date after the cutoff does not slip through the revision.
    app(RequestRevision::class)->handle($this->s->manager, $resent->fresh(), 'Ubah tanggal.');
    $other = RequestScenario::input($this->s->sick, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    expect(rejection(fn () => app(SubmitRequest::class)->handle($this->s->employee, $other, $resent->fresh())))->toHaveKey('start_date');
});

it('reports the client hints computed from the server clock', function () {
    $presenter = fn () => RequestPresenter::type($this->s->sick->fresh());

    ($this->at)('09:00');
    expect($presenter())->toMatchArray([
        'submit_cutoff_time' => '12:00',
        'submit_cutoff_label' => 'Batas pengajuan hari ini pukul 12.00',
        'submit_closed_today' => false,
    ]);

    ($this->at)('12:00');
    expect($presenter()['submit_closed_today'])->toBeTrue();

    $this->s->sick->update(['submit_cutoff_time' => null]);
    expect($presenter())->toMatchArray(['submit_cutoff_time' => null, 'submit_cutoff_label' => null, 'submit_closed_today' => false]);

    // Cuti never exposes a cutoff, whatever the column holds.
    expect(RequestPresenter::type($this->s->annual))->toMatchArray(['submit_cutoff_time' => null, 'submit_closed_today' => false]);
    expect(app(SubmissionCutoff::class)->hints($this->s->overtime)['submit_cutoff_time'])->toBeNull();
});

it('uses office time (not UTC) for the cutoff', function () {
    // 04:59 UTC is 11:59 in Jakarta, 05:00 UTC is 12:00.
    $this->travelTo(CarbonImmutable::parse('2026-10-14 04:59:30', 'UTC'));
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14'])))->toBe([]);

    EmployeeRequest::query()->delete();
    $this->travelTo(CarbonImmutable::parse('2026-10-14 05:00:00', 'UTC'));
    expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14'])))->toHaveKey('start_date');
});

describe('attendance interplay', function () {
    beforeEach(function () {
        $shift = Shift::factory()->create();
        ShiftAssignment::factory()->for($this->s->employee)->for($shift)->between('2026-01-01')->create();
    });

    it('turns the alpha of a request still pending at close-day into sick when approved later', function () {
        ($this->at)('08:30');
        $request = sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14', 'reason' => 'Demam.']);

        // Nobody decided before the 00:30 close-day job of the next night.
        $this->travelTo(CarbonImmutable::parse('2026-10-15 00:30', 'Asia/Jakarta'));
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-14', 'Asia/Jakarta'));
        $day = AttendanceDay::query()->where('user_id', $this->s->employee->id)->sole();
        expect($day->status)->toBe(AttendanceStatus::Absent)->and($day->request_id)->toBeNull();

        // The approval of a past date converts that day, exactly like any other request.
        $this->travelTo(CarbonImmutable::parse('2026-10-15 09:00', 'Asia/Jakarta'));
        $this->s->approve($this->s->hr, $this->s->approve($this->s->manager, $request));

        $day->refresh();
        expect($day->status)->toBe(AttendanceStatus::Sick)
            ->and($day->request_id)->toBe($request->id)
            ->and(AttendanceDay::query()->where('user_id', $this->s->employee->id)->count())->toBe(1);

        // A second close-day run keeps the converted day.
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-14', 'Asia/Jakarta'));
        expect($day->refresh()->status)->toBe(AttendanceStatus::Sick);
    });

    it('turns the alpha of an izin pending at close-day into izin when approved later', function () {
        ($this->at)('11:00');
        $request = sendOn($this->s, $this->s->permit, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14', 'reason' => 'Urusan keluarga.']);

        $this->travelTo(CarbonImmutable::parse('2026-10-15 00:30', 'Asia/Jakarta'));
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-14', 'Asia/Jakarta'));
        $this->s->approve($this->s->hr, $this->s->approve($this->s->manager, $request));

        expect(AttendanceDay::query()->where('user_id', $this->s->employee->id)->sole()->status)->toBe(AttendanceStatus::Permit);
    });

    it('leaves alpha when the request is rejected or canceled', function () {
        ($this->at)('08:30');
        $rejected = sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);
        app(RejectStep::class)->handle($this->s->manager, $rejected, 'Belum ada bukti.');

        $this->travelTo(CarbonImmutable::parse('2026-10-15 00:30', 'Asia/Jakarta'));
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-14', 'Asia/Jakarta'));
        expect(AttendanceDay::query()->where('user_id', $this->s->employee->id)->sole()->status)->toBe(AttendanceStatus::Absent);

        // Canceled before any decision: the day stays alpha too.
        ($this->at)('08:40');
        $other = $this->s->submit($this->s->employee, $this->s->permit, ['start_date' => '2026-10-15', 'end_date' => '2026-10-15']);
        app(CancelRequest::class)->handle($this->s->employee, $other);
        $this->travelTo(CarbonImmutable::parse('2026-10-16 00:30', 'Asia/Jakarta'));
        app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-15', 'Asia/Jakarta'));
        expect(AttendanceDay::query()->where('user_id', $this->s->employee->id)->whereDate('work_date', '2026-10-15')->sole()->status)->toBe(AttendanceStatus::Absent);
    });

    it('marks a day alpha at close when the cutoff passed with no request and no check-in', function () {
        ($this->at)('13:00');
        expect(rejection(fn () => sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14'])))->toHaveKey('start_date');

        $this->travelTo(CarbonImmutable::parse('2026-10-15 00:30', 'Asia/Jakarta'));
        $report = app(CloseAttendanceDay::class)->handle(CarbonImmutable::parse('2026-10-14', 'Asia/Jakarta'));

        expect($report->absent)->toBe(1)
            ->and(AttendanceDay::query()->where('user_id', $this->s->employee->id)->sole()->status)->toBe(AttendanceStatus::Absent);
    });

    it('does not turn a worked day into sick when a pending request is approved after the check-in', function () {
        ($this->at)('08:30');
        $request = sendOn($this->s, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);

        // Pending does not block the check-in (existing rule); the employee came to work anyway.
        AttendanceDay::factory()->for($this->s->employee)->on('2026-10-14')->create([
            'status' => AttendanceStatus::Present,
            'check_in_at' => CarbonImmutable::parse('2026-10-14 09:10', 'Asia/Jakarta')->utc(),
        ]);
        $this->s->approve($this->s->hr, $this->s->approve($this->s->manager, $request));

        expect(AttendanceDay::query()->where('user_id', $this->s->employee->id)->sole()->status)->toBe(AttendanceStatus::Present);
    });
});
