<?php

use App\Domain\Requests\Actions\SaveRequestDraft;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\RequestDurationCalculator;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->calc = app(RequestDurationCalculator::class);
});

it('counts working days without weekends', function () {
    // Fri 9 – Tue 13 Oct = Fri, Mon, Tue.
    $period = $this->calc->compute($this->s->employee, RequestScenario::input($this->s->annual, ['start_date' => '2026-10-09', 'end_date' => '2026-10-13']));

    expect($period->days)->toBe(3.0)
        ->and($period->workDates)->toBe(['2026-10-09', '2026-10-12', '2026-10-13'])
        ->and($period->startAt->toIso8601String())->toBe('2026-10-08T17:00:00+00:00')
        ->and($period->endAt->toIso8601String())->toBe('2026-10-13T16:59:59+00:00');
});

it('uses the bound working-day calendar', function () {
    app()->instance(WorkingDayCalculator::class, new class implements WorkingDayCalculator
    {
        public function workingDates(User $user, CarbonImmutable $from, CarbonImmutable $to): array
        {
            return ['2026-10-12'];
        }

        public function crossesMidnight(User $user, CarbonImmutable $date): bool
        {
            return false;
        }
    });

    $period = app(RequestDurationCalculator::class)->compute($this->s->employee, RequestScenario::input($this->s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']));

    expect($period->days)->toBe(1.0);
});

it('rejects a range without working days', function () {
    expect(fn () => $this->calc->compute($this->s->employee, RequestScenario::input($this->s->annual, ['start_date' => '2026-10-10', 'end_date' => '2026-10-11'])))
        ->toThrow(ValidationException::class, 'Rentang tanggal tidak berisi hari kerja.');
});

it('allows half a day only for single-day types that permit it', function () {
    $s = $this->s;
    $half = $this->calc->compute($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true]));
    expect($half->days)->toBe(0.5)->and($half->payload['half_day'])->toBeTrue();

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'half_day' => true])))
        ->toThrow(ValidationException::class, 'Setengah hari hanya untuk pengajuan satu hari.');

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->sick, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'half_day' => true])))
        ->toThrow(ValidationException::class);
});

it('rejects quota leave across two years', function () {
    expect(fn () => $this->calc->compute($this->s->employee, RequestScenario::input($this->s->annual, ['start_date' => '2026-12-30', 'end_date' => '2027-01-04'])))
        ->toThrow(ValidationException::class);
});

it('computes overtime minutes, also past midnight', function () {
    $evening = $this->calc->compute($this->s->employee, RequestScenario::input($this->s->overtime, ['date' => '2026-10-03', 'start_time' => '17:00', 'end_time' => '20:30']));
    expect($evening->minutes)->toBe(210)->and($evening->days)->toBeNull();

    $night = $this->calc->compute($this->s->employee, RequestScenario::input($this->s->overtime, ['date' => '2026-10-03', 'start_time' => '22:00', 'end_time' => '01:00']));
    expect($night->minutes)->toBe(180)
        ->and($night->endAt->toIso8601String())->toBe('2026-10-03T18:00:00+00:00');
});

it('computes hourly permits and rejects reversed hours', function () {
    $permit = $this->calc->compute($this->s->employee, RequestScenario::input($this->s->permit, ['date' => '2026-10-07', 'start_time' => '13:00', 'end_time' => '15:00']));
    expect($permit->minutes)->toBe(120)->and($permit->payload['mode'])->toBe('hours');

    expect(fn () => $this->calc->compute($this->s->employee, RequestScenario::input($this->s->permit, ['date' => '2026-10-07', 'start_time' => '15:00', 'end_time' => '13:00'])))
        ->toThrow(ValidationException::class);
});

it('limits corrections to recent past dates with at least one time', function () {
    $s = $this->s;
    $ok = $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-02', 'check_out' => '17:10']));
    expect($ok->payload)->toBe(['date' => '2026-10-02', 'check_in' => null, 'check_out' => '17:10']);

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-06', 'check_in' => '08:00'])))
        ->toThrow(ValidationException::class, 'Koreksi hanya untuk tanggal yang sudah lewat atau hari ini.');
    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-09-27', 'check_in' => '08:00'])))
        ->toThrow(ValidationException::class, 'Koreksi maksimal 7 hari ke belakang.');
    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($s->correction, ['date' => '2026-10-02'])))
        ->toThrow(ValidationException::class);
});

it('requires a destination for business trips', function () {
    expect(fn () => $this->calc->compute($this->s->employee, RequestScenario::input($this->s->trip, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13'])))
        ->toThrow(ValidationException::class, 'Tujuan dinas wajib diisi.');
});

it('refuses inactive types and types the user is not eligible for', function () {
    $s = $this->s;
    $big = LeaveType::factory()->create(['code' => 'CBR', 'name' => 'Cuti besar', 'min_service_months' => 72]);
    $s->employee->update(['joined_at' => '2024-01-01']);

    expect(fn () => $this->calc->compute($s->employee, RequestScenario::input($big, ['start_date' => '2026-10-12'])))->not->toThrow(Throwable::class);
    expect(fn () => app(SaveRequestDraft::class)->handle($s->employee, RequestScenario::input($big, ['start_date' => '2026-10-12'])))
        ->toThrow(ValidationException::class, 'Anda belum berhak atas Cuti besar.');

    $s->annual->update(['is_active' => false]);
    expect(fn () => app(SaveRequestDraft::class)->handle($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12'])))
        ->toThrow(ValidationException::class, 'Jenis pengajuan tidak tersedia.');
});

it('saves drafts without number, balance or steps', function () {
    $s = $this->s;
    $draft = app(SaveRequestDraft::class)->handle($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']));

    expect($draft->status)->toBe(RequestStatus::Draft)
        ->and($draft->number)->toBeNull()
        ->and($draft->approvals()->count())->toBe(0)
        ->and($draft->days)->toBe(3.0);

    $submitted = app(SubmitRequest::class)->handle($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']), $draft);

    expect($submitted->id)->toBe($draft->id)
        ->and($submitted->number)->toBe('CUT-2026-10-0001')
        ->and($submitted->round)->toBe(1);
});
