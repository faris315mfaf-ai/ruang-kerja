<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\HrHub\Actions\RemindDailyReport;
use App\Domain\Reports\Notifications\DailyReportReminder;
use App\Models\DailyReport;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * "Ingatkan" in Ruang HR › Monitoring (keputusan pemilik 20 Okt 2026).
 * Monday 19 Oct 2026 16.00 WIB: everyone of homeWorld() is on shift.
 */

beforeEach(function () {
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-19 16:00', 'Asia/Jakarta'));
    $this->home = homeWorld();
    $this->foreign = foreignWorld();
    Notification::fake();
});

it('reminds everyone scheduled who has not sent today\'s report, once per person per day', function () {
    DailyReport::factory()->create([
        'user_id' => $this->home->kadiv->id,
        'company_id' => $this->home->kadiv->company_id,
        'report_date' => '2026-10-19',
        'submitted_at' => now(),
    ]);

    $first = app(RemindDailyReport::class)->handle($this->home->hr);

    Notification::assertSentTo($this->home->anggota, DailyReportReminder::class);
    Notification::assertNotSentTo($this->home->kadiv, DailyReportReminder::class);
    Notification::assertNotSentTo($this->foreign->anggota, DailyReportReminder::class);
    expect($first['sent'])->toBeGreaterThanOrEqual(1);

    // Again the same day: nobody new.
    expect(app(RemindDailyReport::class)->handle($this->home->hr))->toBe(['sent' => 0, 'skipped' => $first['sent']]);

    // The automatic 16.30 reminder keeps its own slot (cycle = the date).
    $this->travelTo(CarbonImmutable::parse('2026-10-20 16:00', 'Asia/Jakarta'));
    expect(app(RemindDailyReport::class)->handle($this->home->hr, [$this->home->anggota->id])['sent'])->toBe(1);
});

it('skips chosen people who already reported or are of another company', function () {
    DailyReport::factory()->create([
        'user_id' => $this->home->anggota->id,
        'company_id' => $this->home->anggota->company_id,
        'report_date' => '2026-10-19',
        'submitted_at' => now(),
    ]);

    $result = app(RemindDailyReport::class)->handle($this->home->hr, [$this->home->anggota->id, $this->foreign->anggota->id]);

    expect($result)->toBe(['sent' => 0, 'skipped' => 1]);
    Notification::assertNothingSent();
});

it('is only for HR and Super Admin', function () {
    expect(fn () => app(RemindDailyReport::class)->handle($this->home->kadiv))->toThrow(AuthorizationException::class);
});
