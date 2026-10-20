<?php

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\HrHub\Queries\HrCalendar;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\Candidate;
use App\Models\EmployeeRequest;
use App\Models\HiringPosition;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Ruang HR › Jadwal (keputusan pemilik 20 Okt 2026): company-wide leave,
 * interviews, holidays and (FEATURE_MEETINGS) meetings.
 */

beforeEach(function () {
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-20 08:00', 'Asia/Jakarta'));
    $this->home = homeWorld();
    $this->foreign = foreignWorld();

    // Leave of someone outside any division the HR leads: still on the HR calendar.
    $this->far = User::factory()->withRole(Role::Anggota)->create(['name' => 'Fajar Jauh']);
    $type = LeaveType::factory()->create(['name' => 'Cuti tahunan', 'category' => RequestCategory::Leave]);
    EmployeeRequest::factory()->status(RequestStatus::Approved)->create([
        'user_id' => $this->far->id,
        'leave_type_id' => $type->id,
        'start_at' => CarbonImmutable::parse('2026-10-21 00:00', 'Asia/Jakarta')->utc(),
        'end_at' => CarbonImmutable::parse('2026-10-22 23:59:59', 'Asia/Jakarta')->utc(),
    ]);
    EmployeeRequest::factory()->status(RequestStatus::Pending)->create([
        'user_id' => $this->far->id,
        'leave_type_id' => $type->id,
        'start_at' => CarbonImmutable::parse('2026-10-27 00:00', 'Asia/Jakarta')->utc(),
        'end_at' => CarbonImmutable::parse('2026-10-27 23:59:59', 'Asia/Jakarta')->utc(),
    ]);

    $position = HiringPosition::factory()->create(['title' => 'Staf Gudang']);
    Candidate::factory()->forPosition($position)->stage(CandidateStage::Interview)->create([
        'full_name' => 'Nadia Calon',
        'interview_at' => CarbonImmutable::parse('2026-10-23 10:00', 'Asia/Jakarta')->utc(),
        'interview_location' => 'Lobi',
    ]);
    Holiday::query()->create(['company_id' => $this->home->company->id, 'date' => '2026-10-28', 'name' => 'Sumpah Pemuda', 'type' => HolidayType::Company]);
});

it('puts company-wide leave, interviews and holidays on the month', function () {
    $calendar = app(HrCalendar::class)->forMonth($this->home->hr, 2026, 10);
    $kinds = fn (string $date): array => array_column($calendar['days'][$date] ?? [], 'title', 'kind');

    expect($calendar['from'])->toBe('2026-09-28')
        ->and($calendar['to'])->toBe('2026-11-01')
        ->and($kinds('2026-10-21'))->toMatchArray(['leave' => 'Fajar Jauh · Cuti tahunan'])
        ->and($kinds('2026-10-22'))->toHaveKey('leave')
        ->and($kinds('2026-10-23'))->toMatchArray(['interview' => 'Wawancara · Nadia Calon'])
        ->and($kinds('2026-10-27'))->not->toHaveKey('leave')
        ->and($kinds('2026-10-28'))->toMatchArray(['holiday' => 'Sumpah Pemuda']);

    $interview = collect($calendar['days']['2026-10-23'])->firstWhere('kind', 'interview');
    expect($interview['time'])->toBe('10.00')
        ->and($interview['subtitle'])->toBe('Staf Gudang · Lobi');

    // This week's agenda (Mon 19 – Sun 25 Oct).
    expect(collect($calendar['week'])->pluck('kind')->unique()->sort()->values()->all())->toContain('leave', 'interview')
        ->and(leaksForeign(json_encode($calendar)))->toBeFalse();
});

it('shows meetings only while the meetings feature is on', function () {
    // homeWorld(): Dimas (kadiv) holds a meeting today at 10.00; only meetings the viewer can see.
    $from = CarbonImmutable::parse('2026-10-01', 'Asia/Jakarta');
    $to = CarbonImmutable::parse('2026-11-01', 'Asia/Jakarta');

    config(['features.meetings' => true]);
    $on = collect(app(HrCalendar::class)->events($this->home->kadiv, $from, $to))->where('kind', 'meeting');

    config(['features.meetings' => false]);
    $off = collect(app(HrCalendar::class)->events($this->home->kadiv, $from, $to))->where('kind', 'meeting');

    expect($on)->toHaveCount(1)
        ->and($on->first()['time'])->toBe('10.00')
        ->and($off)->toBeEmpty();
});

it('lists today\'s agenda for the Ringkasan tab', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-23 07:00', 'Asia/Jakarta'));

    $agenda = app(HrCalendar::class)->day($this->home->hr, CarbonImmutable::now());

    expect(collect($agenda)->pluck('kind')->all())->toBe(['interview'])
        ->and($agenda[0]['href'])->toStartWith('/hiring/kandidat/');
});
